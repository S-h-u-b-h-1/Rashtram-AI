#!/usr/bin/env node

const path = require("node:path");
require("dotenv").config({
  path: process.env.ENV_FILE || path.resolve(__dirname, "../.env.local"),
});
const { getPool } = require("../db");
const { runObjectStorageSmokeTest } = require("../lib/storage/objectStorage");
const { verifyArtifactObjects } = require("../lib/storage/artifactMigration");

const limitArg = process.argv.find((argument) => argument.startsWith("--limit="));
const limit = Number(limitArg?.slice("--limit=".length) || 25);

runObjectStorageSmokeTest()
  .then(async (smoke) => {
    if (smoke.skipped) return { smoke, references: { checked: 0, verified: 0, failures: [] } };
    return { smoke, references: await verifyArtifactObjects(getPool(), { limit }) };
  })
  .then((report) => console.log(JSON.stringify(report, null, 2)))
  .catch((error) => {
    console.error("Object-storage verification failed:", {
      message: error.message,
      code: error.code || null,
      status: error.objectStorageStatus || null,
    });
    process.exitCode = 1;
  })
  .finally(async () => {
    if (globalThis.__rashtramPostgresPool) await getPool().end();
  });
