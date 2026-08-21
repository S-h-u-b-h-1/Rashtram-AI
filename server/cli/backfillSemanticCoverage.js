#!/usr/bin/env node

const path = require("node:path");
require("dotenv").config({
  path: process.env.ENV_FILE || path.resolve(__dirname, "../.env.local"),
});

const { getPool } = require("../db");
const { argumentFlag, argumentInteger, argumentValue } = require("./cliArgs");
const { runSemanticBackfill } = require("../document/semanticBackfillService");

const usage = () => console.log(`Usage:
  npm run semantic:backfill -- --limit=5 [--priority=P0|P1]
    [--document-id=123] [--source=india-code] [--group-size=5]
    [--max-chunks=100] [--dry-run]

The command only targets public SEARCH_READY documents whose active semantic
state is missing or inconsistent. It reuses stored chunks and never downloads
or repeats OCR. Capacity is rechecked between bounded groups.`);

const main = async () => {
  if (argumentFlag("help")) return usage();
  const priority = argumentValue("priority");
  if (priority && !["P0", "P1", "P2", "P3"].includes(String(priority).toUpperCase())) {
    throw new Error("--priority must be P0, P1, P2, or P3");
  }
  const result = await runSemanticBackfill({
    requested: argumentInteger("limit", 5, 1, 250),
    priority: priority ? String(priority).toUpperCase() : null,
    documentId: argumentValue("document-id"),
    source: argumentValue("source"),
    groupSize: argumentInteger("group-size", 5, 1, 25),
    maxChunks: argumentInteger("max-chunks", 100, 1, 1_000),
    dryRun: argumentFlag("dry-run"),
  });
  console.log(JSON.stringify({ generatedAt: new Date().toISOString(), ...result }, null, 2));
};

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
}).finally(async () => getPool().end());
