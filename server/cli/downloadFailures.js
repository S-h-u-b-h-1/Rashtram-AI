require("dotenv").config({
  path: process.env.ENV_FILE || require("path").join(__dirname, "../.env.local"),
});
const { getPool, query } = require("../db");
const { argumentInteger } = require("./cliArgs");

const rowsForDownloadFailures = (limit) => query(
  `WITH failed AS (
     SELECT
       document.id,
       document.document_type,
       document.title,
       COALESCE(legacy.canonical_source, legacy.source_name, 'unknown') AS source,
       LOWER(SUBSTRING(COALESCE(legacy.pdf_url, legacy.canonical_url, legacy.source_url) FROM '^[a-z]+://([^/:]+)')) AS source_domain,
       legacy.pdf_url,
       legacy.canonical_url,
       legacy.source_url,
       COALESCE(resource.mime_type, legacy.mime_type, 'unknown') AS mime_type,
       COALESCE(resource.file_extension, LOWER(SUBSTRING(legacy.pdf_url FROM '\\.([a-zA-Z0-9]+)(?:[?#].*)?$')), 'unknown') AS expected_extension,
       COALESCE(resource.file_size, legacy.file_size_bytes, 0) AS file_size_bytes,
       COALESCE(resource.hash_sha256, legacy.file_hash, document.file_checksum_sha256) AS file_checksum,
       state.processing_status,
       state.failure_code,
       state.pipeline_stage,
       state.retry_eligible,
       state.retry_count,
       state.failure_reason,
       state.readiness_reason,
       state.updated_at,
       state.last_attempted_at,
       CASE
         WHEN state.failure_code IN ('DOWNLOAD_NOT_FOUND', 'HTTP_NOT_FOUND') THEN 404
         WHEN state.failure_code IN ('DOWNLOAD_ACCESS_DENIED', 'HTTP_FORBIDDEN', 'HTTP_UNAUTHORIZED') THEN 403
         WHEN state.failure_code IN ('DOWNLOAD_RATE_LIMITED', 'HTTP_RATE_LIMITED') THEN 429
         WHEN state.failure_code IN ('DOWNLOAD_SERVER_ERROR', 'HTTP_SERVER_ERROR') THEN 500
         ELSE NULL
       END AS inferred_http_status,
       EXISTS (
         SELECT 1
         FROM document_text_artifacts artifact
         WHERE artifact.document_id = document.id
           AND LENGTH(TRIM(COALESCE(artifact.original_text, ''))) > 0
       ) AS valid_text_artifact_exists,
       EXISTS (
         SELECT 1
         FROM document_resources duplicate
         JOIN documents duplicate_document ON duplicate_document.id = duplicate.document_id
         WHERE duplicate.hash_sha256 IS NOT NULL
           AND duplicate.hash_sha256 = COALESCE(resource.hash_sha256, legacy.file_hash, document.file_checksum_sha256)
           AND duplicate.document_id <> document.id
           AND duplicate_document.research_ready
       ) AS canonical_variant_ready,
       (legacy.source_url IS NOT NULL OR legacy.canonical_url IS NOT NULL) AS source_page_url_present,
       legacy.pdf_url IS NULL AS original_file_url_missing,
       CASE
         WHEN legacy.pdf_url IS NULL THEN TRUE
         WHEN legacy.pdf_url !~* '^https?://' THEN TRUE
         ELSE FALSE
       END AS url_malformed
     FROM document_processing_state state
     JOIN documents document ON document.id = state.document_id
     JOIN legislative_documents legacy ON legacy.id = document.id
     LEFT JOIN LATERAL (
       SELECT mime_type, file_extension, file_size, hash_sha256
       FROM document_resources resource
       WHERE resource.document_id = document.id
         AND resource.resource_type IN ('pdf', 'text', 'html')
       ORDER BY resource.is_primary DESC, resource.id
       LIMIT 1
     ) resource ON TRUE
     WHERE state.pipeline_stage = 'download'
       AND (state.processing_status = 'failed' OR state.failure_code IS NOT NULL)
   )
   SELECT *
   FROM failed
   ORDER BY updated_at DESC, id
   LIMIT $1`,
  [limit],
);

const groupRows = (rows, key) => {
  const grouped = new Map();
  for (const row of rows) {
    const value = row[key] == null || row[key] === "" ? "unknown" : String(row[key]);
    grouped.set(value, (grouped.get(value) || 0) + 1);
  }
  return [...grouped.entries()]
    .map(([value, documents]) => ({ [key]: value, documents }))
    .sort((left, right) => right.documents - left.documents || String(left[key]).localeCompare(String(right[key])));
};

const sizeRange = (bytes) => {
  const value = Number(bytes || 0);
  if (!value) return "unknown";
  if (value < 1_000) return "<1KB";
  if (value < 100_000) return "1KB-100KB";
  if (value < 1_000_000) return "100KB-1MB";
  if (value < 10_000_000) return "1MB-10MB";
  return ">=10MB";
};

