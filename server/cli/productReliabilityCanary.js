require("dotenv").config({
  path: process.env.ENV_FILE || require("path").join(__dirname, "../.env.local"),
});
const { getPool, query } = require("../db");
const { argumentFlag, argumentInteger } = require("./cliArgs");
const { indexDocumentTree } = require("../document/documentStructureService");
const { ensureResearchProfile } = require("../document/researchProfileService");

const apply = argumentFlag("apply");
const limit = argumentInteger("limit", 20, 20, 50);

const run = async () => {
  const selected = await query(`SELECT document.id, document.title,
      document.document_type, state.chunks_count
    FROM documents document
    JOIN document_processing_state state ON state.document_id = document.id
    WHERE document.visibility_status = 'public'
      AND state.search_ready = TRUE
      AND state.chunks_count >= 30
    ORDER BY state.chunks_count DESC, document.quality_score DESC, document.id
    LIMIT $1`, [limit]);
  const results = [];
  for (const document of selected.rows) {
    const tree = await indexDocumentTree({ documentId: document.id, dryRun: !apply });
    const profile = apply
      ? await ensureResearchProfile({ documentId: document.id })
      : { documentId: String(document.id), status: "dry_run" };
    const { nodes: _nodes, ...treeMetrics } = tree;
    results.push({
      documentId: String(document.id), title: document.title,
      documentType: document.document_type, chunks: Number(document.chunks_count),
      tree: treeMetrics, profile,
    });
  }
  const durations = results.map((item) => Number(item.tree.durationMs || 0)).sort((a, b) => a - b);
  console.log(JSON.stringify({
    mode: apply ? "apply" : "dry_run",
    requested: limit,
    selected: results.length,
    treeNodes: results.reduce((sum, item) => sum + item.tree.nodeCount, 0),
    treeAverageMs: durations.length ? Math.round(durations.reduce((sum, value) => sum + value, 0) / durations.length) : 0,
    treeP50Ms: durations[Math.floor(durations.length * 0.5)] || 0,
    treeP95Ms: durations[Math.min(durations.length - 1, Math.floor(durations.length * 0.95))] || 0,
    results,
  }, null, 2));
};

run().catch((error) => {
  console.error("Product Reliability V4 canary failed:", error.message);
  process.exitCode = 1;
}).finally(async () => {
  if (globalThis.__rashtramPostgresPool) await getPool().end();
});
