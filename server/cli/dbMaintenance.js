#!/usr/bin/env node

const path = require("node:path");
require("dotenv").config({
  path: process.env.ENV_FILE || path.resolve(__dirname, "../.env.local"),
});
const {
  MAINTENANCE_TABLES,
  createMaintenancePool,
  runMaintenance,
} = require("../lib/database/maintenance");

const maxTablesArg = process.argv.find((arg) => arg.startsWith("--max-tables="));

const main = async () => {
  const pool = createMaintenancePool();
  try {
    const result = await runMaintenance(pool, {
      dryRun: process.argv.includes("--dry-run"),
      maxTables: maxTablesArg
        ? Number(maxTablesArg.slice("--max-tables=".length))
        : MAINTENANCE_TABLES.length,
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
