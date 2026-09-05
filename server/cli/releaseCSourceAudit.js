#!/usr/bin/env node

const path = require("path");
require("dotenv").config({
  path: process.env.ENV_FILE || path.resolve(__dirname, "../.env.local"),
});

const { getPool, query } = require("../db");
const {
  SOURCE_REGISTRY,
  getSourceHealth,
} = require("../dashboard/intelligenceService");

const main = async () => {
  const [sources, states] = await Promise.all([
    getSourceHealth(),
    query(
      `SELECT COALESCE(d.jurisdiction, 'Unknown') AS jurisdiction,
              COUNT(*)::INTEGER AS documents
         FROM document_sources ds
         JOIN documents d ON d.id = ds.document_id
        WHERE ds.source_name = ANY($1::TEXT[])
        GROUP BY 1
        ORDER BY documents DESC, jurisdiction ASC`,
      [["state-legislature"]],
    ),
  ]);
  const statusCounts = sources.reduce((counts, source) => {
    counts[source.freshnessStatus] = (counts[source.freshnessStatus] || 0) + 1;
    return counts;
  }, {});
  console.log(JSON.stringify({
    audit: "RELEASE_C_SOURCE_FRESHNESS",
    readOnly: true,
    checkedAt: new Date().toISOString(),
    configuredConnectors: SOURCE_REGISTRY.length,
    statusCounts,
    stateCorpusVolume: states.rows,
    sources: sources.map((source) => ({
      connector: source.key,
      authorityClass: source.authorityClass,
      sourceLabel: source.sourceLabel,
      enabled: source.enabled,
      expectedCadence: source.expectedCadence,
      lastAttempt: source.lastAttempt,
      lastSuccess: source.lastSuccess,
      lastDocumentSeen: source.lastDocumentSeen,
      lastChangeSeen: source.lastChangeSeen,
      freshnessStatus: source.freshnessStatus,
      failureClass: source.failureClass,
      errorSummary: source.errorSummary,
      consecutiveFailures: source.consecutiveFailures,
      cooldownUntil: source.cooldownUntil,
      documentCount: source.documentCount,
    })),
  }, null, 2));
};

if (require.main === module) {
  main()
    .catch((error) => {
      console.error(error.message);
      process.exitCode = 1;
    })
    .finally(async () => {
      if (globalThis.__rashtramPostgresPool) await getPool().end();
    });
}

module.exports = { main };
