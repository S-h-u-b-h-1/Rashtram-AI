#!/usr/bin/env node

const path = require("node:path");
require("dotenv").config({
  path: process.env.ENV_FILE || path.resolve(__dirname, "../.env.local"),
});
const { getPool } = require("../db");
const { argumentFlag, argumentInteger, argumentValue } = require("./cliArgs");
const { indexLargeDocument } = require("../document/largeDocumentService");

const documentId = argumentValue("document-id");
if (!documentId || !/^\d+$/.test(String(documentId))) {
  console.error("--document-id must be a positive numeric document ID");
  process.exit(1);
}

indexLargeDocument({
  documentId,
  dryRun: argumentFlag("dry-run"),
  targetChunks: argumentInteger("target-chunks", 12, 6, 20),
  maxChunks: argumentInteger("max-chunks", 24, 12, 32),
}).then((result) => console.log(JSON.stringify(result, null, 2)))
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(async () => getPool().end());
