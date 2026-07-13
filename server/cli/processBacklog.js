require("dotenv").config({
  path: process.env.ENV_FILE || require("path").join(__dirname, "../.env.local"),
});
const { getPool, query } = require("../db");
const { argumentInteger, argumentValue } = require("./cliArgs");

const BACKLOG_CLASSES = [
  "pdf_available_not_processed",
  "source_extractable_not_processed",
  "processing_pending",
  "processing_failed_retriable",
  "ocr_required",
  "source_only",
  "missing_pdf",
];

const buildReport = async () => {
  const limit = argumentInteger("limit", 25, 1, 200);
  const source = argumentValue("source");
  const type = argumentValue("type");
  const filters = [`state.readiness_class = ANY($1::TEXT[])`];
  const params = [BACKLOG_CLASSES];
  if (source) {
    params.push(String(source).toLowerCase());
    filters.push(`LOWER(COALESCE(legacy.canonical_source, legacy.source_name, '')) = $${params.length}`);
  }
  if (type) {
    params.push(String(type).toLowerCase().replace(/-/g, "_"));
    filters.push(`LOWER(document.document_type) = $${params.length}`);
  }
  const where = `WHERE ${filters.join(" AND ")}`;

  const [
    totals,
    byClass,
    byStage,
    bySource,
    byType,
    sample,
  ] = await Promise.all([
    query(
      `SELECT
         COUNT(*)::INTEGER AS backlog,
         COUNT(*) FILTER (WHERE state.retry_eligible)::INTEGER AS retry_eligible,
         COUNT(*) FILTER (WHERE state.readiness_class IN (
           'pdf_available_not_processed',
           'source_extractable_not_processed',
           'processing_failed_retriable',
           'ocr_required'
         ))::INTEGER AS processable_now,
         COUNT(*) FILTER (WHERE state.readiness_class IN ('source_only', 'missing_pdf'))::INTEGER AS requires_source_repair
       FROM document_processing_state state
       JOIN documents document ON document.id = state.document_id
       JOIN legislative_documents legacy ON legacy.id = document.id
       ${where}`,
      params,
    ),
    query(
      `SELECT state.readiness_class, COUNT(*)::INTEGER AS documents
       FROM document_processing_state state
       JOIN documents document ON document.id = state.document_id
       JOIN legislative_documents legacy ON legacy.id = document.id
       ${where}
       GROUP BY state.readiness_class
       ORDER BY documents DESC, state.readiness_class`,
      params,
    ),
    query(
      `SELECT COALESCE(state.pipeline_stage, state.failure_stage, 'not_started') AS pipeline_stage,
        COUNT(*)::INTEGER AS documents
       FROM document_processing_state state
       JOIN documents document ON document.id = state.document_id
       JOIN legislative_documents legacy ON legacy.id = document.id
       ${where}
       GROUP BY COALESCE(state.pipeline_stage, state.failure_stage, 'not_started')
       ORDER BY documents DESC, pipeline_stage`,
      params,
    ),
    query(
      `SELECT COALESCE(legacy.canonical_source, legacy.source_name, 'unknown') AS source,
        COUNT(*)::INTEGER AS documents
       FROM document_processing_state state
       JOIN documents document ON document.id = state.document_id
       JOIN legislative_documents legacy ON legacy.id = document.id
       ${where}
       GROUP BY COALESCE(legacy.canonical_source, legacy.source_name, 'unknown')
       ORDER BY documents DESC, source
       LIMIT ${limit}`,
      params,
    ),
    query(
      `SELECT document.document_type, COUNT(*)::INTEGER AS documents
       FROM document_processing_state state
       JOIN documents document ON document.id = state.document_id
       JOIN legislative_documents legacy ON legacy.id = document.id
       ${where}
       GROUP BY document.document_type
       ORDER BY documents DESC, document.document_type`,
      params,
    ),
    query(
      `SELECT
         state.document_id,
         document.document_type,
         document.title,
         COALESCE(legacy.canonical_source, legacy.source_name, 'unknown') AS source,
         state.readiness_class,
         state.failure_code,
         state.retry_eligible,
         state.retry_count,
         state.updated_at
       FROM document_processing_state state
       JOIN documents document ON document.id = state.document_id
       JOIN legislative_documents legacy ON legacy.id = document.id
       ${where}
       ORDER BY
         CASE
           WHEN state.readiness_class = 'processing_failed_retriable' THEN 1
           WHEN state.readiness_class = 'pdf_available_not_processed' THEN 2
           WHEN state.readiness_class = 'source_extractable_not_processed' THEN 3
           ELSE 4
         END,
         state.updated_at ASC
       LIMIT ${limit}`,
      params,
    ),
  ]);

  return {
    generatedAt: new Date().toISOString(),
    filters: { source: source || null, type: type || null, limit },
    totals: totals.rows[0] || {},
    grouped: {
      byReadinessClass: byClass.rows,
      byPipelineStage: byStage.rows,
      bySource: bySource.rows,
      byDocumentType: byType.rows,
    },
    suggestedNextBatch: sample.rows.map((row) => ({
      ...row,
      document_id: String(row.document_id),
    })),
  };
};

buildReport()
  .then((report) => console.log(JSON.stringify(report, null, 2)))
  .catch((error) => {
    console.error("Processing backlog report failed:", {
      message: error.message,
      code: error.code || null,
    });
    process.exitCode = 1;
  })
  .finally(async () => {
    if (globalThis.__rashtramPostgresPool) await getPool().end();
  });
