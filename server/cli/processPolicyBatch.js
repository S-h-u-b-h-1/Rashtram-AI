require("dotenv").config({
  path: process.env.ENV_FILE || require("path").join(__dirname, "../.env.local"),
});

const { getPool, query } = require("../db");
const { prepareDocument } = require("../document/readinessService");

const argumentValue = (name, fallback = null) => {
  const exact = `--${name}`;
  const item = process.argv.find(
    (value) => value === exact || value.startsWith(`${exact}=`),
  );
  if (!item) return fallback;
  return item === exact ? true : item.slice(exact.length + 1);
};

const clamp = (value, fallback, minimum, maximum) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed)
    ? Math.min(Math.max(parsed, minimum), maximum)
    : fallback;
};

const selectPolicyIds = async (limit) => {
  const result = await query(
    `SELECT document.id
     FROM documents document
     JOIN legislative_documents legacy ON legacy.id = document.id
     LEFT JOIN document_processing_state state ON state.document_id = document.id
     WHERE document.document_type IN ('policy', 'report')
       AND document.visibility_status = 'public'
       AND COALESCE(legacy.canonical_source, legacy.source_name)
         IN ('policyedge', 'policy-edge')
       AND COALESCE(legacy.canonical_url, legacy.source_url) IS NOT NULL
       AND NOT COALESCE(state.research_ready, document.research_ready, FALSE)
       AND (
         state.document_id IS NULL
         OR state.readiness_class IN (
           'source_only',
           'source_extractable_not_processed',
           'processing_failed_retriable',
           'processing_failed_permanent'
         )
         OR state.processing_status IN ('not_started', 'pending', 'failed')
       )
     ORDER BY document.quality_score DESC, document.updated_at DESC, document.id
     LIMIT $1`,
    [limit],
  );
  return result.rows.map((row) => String(row.id));
};

const run = async () => {
  const limit = clamp(argumentValue("limit", 25), 25, 1, 100);
  const concurrency = clamp(argumentValue("concurrency", 3), 3, 1, 4);
  const ids = await selectPolicyIds(limit);
  const results = [];
  let cursor = 0;
  const worker = async () => {
    while (cursor < ids.length) {
      const id = ids[cursor];
      cursor += 1;
      try {
        const result = await prepareDocument(id, {
          priority: 100,
          reason: "policy_readiness_batch",
          discoverGraph: false,
        });
        results.push({
          documentId: id,
          status: result.comparisonReady ? "ready" : "processed",
          chunksStored: result.chunksStored,
        });
      } catch (error) {
        results.push({
          documentId: id,
          status: error.processingFailure?.permanent
            ? "dead_letter"
            : "failed",
          error: String(error.message || error).slice(0, 500),
          classification:
            error.processingFailure?.readinessClass ||
            "processing_failed_retriable",
        });
      }
    }
  };
  await Promise.all(
    Array.from({ length: Math.min(concurrency, ids.length) }, () => worker()),
  );

  console.log(JSON.stringify({
    requested: limit,
    concurrency,
    selected: ids.length,
    ready: results.filter((item) => item.status === "ready").length,
    failed: results.filter((item) => item.status !== "ready").length,
    results,
  }, null, 2));
};

if (require.main === module) run()
  .catch((error) => {
    console.error("Policy batch processing failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    if (globalThis.__rashtramPostgresPool) await getPool().end();
  });

module.exports = { selectPolicyIds };
