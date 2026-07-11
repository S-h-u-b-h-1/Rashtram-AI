const { query } = require("../db");
const {
  enqueueProcessing,
} = require("./readinessService");
const { runWorkerPool } = require("./processingWorkerService");

const clampInteger = (value, fallback, minimum, maximum) => {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(Math.max(parsed, minimum), maximum);
};

const ensureAuditCheckpointTable = async () => {
  await query(`
    CREATE TABLE IF NOT EXISTS document_catalogue_audit_checkpoints (
      audit_name TEXT PRIMARY KEY,
      last_document_id BIGINT NOT NULL DEFAULT 0,
      total_audited BIGINT NOT NULL DEFAULT 0,
      started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      completed_at TIMESTAMPTZ
    )
  `);
};

const resetAuditCheckpoint = async (auditName) => {
  await ensureAuditCheckpointTable();
  await query(
    `INSERT INTO document_catalogue_audit_checkpoints (
       audit_name, last_document_id, total_audited, started_at, updated_at,
       completed_at
     )
     VALUES ($1, 0, 0, NOW(), NOW(), NULL)
     ON CONFLICT (audit_name) DO UPDATE SET
       last_document_id = 0,
       total_audited = 0,
       started_at = NOW(),
       updated_at = NOW(),
       completed_at = NULL`,
    [auditName],
  );
};

const loadCheckpoint = async (auditName) => {
  await ensureAuditCheckpointTable();
  const result = await query(
    `INSERT INTO document_catalogue_audit_checkpoints (
       audit_name, last_document_id, total_audited
     )
     VALUES ($1, 0, 0)
     ON CONFLICT (audit_name) DO NOTHING
     RETURNING *`,
    [auditName],
  );
  if (result.rows[0]) return result.rows[0];
  const existing = await query(
    `SELECT * FROM document_catalogue_audit_checkpoints
     WHERE audit_name = $1`,
    [auditName],
  );
  return existing.rows[0];
};

const updateCheckpoint = async (
  auditName,
  {
    lastDocumentId,
    audited,
    complete,
  },
) => {
  await query(
    `UPDATE document_catalogue_audit_checkpoints
     SET last_document_id = $2,
         total_audited = total_audited + $3,
         updated_at = NOW(),
         completed_at = CASE WHEN $4 THEN NOW() ELSE NULL END
     WHERE audit_name = $1`,
    [auditName, lastDocumentId, audited, complete],
  );
};

