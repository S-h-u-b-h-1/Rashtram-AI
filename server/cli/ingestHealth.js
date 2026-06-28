#!/usr/bin/env node

const path = require("path");
require("dotenv").config({
  path: process.env.ENV_FILE || path.resolve(__dirname, "../.env.local"),
});

const {
  CONNECTORS,
  connectorByName,
} = require("../lib/ingestion/connectors");
const {
  runConnectorHealthChecks,
} = require("../lib/ingestion/core/healthCheck");
const { getPool } = require("../db");

const parseArguments = (argumentsList) => {
  const options = {
    sources: [],
    delayMs: 750,
    timeoutMs: 20_000,
    retries: 2,
    limit: 3,
    maxPages: 1,
  };
  for (const argument of argumentsList) {
    if (argument.startsWith("--sources=")) {
      options.sources.push(
        ...argument
          .slice("--sources=".length)
          .split(",")
          .map((value) => value.trim()),
      );
    } else if (argument.startsWith("--source=")) {
      options.sources.push(argument.slice("--source=".length));
    } else if (argument.includes("=")) {
      const [rawKey, ...rawValue] = argument.replace(/^--/, "").split("=");
      const key = rawKey.replace(/-([a-z])/g, (_, letter) =>
        letter.toUpperCase(),
      );
      options[key] = rawValue.join("=");
    }
  }
  for (const key of [
    "delayMs",
    "timeoutMs",
    "retries",
    "limit",
    "maxPages",
  ]) {
    options[key] = Number(options[key]);
  }
  options.sources = [...new Set(options.sources.filter(Boolean))];
  return options;
};

const main = async () => {
  const options = parseArguments(process.argv.slice(2));
  const connectors = options.sources.length
    ? options.sources.map((name) => {
        const connector = connectorByName(name);
        if (!connector) throw new Error(`Unknown source: ${name}`);
        return connector;
      })
    : CONNECTORS;
  const report = await runConnectorHealthChecks(connectors, options);
  console.log(JSON.stringify(report, null, 2));
  if (
    report.sources.some((source) =>
      ["unavailable", "parser changed"].includes(source.status),
    )
  ) {
    process.exitCode = 2;
  }
};

if (require.main === module) {
  main()
    .catch((error) => {
      console.error(error.message);
      process.exitCode = 1;
    })
    .finally(async () => {
      if (globalThis.__rashtramPostgresPool) await getPool().end();
    });
}

module.exports = {
  main,
  parseArguments,
};
