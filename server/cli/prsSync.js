#!/usr/bin/env node

const path = require("path");
require("dotenv").config({
  path: process.env.ENV_FILE || path.resolve(__dirname, "../.env.local"),
});

const { prsConnector } = require("../lib/ingestion/connectors/prsConnector");
const { findCandidates } = require("../lib/ingestion/core/catalogRepository");
const { chooseBestCandidate } = require("../lib/ingestion/core/dedupe");
const { runIngestion } = require("../lib/ingestion/core/ingestionRunner");
const { normalizeRecord } = require("../lib/ingestion/core/normalizer");
const { getPool } = require("../db");

const hasChanged = (record, candidate) =>
  [
    ["title", "title"],
    ["documentType", "document_type"],
    ["status", "status"],
    ["pdfUrl", "pdf_url"],
    ["introducedDate", "introduced_date"],
    ["publicationDate", "publication_date"],
    ["effectiveDate", "effective_date"],
  ].some(([incomingKey, storedKey]) => {
    const incoming = record[incomingKey];
    return incoming != null && String(incoming) !== String(candidate?.[storedKey] ?? "");
  });

const parseArguments = (argumentsList) => {
  const options = {
    dryRun: false,
    catalogOnly: true,
    collections: "all",
    limit: 25,
    maxPages: 1,
    delayMs: 750,
    timeoutMs: 20_000,
    attempts: 2,
    retries: 2,
    downloadPdfs: false,
  };
  for (const argument of argumentsList) {
    if (argument === "--dry-run") options.dryRun = true;
    else if (argument === "--details") options.catalogOnly = false;
    else if (argument.includes("=")) {
      const [rawKey, ...rawValue] = argument.replace(/^--/, "").split("=");
      const key = rawKey.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
      options[key] = rawValue.join("=");
    }
  }
  for (const key of ["limit", "maxPages", "delayMs", "timeoutMs", "attempts", "retries"]) {
    options[key] = Number(options[key]);
  }
  return options;
};

const previewSync = async (options) => {
  const collection = await prsConnector.collect(options);
  const records = collection.records.map(normalizeRecord);
  const counters = {
    fetched: records.length,
    consideredNew: 0,
    consideredUpdates: 0,
    duplicatesSkipped: 0,
    failures: collection.errors.length,
  };
  const sampleNew = [];
  for (const record of records) {
    const candidates = await findCandidates(record);
    const decision = chooseBestCandidate(record, candidates);
    if (decision.action === "merge") {
      if (hasChanged(record, decision.candidate)) counters.consideredUpdates += 1;
      else counters.duplicatesSkipped += 1;
    } else {
      counters.consideredNew += 1;
      if (sampleNew.length < 20) {
        sampleNew.push({
          sourceRecordId: record.sourceRecordId,
          title: record.title,
          year: record.year,
          sourceUrl: record.sourceUrl,
        });
      }
    }
  }
  return {
    source: prsConnector.name,
    dryRun: true,
    collections: options.collections,
    counters,
    latestYearSeen: records.reduce((latest, record) => Math.max(latest, record.year || 0), 0) || null,
    sampleNew,
    errors: collection.errors,
  };
};

const main = async () => {
  const options = parseArguments(process.argv.slice(2));
  const result = options.dryRun
    ? await previewSync(options)
    : await runIngestion(prsConnector, options);
  console.log(JSON.stringify(result, null, 2));
  if (result.status === "failed" || result.errors?.length) process.exitCode = 2;
};

if (require.main === module) {
  main()
    .catch((error) => {
      console.error(error);
      process.exitCode = 1;
    })
    .finally(async () => {
      if (globalThis.__rashtramPostgresPool) await getPool().end();
    });
}

module.exports = { main, parseArguments, previewSync };