const runCatalogueAudit = async (options = {}) => {
  const auditName = "full_catalogue_readiness";
  const batchSize = clampInteger(options.batchSize, 500, 1, 5_000);
  if (!options.resume) {
    await resetAuditCheckpoint(auditName);
  }
  const checkpoint = await loadCheckpoint(auditName);
  const afterId = options.afterId == null
    ? Number(checkpoint.last_document_id || 0)
    : clampInteger(options.afterId, 0, 0, Number.MAX_SAFE_INTEGER);

  const batch = await query(
    `WITH selected AS (
       SELECT document.id
       FROM documents document
       WHERE document.id > $1
       ORDER BY document.id ASC
       LIMIT $2
     ),
     evidence AS (
       SELECT
         document.id,
         document.visibility_status,
         document.title,
         document.document_type,
         legacy.canonical_url,
         legacy.source_url,
         legacy.pdf_url,
         legacy.mime_type,
         COALESCE(legacy.canonical_source, legacy.source_name) AS source_name,
         state.processing_status,
         state.extraction_status,
         state.chunking_status,
         state.embedding_status,
         state.ocr_status,
         state.failure_stage,
         state.failure_reason,
         state.error_message,
         state.retrieval_mode,
         state.retrieval_verified,
         COALESCE(resource_counts.resources, 0)::INTEGER AS resources,
         COALESCE(resource_counts.accessible_resources, 0)::INTEGER AS accessible_resources,
         COALESCE(resource_counts.pdf_resources, 0)::INTEGER AS pdf_resources,
         COALESCE(resource_counts.broken_resources, 0)::INTEGER AS broken_resources,
         COALESCE(chunk_counts.chunks, 0)::INTEGER AS chunks,
         COALESCE(chunk_counts.text_chunks, 0)::INTEGER AS text_chunks,
         COALESCE(chunk_counts.vector_refs, 0)::INTEGER AS vector_refs
       FROM selected
       JOIN documents document ON document.id = selected.id
       JOIN legislative_documents legacy ON legacy.id = document.id
       LEFT JOIN document_processing_state state
         ON state.document_id = document.id
       LEFT JOIN LATERAL (
         SELECT
           COUNT(*) AS resources,
           COUNT(*) FILTER (
             WHERE resource_type IN ('pdf', 'text', 'html') AND is_accessible
           ) AS accessible_resources,
           COUNT(*) FILTER (WHERE resource_type = 'pdf') AS pdf_resources,
           COUNT(*) FILTER (
             WHERE resource_type IN ('pdf', 'text', 'html')
               AND NOT is_accessible
           ) AS broken_resources
         FROM document_resources resource
         WHERE resource.document_id = document.id
       ) resource_counts ON TRUE
       LEFT JOIN LATERAL (
         SELECT
           COUNT(*) AS chunks,
           COUNT(*) FILTER (
             WHERE LENGTH(TRIM(original_text)) > 0
           ) AS text_chunks,
           COUNT(vector_reference) AS vector_refs
         FROM document_text_chunks chunk
         WHERE chunk.document_id = document.id
       ) chunk_counts ON TRUE
     ),
     classified AS (
       SELECT
         *,
         (
           visibility_status = 'public'
           AND NULLIF(TRIM(title), '') IS NOT NULL
           AND accessible_resources > 0
           AND processing_status = 'ready'
           AND extraction_status = 'ready'
           AND chunking_status = 'ready'
           AND chunks > 0
           AND text_chunks > 0
           AND (
             retrieval_verified
             OR retrieval_mode IN ('local_text', 'hybrid')
             OR vector_refs > 0
           )
           AND COALESCE(failure_reason, error_message) IS NULL
         ) AS ready,
         (
           pdf_url IS NOT NULL
           OR accessible_resources > 0
           OR (
             document_type = 'policy'
             AND source_name = 'policyedge'
             AND canonical_url IS NOT NULL
           )
         ) AS processable
       FROM evidence
     ),
     upserted AS (
       INSERT INTO document_processing_state (
         document_id, processing_status, extraction_status, chunking_status,
         embedding_status, ocr_status, chunks_count, embeddings_count,
         retrieval_mode, retrieval_verified, retrieval_verified_at,
         research_ready, comparison_ready, readiness_class,
         readiness_reason, failure_stage, failure_reason, updated_at
       )
       SELECT
         id,
         COALESCE(processing_status, 'not_started'),
         COALESCE(extraction_status, 'not_started'),
         COALESCE(chunking_status, CASE WHEN chunks > 0 THEN 'ready' ELSE 'not_started' END),
         COALESCE(
           embedding_status,
           CASE WHEN vector_refs > 0 THEN 'ready' ELSE 'not_started' END
         ),
         COALESCE(ocr_status, 'not_required'),
         chunks,
         vector_refs,
         CASE
           WHEN ready AND vector_refs > 0 AND retrieval_mode IN ('local_text', 'hybrid')
             THEN 'hybrid'
           WHEN ready AND vector_refs > 0 THEN COALESCE(retrieval_mode, 'vector')
           WHEN chunks > 0 AND text_chunks > 0 THEN 'local_text'
           ELSE COALESCE(retrieval_mode, 'unknown')
         END,
         CASE
           WHEN ready THEN TRUE
           WHEN chunks > 0 AND text_chunks > 0 THEN TRUE
           ELSE COALESCE(retrieval_verified, FALSE)
         END,
         CASE
           WHEN ready OR (chunks > 0 AND text_chunks > 0)
             THEN COALESCE(NOW(), NOW())
           ELSE NULL
         END,
         ready,
         ready,
         CASE
           WHEN visibility_status <> 'public' THEN 'invalid_or_quarantined'
           WHEN ready THEN 'ready'
           WHEN processing_status IN ('queued', 'processing', 'running')
             THEN 'processing'
           WHEN ocr_status = 'pending' THEN 'ocr_required'
           WHEN COALESCE(failure_reason, error_message, '') ~*
             '(404|410|forbidden|unsupported|invalid pdf|corrupted|no usable text)'
             THEN 'permanent_failure'
           WHEN processing_status = 'failed' THEN 'retriable_failure'
           WHEN processable THEN 'processable_unprocessed'
           WHEN canonical_url IS NOT NULL OR source_url IS NOT NULL THEN 'source_only'
           WHEN broken_resources > 0 THEN 'broken_resource'
           ELSE 'permanent_failure'
         END,
         CASE
           WHEN visibility_status <> 'public'
             THEN 'Invalid or quarantined catalogue record.'
           WHEN ready THEN NULL
           WHEN processing_status IN ('queued', 'processing', 'running')
             THEN 'Document processing is in progress.'
           WHEN ocr_status = 'pending'
             THEN 'The document requires OCR before chunks can be created.'
           WHEN COALESCE(failure_reason, error_message) IS NOT NULL
             THEN COALESCE(failure_reason, error_message)
           WHEN processable
             THEN 'Document is processable but has not been prepared.'
           WHEN canonical_url IS NOT NULL OR source_url IS NOT NULL
             THEN 'Only a source page is currently available.'
           WHEN broken_resources > 0
             THEN 'Document resources are present but not accessible.'
           ELSE 'No accessible source or resource is available.'
         END,
         CASE
           WHEN chunks = 0 AND processable THEN 'chunking'
           ELSE failure_stage
         END,
         COALESCE(failure_reason, error_message),
         NOW()
       FROM classified
       ON CONFLICT (document_id) DO UPDATE SET
         processing_status = EXCLUDED.processing_status,
         extraction_status = EXCLUDED.extraction_status,
         chunking_status = EXCLUDED.chunking_status,
         embedding_status = EXCLUDED.embedding_status,
         ocr_status = EXCLUDED.ocr_status,
         chunks_count = EXCLUDED.chunks_count,
         embeddings_count = EXCLUDED.embeddings_count,
         retrieval_mode = EXCLUDED.retrieval_mode,
         retrieval_verified = EXCLUDED.retrieval_verified,
         retrieval_verified_at = COALESCE(
           document_processing_state.retrieval_verified_at,
           EXCLUDED.retrieval_verified_at
         ),
         research_ready = EXCLUDED.research_ready,
         comparison_ready = EXCLUDED.comparison_ready,
         readiness_class = EXCLUDED.readiness_class,
         readiness_reason = EXCLUDED.readiness_reason,
         failure_stage = EXCLUDED.failure_stage,
         failure_reason = EXCLUDED.failure_reason,
         updated_at = NOW()
       RETURNING document_id, readiness_class
     )
     UPDATE documents document
     SET research_ready = state.research_ready,
         comparison_ready = state.comparison_ready,
         updated_at = NOW()
     FROM document_processing_state state
     JOIN selected ON selected.id = state.document_id
     WHERE document.id = state.document_id
     RETURNING document.id`,
    [afterId, batchSize],
  );

  const audited = batch.rows.length;
  const lastDocumentId = audited
    ? Math.max(...batch.rows.map((row) => Number(row.id)))
    : afterId;
  const complete = audited < batchSize;
  await updateCheckpoint(auditName, {
    lastDocumentId,
    audited,
    complete,
  });
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

  const summary = await query(`
      SELECT
        state.readiness_class AS classification,
        document.document_type,
        legacy.jurisdiction,
        legacy.ministry,
        legacy.year,
        COUNT(*)::INTEGER AS documents
      FROM document_processing_state state
      JOIN documents document ON document.id = state.document_id
      JOIN legislative_documents legacy ON legacy.id = document.id
      GROUP BY state.readiness_class, document.document_type,
        legacy.jurisdiction, legacy.ministry, legacy.year
      ORDER BY documents DESC
      LIMIT 250
    `);

  return {
    auditName,
    batchSize,
    afterId,
    audited,
    nextAfterId: complete ? null : lastDocumentId,
    complete,
    groups: summary.rows.map((row) => ({
      classification: row.classification,
      documentType: row.document_type,
      jurisdiction: row.jurisdiction,
      ministry: row.ministry,
      year: row.year,
      documents: Number(row.documents || 0),
    })),
  };
};

