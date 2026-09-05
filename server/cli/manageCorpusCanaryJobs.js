#!/usr/bin/env node

const path = require("node:path");
require("dotenv").config({
  path: process.env.ENV_FILE || path.resolve(__dirname, "../.env.local"),
});
const { getPool, query } = require("../db");
const { argumentFlag, argumentValue } = require("./cliArgs");

const main = async () => {
  const after = argumentValue("after");
  if (!after || Number.isNaN(new Date(after).getTime())) {
    throw new Error("A valid --after=<ISO timestamp> is required.");
  }
  const apply = argumentFlag("apply");
  const includeRunning = argumentFlag("include-running");
  const reason = argumentValue("reason", "mass_corpus_backfill");
  const matches = await query(`
    SELECT id, document_id, status, attempt, queued_at
    FROM document_processing_jobs
    WHERE status = ANY($3::TEXT[])
      AND queued_at >= $1::TIMESTAMPTZ
      AND metadata_json->>'reason' = $2
    ORDER BY id
  `, [after, reason, includeRunning ? ["queued", "running"] : ["queued"]]);
  let cancelled = [];
  if (apply && matches.rows.length) {
    const result = await query(`
      UPDATE document_processing_jobs
      SET status = 'cancelled', completed_at = NOW(),
        failure_reason = 'Release B canary cancelled before claim after an operator abort.',
        retry_eligible = TRUE, updated_at = NOW()
      WHERE id = ANY($1::BIGINT[])
        AND status = ANY($2::TEXT[])
      RETURNING id, document_id
    `, [
      matches.rows.map((row) => row.id),
      includeRunning ? ["queued", "running"] : ["queued"],
    ]);
    cancelled = result.rows;
  }
  console.log(JSON.stringify({
    mode: apply ? "apply" : "audit",
    after: new Date(after).toISOString(),
    reason,
    includeRunning,
    matched: matches.rows.length,
    cancelled: cancelled.length,
    sample: matches.rows.slice(0, 20).map((row) => ({
      jobId: String(row.id), documentId: String(row.document_id),
      attempt: Number(row.attempt || 0), queuedAt: row.queued_at,
    })),
  }, null, 2));
};

main().catch((error) => {
  console.error("Corpus canary job management failed:", {
    message: error.message, code: error.code || null,
  });
  process.exitCode = 1;
}).finally(async () => getPool().end());
