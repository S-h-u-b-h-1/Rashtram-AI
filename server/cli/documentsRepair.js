require("dotenv").config({
  path: process.env.ENV_FILE || require("path").join(__dirname, "../.env.local"),
});
const { getPool } = require("../db");
const { runCatalogueRepair } = require("../document/catalogueAuditService");

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

runCatalogueRepair({
  classification: argumentValue("classification"),
  limit: argumentValue("limit", 100),
  concurrency: argumentValue("concurrency", 2),
  sourceConcurrency: argumentValue("source-concurrency", 2),
  maxAttempts: argumentValue("max-attempts", 3),
  enqueueOnly: argumentFlag("enqueue-only"),
  discoverGraph: !argumentFlag("skip-graph"),
})
  .then((result) => console.log(JSON.stringify(result, null, 2)))
  .catch((error) => {
    console.error("Document catalogue repair failed:", {
      message: error.message,
      code: error.code || null,
    });
    process.exitCode = 1;
  })
  .finally(async () => {
    if (globalThis.__rashtramPostgresPool) await getPool().end();
  });
