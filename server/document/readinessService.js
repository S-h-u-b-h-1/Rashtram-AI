const { query } = require("../db");
const DocumentRepository = require("./DocumentRepository");

const RETRIABLE_FAILURE_PATTERN =
  /timeout|timed out|429|rate limit|temporar|network|econn|reset|503|502|504|unavailable|dns|enotfound/i;
const PERMANENT_FAILURE_PATTERN =
  /404|410|not found|invalid pdf|unsupported file|no usable text|insufficient to create|too large for inline ocr/i;

const classifyProcessingFailure = (error, fallbackStage = "processing") => {
  const message = String(error?.message || error || "Document processing failed.")
    .normalize("NFKC")
    .slice(0, 2_000);
  const status = Number(error?.response?.status || error?.status || 0);
  let failureStage = fallbackStage;
  if (/pdf|download|404|410|content[- ]type/i.test(message)) {
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
    [404, 410, 415].includes(status) ||
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
  { priority = 50, reason = "manual_prepare" } = {},
) => {
  const id = Number.parseInt(documentId, 10);
  if (!Number.isSafeInteger(id) || id <= 0) {
    const error = new Error("Document ID must be a positive integer.");
    error.status = 400;
    throw error;
  }
  const result = await query(
    `INSERT INTO document_processing_jobs (
       document_id, requested_by, priority, metadata_json
     )
     VALUES ($1, $2, $3, $4::jsonb)
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
  { userId = null, priority = 100, reason = "manual_prepare" } = {},
) => {
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
  if (!document.pdfUrl) {
    const error = new Error(
      document.sourceUrl
        ? "Only a source page is available; no verified PDF can be processed."
        : "No verified PDF or extractable source is available.",
    );
    error.status = 422;
    throw error;
  }
  const job = await enqueueProcessing(document.id, userId, {
    priority,
    reason,
  });
  await query(
    `UPDATE document_processing_jobs
     SET status = 'running', attempt = attempt + 1,
         started_at = COALESCE(started_at, NOW()), updated_at = NOW()
     WHERE id = $1`,
    [job.id],
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
    const retrievalVerified = await verifyRetrieval(document);
    if (!retrievalVerified) {
      const error = new Error(
        "Research passages were stored but retrieval verification failed.",
      );
      error.status = 503;
      throw error;
    }
    const artifact = result.textArtifact || {};
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
           failure_reason = NULL, updated_at = NOW()
       WHERE id = $1`,
      [job.id],
    );
    return {
      ...result,
      jobId: String(job.id),
      researchReady: true,
      comparisonReady: true,
      retrievalVerified,
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
    await query(
      `UPDATE document_processing_jobs
       SET status = 'failed', completed_at = NOW(),
           failure_reason = $2, updated_at = NOW()
       WHERE id = $1`,
      [job.id, failure.failureReason],
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
    UPDATE document_processing_state state
    SET pdf_status = CASE
          WHEN legacy.pdf_url IS NOT NULL THEN
            CASE
              WHEN legacy.mime_type IS NOT NULL
                AND legacy.mime_type NOT ILIKE '%pdf%'
                THEN 'unsupported'
              ELSE COALESCE(NULLIF(state.pdf_status, 'unknown'), 'available')
            END
          WHEN EXISTS (
            SELECT 1 FROM document_resources resource
            WHERE resource.document_id = document.id
              AND resource.resource_type IN ('text', 'html')
              AND resource.is_accessible
          ) THEN 'not_required'
          ELSE 'missing'
        END,
        research_ready = document.research_ready,
        comparison_ready = document.comparison_ready,
        readiness_class = CASE
          WHEN document.visibility_status = 'hidden_invalid'
            THEN 'invalid_or_quarantined'
          WHEN document.comparison_ready THEN 'comparison_ready'
          WHEN document.research_ready THEN 'research_ready'
          WHEN legacy.mime_type IS NOT NULL
            AND legacy.mime_type NOT ILIKE '%pdf%'
            AND legacy.pdf_url IS NOT NULL
            THEN 'unsupported_file_type'
          WHEN state.ocr_status = 'pending' THEN 'ocr_required'
          WHEN state.processing_status IN ('queued', 'processing')
            THEN 'processing_pending'
          WHEN state.processing_status = 'failed'
            AND COALESCE(state.failure_reason, state.error_message, '') ~*
              '(404|410|not found|invalid pdf|unsupported|no usable text|too large)'
            THEN 'processing_failed_permanent'
          WHEN state.processing_status = 'failed'
            THEN 'processing_failed_retriable'
          WHEN legacy.pdf_url IS NOT NULL
            THEN 'pdf_available_not_processed'
          WHEN document.canonical_url IS NOT NULL THEN 'source_only'
          ELSE 'missing_pdf'
        END,
        readiness_reason = CASE
          WHEN document.visibility_status = 'hidden_invalid'
            THEN 'Invalid or quarantined catalogue record.'
          WHEN document.research_ready THEN NULL
          WHEN legacy.mime_type IS NOT NULL
            AND legacy.mime_type NOT ILIKE '%pdf%'
            AND legacy.pdf_url IS NOT NULL
            THEN 'The linked file type is not supported for PDF processing.'
          WHEN state.ocr_status = 'pending'
            THEN 'The PDF requires OCR before research passages can be created.'
          WHEN state.processing_status IN ('queued', 'processing')
            THEN 'Document processing is pending.'
          WHEN state.processing_status = 'failed'
            THEN COALESCE(
              state.failure_reason,
              state.error_message,
              'Document processing failed.'
            )
          WHEN legacy.pdf_url IS NOT NULL
            THEN 'A PDF is available but has not been processed.'
          WHEN document.canonical_url IS NOT NULL
            THEN 'Only a source page is currently available.'
          ELSE 'No accessible PDF or extractable source is available.'
        END,
        updated_at = NOW()
    FROM documents document
    JOIN legislative_documents legacy ON legacy.id = document.id
    WHERE state.document_id = document.id
    RETURNING state.readiness_class
  `);
  const counts = result.rows.reduce((summary, row) => {
    summary[row.readiness_class] =
      (summary[row.readiness_class] || 0) + 1;
    return summary;
  }, {});
  return {
    audited: result.rows.length,
    createdStates: inserted.rows.length,
    counts,
  };
};

const getProcessingStatus = async () => {
  const [counts, totals, latest] = await Promise.all([
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
  ]);
  const row = totals.rows[0] || {};
  return {
    totalDocuments: Number(row.total_documents || 0),
    researchReady: Number(row.research_ready || 0),
    comparisonReady: Number(row.comparison_ready || 0),
    processableBacklog: Number(row.processable_backlog || 0),
    chunks: Number(row.chunks || 0),
    embeddings: Number(row.embeddings || 0),
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
  const limit = Math.min(Math.max(Number(options.limit) || 25, 1), 100);
  const requestedType = normalizeBatchType(options.type);
  const retryFailed = Boolean(options.retryFailed);
  const onlyUnprocessed = Boolean(options.onlyUnprocessed);
  const candidates = await query(
    `SELECT document.id, document.document_type
     FROM documents document
     JOIN legislative_documents legacy ON legacy.id = document.id
     LEFT JOIN document_processing_state state
       ON state.document_id = document.id
     WHERE document.visibility_status = 'public'
       AND legacy.pdf_url IS NOT NULL
       AND ($1::TEXT IS NULL OR document.document_type = $1)
       AND (NOT $2::BOOLEAN OR document.jurisdiction_level = 'state')
       AND (
         ($3::BOOLEAN AND state.readiness_class = 'processing_failed_retriable')
         OR ($4::BOOLEAN AND state.processing_status IN ('not_started', 'pending'))
         OR (
           NOT $3::BOOLEAN AND NOT $4::BOOLEAN
           AND NOT document.research_ready
           AND state.readiness_class NOT IN (
             'processing_failed_permanent',
             'invalid_or_quarantined',
             'unsupported_file_type'
           )
         )
       )
     ORDER BY
       CASE WHEN EXISTS (
         SELECT 1 FROM user_document_interactions interaction
         WHERE interaction.document_id = document.id
       ) THEN 0 ELSE 1 END,
       CASE WHEN EXISTS (
         SELECT 1 FROM document_comparisons comparison
         WHERE comparison.document_ids_json ? document.id::TEXT
       ) THEN 0 ELSE 1 END,
       CASE document.document_type
         WHEN 'bill' THEN 0
         WHEN 'act' THEN 1
         WHEN 'policy' THEN 2
         WHEN 'gazette' THEN 3
         ELSE 4
       END,
       CASE WHEN EXISTS (
         SELECT 1 FROM document_relationships relationship
         WHERE relationship.from_document_id = document.id
            OR relationship.to_document_id = document.id
       ) THEN 0 ELSE 1 END,
       document.quality_score DESC,
       document.updated_at DESC
     LIMIT $5`,
    [
      requestedType.type,
      requestedType.stateOnly,
      retryFailed,
      onlyUnprocessed,
      limit,
    ],
  );
  const results = [];
  for (const candidate of candidates.rows) {
    try {
      const result = await prepareDocument(candidate.id, {
        priority: 60,
        reason: "batch_backfill",
      });
      results.push({
        documentId: String(candidate.id),
        status: "ready",
        chunks: Number(result.chunksStored || 0),
      });
    } catch (error) {
      results.push({
        documentId: String(candidate.id),
        status: "failed",
        error: String(error.message || error).slice(0, 500),
        classification:
          error.processingFailure?.readinessClass ||
          "processing_failed_retriable",
      });
    }
  }
  return {
    requested: limit,
    selected: candidates.rows.length,
    ready: results.filter((item) => item.status === "ready").length,
    failed: results.filter((item) => item.status === "failed").length,
    results,
  };
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