const runCatalogueRepair = async (options = {}) => {
  const classification = String(options.classification || "").trim();
  if (!classification) {
    const error = new Error("A classification is required.");
    error.status = 400;
    throw error;
  }
  const limit = clampInteger(options.limit, 100, 1, 1_000);
  const candidates = await query(
    `SELECT state.document_id
     FROM document_processing_state state
     JOIN documents document ON document.id = state.document_id
     WHERE state.readiness_class = $1
       AND document.visibility_status = 'public'
       AND state.readiness_class NOT IN (
         'ready',
         'permanent_failure',
         'invalid_or_quarantined',
         'source_only',
         'unsupported_format'
       )
       AND NOT EXISTS (
         SELECT 1
         FROM document_processing_jobs job
         WHERE job.document_id = state.document_id
           AND job.status IN ('queued', 'running')
       )
     ORDER BY document.quality_score DESC NULLS LAST,
       state.updated_at ASC NULLS FIRST,
       state.document_id ASC
     LIMIT $2`,
    [classification, limit],
  );
  const allowedDocumentIds = candidates.rows
    .map((row) => Number(row.document_id))
    .filter(Boolean);
  if (!allowedDocumentIds.length) {
    return {
      classification,
      selected: 0,
      requested: limit,
      enqueued: 0,
      processed: 0,
      ready: 0,
      failed: 0,
      results: [],
    };
  }
  const jobs = [];
  for (const documentId of allowedDocumentIds) {
    jobs.push(
      await enqueueProcessing(documentId, null, {
        priority: 90,
        reason: `catalogue_repair:${classification}`,
        maxAttempts: options.maxAttempts || 3,
      }),
    );
  }
  if (options.enqueueOnly) {
    return {
      classification,
      selected: allowedDocumentIds.length,
      requested: limit,
      enqueued: jobs.length,
      processed: 0,
      ready: 0,
      failed: 0,
      results: [],
    };
  }
  const processed = await runWorkerPool({
    maxJobs: Math.min(limit, jobs.length),
    concurrency: options.concurrency,
    sourceConcurrency: options.sourceConcurrency,
    discoverGraph: options.discoverGraph,
    allowedDocumentIds,
  });
  return {
    classification,
    selected: allowedDocumentIds.length,
    requested: limit,
    enqueued: jobs.length,
    ...processed,
  };
};

module.exports = {
  runCatalogueAudit,
  runCatalogueRepair,
};
