const path = require("node:path");
const fs = require("node:fs");
const { getProcessingStatus } = require("../document/readinessService");
const { cacheStats } = require("../retrieval/researchCache");
const { rolloutConfiguration } = require("../retrieval/featureFlags");
const { getResearchTelemetrySummary } = require("../retrieval/researchTelemetry");
const { evaluateRun } = require("../evaluation/ragEvalV1");
const {
  getSemanticBackfillMetrics,
  getSemanticCoverageReport,
} = require("../document/semanticCoverageService");

const baselinePath = path.resolve(__dirname, "../evaluation/benchmarks/ci-baseline-v1.json");
const benchmarkPath = path.resolve(__dirname, "../evaluation/benchmarks/ci-v1.json");
const runPath = path.resolve(__dirname, "../evaluation/benchmarks/ci-run-v1.json");

const getResearchQualityStatus = async () => {
  const baseline = JSON.parse(fs.readFileSync(baselinePath, "utf8"));
  const cases = JSON.parse(fs.readFileSync(benchmarkPath, "utf8"));
  const run = JSON.parse(fs.readFileSync(runPath, "utf8"));
  const evaluated = evaluateRun({ cases, ...run });
  return {
    visibility: "internal",
    governance: {
      benchmark: baseline.benchmark,
      reviewStatus: baseline.reviewStatus,
      purpose: baseline.purpose,
      expertAccuracyClaim: false,
    },
    baseline: baseline.metrics,
    evaluation: evaluated.metrics,
    regressionPolicy: baseline.policy,
    productionTelemetry: await getResearchTelemetrySummary(),
  };
};

const getResearchOperations = async () => {
  const [processing, queryTelemetry, semanticCoverage, semanticBackfill] = await Promise.all([
    getProcessingStatus(),
    getResearchTelemetrySummary(),
    getSemanticCoverageReport(),
    getSemanticBackfillMetrics(),
  ]);
  return {
    generatedAt: new Date().toISOString(),
    processing,
    queryTelemetry,
    semanticCoverage,
    semanticBackfill,
    caches: cacheStats(),
    rollout: rolloutConfiguration(),
    notes: {
      capabilityReadinessIsCanonical: true,
      oneGenericReadyPercentageIsNotUsed: true,
      rawQuestionsStored: false,
      assistantAnswersUsedAsEvidence: false,
    },
  };
};

module.exports = { getResearchOperations, getResearchQualityStatus };
