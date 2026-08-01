#!/usr/bin/env node

const path = require("node:path");
require("dotenv").config({
  path: process.env.ENV_FILE || path.resolve(__dirname, "../.env.local"),
});
const { createMaintenancePool, runRetention } = require("../lib/database/maintenance");

const numberArg = (name, fallback) => {
  const value = process.argv.find((arg) => arg.startsWith(`--${name}=`));
  return value ? Number(value.slice(name.length + 3)) : fallback;
};

const main = async () => {
  const pool = createMaintenancePool();
  try {
    const result = await runRetention(pool, {
      dryRun: process.argv.includes("--dry-run"),
      batchSize: numberArg("batch-size", 500),
      maxBatches: numberArg("max-batches", 10),
      onProgress: (progress) =>
        console.error(JSON.stringify({ progress })),
    });
    console.log(JSON.stringify(result, null, 2));
  } finally {
    await pool.end();
  }
};

main().catch((error) => {
  console.error(JSON.stringify({ code: error.code || null, error: error.message }));
  process.exitCode = 1;
});
