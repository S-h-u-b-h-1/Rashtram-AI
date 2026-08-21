#!/usr/bin/env node

const path = require("node:path");
require("dotenv").config({
  path: process.env.ENV_FILE || path.resolve(__dirname, "../.env.local"),
});

const { getPool } = require("../db");
const { argumentFlag, argumentInteger } = require("./cliArgs");
const { corpusAuthorityReport } = require("../document/corpusIntelligenceService");

corpusAuthorityReport({ p2Limit: argumentInteger("p2-limit", 100, 1, 500) })
  .then((report) => console.log(JSON.stringify(
    argumentFlag("summary") ? {
      generatedAt: report.generatedAt,
      summary: report.summary,
      rankedP2: report.rankedP2,
      policy: report.policy,
    } : report,
    null,
    2,
  )))
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(async () => getPool().end());
