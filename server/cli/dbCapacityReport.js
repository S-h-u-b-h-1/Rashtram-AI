#!/usr/bin/env node

const path = require("node:path");
const fs = require("node:fs");
require("dotenv").config({
  path: process.env.ENV_FILE || path.resolve(__dirname, "../.env.local"),
});
const { getPool } = require("../db");
const { buildCapacityReport } = require("../lib/database/capacity");

const outputArg = process.argv.find((argument) => argument.startsWith("--output="));

buildCapacityReport(getPool())
  .then((report) => {
    const outputPath = outputArg
      ? path.resolve(outputArg.slice("--output=".length))
      : null;
    if (outputPath) {
      fs.writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`, {
        mode: 0o600,
      });
      console.log(JSON.stringify({
        ok: true,
        outputPath,
        storage: report.storage,
        migration022: report.migration022,
        counts: report.counts,
        projections: report.projections,
      }, null, 2));
      return;
    }
    console.log(JSON.stringify(report, null, 2));
  })
  .catch((error) => {
    console.error("Database capacity report failed:", {
      message: error.message,
      code: error.code || null,
    });
    process.exitCode = 1;
  })
  .finally(async () => {
    if (globalThis.__rashtramPostgresPool) await getPool().end();
  });
