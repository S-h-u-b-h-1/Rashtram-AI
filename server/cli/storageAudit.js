#!/usr/bin/env node

const path = require("node:path");
require("dotenv").config({
  path: process.env.ENV_FILE || path.resolve(__dirname, "../.env.local"),
});
const { getPool } = require("../db");
const { auditArtifactStorage } = require("../lib/storage/artifactMigration");

auditArtifactStorage(getPool())
  .then((report) => console.log(JSON.stringify(report, null, 2)))
  .catch((error) => {
    console.error("Object-storage audit failed:", { message: error.message, code: error.code || null });
    process.exitCode = 1;
  })
  .finally(async () => {
    if (globalThis.__rashtramPostgresPool) await getPool().end();
  });