const ageRange = (value) => {
  if (!value) return "unknown";
  const ageDays = Math.floor((Date.now() - new Date(value).getTime()) / 86_400_000);
  if (ageDays < 1) return "<1d";
  if (ageDays < 7) return "1-6d";
  if (ageDays < 30) return "7-29d";
  return ">=30d";
};

const buildReport = async () => {
  const limit = argumentInteger("limit", 1_000, 1, 5_000);
  const sampleLimit = argumentInteger("sample", 25, 0, 100);
  const rows = (await rowsForDownloadFailures(limit)).rows;
  const normalized = rows.map((row) => ({
    ...row,
    id: String(row.id),
    response_size_range: sizeRange(row.file_size_bytes),
    failure_age_range: ageRange(row.last_attempted_at || row.updated_at),
    html_response: ["DOWNLOAD_HTML_RESPONSE"].includes(row.failure_code),
    not_found: ["DOWNLOAD_NOT_FOUND", "HTTP_NOT_FOUND"].includes(row.failure_code),
    access_denied: [
      "DOWNLOAD_ACCESS_DENIED",
      "HTTP_FORBIDDEN",
      "HTTP_UNAUTHORIZED",
    ].includes(row.failure_code),
    dns_failed: row.failure_code === "DOWNLOAD_DNS_FAILED",
    tls_failed: row.failure_code === "DOWNLOAD_TLS_FAILED",
    redirect_loop: row.failure_code === "DOWNLOAD_REDIRECT_LOOP",
    zero_byte: row.failure_code === "DOWNLOAD_ZERO_BYTE",
    truncated: row.failure_code === "DOWNLOAD_TRUNCATED",
    corrupt_or_encrypted: ["PDF_CORRUPT", "PDF_ENCRYPTED"].includes(row.failure_code),
    detailed_message_present: Boolean(row.failure_reason || row.readiness_reason),
  }));
  return {
    generatedAt: new Date().toISOString(),
    sampled: normalized.length,
    grouped: {
      bySource: groupRows(normalized, "source"),
      bySourceDomain: groupRows(normalized, "source_domain"),
      byHttpStatus: groupRows(normalized, "inferred_http_status"),
      byFailureCode: groupRows(normalized, "failure_code"),
      byDocumentType: groupRows(normalized, "document_type"),
      byMimeType: groupRows(normalized, "mime_type"),
      byExpectedExtension: groupRows(normalized, "expected_extension"),
      byResponseSizeRange: groupRows(normalized, "response_size_range"),
      byRetryCount: groupRows(normalized, "retry_count"),
      byFailureAge: groupRows(normalized, "failure_age_range"),
    },
    booleans: {
      validTextArtifactExists: normalized.filter((row) => row.valid_text_artifact_exists).length,
      canonicalVariantReady: normalized.filter((row) => row.canonical_variant_ready).length,
      sourcePageUrlPresent: normalized.filter((row) => row.source_page_url_present).length,
      originalFileUrlMissing: normalized.filter((row) => row.original_file_url_missing).length,
      urlMalformed: normalized.filter((row) => row.url_malformed).length,
      htmlResponse: normalized.filter((row) => row.html_response).length,
      notFound: normalized.filter((row) => row.not_found).length,
      accessDenied: normalized.filter((row) => row.access_denied).length,
      dnsFailed: normalized.filter((row) => row.dns_failed).length,
      tlsFailed: normalized.filter((row) => row.tls_failed).length,
      redirectLoop: normalized.filter((row) => row.redirect_loop).length,
      zeroByte: normalized.filter((row) => row.zero_byte).length,
      truncated: normalized.filter((row) => row.truncated).length,
      corruptOrEncrypted: normalized.filter((row) => row.corrupt_or_encrypted).length,
    },
    sample: normalized.slice(0, sampleLimit).map((row) => ({
      documentId: row.id,
      type: row.document_type,
      title: row.title,
      source: row.source,
      domain: row.source_domain,
      failureCode: row.failure_code,
      retryEligible: row.retry_eligible,
      retryCount: Number(row.retry_count || 0),
      inferredHttpStatus: row.inferred_http_status,
      mimeType: row.mime_type,
      expectedExtension: row.expected_extension,
      responseSizeRange: row.response_size_range,
      sourcePageUrlPresent: row.source_page_url_present,
      originalFileUrlMissing: row.original_file_url_missing,
      urlMalformed: row.url_malformed,
      validTextArtifactExists: row.valid_text_artifact_exists,
      canonicalVariantReady: row.canonical_variant_ready,
      detailedMessagePresent: row.detailed_message_present,
    })),
  };
};

buildReport()
  .then((result) => console.log(JSON.stringify(result, null, 2)))
  .catch((error) => {
    console.error("Download failure report failed:", {
      message: error.message,
      code: error.code || null,
    });
    process.exitCode = 1;
  })
  .finally(async () => {
    if (globalThis.__rashtramPostgresPool) await getPool().end();
  });
