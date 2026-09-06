#!/usr/bin/env node

const path = require("node:path");
require("dotenv").config({
  path: process.env.ENV_FILE || path.resolve(__dirname, "../.env.local"),
});
const { getPool, query } = require("../db");
const { argumentFlag, argumentInteger, argumentValue } = require("./cliArgs");

const main = async () => {
  const apply = argumentFlag("apply");
  const olderThanHours = argumentInteger("older-than-hours", 24, 1, 24 * 365);
  const reason = argumentValue("reason", "mass_corpus_backfill");
  const params = [reason, olderThanHours];
  const predicate = `
    status = 'queued'
    AND requested_by IS NULL
    AND attempt = 0
    AND metadata_json->>'reason' = $1
    AND queued_at < NOW() - ($2 * INTERVAL '1 hour')
  `;
  const matches = await query(`
    SELECT COUNT(*)::INTEGER AS jobs,
      COUNT(DISTINCT document_id)::INTEGER AS documents,
      MIN(queued_at) AS oldest,
      MAX(queued_at) AS newest
    FROM document_processing_jobs
    WHERE ${predicate}
  `, params);
  const sample = await query(`
    SELECT id, document_id, queued_at
    FROM document_processing_jobs
    WHERE ${predicate}
    ORDER BY queued_at, id
    LIMIT 20
  `, params);
  let cancelled = 0;
  if (apply && Number(matches.rows[0]?.jobs || 0) > 0) {
    const result = await query(`
      WITH cancelled AS (
        UPDATE document_processing_jobs
        SET status = 'cancelled', completed_at = NOW(),
          failure_reason = 'Superseded never-claimed system backfill job; Release B uses bounded priority canaries.',
          retry_eligible = TRUE, updated_at = NOW()
        WHERE ${predicate}
        RETURNING id
      )
      SELECT COUNT(*)::INTEGER AS cancelled FROM cancelled
    `, params);
    cancelled = Number(result.rows[0]?.cancelled || 0);
  }
  console.log(JSON.stringify({
    mode: apply ? "apply" : "audit",
    safetyContract: {
      systemOwnedOnly: true,
      neverClaimedOnly: true,
      queuedOnly: true,
      userJobsProtected: true,
    },
    reason,
    olderThanHours,
    matched: matches.rows[0] || {},
    cancelled,
    sample: sample.rows.map((row) => ({
      jobId: String(row.id),
      documentId: String(row.document_id),
      queuedAt: row.queued_at,
    })),
  }, null, 2));
};

main().catch((error) => {
  console.error("Stale system queue reconciliation failed:", {
    message: error.message,
    code: error.code || null,
  });
  process.exitCode = 1;
}).finally(async () => getPool().end());
