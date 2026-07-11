require("dotenv").config({
  path: process.env.ENV_FILE || require("path").join(__dirname, "../.env.local"),
});
const { getPool } = require("../db");
const { runCatalogueAudit } = require("../document/catalogueAuditService");

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

runCatalogueAudit({
  batchSize: argumentValue("batch-size", argumentValue("limit", 500)),
  afterId: argumentValue("after-id"),
  resume: argumentFlag("resume"),
})
  .then((result) => console.log(JSON.stringify(result, null, 2)))
  .catch((error) => {
    console.error("Document catalogue audit failed:", {
      message: error.message,
      code: error.code || null,
    });
    process.exitCode = 1;
  })
  .finally(async () => {
    if (globalThis.__rashtramPostgresPool) await getPool().end();
  });
