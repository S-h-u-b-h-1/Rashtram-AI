require("dotenv").config({
  path: process.env.ENV_FILE || require("path").join(__dirname, "../.env.local"),
});
const { getPool, query } = require("../db");
const { argumentFlag, argumentInteger, argumentValue } = require("./cliArgs");

const buildReport = async () => {
  const enqueue = argumentFlag("enqueue");
  const limit = argumentInteger("limit", 50, 1, 500);
  const failureCode = argumentValue("failure-code");
  const source = argumentValue("source");
  const type = argumentValue("type");
  const maxRetryCount = argumentInteger("max-retry-count", 3, 0, 20);
  const priority = argumentInteger("priority", 55, 1, 100);

  const params = [limit, maxRetryCount];
  const filters = [
    "state.retry_eligible = TRUE",
    "state.readiness_class = 'processing_failed_retriable'",
    "state.retry_count <= $2",
    "document.visibility_status = 'public'",
    `NOT EXISTS (
       SELECT 1
       FROM document_processing_jobs active
       WHERE active.document_id = state.document_id
         AND active.status IN ('queued', 'running')
     )`,
  ];
  if (failureCode) {
    params.push(String(failureCode).toUpperCase());
    filters.push(`state.failure_code = $${params.length}`);
  }
  if (source) {
    params.push(String(source).toLowerCase());
    filters.push(`LOWER(COALESCE(legacy.canonical_source, legacy.source_name, '')) = $${params.length}`);
  }
  if (type) {
    params.push(String(type).toLowerCase().replace(/-/g, "_"));
    filters.push(`LOWER(document.document_type) = $${params.length}`);
  }

  const candidateSql = `
    SELECT
      state.document_id,
      document.document_type,
      document.title,
      COALESCE(legacy.canonical_source, legacy.source_name, 'unknown') AS source,
      state.failure_code,
      state.pipeline_stage,
      state.retry_count,
      state.readiness_reason,
      state.updated_at
    FROM document_processing_state state
    JOIN documents document ON document.id = state.document_id
    JOIN legislative_documents legacy ON legacy.id = document.id
    WHERE ${filters.join(" AND ")}
    ORDER BY state.retry_count ASC, state.updated_at ASC
    LIMIT $1
  `;

  const candidates = await query(candidateSql, params);
  let enqueued = [];
  if (enqueue && candidates.rows.length) {
    const ids = candidates.rows.map((row) => row.document_id);
    const enqueueResult = await query(
      `INSERT INTO document_processing_jobs (
         document_id, priority, metadata_json, source_host, max_attempts
       )
       SELECT
         state.document_id,
         $2,
         JSONB_BUILD_OBJECT(
           'reason', 'retryable_failure_backfill',
           'failureCode', state.failure_code,
           'requestedBy', 'process:retryable'
         ),
         NULLIF(LOWER(SUBSTRING((
           SELECT COALESCE(legacy.pdf_url, legacy.canonical_url, legacy.source_url)
           FROM legislative_documents legacy
           WHERE legacy.id = state.document_id
         ) FROM '^[a-z]+://([^/:]+)')), ''),
         3
       FROM document_processing_state state
       WHERE state.document_id = ANY($1::BIGINT[])
       ON CONFLICT (document_id)
         WHERE status IN ('queued', 'running')
       DO NOTHING
       RETURNING document_id, id AS job_id`,
      [ids, priority],
    );
    enqueued = enqueueResult.rows;
  }

  return {
    generatedAt: new Date().toISOString(),
    mode: enqueue ? "enqueue" : "dry_run",
    filters: {
      limit,
      failureCode: failureCode || null,
      source: source || null,
      type: type || null,
      maxRetryCount,
      priority,
    },
    candidates: candidates.rows.map((row) => ({
      ...row,
      document_id: String(row.document_id),
    })),
    enqueued: enqueued.map((row) => ({
      documentId: String(row.document_id),
      jobId: String(row.job_id),
    })),
    note: enqueue
      ? "Queued only candidates without an active queued/running job."
      : "Dry run only. Pass --enqueue to create jobs.",
  };
};

buildReport()
  .then((report) => console.log(JSON.stringify(report, null, 2)))
  .catch((error) => {
    console.error("Retryable processing report failed:", {
      message: error.message,
      code: error.code || null,
    });
    process.exitCode = 1;
  })
  .finally(async () => {
    if (globalThis.__rashtramPostgresPool) await getPool().end();
  });
