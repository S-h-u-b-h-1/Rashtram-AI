#!/usr/bin/env node

const fs = require("node:fs");
const path = require("node:path");
require("dotenv").config({
  path: process.env.ENV_FILE || path.resolve(__dirname, "../.env.local"),
});
const { getPool } = require("../db");
const { argumentFlag, argumentInteger, argumentValue } = require("./cliArgs");
const { runCorpusRecoveryWave } = require("../document/corpusRecoveryService");

const main = async () => {
  const requested = argumentInteger("limit", 5, 1, 500);
  const concurrency = argumentInteger("concurrency", 1, 1, 4);
  const report = await runCorpusRecoveryWave({
    requested,
    concurrency,
    oneDocumentPerSource: argumentFlag("one-per-source"),
    maxWallClockMs: argumentInteger("max-minutes", 60, 1, 60) * 60_000,
  });
  const output = argumentValue("output");
  if (output) {
    const outputPath = path.resolve(output);
    fs.writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`, { mode: 0o600 });
  }
  console.log(JSON.stringify({
    generatedAt: report.generatedAt,
    runId: report.runId,
    requested: report.requested,
    attempted: report.attempted,
    recovered: report.recovered,
    failed: report.failed,
    retryableFailures: report.retryableFailures,
    retryableFailureRate: report.retryableFailureRate,
    gatePassed: report.gatePassed,
    stopReason: report.stopReason,
    processing: report.processing,
    storage: report.storage,
    newlySearchReady: report.readiness.newlySearchReady,
    integrity: report.integrity,
    candidateClasses: report.candidateClasses,
    outputPath: output ? path.resolve(output) : null,
  }, null, 2));
};

main().catch((error) => {
  console.error("Corpus recovery wave failed:", {
    message: error.message,
    code: error.code || null,
  });
  process.exitCode = 1;
}).finally(async () => getPool().end());
