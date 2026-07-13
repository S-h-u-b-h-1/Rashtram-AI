#!/usr/bin/env node

const path = require("path");
require("dotenv").config({
  path: process.env.ENV_FILE || path.resolve(__dirname, "../.env.local"),
});

const { query } = require("../db");
const {
  REQUIRED_CATEGORIES,
  RESEARCH_BENCHMARKS,
} = require("../evaluation/researchBenchmarks");

const readinessCoverage = async () => {
  const result = await query(`
    SELECT
      COUNT(*)::INTEGER AS total_documents,
      COUNT(*) FILTER (WHERE research_ready)::INTEGER AS research_ready,
      COUNT(*) FILTER (WHERE comparison_ready)::INTEGER AS comparison_ready,
      COUNT(*) FILTER (
        WHERE source_authority_tier = 'A'
      )::INTEGER AS tier_a_documents,
      COUNT(*) FILTER (
        WHERE source_authority_tier = 'D'
      )::INTEGER AS tier_d_documents
    FROM documents
  `);
  const byType = await query(`
    SELECT
      document_type,
      COUNT(*)::INTEGER AS total,
      COUNT(*) FILTER (WHERE research_ready)::INTEGER AS research_ready,
      COUNT(*) FILTER (WHERE comparison_ready)::INTEGER AS comparison_ready
    FROM documents
    GROUP BY document_type
    ORDER BY total DESC, document_type
  `);
  return {
    totals: result.rows[0],
    byType: byType.rows,
  };
};

const evaluateCoverage = (coverage) => {
  const types = new Map(
    coverage.byType.map((row) => [
      row.document_type,
      {
        total: Number(row.total || 0),
        researchReady: Number(row.research_ready || 0),
        comparisonReady: Number(row.comparison_ready || 0),
      },
    ]),
  );

  return RESEARCH_BENCHMARKS.map((benchmark) => {
    const typeCoverage = benchmark.requiredDocumentTypes.map((type) => ({
      type,
      ...(types.get(type) || {
        total: 0,
        researchReady: 0,
        comparisonReady: 0,
      }),
    }));
    return {
      id: benchmark.id,
      category: benchmark.category,
      query: benchmark.query,
      readinessCovered: typeCoverage.some((item) => item.researchReady > 0),
      typeCoverage,
      measuredMetrics: {
        retrievalPrecision: "not_measured",
        retrievalRecall: "not_measured",
        citationCorrectness: "not_measured",
        answerCorrectness: "not_measured",
        unsupportedClaimRate: "not_measured",
        comparisonQuality: "not_measured",
        latencyMs: "not_measured",
        cost: "not_measured",
      },
    };
  });
};

const toMarkdown = (report) => {
  const lines = [
    "# Research Evaluation Report",
    "",
    `Generated at: ${report.generatedAt}`,
    "",
    "## Corpus readiness",
    "",
    `- Total documents: ${report.coverage.totals.total_documents}`,
    `- Research-ready documents: ${report.coverage.totals.research_ready}`,
    `- Comparison-ready documents: ${report.coverage.totals.comparison_ready}`,
    `- Tier A documents: ${report.coverage.totals.tier_a_documents}`,
    `- Tier D documents: ${report.coverage.totals.tier_d_documents}`,
    "",
    "## Benchmark coverage",
    "",
    "| Benchmark | Category | Readiness covered | Metrics status |",
    "|---|---|---:|---|",
    ...report.benchmarks.map((benchmark) => (
      `| ${benchmark.id} | ${benchmark.category} | ${benchmark.readinessCovered ? "yes" : "no"} | scaffolded, not measured |`
    )),
    "",
    "## Important limitation",
    "",
    "This command currently verifies benchmark coverage and readiness prerequisites. It does not yet score generated answers. Metrics remain `not_measured` until evaluator fixtures and expected answers are added.",
    "",
  ];
  return lines.join("\n");
};

const main = async () => {
  const coverage = await readinessCoverage();
  const benchmarks = evaluateCoverage(coverage);
  const categories = new Set(benchmarks.map((benchmark) => benchmark.category));
  const missingCategories = REQUIRED_CATEGORIES.filter(
    (category) => !categories.has(category),
  );
  const report = {
    generatedAt: new Date().toISOString(),
    status: missingCategories.length ? "incomplete" : "scaffolded",
    missingCategories,
    coverage,
    benchmarks,
  };

  if (process.argv.includes("--markdown")) {
    console.log(toMarkdown(report));
  } else {
    console.log(JSON.stringify(report, null, 2));
  }

  if (missingCategories.length) process.exitCode = 1;
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
