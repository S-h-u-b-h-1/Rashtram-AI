require("dotenv").config({
  path: process.env.ENV_FILE || require("path").join(__dirname, "../.env.local"),
});
const { getPool } = require("../db");
const { runResearchReadinessAudit } = require("../document/researchReadinessAuditService");
const { argumentFlag, argumentInteger } = require("./cliArgs");

runResearchReadinessAudit({
  includeDocuments: argumentFlag("include-documents"),
  sampleLimit: argumentInteger("sample-limit", 25, 1, 200),
})
  .then((report) => console.log(JSON.stringify(report, null, 2)))
  .catch((error) => {
    console.error("Read-only research readiness audit failed:", {
      message: error.message,
      code: error.code || null,
    });
    process.exitCode = 1;
  })
  .finally(async () => {
    if (globalThis.__rashtramPostgresPool) await getPool().end();
  });
