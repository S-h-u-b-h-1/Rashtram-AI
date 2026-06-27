#!/usr/bin/env node

const path = require("path");
require("dotenv").config({
  path: process.env.ENV_FILE || path.resolve(__dirname, "../.env.local"),
});

const {
  getPendingReviews,
} = require("../lib/ingestion/core/catalogRepository");
const { getPool } = require("../db");

const limit =
  Number(
    process.argv
      .find((argument) => argument.startsWith("--limit="))
      ?.slice("--limit=".length),
  ) || 100;

getPendingReviews(limit)
  .then((matches) => console.log(JSON.stringify({ matches }, null, 2)))
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    if (globalThis.__rashtramPostgresPool) await getPool().end();
  });
