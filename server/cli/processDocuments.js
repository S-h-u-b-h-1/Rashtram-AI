require("dotenv").config({
  path: process.env.ENV_FILE || require("path").join(__dirname, "../.env.local"),
});
const { getPool } = require("../db");
const { processDocumentBatch } = require("../document/readinessService");

const argumentValue = (name, fallback = null) => {
  const exact = `--${name}`;
  const item = process.argv.find(
    (value) => value === exact || value.startsWith(`${exact}=`),
  );
  if (!item) return fallback;
  return item === exact ? true : item.slice(exact.length + 1);
};

const argumentFlag = (name) => {
  const value = argumentValue(name, false);
  if (value === true) return true;
  return ["1", "true", "yes", "on"].includes(
    String(value).trim().toLowerCase(),
  );
};

processDocumentBatch({
  limit: argumentValue("limit", 25),
  concurrency: argumentValue("concurrency", 3),
  maxAttempts: argumentValue("max-attempts", 3),
  staleMinutes: argumentValue("stale-minutes", 15),
  sourceConcurrency: argumentValue("source-concurrency", 2),
  type: argumentValue("type"),
  onlyUnprocessed: argumentFlag("only-unprocessed"),
  retryFailed: argumentFlag("retry-failed"),
  resume: argumentFlag("resume"),
  enqueueOnly: argumentFlag("enqueue-only"),
  discoverGraph: !argumentFlag("skip-graph"),
})
  .then((result) => console.log(JSON.stringify(result, null, 2)))
  .catch((error) => {
    console.error("Document batch processing failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    if (globalThis.__rashtramPostgresPool) await getPool().end();
  });
