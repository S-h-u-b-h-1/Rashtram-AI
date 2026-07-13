require("dotenv").config({
  path: process.env.ENV_FILE || require("path").join(__dirname, "../.env.local"),
});
const { getPool, query } = require("../db");
const { argumentInteger } = require("./cliArgs");

const buildReport = async () => {
  const limit = argumentInteger("limit", 25, 1, 200);
  const [
    checks,
    duplicateGroups,
    sampleInvalidReady,
    sampleFailedWithChunks,
    sampleStateMismatch,
  ] = await Promise.all([
    query(`
      SELECT
        COUNT(*) FILTER (
          WHERE document.research_ready
            AND NOT (
              state.processing_status = 'ready'
              AND state.extraction_status = 'ready'
              AND state.chunking_status = 'ready'
              AND state.chunks_count > 0
              AND state.retrieval_verified
              AND state.error_message IS NULL
            )
        )::INTEGER AS invalid_research_ready,
        COUNT(*) FILTER (
          WHERE document.comparison_ready AND NOT document.research_ready
        )::INTEGER AS comparison_without_research,
        COUNT(*) FILTER (
          WHERE state.research_ready IS DISTINCT FROM document.research_ready
             OR state.comparison_ready IS DISTINCT FROM document.comparison_ready
        )::INTEGER AS state_document_flag_mismatch,
        COUNT(*) FILTER (
          WHERE state.processing_status = 'failed'
            AND state.chunks_count > 0
        )::INTEGER AS failed_with_chunks,
        COUNT(*) FILTER (
          WHERE state.processing_status = 'ready'
            AND state.chunks_count = 0
        )::INTEGER AS ready_without_chunks,
        COUNT(*) FILTER (
          WHERE state.failure_code IS NULL
            AND state.processing_status = 'failed'
        )::INTEGER AS failed_without_failure_code,
        COUNT(*) FILTER (
          WHERE state.failure_code IS NOT NULL
            AND state.pipeline_stage IS NULL
        )::INTEGER AS coded_without_pipeline_stage,
        COUNT(*) FILTER (
          WHERE state.retry_eligible = FALSE
            AND state.readiness_class = 'processing_failed_retriable'
        )::INTEGER AS non_retryable_marked_retriable,
        COUNT(*) FILTER (
          WHERE state.retry_eligible = TRUE
            AND state.readiness_class = 'processing_failed_permanent'
        )::INTEGER AS retryable_marked_permanent
      FROM documents document
      LEFT JOIN document_processing_state state ON state.document_id = document.id
    `),
    query(`
      WITH normalized AS (
        SELECT
          COALESCE(NULLIF(file_checksum_sha256, ''), NULLIF(content_fingerprint_sha256, '')) AS fingerprint,
          COUNT(*)::INTEGER AS documents
        FROM documents
        WHERE COALESCE(NULLIF(file_checksum_sha256, ''), NULLIF(content_fingerprint_sha256, '')) IS NOT NULL
        GROUP BY COALESCE(NULLIF(file_checksum_sha256, ''), NULLIF(content_fingerprint_sha256, ''))
        HAVING COUNT(*) > 1
      )
      SELECT
        COUNT(*)::INTEGER AS duplicate_groups,
        COALESCE(SUM(documents), 0)::INTEGER AS documents_in_duplicate_groups,
        COALESCE(MAX(documents), 0)::INTEGER AS largest_group
      FROM normalized
    `),
    query(
      `SELECT
         document.id,
         document.document_type,
         document.title,
         document.research_ready,
         document.comparison_ready,
         state.processing_status,
         state.extraction_status,
         state.chunking_status,
         state.embedding_status,
         state.chunks_count,
         state.retrieval_verified,
         state.readiness_class
       FROM documents document
       LEFT JOIN document_processing_state state ON state.document_id = document.id
       WHERE document.research_ready
         AND NOT (
           state.processing_status = 'ready'
           AND state.extraction_status = 'ready'
           AND state.chunking_status = 'ready'
           AND state.chunks_count > 0
           AND state.retrieval_verified
           AND state.error_message IS NULL
         )
       ORDER BY document.updated_at DESC
       LIMIT $1`,
      [limit],
    ),
    query(
      `SELECT
         document.id,
         document.document_type,
         document.title,
         state.processing_status,
         state.failure_code,
         state.pipeline_stage,
         state.chunks_count,
         state.embeddings_count,
         state.readiness_class,
         state.updated_at
       FROM document_processing_state state
       JOIN documents document ON document.id = state.document_id
       WHERE state.processing_status = 'failed'
         AND state.chunks_count > 0
       ORDER BY state.updated_at DESC
       LIMIT $1`,
      [limit],
    ),
    query(
      `SELECT
         document.id,
         document.document_type,
         document.title,
         document.research_ready AS document_research_ready,
         document.comparison_ready AS document_comparison_ready,
         state.research_ready AS state_research_ready,
         state.comparison_ready AS state_comparison_ready,
         state.readiness_class,
         state.updated_at
       FROM documents document
       JOIN document_processing_state state ON state.document_id = document.id
       WHERE state.research_ready IS DISTINCT FROM document.research_ready
          OR state.comparison_ready IS DISTINCT FROM document.comparison_ready
       ORDER BY state.updated_at DESC
       LIMIT $1`,
      [limit],
    ),
  ]);

  const stringifyIds = (rows) =>
    rows.map((row) => ({ ...row, id: String(row.id) }));

  return {
    generatedAt: new Date().toISOString(),
    checks: {
      ...(checks.rows[0] || {}),
      ...(duplicateGroups.rows[0] || {}),
    },
    samples: {
      invalidResearchReady: stringifyIds(sampleInvalidReady.rows),
      failedWithChunks: stringifyIds(sampleFailedWithChunks.rows),
      stateDocumentFlagMismatch: stringifyIds(sampleStateMismatch.rows),
    },
  };
};

buildReport()
  .then((report) => console.log(JSON.stringify(report, null, 2)))
  .catch((error) => {
    console.error("Processing consistency report failed:", {
      message: error.message,
      code: error.code || null,
    });
    process.exitCode = 1;
  })
  .finally(async () => {
    if (globalThis.__rashtramPostgresPool) await getPool().end();
  });
