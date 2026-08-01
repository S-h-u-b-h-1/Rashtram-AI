#!/usr/bin/env node

const path = require("node:path");
require("dotenv").config({
  path: process.env.ENV_FILE || path.resolve(__dirname, "../.env.local"),
});
const { getPool } = require("../db");
const {
  dryRunArtifactMigration,
  migrateArtifacts,
  rollbackArtifactMigration,
} = require("../lib/storage/artifactMigration");

const valueArg = (name) => process.argv.find((argument) => argument.startsWith(`--${name}=`))
  ?.slice(name.length + 3);
const limit = Number(valueArg("limit") || 10);
const rollbackRun = valueArg("rollback-run");
const dryRun = process.argv.includes("--dry-run") ||
  (!process.argv.some((argument) => argument.startsWith("--limit=")) && !rollbackRun);

const execute = () => {
  if (rollbackRun) return rollbackArtifactMigration(getPool(), Number(rollbackRun));
  if (dryRun) return dryRunArtifactMigration(getPool(), { limit });
  return migrateArtifacts(getPool(), { limit });
};

execute()
  .then((report) => console.log(JSON.stringify(report, null, 2)))
  .catch((error) => {
    console.error("Object-storage migration failed:", { message: error.message, code: error.code || null });
    process.exitCode = 1;
  })
  .finally(async () => {
    if (globalThis.__rashtramPostgresPool) await getPool().end();
  });
