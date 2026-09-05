const fs = require("node:fs");
const path = require("node:path");
require("dotenv").config({
  path: process.env.ENV_FILE || path.join(__dirname, "../.env.local"),
});
const { getPool } = require("../db");
const { runResearchReadinessAudit } = require("../document/researchReadinessAuditService");
const { argumentFlag, argumentInteger, argumentValue } = require("./cliArgs");

const compact = argumentFlag("compact");
const output = argumentValue("output");

runResearchReadinessAudit({
  includeDocuments: argumentFlag("include-documents"),
  includeSamples: !argumentFlag("summary-only") && !compact,
  sampleLimit: argumentInteger("sample-limit", 25, 1, 200),
})
  .then((report) => {
    if (output) {
      fs.writeFileSync(path.resolve(output), `${JSON.stringify(report, null, 2)}\n`, { mode: 0o600 });
    }
    console.log(JSON.stringify(compact ? {
      generatedAt: report.generatedAt,
      totalPublicCatalogue: report.totalPublicCatalogue,
      funnel: report.funnel,
      notSearchReady: report.notSearchReady,
      automaticallyRecoverable: report.automaticallyRecoverable,
      retryable: report.retryable,
      manualReview: report.manualReview,
      permanentlyUnavailable: report.permanentlyUnavailable,
      recoveryEligibility: report.recoveryEligibility,
      byResourceType: report.byResourceType,
      byRecoveryClass: report.byRecoveryClass,
      byRecoveryGroup: report.byRecoveryGroup,
      byPriority: report.byPriority,
      databaseBytes: report.databaseBytes,
      eta: report.eta,
      outputPath: output ? path.resolve(output) : null,
    } : report, null, 2));
  })
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
