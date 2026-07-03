#!/usr/bin/env node

const path = require("path");
require("dotenv").config({
  path: process.env.ENV_FILE || path.resolve(__dirname, "../.env.local"),
});
const { connectorByName } = require("../lib/ingestion/connectors");
const { runIngestion } = require("../lib/ingestion/core/ingestionRunner");
const { scheduleForProfile } = require("../lib/ingestion/schedules");
const { refreshDataQuality } = require("../lib/database/quality");
const { getPool } = require("../db");

const parseArguments = (args) => {
  const options = {
    profile: "daily",
    dryRun: false,
    maxPages: 2,
    limit: 50,
    delayMs: 750,
    timeoutMs: 15_000,
    retries: 1,
    downloadPdfs: false,
  };
  for (const argument of args) {
    if (argument === "--dry-run") options.dryRun = true;
    else if (argument.includes("=")) {
      const [rawKey, ...rawValue] = argument.replace(/^--/, "").split("=");
      const key = rawKey.replace(/-([a-z])/g, (_, letter) =>
        letter.toUpperCase(),
      );
      options[key] = rawValue.join("=");
    }
  }
  for (const key of [
    "maxPages",
    "limit",
    "delayMs",
    "timeoutMs",
    "retries",
  ]) {
    options[key] = Number(options[key]);
  }
  if (typeof options.dryRun === "string") {
    options.dryRun = !["false", "0", "no"].includes(
      options.dryRun.toLowerCase(),
    );
  }
  options.downloadPdfs = false;
  return options;
};

const main = async () => {
  const options = parseArguments(process.argv.slice(2));
  const requestedSources = options.sources
    ? String(options.sources)
        .split(",")
        .map((source) => source.trim())
        .filter(Boolean)
    : scheduleForProfile(options.profile);
  const summaries = [];

  for (const source of [...new Set(requestedSources)]) {
    const connector = connectorByName(source);
    if (!connector) {
      summaries.push({
        source,
        status: "failed",
        errors: [{ message: "Connector is not registered." }],
      });
      continue;
    }
    const summary = await runIngestion(connector, options);
    summaries.push(summary);
  }

  const quality = options.dryRun ? null : await refreshDataQuality();
  const failed = summaries.filter((summary) => summary.status === "failed");
  console.log(
    JSON.stringify(
      {
        profile: options.profile,
        dryRun: options.dryRun,
        startedSources: summaries.length,
        failedSources: failed.length,
        partialFailures: summaries.filter(
          (summary) => summary.status === "completed_with_errors",
        ).length,
        quality,
        summaries,
      },
      null,
      2,
    ),
  );
  if (failed.length === summaries.length) process.exitCode = 2;
};

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    if (globalThis.__rashtramPostgresPool) await getPool().end();
  });

module.exports = {
  parseArguments,
};
