#!/usr/bin/env node

const path = require("node:path");
require("dotenv").config({
  path: process.env.ENV_FILE || path.resolve(__dirname, "../.env.local"),
});
const { getPool } = require("../db");
const { getCommercialPilotMetrics } = require("../product/productMetricsService");

getCommercialPilotMetrics()
  .then((result) => console.log(JSON.stringify(result, null, 2)))
  .catch((error) => { console.error(error); process.exitCode = 1; })
  .finally(async () => { if (globalThis.__rashtramPostgresPool) await getPool().end(); });
