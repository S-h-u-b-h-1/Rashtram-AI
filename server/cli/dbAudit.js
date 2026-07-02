#!/usr/bin/env node

const path = require("path");
require("dotenv").config({
  path: process.env.ENV_FILE || path.resolve(__dirname, "../.env.local"),
});
const { getPool } = require("../db");
const {
  inventoryDatabase,
  writeAuditReport,
} = require("../lib/database/audit");

inventoryDatabase()
  .then((audit) => {
    const outputPath = writeAuditReport(audit);
    console.log(
      JSON.stringify(
        {
          ok: true,
          report: outputPath,
          tables: audit.database.tables,
          emptyTables: audit.database.emptyTables,
          quality: audit.quality,
        },
        null,
        2,
      ),
    );
  })
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    if (globalThis.__rashtramPostgresPool) await getPool().end();
  });
