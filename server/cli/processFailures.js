require("dotenv").config({
  path: process.env.ENV_FILE || require("path").join(__dirname, "../.env.local"),
});
const { getPool, query } = require("../db");
const { argumentInteger, argumentValue } = require("./cliArgs");

const buildReport = async () => {
  const limit = argumentInteger("limit", 25, 1, 200);
  const source = argumentValue("source");
  const type = argumentValue("type");
  const filters = [];
  const params = [];
  if (source) {
    params.push(String(source).toLowerCase());
    filters.push(`LOWER(COALESCE(legacy.canonical_source, legacy.source_name, '')) = $${params.length}`);
  }
  if (type) {
    params.push(String(type).toLowerCase().replace(/-/g, "_"));
    filters.push(`LOWER(document.document_type) = $${params.length}`);
  }
  const where = filters.length ? `WHERE ${filters.join(" AND ")}` : "";

  const [
    totals,
    byFailureCode,
    byStage,
    bySource,
    byType,
    byMime,
    extraction,
    retry,
    quality,
    recent,
  ] = await Promise.all([
    query(
      `SELECT
         COUNT(*)::INTEGER AS documents,
         COUNT(*) FILTER (WHERE state.processing_status = 'failed')::INTEGER AS failed,
         COUNT(*) FILTER (WHERE state.readiness_class = 'processing_failed_retriable')::INTEGER AS retriable_class,
         COUNT(*) FILTER (WHERE state.readiness_class = 'processing_failed_permanent')::INTEGER AS permanent_class,
         COUNT(*) FILTER (
           WHERE state.retry_eligible
             AND (state.processing_status = 'failed' OR state.failure_code IS NOT NULL)
         )::INTEGER AS retry_eligible_failures,
         COUNT(*) FILTER (WHERE state.failure_code IS NULL AND state.processing_status = 'failed')::INTEGER AS uncoded_failures,
         COUNT(*) FILTER (WHERE resource.document_id IS NOT NULL)::INTEGER AS with_accessible_resource,
         COUNT(*) FILTER (WHERE pdf.document_id IS NOT NULL)::INTEGER AS with_accessible_pdf
       FROM document_processing_state state
       JOIN documents document ON document.id = state.document_id
       JOIN legislative_documents legacy ON legacy.id = document.id
       LEFT JOIN LATERAL (
         SELECT 1 AS document_id
         FROM document_resources resource
         WHERE resource.document_id = document.id
           AND resource.resource_type IN ('pdf', 'text', 'html')
           AND resource.is_accessible
         LIMIT 1
       ) resource ON TRUE
       LEFT JOIN LATERAL (
         SELECT 1 AS document_id
         FROM document_resources resource
         WHERE resource.document_id = document.id
           AND resource.resource_type = 'pdf'
           AND resource.is_accessible
         LIMIT 1
       ) pdf ON TRUE
       ${where}`,
      params,
    ),
    query(
      `SELECT
         COALESCE(state.failure_code, 'UNCODED') AS failure_code,
         COALESCE(state.retry_eligible, FALSE) AS retry_eligible,
         COUNT(*)::INTEGER AS documents
       FROM document_processing_state state
       JOIN documents document ON document.id = state.document_id
       JOIN legislative_documents legacy ON legacy.id = document.id
       WHERE (state.processing_status = 'failed' OR state.failure_code IS NOT NULL)
         ${filters.length ? `AND ${filters.join(" AND ")}` : ""}
       GROUP BY COALESCE(state.failure_code, 'UNCODED'), COALESCE(state.retry_eligible, FALSE)
       ORDER BY documents DESC, failure_code
       LIMIT ${limit}`,
      params,
    ),
    query(
      `SELECT
         COALESCE(state.pipeline_stage, state.failure_stage, 'unknown') AS pipeline_stage,
         COUNT(*)::INTEGER AS documents
       FROM document_processing_state state
       JOIN documents document ON document.id = state.document_id
       JOIN legislative_documents legacy ON legacy.id = document.id
       WHERE (state.processing_status = 'failed' OR state.failure_code IS NOT NULL)
         ${filters.length ? `AND ${filters.join(" AND ")}` : ""}
       GROUP BY COALESCE(state.pipeline_stage, state.failure_stage, 'unknown')
       ORDER BY documents DESC, pipeline_stage
       LIMIT ${limit}`,
      params,
    ),
    query(
      `SELECT
         COALESCE(legacy.canonical_source, legacy.source_name, 'unknown') AS source,
         COUNT(*)::INTEGER AS documents,
         COUNT(*) FILTER (WHERE state.retry_eligible)::INTEGER AS retry_eligible
       FROM document_processing_state state
       JOIN documents document ON document.id = state.document_id
       JOIN legislative_documents legacy ON legacy.id = document.id
       WHERE (state.processing_status = 'failed' OR state.failure_code IS NOT NULL)
         ${filters.length ? `AND ${filters.join(" AND ")}` : ""}
       GROUP BY COALESCE(legacy.canonical_source, legacy.source_name, 'unknown')
       ORDER BY documents DESC, source
       LIMIT ${limit}`,
      params,
    ),
    query(
      `SELECT
         document.document_type,
         COUNT(*)::INTEGER AS documents,
         COUNT(*) FILTER (WHERE state.retry_eligible)::INTEGER AS retry_eligible
       FROM document_processing_state state
       JOIN documents document ON document.id = state.document_id
       JOIN legislative_documents legacy ON legacy.id = document.id
       WHERE (state.processing_status = 'failed' OR state.failure_code IS NOT NULL)
         ${filters.length ? `AND ${filters.join(" AND ")}` : ""}
       GROUP BY document.document_type
       ORDER BY documents DESC, document.document_type
       LIMIT ${limit}`,
      params,
    ),
    query(
      `SELECT
         COALESCE(resource.mime_type, legacy.mime_type, 'unknown') AS mime_type,
         COUNT(*)::INTEGER AS documents
       FROM document_processing_state state
       JOIN documents document ON document.id = state.document_id
       JOIN legislative_documents legacy ON legacy.id = document.id
       LEFT JOIN LATERAL (
         SELECT mime_type
         FROM document_resources resource
         WHERE resource.document_id = document.id
           AND resource.resource_type IN ('pdf', 'text', 'html')
         ORDER BY resource.is_primary DESC, resource.id
         LIMIT 1
       ) resource ON TRUE
       WHERE (state.processing_status = 'failed' OR state.failure_code IS NOT NULL)
         ${filters.length ? `AND ${filters.join(" AND ")}` : ""}
       GROUP BY COALESCE(resource.mime_type, legacy.mime_type, 'unknown')
       ORDER BY documents DESC, mime_type
       LIMIT ${limit}`,
      params,
    ),
    query(
      `SELECT
         COALESCE(state.extraction_method, artifact.extraction_method, 'unknown') AS extraction_method,
         COUNT(*)::INTEGER AS documents
       FROM document_processing_state state
       JOIN documents document ON document.id = state.document_id
       JOIN legislative_documents legacy ON legacy.id = document.id
       LEFT JOIN document_text_artifacts artifact ON artifact.document_id = document.id
       WHERE (state.processing_status = 'failed' OR state.failure_code IS NOT NULL)
         ${filters.length ? `AND ${filters.join(" AND ")}` : ""}
       GROUP BY COALESCE(state.extraction_method, artifact.extraction_method, 'unknown')
       ORDER BY documents DESC, extraction_method
       LIMIT ${limit}`,
      params,
    ),
    query(
      `SELECT
         state.retry_count,
         COUNT(*)::INTEGER AS documents
       FROM document_processing_state state
       JOIN documents document ON document.id = state.document_id
       JOIN legislative_documents legacy ON legacy.id = document.id
       WHERE (state.processing_status = 'failed' OR state.failure_code IS NOT NULL)
         ${filters.length ? `AND ${filters.join(" AND ")}` : ""}
       GROUP BY state.retry_count
       ORDER BY state.retry_count`,
      params,
    ),
    query(
      `SELECT
         COUNT(*) FILTER (WHERE state.failure_code IN ('SOURCE_URL_MISSING', 'DOWNLOAD_URL_MISSING'))::INTEGER AS source_missing,
         COUNT(*) FILTER (WHERE state.failure_code IN ('HTTP_NOT_FOUND', 'HTTP_FORBIDDEN', 'HTTP_UNAUTHORIZED', 'DOWNLOAD_NOT_FOUND', 'DOWNLOAD_ACCESS_DENIED'))::INTEGER AS inaccessible_source,
         COUNT(*) FILTER (WHERE state.failure_code IN ('PDF_CORRUPT', 'PDF_ENCRYPTED'))::INTEGER AS corrupt_or_encrypted_pdf,
         COUNT(*) FILTER (WHERE state.failure_code = 'PDF_SCANNED_OCR_REQUIRED')::INTEGER AS scanned_ocr_required,
         COUNT(*) FILTER (WHERE state.failure_code IN ('TEXT_EXTRACTION_EMPTY', 'TEXT_EXTRACTION_TOO_SHORT', 'TEXT_ENCODING_UNSUPPORTED', 'CHUNKING_EMPTY'))::INTEGER AS unusable_text,
         COUNT(*) FILTER (WHERE state.failure_code IN ('SUMMARY_PROVIDER_ERROR', 'PROVIDER_AUTH_ERROR', 'PROVIDER_QUOTA_ERROR'))::INTEGER AS ai_provider_failures,
         COUNT(*) FILTER (WHERE state.failure_code IN ('EMBEDDING_PROVIDER_ERROR', 'VECTOR_STORE_ERROR'))::INTEGER AS embedding_or_vector_failures,
         COUNT(*) FILTER (
           WHERE state.processing_status = 'failed'
             AND state.chunks_count > 0
         )::INTEGER AS failed_despite_chunks
       FROM document_processing_state state
       JOIN documents document ON document.id = state.document_id
       JOIN legislative_documents legacy ON legacy.id = document.id
       ${where}`,
      params,
    ),
    query(
      `SELECT
         state.document_id,
         document.document_type,
         document.title,
         COALESCE(legacy.canonical_source, legacy.source_name, 'unknown') AS source,
         state.processing_status,
         state.failure_code,
         state.pipeline_stage,
         state.retry_eligible,
         state.retry_count,
         state.readiness_class,
         state.last_attempted_at,
         state.updated_at
       FROM document_processing_state state
       JOIN documents document ON document.id = state.document_id
       JOIN legislative_documents legacy ON legacy.id = document.id
       WHERE (state.processing_status = 'failed' OR state.failure_code IS NOT NULL)
         ${filters.length ? `AND ${filters.join(" AND ")}` : ""}
       ORDER BY state.updated_at DESC
       LIMIT ${limit}`,
      params,
    ),
  ]);

  return {
    generatedAt: new Date().toISOString(),
    filters: { source: source || null, type: type || null, limit },
    totals: totals.rows[0] || {},
    grouped: {
      byFailureCode: byFailureCode.rows,
      byPipelineStage: byStage.rows,
      bySource: bySource.rows,
      byDocumentType: byType.rows,
      byMimeType: byMime.rows,
      byExtractionMethod: extraction.rows,
      byRetryCount: retry.rows,
    },
    qualitySignals: quality.rows[0] || {},
    recentFailures: recent.rows.map((row) => ({
      ...row,
      document_id: String(row.document_id),
    })),
  };
};

buildReport()
  .then((report) => console.log(JSON.stringify(report, null, 2)))
  .catch((error) => {
    console.error("Processing failure analysis failed:", {
      message: error.message,
      code: error.code || null,
    });
    process.exitCode = 1;
  })
  .finally(async () => {
    if (globalThis.__rashtramPostgresPool) await getPool().end();
  });
