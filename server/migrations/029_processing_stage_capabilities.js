const crypto = require("node:crypto");

const sql = `
CREATE TABLE IF NOT EXISTS document_processing_stages (
  id BIGSERIAL PRIMARY KEY,
  document_id BIGINT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  job_id BIGINT REFERENCES document_processing_jobs(id) ON DELETE SET NULL,
  stage TEXT NOT NULL CHECK (stage IN (
    'DISCOVERED', 'RESOURCE_VERIFIED', 'FETCH', 'EXTRACT', 'OCR',
    'NORMALIZE', 'CHUNK', 'FTS_INDEX', 'EMBED', 'VECTOR_INDEX',
    'RETRIEVAL_VERIFY', 'READY'
  )),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending', 'running', 'completed', 'skipped', 'failed'
  )),
  attempt_count INTEGER NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
  failure_category TEXT,
  failure_reason TEXT,
  retryable BOOLEAN NOT NULL DEFAULT TRUE,
  input_hash TEXT,
  output_hash TEXT,
  processor_version TEXT NOT NULL,
  duration_ms INTEGER,
  metadata_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (document_id, stage)
);

CREATE INDEX IF NOT EXISTS document_processing_stages_resume_idx
  ON document_processing_stages (status, retryable, updated_at, document_id);
CREATE INDEX IF NOT EXISTS document_processing_stages_job_idx
  ON document_processing_stages (job_id, stage);

ALTER TABLE document_processing_state
  ADD COLUMN IF NOT EXISTS catalogued BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS resource_ready BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS text_ready BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS search_ready BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS semantic_ready BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS chat_ready BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS capability_comparison_ready BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS capabilities_updated_at TIMESTAMPTZ;

ALTER TABLE document_text_artifacts
  ADD COLUMN IF NOT EXISTS extracted_text_sha256 TEXT;

ALTER TABLE document_text_chunks
  ADD COLUMN IF NOT EXISTS chunk_sha256 TEXT,
  ADD COLUMN IF NOT EXISTS embedding_input_sha256 TEXT;

ALTER TABLE document_text_artifacts
  DROP CONSTRAINT IF EXISTS document_text_artifacts_extraction_method_check;
ALTER TABLE document_text_artifacts
  ADD CONSTRAINT document_text_artifacts_extraction_method_check
  CHECK (extraction_method IN (
    'pdf_text', 'pdf_text_with_page_ocr', 'gemini_ocr', 'openai_ocr',
    'source_html', 'local_text_chunks'
  ));

UPDATE document_text_artifacts
SET extracted_text_sha256 = COALESCE(
  extracted_text_sha256,
  NULLIF(metadata_json ->> 'textSha256', '')
)
WHERE extracted_text_sha256 IS NULL;

UPDATE document_text_chunks
SET chunk_sha256 = COALESCE(chunk_sha256, content_hash),
    embedding_input_sha256 = COALESCE(embedding_input_sha256, content_hash)
WHERE chunk_sha256 IS NULL OR embedding_input_sha256 IS NULL;

UPDATE document_processing_state state
SET catalogued = TRUE,
    resource_ready = EXISTS (
      SELECT 1 FROM document_resources resource
      WHERE resource.document_id = state.document_id
        AND resource.resource_type IN ('pdf', 'text', 'html')
        AND resource.is_accessible
    ),
    text_ready = state.extraction_status = 'ready' AND state.chunks_count > 0,
    search_ready = state.chunking_status = 'ready' AND state.chunks_count > 0,
    semantic_ready = state.embedding_status = 'ready'
      AND state.embeddings_count >= state.chunks_count
      AND state.chunks_count > 0,
    chat_ready = state.chunking_status = 'ready'
      AND state.chunks_count > 0
      AND state.retrieval_verified,
    capability_comparison_ready = state.comparison_ready,
    capabilities_updated_at = NOW();

CREATE INDEX IF NOT EXISTS document_processing_state_capabilities_idx
  ON document_processing_state (
    search_ready, semantic_ready, chat_ready, capability_comparison_ready
  );
CREATE INDEX IF NOT EXISTS document_text_artifacts_extracted_hash_idx
  ON document_text_artifacts (extracted_text_sha256)
  WHERE extracted_text_sha256 IS NOT NULL;
CREATE INDEX IF NOT EXISTS document_text_chunks_chunk_sha_idx
  ON document_text_chunks (document_id, chunk_sha256)
  WHERE chunk_sha256 IS NOT NULL;
`;

module.exports = {
  checksum: crypto.createHash("sha256").update(sql).digest("hex"),
  up: (client) => client.query(sql),
};
