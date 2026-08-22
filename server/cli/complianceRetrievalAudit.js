require("dotenv").config({
  path: process.env.ENV_FILE || require("path").join(__dirname, "../.env.local"),
});
const { getPool } = require("../db");
const { runComplianceCopilot } = require("../product/complianceCopilotService");

const FIXTURES = [
  "I run an NBFC offering digital loans across India.",
  "I operate an EV battery recycling facility in Gujarat.",
  "I am starting a food manufacturing company in West Bengal.",
  "I run an insurance brokerage in Maharashtra.",
  "I operate a SaaS company in India handling customer personal data.",
];

const audit = async () => {
  const results = [];
  const originalLog = console.log;
  const originalInfo = console.info;
  console.log = () => {};
  console.info = () => {};
  const runs = await Promise.all(FIXTURES.map(async (problem) => {
    const startedAt = Date.now();
    try {
      const result = await runComplianceCopilot(null, { problem, limit: 8 }, {
        persist: async () => ({ rows: [{ id: "read-only-audit", created_at: new Date().toISOString() }] }),
      });
      const recommendations = result.recommendations || [];
      const primaryCount = recommendations.filter((item) =>
        item.authorityClass === "PRIMARY_OFFICIAL").length;
      const mismatches = recommendations.filter((item) =>
        item.relevance?.jurisdictionMismatch).length;
      return {
        problem,
        durationMs: Date.now() - startedAt,
        topCandidate: recommendations[0]
          ? {
              id: recommendations[0].id,
              title: recommendations[0].title,
              relevanceTier: recommendations[0].relevanceTier,
              authorityClass: recommendations[0].authorityClass,
            }
          : null,
        recommendationCount: recommendations.length,
        primarySourceRate: recommendations.length ? primaryCount / recommendations.length : 0,
        secondaryOnly: recommendations.length > 0 && primaryCount === 0,
        jurisdictionMismatchRate: recommendations.length ? mismatches / recommendations.length : 0,
        obligationEvidenceRate: result.evidenceBackedObligations?.length
          ? result.evidenceBackedObligations.length / Math.max(result.evidence.length, 1)
          : 0,
        abstained: Boolean(result.abstention),
        evidenceStatus: result.evidenceStatus,
      };
    } catch (error) {
      return { problem, durationMs: Date.now() - startedAt, error: error.message };
    }
  }));
  results.push(...runs);
  console.log = originalLog;
  console.info = originalInfo;
  const completed = results.filter((item) => !item.error);
  process.stdout.write(`${JSON.stringify({
    generatedAt: new Date().toISOString(),
    readOnly: true,
    fixtureCount: FIXTURES.length,
    completed: completed.length,
    averages: {
      durationMs: completed.length
        ? Math.round(completed.reduce((sum, item) => sum + item.durationMs, 0) / completed.length)
        : null,
      primarySourceRate: completed.length
        ? completed.reduce((sum, item) => sum + item.primarySourceRate, 0) / completed.length
        : null,
      jurisdictionMismatchRate: completed.length
        ? completed.reduce((sum, item) => sum + item.jurisdictionMismatchRate, 0) / completed.length
        : null,
      obligationEvidenceRate: completed.length
        ? completed.reduce((sum, item) => sum + item.obligationEvidenceRate, 0) / completed.length
        : null,
      abstentionRate: completed.length
        ? completed.filter((item) => item.abstained).length / completed.length
        : null,
      secondaryOnlyRate: completed.length
        ? completed.filter((item) => item.secondaryOnly).length / completed.length
        : null,
    },
    results,
    qualification: "Automated retrieval fixtures measure gating behavior, not legal accuracy.",
  }, null, 2)}\n`);
};

audit()
  .catch((error) => {
    console.error("Read-only compliance retrieval audit failed:", error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    if (globalThis.__rashtramPostgresPool) await getPool().end();
  });
