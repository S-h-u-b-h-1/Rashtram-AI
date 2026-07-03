const crypto = require("crypto");

const sql = `
ALTER TABLE documents
  ADD COLUMN IF NOT EXISTS comparison_ready BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS documents_comparison_ready_idx
  ON documents (comparison_ready, quality_score DESC);

ALTER TABLE document_processing_state
  ADD COLUMN IF NOT EXISTS pdf_status TEXT NOT NULL DEFAULT 'unknown',
  ADD COLUMN IF NOT EXISTS chunking_status TEXT NOT NULL DEFAULT 'not_started',
  ADD COLUMN IF NOT EXISTS research_ready BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS comparison_ready BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS embeddings_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS text_length INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS language TEXT,
  ADD COLUMN IF NOT EXISTS script TEXT,
  ADD COLUMN IF NOT EXISTS is_bilingual BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS retry_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS failure_stage TEXT,
  ADD COLUMN IF NOT EXISTS failure_reason TEXT,
  ADD COLUMN IF NOT EXISTS failure_details_json JSONB
    NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS readiness_class TEXT NOT NULL DEFAULT 'source_only',
  ADD COLUMN IF NOT EXISTS readiness_reason TEXT,
  ADD COLUMN IF NOT EXISTS last_attempted_at TIMESTAMPTZ;

UPDATE document_processing_state state
SET pdf_status = CASE
      WHEN legacy.pdf_url IS NOT NULL THEN
        CASE
          WHEN legacy.mime_type IS NOT NULL
            AND legacy.mime_type NOT ILIKE '%pdf%'
            THEN 'unsupported'
          ELSE 'available'
        END
      WHEN EXISTS (
        SELECT 1 FROM document_resources resource
        WHERE resource.document_id = document.id
          AND resource.resource_type IN ('text', 'html')
          AND resource.is_accessible
      ) THEN 'not_required'
      ELSE 'missing'
    END,
    chunking_status = CASE
      WHEN state.chunks_count > 0 THEN 'ready'
      WHEN state.processing_status = 'failed' THEN 'failed'
      ELSE 'not_started'
    END,
    embeddings_count = CASE
      WHEN state.embedding_status = 'ready' THEN state.chunks_count
      ELSE 0
    END,
    text_length = COALESCE(LENGTH(artifact.original_text), 0),
    language = artifact.language_code,
    script = artifact.script,
    is_bilingual = COALESCE(artifact.is_bilingual, FALSE),
    research_ready = document.research_ready,
    comparison_ready = (
      document.research_ready
      AND state.chunks_count > 0
      AND state.embedding_status = 'ready'
    ),
    failure_stage = CASE
      WHEN state.processing_status = 'failed' THEN
        CASE
          WHEN state.extraction_status = 'failed' THEN 'extraction'
          WHEN state.embedding_status = 'failed' THEN 'embedding'
          WHEN state.summary_status = 'failed' THEN 'summary'
          ELSE 'processing'
        END
      ELSE NULL
    END,
    failure_reason = CASE
      WHEN state.processing_status = 'failed' THEN state.error_message
      ELSE NULL
    END,
    readiness_class = CASE
      WHEN document.visibility_status = 'hidden_invalid'
        THEN 'invalid_or_quarantined'
      WHEN document.research_ready AND state.chunks_count > 0
        AND state.embedding_status = 'ready'
        THEN 'comparison_ready'
      WHEN document.research_ready THEN 'research_ready'
      WHEN legacy.mime_type IS NOT NULL
        AND legacy.mime_type NOT ILIKE '%pdf%'
        AND legacy.pdf_url IS NOT NULL
        THEN 'unsupported_file_type'
      WHEN state.ocr_status = 'pending' THEN 'ocr_required'
      WHEN state.processing_status = 'processing' THEN 'processing_pending'
      WHEN state.processing_status = 'failed'
        AND COALESCE(state.error_message, '') ~*
          '(404|not found|invalid pdf|unsupported|no usable text)'
        THEN 'processing_failed_permanent'
      WHEN state.processing_status = 'failed'
        THEN 'processing_failed_retriable'
      WHEN legacy.pdf_url IS NOT NULL THEN 'pdf_available_not_processed'
      WHEN document.canonical_url IS NOT NULL THEN 'source_only'
      ELSE 'missing_pdf'
    END,
    readiness_reason = CASE
      WHEN document.visibility_status = 'hidden_invalid'
        THEN 'Invalid or quarantined catalogue record.'
      WHEN document.research_ready AND state.chunks_count > 0
        AND state.embedding_status = 'ready'
        THEN NULL
      WHEN legacy.mime_type IS NOT NULL
        AND legacy.mime_type NOT ILIKE '%pdf%'
        AND legacy.pdf_url IS NOT NULL
        THEN 'The linked file type is not supported for PDF processing.'
      WHEN state.ocr_status = 'pending'
        THEN 'The PDF requires OCR before research passages can be created.'
      WHEN state.processing_status = 'processing'
        THEN 'Document processing is in progress.'
      WHEN state.processing_status = 'failed'
        THEN COALESCE(state.error_message, 'Document processing failed.')
      WHEN legacy.pdf_url IS NOT NULL
        THEN 'A PDF is available but has not been processed.'
      WHEN document.canonical_url IS NOT NULL
        THEN 'Only a source page is currently available.'
      ELSE 'No accessible PDF or extractable source is available.'
    END
FROM documents document
JOIN legislative_documents legacy ON legacy.id = document.id
LEFT JOIN document_text_artifacts artifact
  ON artifact.document_id = document.id
WHERE state.document_id = document.id;

UPDATE documents document
SET comparison_ready = state.comparison_ready
FROM document_processing_state state
WHERE state.document_id = document.id;

CREATE INDEX IF NOT EXISTS document_processing_readiness_idx
  ON document_processing_state (
    readiness_class,
    comparison_ready,
    updated_at DESC
  );

CREATE INDEX IF NOT EXISTS document_processing_retry_idx
  ON document_processing_state (
    processing_status,
    retry_count,
    last_attempted_at
  );

CREATE TABLE IF NOT EXISTS document_processing_jobs (
  id BIGSERIAL PRIMARY KEY,
  document_id BIGINT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  requested_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'queued'
    CHECK (status IN ('queued', 'running', 'completed', 'failed', 'cancelled')),
  priority INTEGER NOT NULL DEFAULT 50,
  attempt INTEGER NOT NULL DEFAULT 0,
  failure_reason TEXT,
  metadata_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  queued_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS document_processing_jobs_active_idx
  ON document_processing_jobs (document_id)
  WHERE status IN ('queued', 'running');

CREATE INDEX IF NOT EXISTS document_processing_jobs_queue_idx
  ON document_processing_jobs (status, priority DESC, queued_at ASC);
`;

module.exports = {
  checksum: crypto.createHash("sha256").update(sql).digest("hex"),
  up: (client) => client.query(sql),
};
