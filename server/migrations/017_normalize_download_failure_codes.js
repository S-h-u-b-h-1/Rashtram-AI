const crypto = require("crypto");

const sql = `
WITH mapped AS (
  SELECT
    document_id,
    CASE failure_code
      WHEN 'HTTP_UNAUTHORIZED' THEN 'DOWNLOAD_ACCESS_DENIED'
      WHEN 'HTTP_FORBIDDEN' THEN 'DOWNLOAD_ACCESS_DENIED'
      WHEN 'HTTP_NOT_FOUND' THEN 'DOWNLOAD_NOT_FOUND'
      WHEN 'HTTP_RATE_LIMITED' THEN 'DOWNLOAD_RATE_LIMITED'
      WHEN 'HTTP_SERVER_ERROR' THEN 'DOWNLOAD_SERVER_ERROR'
      WHEN 'NETWORK_ERROR' THEN 'DOWNLOAD_UNKNOWN'
      WHEN 'INVALID_MIME_TYPE' THEN 'DOWNLOAD_UNSUPPORTED_CONTENT'
      ELSE failure_code
    END AS normalized_code
  FROM document_processing_state
  WHERE pipeline_stage = 'download'
    AND failure_code IN (
      'HTTP_UNAUTHORIZED',
      'HTTP_FORBIDDEN',
      'HTTP_NOT_FOUND',
      'HTTP_RATE_LIMITED',
      'HTTP_SERVER_ERROR',
      'NETWORK_ERROR',
      'INVALID_MIME_TYPE'
    )
)
UPDATE document_processing_state state
SET failure_code = mapped.normalized_code,
    retry_eligible = CASE
      WHEN mapped.normalized_code IN (
        'DOWNLOAD_ACCESS_DENIED',
        'DOWNLOAD_NOT_FOUND',
        'DOWNLOAD_HTML_RESPONSE',
        'DOWNLOAD_UNSUPPORTED_CONTENT',
        'DOWNLOAD_ZERO_BYTE',
        'DOWNLOAD_TRUNCATED',
        'DOWNLOAD_CHECKSUM_MISMATCH'
      ) THEN FALSE
      ELSE state.retry_eligible
    END,
    readiness_class = CASE
      WHEN mapped.normalized_code IN (
        'DOWNLOAD_ACCESS_DENIED',
        'DOWNLOAD_NOT_FOUND',
        'DOWNLOAD_HTML_RESPONSE',
        'DOWNLOAD_UNSUPPORTED_CONTENT',
        'DOWNLOAD_ZERO_BYTE',
        'DOWNLOAD_TRUNCATED',
        'DOWNLOAD_CHECKSUM_MISMATCH'
      ) THEN 'processing_failed_permanent'
      ELSE state.readiness_class
    END,
    updated_at = NOW()
FROM mapped
WHERE mapped.document_id = state.document_id;

UPDATE document_processing_jobs job
SET failure_code = state.failure_code,
    retry_eligible = state.retry_eligible,
    updated_at = NOW()
FROM document_processing_state state
WHERE state.document_id = job.document_id
  AND state.pipeline_stage = 'download'
  AND job.status IN ('failed', 'dead_letter');

UPDATE document_processing_attempts attempt
SET failure_code = state.failure_code,
    retry_eligible = state.retry_eligible
FROM document_processing_state state
WHERE state.document_id = attempt.document_id
  AND state.pipeline_stage = 'download'
  AND attempt.status IN ('failed', 'dead_letter');
`;

module.exports = {
  checksum: crypto.createHash("sha256").update(sql).digest("hex"),
  up: (client) => client.query(sql),
};
