const crypto = require("crypto");

const sql = `
ALTER TABLE document_processing_state
  ADD COLUMN IF NOT EXISTS failure_code TEXT,
  ADD COLUMN IF NOT EXISTS retry_eligible BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS pipeline_stage TEXT,
  ADD COLUMN IF NOT EXISTS input_checksum_sha256 TEXT,
  ADD COLUMN IF NOT EXISTS output_checksum_sha256 TEXT,
  ADD COLUMN IF NOT EXISTS extraction_method TEXT,
  ADD COLUMN IF NOT EXISTS extraction_quality_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS worker_version TEXT,
  ADD COLUMN IF NOT EXISTS estimated_cost_usd NUMERIC(12,6);

ALTER TABLE document_processing_jobs
  ADD COLUMN IF NOT EXISTS failure_code TEXT,
  ADD COLUMN IF NOT EXISTS retry_eligible BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS pipeline_stage TEXT,
  ADD COLUMN IF NOT EXISTS input_checksum_sha256 TEXT,
  ADD COLUMN IF NOT EXISTS output_checksum_sha256 TEXT,
  ADD COLUMN IF NOT EXISTS extraction_method TEXT,
  ADD COLUMN IF NOT EXISTS worker_version TEXT,
  ADD COLUMN IF NOT EXISTS estimated_cost_usd NUMERIC(12,6);

ALTER TABLE document_processing_attempts
  ADD COLUMN IF NOT EXISTS pipeline_stage TEXT,
  ADD COLUMN IF NOT EXISTS failure_code TEXT,
  ADD COLUMN IF NOT EXISTS retry_eligible BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS failure_detail_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS input_checksum_sha256 TEXT,
  ADD COLUMN IF NOT EXISTS output_checksum_sha256 TEXT,
  ADD COLUMN IF NOT EXISTS extraction_method TEXT,
  ADD COLUMN IF NOT EXISTS ai_provider TEXT,
  ADD COLUMN IF NOT EXISTS ai_model TEXT,
  ADD COLUMN IF NOT EXISTS estimated_cost_usd NUMERIC(12,6);

WITH classified AS (
  SELECT
    state.document_id,
    artifact.extraction_method,
    artifact.pdf_quality_json,
    artifact.metadata_json,
    resource.hash_sha256 AS resource_hash,
    CASE
      WHEN COALESCE(state.failure_reason, state.error_message, state.readiness_reason, '') ~*
        '(401|unauthorized)'
        THEN 'HTTP_UNAUTHORIZED'
      WHEN COALESCE(state.failure_reason, state.error_message, state.readiness_reason, '') ~*
        '(403|forbidden)'
        THEN 'HTTP_FORBIDDEN'
      WHEN COALESCE(state.failure_reason, state.error_message, state.readiness_reason, '') ~*
        '(404|410|not found)'
        THEN 'HTTP_NOT_FOUND'
      WHEN COALESCE(state.failure_reason, state.error_message, state.readiness_reason, '') ~*
        '(429|rate limit)'
        THEN 'HTTP_RATE_LIMITED'
      WHEN COALESCE(state.failure_reason, state.error_message, state.readiness_reason, '') ~*
        '(502|503|504|server error|unavailable)'
        THEN 'HTTP_SERVER_ERROR'
      WHEN COALESCE(state.failure_reason, state.error_message, state.readiness_reason, '') ~*
        '(timeout|timed out|deadline)'
        THEN 'PROCESSING_TIMEOUT'
      WHEN COALESCE(state.failure_reason, state.error_message, state.readiness_reason, '') ~*
        '(enotfound|econn|socket hang up|network|dns|reset)'
        THEN 'NETWORK_ERROR'
      WHEN COALESCE(state.failure_reason, state.error_message, state.readiness_reason, '') ~*
        '(unsupported file|unsupported mime|invalid mime|content[- ]type|not a pdf)'
        THEN 'INVALID_MIME_TYPE'
      WHEN COALESCE(state.failure_reason, state.error_message, state.readiness_reason, '') ~*
        '(encrypted pdf|password)'
        THEN 'PDF_ENCRYPTED'
      WHEN COALESCE(state.failure_reason, state.error_message, state.readiness_reason, '') ~*
        '(invalid pdf|corrupt|malformed pdf|bad xref)'
        THEN 'PDF_CORRUPT'
      WHEN state.ocr_status = 'pending'
        OR COALESCE(state.failure_reason, state.error_message, state.readiness_reason, '') ~*
          '(scanned|ocr required|ocr_required)'
        THEN 'PDF_SCANNED_OCR_REQUIRED'
      WHEN COALESCE(state.failure_reason, state.error_message, state.readiness_reason, '') ~*
        '(ocr.*unavailable|tesseract|vision unavailable)'
        THEN 'OCR_UNAVAILABLE'
      WHEN COALESCE(state.failure_reason, state.error_message, state.readiness_reason, '') ~*
        '(no usable text|empty text|extraction.*empty)'
        THEN 'TEXT_EXTRACTION_EMPTY'
      WHEN COALESCE(state.failure_reason, state.error_message, state.readiness_reason, '') ~*
        '(too short|insufficient text|insufficient to create)'
        THEN 'TEXT_EXTRACTION_TOO_SHORT'
      WHEN COALESCE(state.failure_reason, state.error_message, state.readiness_reason, '') ~*
        '(chunk|passage).*?(empty|no usable|without creating)'
        THEN 'CHUNKING_EMPTY'
      WHEN COALESCE(state.failure_reason, state.error_message, state.readiness_reason, '') ~*
        '(retrieval verification failed|retrieval.*failed|no retrieval path)'
        THEN 'RETRIEVAL_VERIFICATION_FAILED'
      WHEN COALESCE(state.failure_reason, state.error_message, state.readiness_reason, '') ~*
        '(embed|embedding)'
        THEN 'EMBEDDING_PROVIDER_ERROR'
      WHEN COALESCE(state.failure_reason, state.error_message, state.readiness_reason, '') ~*
        '(pinecone|vector)'
        THEN 'VECTOR_STORE_ERROR'
      WHEN COALESCE(state.failure_reason, state.error_message, state.readiness_reason, '') ~*
        '(billing|quota)'
        THEN 'PROVIDER_QUOTA_ERROR'
      WHEN COALESCE(state.failure_reason, state.error_message, state.readiness_reason, '') ~*
        '(auth|api key|credential|secret|token|authorization)'
        THEN 'PROVIDER_AUTH_ERROR'
      WHEN COALESCE(state.failure_reason, state.error_message, state.readiness_reason, '') ~*
        '(summary|gemini|openai|model|generation)'
        THEN 'SUMMARY_PROVIDER_ERROR'
      WHEN state.readiness_class = 'missing_pdf'
        THEN 'SOURCE_URL_MISSING'
      WHEN state.readiness_class = 'unsupported_file_type'
        THEN 'INVALID_MIME_TYPE'
      WHEN state.readiness_class LIKE 'processing_failed%'
        THEN 'UNKNOWN_PROCESSING_ERROR'
      ELSE state.failure_code
    END AS failure_code
  FROM document_processing_state state
  LEFT JOIN LATERAL (
    SELECT hash_sha256
    FROM document_resources resource
    WHERE resource.document_id = state.document_id
      AND resource.resource_type IN ('pdf', 'text', 'html')
    ORDER BY resource.is_primary DESC, resource.id
    LIMIT 1
  ) resource ON TRUE
  LEFT JOIN document_text_artifacts artifact
    ON artifact.document_id = state.document_id
)
UPDATE document_processing_state state
SET failure_code = COALESCE(state.failure_code, classified.failure_code),
    retry_eligible = CASE
      WHEN COALESCE(state.failure_code, classified.failure_code) IN (
        'SOURCE_URL_MISSING',
        'HTTP_UNAUTHORIZED',
        'HTTP_FORBIDDEN',
        'HTTP_NOT_FOUND',
        'INVALID_MIME_TYPE',
        'PDF_CORRUPT',
        'PDF_ENCRYPTED',
        'TEXT_EXTRACTION_EMPTY',
        'TEXT_EXTRACTION_TOO_SHORT',
        'CHUNKING_EMPTY',
        'DUPLICATE_CANONICAL_CONFLICT',
        'METADATA_INCOMPLETE'
      ) THEN FALSE
      ELSE TRUE
    END,
    pipeline_stage = COALESCE(
      state.pipeline_stage,
      state.failure_stage,
      CASE
        WHEN COALESCE(state.failure_code, classified.failure_code) IN (
          'SOURCE_URL_MISSING'
        ) THEN 'source'
        WHEN COALESCE(state.failure_code, classified.failure_code) IN (
          'HTTP_UNAUTHORIZED',
          'HTTP_FORBIDDEN',
          'HTTP_NOT_FOUND',
          'HTTP_RATE_LIMITED',
          'HTTP_SERVER_ERROR',
          'DOWNLOAD_TIMEOUT',
          'NETWORK_ERROR'
        ) THEN 'download'
        WHEN COALESCE(state.failure_code, classified.failure_code) IN (
          'INVALID_MIME_TYPE',
          'PDF_CORRUPT',
          'PDF_ENCRYPTED'
        ) THEN 'pdf'
        WHEN COALESCE(state.failure_code, classified.failure_code) IN (
          'PDF_SCANNED_OCR_REQUIRED',
          'OCR_UNAVAILABLE'
        ) THEN 'ocr'
        WHEN COALESCE(state.failure_code, classified.failure_code) IN (
          'TEXT_EXTRACTION_EMPTY',
          'TEXT_EXTRACTION_TOO_SHORT'
        ) THEN 'extraction'
        WHEN COALESCE(state.failure_code, classified.failure_code) = 'CHUNKING_EMPTY'
          THEN 'chunking'
        WHEN COALESCE(state.failure_code, classified.failure_code) = 'EMBEDDING_PROVIDER_ERROR'
          THEN 'embedding'
        WHEN COALESCE(state.failure_code, classified.failure_code) = 'VECTOR_STORE_ERROR'
          THEN 'vector_store'
        WHEN COALESCE(state.failure_code, classified.failure_code) = 'SUMMARY_PROVIDER_ERROR'
          THEN 'summary'
        WHEN COALESCE(state.failure_code, classified.failure_code) = 'RETRIEVAL_VERIFICATION_FAILED'
          THEN 'retrieval'
        ELSE NULL
      END
    ),
    input_checksum_sha256 = COALESCE(
      state.input_checksum_sha256,
      classified.resource_hash
    ),
    output_checksum_sha256 = COALESCE(
      state.output_checksum_sha256,
      NULLIF(classified.metadata_json ->> 'textSha256', '')
    ),
    extraction_method = COALESCE(
      state.extraction_method,
      classified.extraction_method
    ),
    extraction_quality_json = CASE
      WHEN state.extraction_quality_json = '{}'::jsonb
        THEN COALESCE(classified.pdf_quality_json, '{}'::jsonb)
      ELSE state.extraction_quality_json
    END,
    updated_at = NOW()
FROM classified
WHERE classified.document_id = state.document_id;

UPDATE document_processing_jobs job
SET failure_code = COALESCE(job.failure_code, state.failure_code),
    retry_eligible = COALESCE(state.retry_eligible, job.retry_eligible),
    pipeline_stage = COALESCE(job.pipeline_stage, state.pipeline_stage),
    input_checksum_sha256 = COALESCE(
      job.input_checksum_sha256,
      state.input_checksum_sha256
    ),
    output_checksum_sha256 = COALESCE(
      job.output_checksum_sha256,
      state.output_checksum_sha256
    ),
    extraction_method = COALESCE(job.extraction_method, state.extraction_method),
    updated_at = NOW()
FROM document_processing_state state
WHERE state.document_id = job.document_id;

UPDATE document_processing_attempts attempt
SET failure_code = COALESCE(attempt.failure_code, state.failure_code),
    retry_eligible = COALESCE(state.retry_eligible, attempt.retry_eligible),
    pipeline_stage = COALESCE(
      attempt.pipeline_stage,
      attempt.failure_stage,
      state.pipeline_stage
    ),
    input_checksum_sha256 = COALESCE(
      attempt.input_checksum_sha256,
      state.input_checksum_sha256
    ),
    output_checksum_sha256 = COALESCE(
      attempt.output_checksum_sha256,
      state.output_checksum_sha256
    ),
    extraction_method = COALESCE(
      attempt.extraction_method,
      state.extraction_method
    ),
    ai_provider = COALESCE(attempt.ai_provider, state.ai_provider)
FROM document_processing_state state
WHERE state.document_id = attempt.document_id;

CREATE INDEX IF NOT EXISTS document_processing_state_failure_code_idx
  ON document_processing_state (failure_code, retry_eligible, updated_at DESC)
  WHERE failure_code IS NOT NULL;

CREATE INDEX IF NOT EXISTS document_processing_state_pipeline_stage_idx
  ON document_processing_state (pipeline_stage, processing_status, updated_at DESC)
  WHERE pipeline_stage IS NOT NULL;

CREATE INDEX IF NOT EXISTS document_processing_jobs_failure_code_idx
  ON document_processing_jobs (failure_code, status, updated_at DESC)
  WHERE failure_code IS NOT NULL;

CREATE INDEX IF NOT EXISTS document_processing_attempts_failure_code_idx
  ON document_processing_attempts (failure_code, status, completed_at DESC)
  WHERE failure_code IS NOT NULL;
`;

module.exports = {
  checksum: crypto.createHash("sha256").update(sql).digest("hex"),
  up: (client) => client.query(sql),
};
