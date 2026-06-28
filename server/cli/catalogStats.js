#!/usr/bin/env node

const path = require("path");
require("dotenv").config({
  path: process.env.ENV_FILE || path.resolve(__dirname, "../.env.local"),
});

const {
  getUniversalStats,
} = require("../lib/ingestion/core/catalogRepository");
const { getPool } = require("../db");

getUniversalStats()
  .then((stats) => console.log(JSON.stringify(stats, null, 2)))
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    if (globalThis.__rashtramPostgresPool) await getPool().end();
  });
