const { query } = require("../db");
const DocumentRepository = require("./DocumentRepository");

const RETRIABLE_FAILURE_PATTERN =
  /timeout|timed out|429|rate limit|temporar|network|econn|reset|503|502|504|unavailable|dns|enotfound/i;
const PERMANENT_FAILURE_PATTERN =
  /404|410|not found|invalid pdf|corrupted pdf|encrypted pdf|unsupported file|no usable text|insufficient to create|too large for inline ocr/i;

const classifyProcessingFailure = (error, fallbackStage = "processing") => {
  const message = String(error?.message || error || "Document processing failed.")
    .normalize("NFKC")
    .slice(0, 2_000);
  const status = Number(error?.response?.status || error?.status || 0);
  let failureStage = fallbackStage;
  if (
    [401, 403, 404, 410, 415].includes(status) ||
    /pdf|download|401|403|404|410|forbidden|content[- ]type/i.test(message)
  ) {
    failureStage = "pdf";
  } else if (/ocr|scanned/i.test(message)) {
    failureStage = "ocr";
  } else if (/extract|usable text/i.test(message)) {
    failureStage = "extraction";
  } else if (/chunk|passage/i.test(message)) {
    failureStage = "chunking";
  } else if (/embed|pinecone|vector/i.test(message)) {
    failureStage = "embedding";
  } else if (/summary|model|openai/i.test(message)) {
    failureStage = "summary";
  }
  const permanent =
    [401, 403, 404, 410, 415].includes(status) ||
    PERMANENT_FAILURE_PATTERN.test(message);
  const retriable = !permanent && (
    !status ||
    RETRIABLE_FAILURE_PATTERN.test(message) ||
    status >= 500
  );
  return {
    failureStage,
    failureReason: message,
    readinessClass: permanent
      ? "processing_failed_permanent"
      : "processing_failed_retriable",
    readinessReason: message,
    retriable,
    permanent,
    details: {
      status: status || null,
      code: error?.code || null,
      provider: error?.response?.headers?.server || null,
      classifiedAt: new Date().toISOString(),
    },
  };
};

const enqueueProcessing = async (
  documentId,
  userId = null,
  {
    priority = 50,
    reason = "manual_prepare",
    maxAttempts = 3,
  } = {},
) => {
  const id = Number.parseInt(documentId, 10);
  if (!Number.isSafeInteger(id) || id <= 0) {
    const error = new Error("Document ID must be a positive integer.");
    error.status = 400;
    throw error;
  }
  const result = await query(
    `INSERT INTO document_processing_jobs (
       document_id, requested_by, priority, metadata_json,
       source_host, max_attempts
     )
     VALUES (
       $1, $2, $3, $4::jsonb,
       NULLIF(LOWER(SUBSTRING((
         SELECT COALESCE(pdf_url, canonical_url, source_url)
         FROM legislative_documents WHERE id = $1
       ) FROM '^[a-z]+://([^/:]+)')), ''),
       $5
     )
     ON CONFLICT (document_id)
       WHERE status IN ('queued', 'running')
     DO UPDATE SET
       priority = GREATEST(
         document_processing_jobs.priority,
         EXCLUDED.priority
       ),
       requested_by = COALESCE(
         EXCLUDED.requested_by,
         document_processing_jobs.requested_by
       ),
       metadata_json =
         document_processing_jobs.metadata_json || EXCLUDED.metadata_json,
       updated_at = NOW()
     RETURNING *`,
    [
      id,
      userId,
      Math.min(Math.max(Number(priority) || 50, 1), 100),
      JSON.stringify({ reason }),
      Math.min(Math.max(Number(maxAttempts) || 3, 1), 10),
    ],
  );
  return result.rows[0];
};

const verifyRetrieval = async (document) => {
  const { retrievePassages } = require("./documentResearchService");
  let lastError;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const passages = await retrievePassages(
        document.type,
        document.id,
        document.title,
        2,
      );
      if (passages.some((passage) => String(passage.content || "").trim())) {
        return true;
      }
    } catch (error) {
      lastError = error;
    }
    if (attempt === 0) {
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }
  if (lastError) throw lastError;
  return false;
};

