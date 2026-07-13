const crypto = require("crypto");

const sql = `
UPDATE document_processing_state
SET pipeline_stage = CASE
      WHEN failure_code = 'SOURCE_URL_MISSING' THEN 'source'
      WHEN failure_code IN (
        'SOURCE_URL_UNREACHABLE',
        'HTTP_UNAUTHORIZED',
        'HTTP_FORBIDDEN',
        'HTTP_NOT_FOUND',
        'HTTP_RATE_LIMITED',
        'HTTP_SERVER_ERROR',
        'DOWNLOAD_TIMEOUT',
        'NETWORK_ERROR'
      ) THEN 'download'
      WHEN failure_code IN (
        'INVALID_MIME_TYPE',
        'PDF_CORRUPT',
        'PDF_ENCRYPTED'
      ) THEN 'pdf'
      WHEN failure_code IN (
        'PDF_SCANNED_OCR_REQUIRED',
        'OCR_UNAVAILABLE'
      ) THEN 'ocr'
      WHEN failure_code IN (
        'TEXT_EXTRACTION_EMPTY',
        'TEXT_EXTRACTION_TOO_SHORT'
      ) THEN 'extraction'
      WHEN failure_code = 'CHUNKING_EMPTY' THEN 'chunking'
      WHEN failure_code = 'EMBEDDING_PROVIDER_ERROR' THEN 'embedding'
      WHEN failure_code = 'VECTOR_STORE_ERROR' THEN 'vector_store'
      WHEN failure_code = 'SUMMARY_PROVIDER_ERROR' THEN 'summary'
      WHEN failure_code = 'RETRIEVAL_VERIFICATION_FAILED' THEN 'retrieval'
      WHEN failure_code = 'DUPLICATE_CANONICAL_CONFLICT' THEN 'dedupe'
      WHEN failure_code = 'METADATA_INCOMPLETE' THEN 'metadata'
      WHEN failure_code IN (
        'PROVIDER_AUTH_ERROR',
        'PROVIDER_QUOTA_ERROR'
      ) THEN 'ai_provider'
      ELSE COALESCE(pipeline_stage, failure_stage, 'processing')
    END,
    updated_at = NOW()
WHERE failure_code IS NOT NULL;

UPDATE document_processing_jobs job
SET pipeline_stage = state.pipeline_stage,
    failure_code = COALESCE(job.failure_code, state.failure_code),
    retry_eligible = state.retry_eligible,
    updated_at = NOW()
FROM document_processing_state state
WHERE state.document_id = job.document_id
  AND state.failure_code IS NOT NULL;

UPDATE document_processing_attempts attempt
SET pipeline_stage = state.pipeline_stage,
    failure_code = COALESCE(attempt.failure_code, state.failure_code),
    retry_eligible = state.retry_eligible
FROM document_processing_state state
WHERE state.document_id = attempt.document_id
  AND state.failure_code IS NOT NULL;
`;

module.exports = {
  checksum: crypto.createHash("sha256").update(sql).digest("hex"),
  up: (client) => client.query(sql),
};
