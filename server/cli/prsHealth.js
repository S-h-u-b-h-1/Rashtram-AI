#!/usr/bin/env node

const path = require("path");
require("dotenv").config({
  path: process.env.ENV_FILE || path.resolve(__dirname, "../.env.local"),
});

const { prsConnector } = require("../lib/ingestion/connectors/prsConnector");
const { probeConnector, loadIngestionHistory } = require("../lib/ingestion/core/healthCheck");
const { SOURCE_DEFINITIONS } = require("../lib/prsCatalog");
const { getPool } = require("../db");

const valueFor = (name, fallback) => {
  const argument = process.argv.slice(2).find((item) => item.startsWith(`--${name}=`));
  return argument ? argument.slice(name.length + 3) : fallback;
};

const main = async () => {
  const history = await loadIngestionHistory();
  const collections = String(valueFor("collections", "all"));
  const report = await probeConnector(
    prsConnector,
    {
      collections,
      limit: Number(valueFor("limit", 5)),
      maxPages: Number(valueFor("max-pages", 1)),
      timeoutMs: Number(valueFor("timeout-ms", 20_000)),
      attempts: Number(valueFor("attempts", 2)),
    },
    { history: history.get(prsConnector.name) || {} },
  );
  console.log(
    JSON.stringify(
      {
        checkedAt: new Date().toISOString(),
        transport: {
          kind: "public-html",
          authenticatedApi: false,
          baseUrl: "https://prsindia.org",
          collections: SOURCE_DEFINITIONS.map(({ key, url, paginated }) => ({
            key,
            url,
            paginated,
          })),
        },
        report,
      },
      null,
      2,
    ),
  );
  if (!["connected", "no data found"].includes(report.status)) process.exitCode = 2;
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

module.exports = { main, valueFor };
