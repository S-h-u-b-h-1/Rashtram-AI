#!/usr/bin/env node

const path = require("node:path");
require("dotenv").config({
  path: process.env.ENV_FILE || path.resolve(__dirname, "../.env.local"),
});
const {
  createMaintenancePool,
  storageReport,
  writeStorageReport,
} = require("../lib/database/maintenance");

const outputArg = process.argv.find((arg) => arg.startsWith("--output="));

const main = async () => {
  const pool = createMaintenancePool();
  try {
    const report = await storageReport(pool);
    const outputPath = outputArg ? outputArg.slice("--output=".length) : null;
    if (outputPath) writeStorageReport(report, outputPath);
    console.log(JSON.stringify(report, null, 2));
  } finally {
    await pool.end();
  }
};

main().catch((error) => {
  console.error(JSON.stringify({ code: error.code || null, error: error.message }));
  process.exitCode = 1;
});
