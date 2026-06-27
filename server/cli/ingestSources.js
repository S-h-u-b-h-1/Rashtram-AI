#!/usr/bin/env node

const path = require("path");
require("dotenv").config({
  path: process.env.ENV_FILE || path.resolve(__dirname, "../.env.local"),
});

const { CONNECTORS, connectorByName } = require("../lib/ingestion/connectors");
const { runIngestion } = require("../lib/ingestion/core/ingestionRunner");
const { getPool } = require("../db");

const parseArguments = (argumentsList) => {
  const options = {
    sources: [],
    catalogOnly: false,
    delayMs: 750,
    maxPages: 10,
    limit: 100,
  };
  for (const argument of argumentsList) {
    if (argument === "--catalog-only") options.catalogOnly = true;
    else if (argument === "--details") options.catalogOnly = false;
    else if (argument.startsWith("--source=")) {
      options.sources.push(argument.slice("--source=".length));
    } else if (argument.startsWith("--sources=")) {
      options.sources.push(
        ...argument
          .slice("--sources=".length)
          .split(",")
          .map((value) => value.trim()),
      );
    } else if (argument.includes("=")) {
      const [rawKey, ...rawValue] = argument.replace(/^--/, "").split("=");
      const key = rawKey.replace(/-([a-z])/g, (_, letter) =>
        letter.toUpperCase(),
      );
      options[key] = rawValue.join("=");
    }
  }
  if (!options.sources.length) options.sources = ["india-code", "egazette"];
  options.sources = [...new Set(options.sources.filter(Boolean))];
  for (const key of [
    "delayMs",
    "maxPages",
    "limit",
    "pageSize",
    "timeoutMs",
    "retries",
  ]) {
    if (options[key] != null) options[key] = Number(options[key]);
  }
  return options;
};

const main = async () => {
  const options = parseArguments(process.argv.slice(2));
  const unknown = options.sources.filter((source) => !connectorByName(source));
  if (unknown.length) {
    throw new Error(
      `Unknown source(s): ${unknown.join(", ")}. Available: ${CONNECTORS.map(
        (connector) => connector.name,
      ).join(", ")}`,
    );
  }

  const summaries = [];
  for (const source of options.sources) {
    console.log(`Collecting ${source}...`);
    const summary = await runIngestion(connectorByName(source), options);
    summaries.push(summary);
    console.log(
      `  ${summary.status}: ${summary.stored}/${summary.discovered} stored`,
    );
  }
  console.log(JSON.stringify({ summaries }, null, 2));
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