const prepareDocument = async (
  documentId,
  {
    userId = null,
    priority = 100,
    reason = "manual_prepare",
    job: suppliedJob = null,
    workerId = null,
    discoverGraph = true,
  } = {},
) => {
  const startedAt = Date.now();
  const memoryStart = process.memoryUsage().rss;
  const document = await DocumentRepository.getById(documentId);
  if (!document) {
    const error = new Error("Document not found.");
    error.status = 404;
    throw error;
  }
  if (document.visibilityStatus === "hidden_invalid") {
    const error = new Error("Invalid or quarantined documents cannot be processed.");
    error.status = 422;
    throw error;
  }
  const { isExtractableSourceDocument } = require("./documentResearchService");
  if (!document.pdfUrl && !isExtractableSourceDocument(document)) {
    const error = new Error(
      document.sourceUrl
        ? "Only a source page is available; no verified PDF can be processed."
        : "No verified PDF or extractable source is available.",
    );
    error.status = 422;
    throw error;
  }
  const job = suppliedJob || await enqueueProcessing(document.id, userId, {
    priority,
    reason,
  });
  if (!suppliedJob) {
    const claimed = await query(
      `UPDATE document_processing_jobs
       SET status = 'running', attempt = attempt + 1,
           worker_id = COALESCE($2, worker_id, 'request'),
           claimed_at = NOW(), heartbeat_at = NOW(),
           started_at = COALESCE(started_at, NOW()), updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [job.id, workerId],
    );
    Object.assign(job, claimed.rows[0] || {});
  }
  const queueWaitMs = Math.max(
    0,
    new Date(job.claimed_at || Date.now()).getTime() -
      new Date(job.queued_at || Date.now()).getTime(),
  );
  await query(
    `INSERT INTO document_processing_attempts (
       job_id, document_id, worker_id, attempt, status, queue_wait_ms
     )
     VALUES ($1, $2, $3, $4, 'running', $5)
     ON CONFLICT (job_id, attempt) DO UPDATE SET
       worker_id = EXCLUDED.worker_id,
       status = 'running',
       queue_wait_ms = EXCLUDED.queue_wait_ms,
       started_at = NOW(),
       completed_at = NULL`,
    [
      job.id,
      document.id,
      workerId || job.worker_id || "request",
      Number(job.attempt || 1),
      queueWaitMs,
    ],
  );
  await DocumentRepository.updateProcessingStatus(
    document.id,
    "processing",
    null,
    {
      pdfStatus: "validating",
      extractionStatus: "processing",
      chunkingStatus: "not_started",
      embeddingStatus: "not_started",
      summaryStatus: "not_started",
      readinessClass: "processing_pending",
      readinessReason: "Document processing is in progress.",
    },
  );
  try {
    const { processDocument } = require("./documentResearchService");
    const result = await processDocument(document.type, document.id);
    const chunksCount = Number(
      result.chunksStored || result.totalChunks || 0,
    );
    if (chunksCount <= 0) {
      const error = new Error(
        "Processing completed without creating research passages.",
      );
      error.status = 422;
      throw error;
    }
    const retrievalStartedAt = Date.now();
    const retrievalVerified = await verifyRetrieval(document);
    const retrievalMs = Date.now() - retrievalStartedAt;
    if (!retrievalVerified) {
      const error = new Error(
        "Research passages were stored but retrieval verification failed.",
      );
      error.status = 503;
      throw error;
    }
    const artifact = result.textArtifact || {};
    const stageMetrics = {
      ...(result.stageMetrics || {}),
      retrievalMs,
      totalMs: Date.now() - startedAt,
    };
    await DocumentRepository.updateProcessingStatus(
      document.id,
      "ready",
      null,
      {
        pdfStatus: "valid",
        extractionStatus: "ready",
        ocrStatus: artifact.ocrUsed
          ? "ready"
          : artifact.ocrRequired
            ? "pending"
            : "not_required",
        chunkingStatus: "ready",
        embeddingStatus: "ready",
        summaryStatus: result.summary ? "ready" : "not_started",
        chunksCount,
        embeddingsCount: chunksCount,
        textLength: Number(result.textLength || 0),
        language:
          artifact.languageCode || result.language?.languageCode || "und",
        script: artifact.script || result.language?.script || "Unknown",
        isBilingual: Boolean(
          artifact.isBilingual || result.language?.isBilingual,
        ),
        embeddingProvider:
          process.env.OPENAI_EMBEDDING_MODEL || "text-embedding-3-large",
        aiProvider: "openai",
        retrievalVerified,
        readinessClass: "comparison_ready",
      },
    );
    await query(
      `UPDATE document_processing_jobs
       SET status = 'completed', completed_at = NOW(),
           failure_reason = NULL, updated_at = NOW(),
           duration_ms = $2, queue_wait_ms = $3,
           stage_metrics_json = $4::jsonb,
           usage_json = $5::jsonb, memory_peak_bytes = $6,
           heartbeat_at = NOW()
       WHERE id = $1`,
      [
        job.id,
        Date.now() - startedAt,
        queueWaitMs,
        JSON.stringify(stageMetrics),
        JSON.stringify(result.usage || {}),
        Math.max(memoryStart, process.memoryUsage().rss),
      ],
    );
    await query(
      `UPDATE document_processing_attempts
       SET status = 'completed', completed_at = NOW(),
           duration_ms = $3, stage_metrics_json = $4::jsonb,
           usage_json = $5::jsonb, memory_peak_bytes = $6
       WHERE job_id = $1 AND attempt = $2`,
      [
        job.id,
        Number(job.attempt || 1),
        Date.now() - startedAt,
        JSON.stringify(stageMetrics),
        JSON.stringify(result.usage || {}),
        Math.max(memoryStart, process.memoryUsage().rss),
      ],
    );
    if (discoverGraph) {
      const graphStartedAt = Date.now();
      try {
        const {
          discoverRelationshipsForDocument,
        } = require("../graph/relationshipEngine");
        const graph = await discoverRelationshipsForDocument(document.id, {
          verifyWithAI: false,
          candidateLimit: 60,
        });
        stageMetrics.graphMs = Date.now() - graphStartedAt;
        stageMetrics.relationshipsStored = graph.relationshipsStored;
        stageMetrics.totalMs = Date.now() - startedAt;
        await query(
          `UPDATE document_processing_jobs
           SET stage_metrics_json =
             stage_metrics_json || $2::jsonb, updated_at = NOW()
           WHERE id = $1`,
          [job.id, JSON.stringify({
            graphMs: stageMetrics.graphMs,
            relationshipsStored: graph.relationshipsStored,
          })],
        );
        await query(
          `UPDATE document_processing_attempts
           SET stage_metrics_json =
             stage_metrics_json || $3::jsonb,
             duration_ms = $4
           WHERE job_id = $1 AND attempt = $2`,
          [
            job.id,
            Number(job.attempt || 1),
            JSON.stringify({
              graphMs: stageMetrics.graphMs,
              relationshipsStored: graph.relationshipsStored,
            }),
            Date.now() - startedAt,
          ],
        );
      } catch (graphError) {
        console.warn(
          `Post-processing graph discovery failed for ${document.id}:`,
          graphError.message,
        );
      }
    }
    return {
      ...result,
      jobId: String(job.id),
      researchReady: true,
      comparisonReady: true,
      retrievalVerified,
      stageMetrics,
    };
  } catch (error) {
    const failure = classifyProcessingFailure(error);
    await DocumentRepository.updateProcessingStatus(
      document.id,
      "failed",
      failure.failureReason,
      {
        pdfStatus: failure.failureStage === "pdf" ? "invalid" : "available",
        failureStage: failure.failureStage,
        failureReason: failure.failureReason,
        failureDetails: failure.details,
        readinessClass: failure.readinessClass,
        readinessReason: failure.readinessReason,
      },
    );
    const nextStatus =
      failure.retriable && Number(job.attempt || 1) < Number(job.max_attempts || 3)
        ? "queued"
        : failure.permanent
          ? "dead_letter"
          : "failed";
    const retryDelaySeconds = Math.min(
      900,
      15 * 2 ** Math.max(Number(job.attempt || 1) - 1, 0),
    );
    const durationMs = Date.now() - startedAt;
    const memoryPeakBytes = Math.max(memoryStart, process.memoryUsage().rss);
    await query(
      `UPDATE document_processing_jobs
       SET status = $2,
           completed_at = CASE WHEN $2 = 'queued' THEN NULL ELSE NOW() END,
           next_attempt_at = CASE
             WHEN $2 = 'queued'
               THEN NOW() + ($4 * INTERVAL '1 second')
             ELSE next_attempt_at
           END,
           failure_reason = $3, duration_ms = $5,
           queue_wait_ms = $6, memory_peak_bytes = $7,
           heartbeat_at = NOW(), updated_at = NOW()
       WHERE id = $1`,
      [
        job.id,
        nextStatus,
        failure.failureReason,
        retryDelaySeconds,
        durationMs,
        queueWaitMs,
        memoryPeakBytes,
      ],
    );
    await query(
      `UPDATE document_processing_attempts
       SET status = $3, failure_stage = $4, failure_reason = $5,
           completed_at = NOW(), duration_ms = $6,
           memory_peak_bytes = $7
       WHERE job_id = $1 AND attempt = $2`,
      [
        job.id,
        Number(job.attempt || 1),
        nextStatus === "dead_letter" ? "dead_letter" : "failed",
        failure.failureStage,
        failure.failureReason,
        durationMs,
        memoryPeakBytes,
      ],
    );
    error.processingFailure = failure;
    throw error;
  }
};

const runReadinessAudit = async () => {
  const inserted = await query(`
    INSERT INTO document_processing_state (
      document_id, processing_status, extraction_status, embedding_status,
      summary_status, ocr_status, error_message, chunks_count,
      last_processed_at, pdf_status, chunking_status, embeddings_count,
      text_length, language, script, is_bilingual
    )
    SELECT
      document.id,
      COALESCE(legacy.processing_status, 'not_started'),
      CASE
        WHEN artifact.document_id IS NOT NULL THEN 'ready'
        WHEN legacy.processing_status = 'failed' THEN 'failed'
        ELSE 'not_started'
      END,
      CASE
        WHEN legacy.processing_status = 'ready' THEN 'ready'
        WHEN legacy.processing_status = 'failed' THEN 'failed'
        ELSE 'not_started'
      END,
      CASE
        WHEN artifact.english_summary IS NOT NULL THEN 'ready'
        WHEN legacy.processing_status = 'failed' THEN 'failed'
        ELSE 'not_started'
      END,
      CASE
        WHEN artifact.ocr_used THEN 'ready'
        WHEN artifact.ocr_required THEN 'pending'
        ELSE 'not_required'
      END,
      legacy.processing_error,
      COALESCE(NULLIF(artifact.metadata_json ->> 'chunks', '')::INTEGER, 0),
      legacy.processed_at,
      CASE WHEN legacy.pdf_url IS NULL THEN 'missing' ELSE 'available' END,
      CASE
        WHEN COALESCE(NULLIF(artifact.metadata_json ->> 'chunks', '')::INTEGER, 0) > 0
          THEN 'ready'
        ELSE 'not_started'
      END,
      CASE
        WHEN legacy.processing_status = 'ready'
          THEN COALESCE(NULLIF(artifact.metadata_json ->> 'chunks', '')::INTEGER, 0)
        ELSE 0
      END,
      COALESCE(LENGTH(artifact.original_text), 0),
      artifact.language_code,
      artifact.script,
      COALESCE(artifact.is_bilingual, FALSE)
    FROM documents document
    JOIN legislative_documents legacy ON legacy.id = document.id
    LEFT JOIN document_text_artifacts artifact
      ON artifact.document_id = document.id
    ON CONFLICT (document_id) DO NOTHING
    RETURNING document_id
  `);
  const result = await query(`
    WITH computed AS (
      SELECT
        document.id,
        document.visibility_status,
        document.title,
        document.canonical_url,
        document.document_type,
        COALESCE(legacy.canonical_source, legacy.source_name) AS source_name,
        legacy.pdf_url,
        legacy.mime_type,
        state.processing_status,
        state.extraction_status,
        state.chunking_status,
        state.embedding_status,
        state.summary_status,
        state.ocr_status,
        state.error_message,
        state.failure_reason,
        state.chunks_count,
        state.embeddings_count,
        EXISTS (
          SELECT 1 FROM document_resources resource
          WHERE resource.document_id = document.id
            AND resource.resource_type IN ('pdf', 'text', 'html')
            AND resource.is_accessible
        ) AS has_accessible_resource,
        EXISTS (
          SELECT 1 FROM document_resources resource
          WHERE resource.document_id = document.id
            AND resource.resource_type IN ('text', 'html')
            AND resource.is_accessible
        ) AS has_extractable_source_resource
      FROM document_processing_state state
      JOIN documents document ON document.id = state.document_id
      JOIN legislative_documents legacy ON legacy.id = document.id
    ),
    readiness AS (
      SELECT
        *,
        (
          visibility_status = 'public'
          AND NULLIF(TRIM(title), '') IS NOT NULL
          AND has_accessible_resource
          AND processing_status = 'ready'
          AND extraction_status = 'ready'
          AND chunking_status = 'ready'
          AND embedding_status = 'ready'
          AND chunks_count > 0
          AND embeddings_count >= chunks_count
          AND error_message IS NULL
        ) AS genuinely_ready,
        (
          document_type = 'policy'
          AND source_name = 'policyedge'
          AND canonical_url IS NOT NULL
        ) AS extractable_policy_source
      FROM computed
    )
    UPDATE document_processing_state state
    SET pdf_status = CASE
          WHEN readiness.pdf_url IS NOT NULL THEN
            CASE
              WHEN readiness.mime_type IS NOT NULL
                AND readiness.mime_type NOT ILIKE '%pdf%'
                THEN 'unsupported'
              ELSE COALESCE(NULLIF(state.pdf_status, 'unknown'), 'available')
            END
          WHEN readiness.has_extractable_source_resource THEN 'not_required'
          ELSE 'missing'
        END,
        research_ready = readiness.genuinely_ready,
        comparison_ready = readiness.genuinely_ready,
        readiness_class = CASE
          WHEN readiness.visibility_status = 'hidden_invalid'
            THEN 'invalid_or_quarantined'
          WHEN readiness.genuinely_ready THEN 'comparison_ready'
          WHEN readiness.mime_type IS NOT NULL
            AND readiness.mime_type NOT ILIKE '%pdf%'
            AND readiness.pdf_url IS NOT NULL
            THEN 'unsupported_file_type'
          WHEN readiness.ocr_status = 'pending' THEN 'ocr_required'
          WHEN readiness.processing_status IN ('queued', 'processing')
            THEN 'processing_pending'
          WHEN readiness.processing_status = 'failed'
            AND COALESCE(readiness.failure_reason, readiness.error_message, '') ~*
              '(401|403|404|410|forbidden|not found|invalid pdf|unsupported|no usable text|too large)'
            THEN 'processing_failed_permanent'
          WHEN readiness.processing_status = 'failed'
            THEN 'processing_failed_retriable'
          WHEN readiness.pdf_url IS NOT NULL
            THEN 'pdf_available_not_processed'
          WHEN readiness.extractable_policy_source
            THEN 'source_extractable_not_processed'
          WHEN readiness.canonical_url IS NOT NULL THEN 'source_only'
          ELSE 'missing_pdf'
        END,
        readiness_reason = CASE
          WHEN readiness.visibility_status = 'hidden_invalid'
            THEN 'Invalid or quarantined catalogue record.'
          WHEN readiness.genuinely_ready THEN NULL
          WHEN readiness.mime_type IS NOT NULL
            AND readiness.mime_type NOT ILIKE '%pdf%'
            AND readiness.pdf_url IS NOT NULL
            THEN 'The linked file type is not supported for PDF processing.'
          WHEN readiness.ocr_status = 'pending'
            THEN 'The PDF requires OCR before research passages can be created.'
          WHEN readiness.processing_status IN ('queued', 'processing')
            THEN 'Document processing is pending.'
          WHEN readiness.processing_status = 'failed'
            THEN COALESCE(
              readiness.failure_reason,
              readiness.error_message,
              'Document processing failed.'
            )
          WHEN readiness.pdf_url IS NOT NULL
            THEN 'A PDF is available but has not been processed.'
          WHEN readiness.extractable_policy_source
            THEN 'An extractable source page is available but has not been processed.'
          WHEN readiness.canonical_url IS NOT NULL
            THEN 'Only a source page is currently available.'
          ELSE 'No accessible PDF or extractable source is available.'
        END,
        updated_at = NOW()
    FROM readiness
    WHERE state.document_id = readiness.id
    RETURNING state.readiness_class
  `);
  await query(`
    UPDATE documents document
    SET research_ready = state.research_ready,
        comparison_ready = state.comparison_ready,
        updated_at = NOW()
    FROM document_processing_state state
    WHERE state.document_id = document.id
      AND (
        document.research_ready IS DISTINCT FROM state.research_ready
        OR document.comparison_ready IS DISTINCT FROM state.comparison_ready
      )
  `);
  const counts = result.rows.reduce((summary, row) => {
    summary[row.readiness_class] =
      (summary[row.readiness_class] || 0) + 1;
    return summary;
  }, {});
  const reconciled = await query(`
    UPDATE document_processing_jobs job
    SET status = 'dead_letter', completed_at = COALESCE(completed_at, NOW()),
        updated_at = NOW()
    FROM document_processing_state state
    WHERE state.document_id = job.document_id
      AND state.readiness_class = 'processing_failed_permanent'
      AND job.status = 'failed'
    RETURNING job.id
  `);
  return {
    audited: result.rows.length,
    createdStates: inserted.rows.length,
    reconciledDeadLetters: reconciled.rows.length,
    counts,
  };
};

const getProcessingStatus = async () => {
  const [counts, totals, latest, jobs, performance, workers] = await Promise.all([
    query(`
      SELECT readiness_class, COUNT(*)::INTEGER AS documents
      FROM document_processing_state
      GROUP BY readiness_class
      ORDER BY documents DESC, readiness_class
    `),
    query(`
      SELECT
        COUNT(*)::INTEGER AS total_documents,
        COUNT(*) FILTER (WHERE research_ready)::INTEGER AS research_ready,
        COUNT(*) FILTER (WHERE comparison_ready)::INTEGER AS comparison_ready,
        COUNT(*) FILTER (
          WHERE readiness_class IN (
            'pdf_available_not_processed',
            'source_extractable_not_processed',
            'processing_pending',
            'processing_failed_retriable',
            'ocr_required'
          )
        )::INTEGER AS processable_backlog,
        COALESCE(SUM(chunks_count), 0)::INTEGER AS chunks,
        COALESCE(SUM(embeddings_count), 0)::INTEGER AS embeddings
      FROM document_processing_state
    `),
    query(`
      SELECT state.document_id, document.title, document.document_type,
        state.readiness_class, state.last_processed_at
      FROM document_processing_state state
      JOIN documents document ON document.id = state.document_id
      WHERE state.last_processed_at IS NOT NULL
      ORDER BY state.last_processed_at DESC
      LIMIT 10
    `),
    query(`
      WITH latest_jobs AS (
        SELECT status,
          ROW_NUMBER() OVER (
            PARTITION BY document_id
            ORDER BY id DESC
          ) AS job_rank
        FROM document_processing_jobs
      )
      SELECT status, COUNT(*)::INTEGER AS jobs
      FROM latest_jobs
      WHERE job_rank = 1
      GROUP BY status
      ORDER BY status
    `),
    query(`
      SELECT
        COUNT(*)::INTEGER AS attempts,
        COUNT(*) FILTER (WHERE status = 'completed')::INTEGER AS completed,
        COUNT(*) FILTER (
          WHERE status IN ('failed', 'dead_letter')
        )::INTEGER AS failed,
        ROUND(AVG(duration_ms) FILTER (
          WHERE status = 'completed'
        ))::INTEGER AS average_duration_ms,
        ROUND(AVG(queue_wait_ms))::INTEGER AS average_queue_wait_ms,
        ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (
          ORDER BY duration_ms
        ) FILTER (WHERE status = 'completed'))::INTEGER AS p50_duration_ms,
        ROUND(PERCENTILE_CONT(0.95) WITHIN GROUP (
          ORDER BY duration_ms
        ) FILTER (WHERE status = 'completed'))::INTEGER AS p95_duration_ms,
        COUNT(*) FILTER (
          WHERE status = 'completed'
            AND completed_at >= NOW() - INTERVAL '24 hours'
        )::INTEGER AS completed_24h,
        GREATEST(
          EXTRACT(EPOCH FROM (
            NOW() - MIN(started_at) FILTER (
              WHERE started_at >= NOW() - INTERVAL '24 hours'
            )
          )) / 3600,
          0.0167
        )::NUMERIC AS observed_hours,
        COALESCE(SUM(
          NULLIF(usage_json ->> 'generationInputTokens', '')::BIGINT
        ), 0)::BIGINT AS generation_input_tokens,
        COALESCE(SUM(
          NULLIF(usage_json ->> 'generationOutputTokens', '')::BIGINT
        ), 0)::BIGINT AS generation_output_tokens,
        COALESCE(SUM(
          NULLIF(usage_json ->> 'embeddingInputTokens', '')::BIGINT
        ), 0)::BIGINT AS embedding_input_tokens,
        ROUND(AVG(
          NULLIF(stage_metrics_json ->> 'downloadMs', '')::NUMERIC
        ))::INTEGER AS average_download_ms,
        ROUND(AVG(
          NULLIF(stage_metrics_json ->> 'ocrMs', '')::NUMERIC
        ))::INTEGER AS average_ocr_ms,
        ROUND(AVG(
          NULLIF(stage_metrics_json ->> 'embeddingsMs', '')::NUMERIC
        ))::INTEGER AS average_embeddings_ms,
        ROUND(AVG(
          NULLIF(stage_metrics_json ->> 'summaryMs', '')::NUMERIC
        ))::INTEGER AS average_summary_ms,
        ROUND(AVG(
          NULLIF(stage_metrics_json ->> 'pineconeMs', '')::NUMERIC
        ))::INTEGER AS average_pinecone_ms,
        ROUND(AVG(
          NULLIF(stage_metrics_json ->> 'graphMs', '')::NUMERIC
        ))::INTEGER AS average_graph_ms,
        MAX(memory_peak_bytes)::BIGINT AS peak_memory_bytes
      FROM document_processing_attempts
    `),
    query(`
      SELECT worker_id, status, concurrency, current_document_id,
        processed_count, failed_count, heartbeat_at
      FROM document_processing_workers
      WHERE heartbeat_at >= NOW() - INTERVAL '15 minutes'
      ORDER BY heartbeat_at DESC
      LIMIT 20
    `),
  ]);
  const row = totals.rows[0] || {};
  const performanceRow = performance.rows[0] || {};
  const jobCounts = Object.fromEntries(
    jobs.rows.map((item) => [item.status, Number(item.jobs || 0)]),
  );
  const completed24h = Number(performanceRow.completed_24h || 0);
  const observedHours = Math.min(
    24,
    Math.max(Number(performanceRow.observed_hours || 0.0167), 0.0167),
  );
  const throughputPerHour = Number(
    (completed24h / observedHours).toFixed(2),
  );
  const backlog = Number(row.processable_backlog || 0);
  return {
    totalDocuments: Number(row.total_documents || 0),
    researchReady: Number(row.research_ready || 0),
    comparisonReady: Number(row.comparison_ready || 0),
    processableBacklog: Number(row.processable_backlog || 0),
    chunks: Number(row.chunks || 0),
    embeddings: Number(row.embeddings || 0),
    queue: {
      queued: jobCounts.queued || 0,
      running: jobCounts.running || 0,
      failed: jobCounts.failed || 0,
      deadLetter: jobCounts.dead_letter || 0,
      completed: jobCounts.completed || 0,
    },
    performance: {
      attempts: Number(performanceRow.attempts || 0),
      completed: Number(performanceRow.completed || 0),
      failed: Number(performanceRow.failed || 0),
      failureRate:
        Number(performanceRow.attempts || 0) > 0
          ? Number((
            Number(performanceRow.failed || 0) /
            Number(performanceRow.attempts)
          ).toFixed(4))
          : 0,
      averageDurationMs: Number(performanceRow.average_duration_ms || 0),
      averageQueueWaitMs: Number(
        performanceRow.average_queue_wait_ms || 0,
      ),
      p50DurationMs: Number(performanceRow.p50_duration_ms || 0),
      p95DurationMs: Number(performanceRow.p95_duration_ms || 0),
      completed24h,
      throughputPerHour,
      estimatedCompletionHours:
        throughputPerHour > 0
          ? Number((backlog / throughputPerHour).toFixed(1))
          : null,
      estimatedUsage: {
        generationInputTokens: Number(
          performanceRow.generation_input_tokens || 0,
        ),
        generationOutputTokens: Number(
          performanceRow.generation_output_tokens || 0,
        ),
        embeddingInputTokens: Number(
          performanceRow.embedding_input_tokens || 0,
        ),
      },
      averageStageMs: {
        download: Number(performanceRow.average_download_ms || 0),
        ocr: Number(performanceRow.average_ocr_ms || 0),
        summary: Number(performanceRow.average_summary_ms || 0),
        embeddings: Number(performanceRow.average_embeddings_ms || 0),
        pinecone: Number(performanceRow.average_pinecone_ms || 0),
        graph: Number(performanceRow.average_graph_ms || 0),
      },
      peakMemoryBytes: Number(performanceRow.peak_memory_bytes || 0),
    },
    workers: workers.rows.map((worker) => ({
      workerId: worker.worker_id,
      status: worker.status,
      concurrency: Number(worker.concurrency || 1),
      currentDocumentId: worker.current_document_id
        ? String(worker.current_document_id)
        : null,
      processedCount: Number(worker.processed_count || 0),
      failedCount: Number(worker.failed_count || 0),
      heartbeatAt: worker.heartbeat_at,
    })),
    byClassification: counts.rows.map((item) => ({
      classification: item.readiness_class,
      documents: Number(item.documents || 0),
    })),
    latestProcessed: latest.rows.map((item) => ({
      documentId: String(item.document_id),
      title: item.title,
      documentType: item.document_type,
      readinessClass: item.readiness_class,
      lastProcessedAt: item.last_processed_at,
    })),
  };
};

const normalizeBatchType = (value) => {
  const type = String(value || "").trim().toLowerCase().replace(/-/g, "_");
  if (!type) return { type: null, stateOnly: false };
  if (type === "state_bill") return { type: "bill", stateOnly: true };
  if (type === "state_act") return { type: "act", stateOnly: true };
  return { type, stateOnly: false };
};

const processDocumentBatch = async (options = {}) => {
  const { runProcessingBatch } = require("./processingWorkerService");
  return runProcessingBatch(options);
};

module.exports = {
  classifyProcessingFailure,
  enqueueProcessing,
  getProcessingStatus,
  normalizeBatchType,
  prepareDocument,
  processDocumentBatch,
  runReadinessAudit,
};
