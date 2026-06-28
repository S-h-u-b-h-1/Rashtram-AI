#!/usr/bin/env node

const path = require("path");
require("dotenv").config({
  path: process.env.ENV_FILE || path.resolve(__dirname, "../.env.local"),
});

const {
  getDuplicateCandidates,
} = require("../lib/ingestion/core/catalogRepository");
const { getPool } = require("../db");

const limit =
  Number(
    process.argv
      .find((argument) => argument.startsWith("--limit="))
      ?.slice("--limit=".length),
  ) || 100;

getDuplicateCandidates(limit)
  .then((duplicates) => console.log(JSON.stringify({ duplicates }, null, 2)))
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    if (globalThis.__rashtramPostgresPool) await getPool().end();
  });
