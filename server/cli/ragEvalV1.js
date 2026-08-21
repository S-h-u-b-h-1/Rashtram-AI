#!/usr/bin/env node

const fs = require("node:fs");
const path = require("node:path");
const { argumentFlag, argumentValue } = require("./cliArgs");
const {
  compareConfigurations,
  compareWithBaseline,
  evaluateRun,
} = require("../evaluation/ragEvalV1");

const root = path.resolve(__dirname, "../evaluation/benchmarks");
const readJson = (value, fallback) => JSON.parse(fs.readFileSync(
  path.resolve(process.cwd(), value || fallback),
  "utf8",
));

const number = (value) => value == null ? "not measured" : Number(value).toFixed(4);

const markdownReport = (report) => {
  const metrics = report.metrics;
  const sections = [
    ["Document type", metrics.byDocumentType],
    ["Query type", metrics.byQueryType],
    ["Jurisdiction", metrics.byJurisdiction],
    ["Authority class", metrics.byAuthorityClass],
    ["Difficulty", metrics.byDifficulty],
    ["Answerability", metrics.byAnswerability],
    ["Review maturity", metrics.byReviewMaturity],
  ];
  return [
    "# Rashtram RAG Evaluation V1",
    "",
    `Generated: ${report.generatedAt}`,
    `Benchmark status: ${report.benchmarkReviewStatus}`,
    `Evaluator: ${report.evaluator.type} (${report.evaluator.version}; no model judge)`,
    `Version fingerprint: ${report.versions.fingerprint}`,
    "",
    "## Overall",
    "",
    `- Recall@1: ${number(metrics.recallAt1)}`,
    `- Recall@3: ${number(metrics.recallAt3)}`,
    `- Recall@5: ${number(metrics.recallAt5)}`,
    `- Recall@10: ${number(metrics.recallAt10)}`,
    `- MRR: ${number(metrics.mrr)}`,
    `- nDCG@10: ${number(metrics.ndcgAt10)}`,
    `- Document-hit rate: ${number(metrics.documentHitRate)}`,
    `- Exact-reference hit rate: ${number(metrics.exactReferenceHitRate)}`,
    `- Primary-source preference rate: ${number(metrics.primarySourcePreferenceRate)}`,
    `- Citation precision: ${number(metrics.citationPrecision)}`,
    `- Citation recall: ${number(metrics.citationRecall)}`,
    `- Unsupported factual claim rate: ${number(metrics.unsupportedFactualClaimRate)}`,
    `- Evidence faithfulness: ${number(metrics.evidenceFaithfulness)}`,
    `- Abstention precision: ${number(metrics.abstentionPrecision)}`,
    `- Abstention recall: ${number(metrics.abstentionRecall)}`,
    `- Conflict-detection accuracy: ${number(metrics.conflictDetectionAccuracy)}`,
    `- Temporal-answer accuracy: ${number(metrics.temporalAnswerAccuracy)}`,
    "",
    ...sections.flatMap(([label, groups]) => [
      `## By ${label.toLowerCase()}`,
      "",
      "| Group | Cases | Recall@10 | MRR | Citation precision |",
      "|---|---:|---:|---:|---:|",
      ...Object.entries(groups).map(([group, value]) =>
        `| ${group} | ${value.cases} | ${number(value.recallAt10)} | ${number(value.mrr)} | ${number(value.citationPrecision)} |`,
      ),
      "",
    ]),
    "## Failures",
    "",
    ...report.cases.filter((item) => item.failures.length).map((item) =>
      `- ${item.benchmark.id}: ${item.failures.join(", ")}`,
    ),
    ...(report.cases.some((item) => item.failures.length) ? [] : ["- None in this run."]),
    "",
    "## Interpretation",
    "",
    "This CI dataset is synthetic and checks evaluator/retrieval contracts. It is not expert-reviewed legal ground truth and must not be used to claim production legal accuracy.",
  ].join("\n");
};

const main = () => {
  const benchmarkPath = argumentValue("benchmark", path.join(root, "ci-v1.json"));
  const runPath = argumentValue("run", path.join(root, "ci-run-v1.json"));
  const baselinePath = argumentValue("baseline", path.join(root, "ci-baseline-v1.json"));
  const cases = readJson(benchmarkPath);
  const run = readJson(runPath);
  if (run.configurations) {
    console.log(JSON.stringify(compareConfigurations({
      cases,
      configurations: run.configurations,
      versions: run.versions,
    }), null, 2));
    return;
  }
  const evaluated = evaluateRun({ cases, ...run });
  const baseline = readJson(baselinePath);
  const regression = compareWithBaseline(evaluated.metrics, baseline.metrics, baseline.policy);
  const report = {
    generatedAt: new Date().toISOString(),
    benchmarkReviewStatus: [...new Set(cases.map((item) => item.review_status))].join(","),
    ...evaluated,
    regression,
  };
  const outputJson = argumentValue("output-json");
  const outputMarkdown = argumentValue("output-markdown");
  if (outputJson) fs.writeFileSync(path.resolve(process.cwd(), outputJson), JSON.stringify(report, null, 2));
  if (outputMarkdown) fs.writeFileSync(path.resolve(process.cwd(), outputMarkdown), markdownReport(report));
  if (argumentFlag("confirm-baseline-update")) {
    const target = argumentValue("write-baseline");
    if (!target) throw new Error("--confirm-baseline-update requires --write-baseline=<path>.");
    fs.writeFileSync(path.resolve(process.cwd(), target), JSON.stringify({
      ...baseline,
      metrics: {
        recallAt10: report.metrics.recallAt10,
        mrr: report.metrics.mrr,
        citationPrecision: report.metrics.citationPrecision,
      },
      updatedAt: new Date().toISOString(),
      updatedManually: true,
    }, null, 2));
  }
  console.log(JSON.stringify({
    versions: report.versions,
    metrics: report.metrics,
    regression,
    outputs: { json: outputJson || null, markdown: outputMarkdown || null },
  }, null, 2));
  if (!regression.passed) process.exitCode = 1;
};

try {
  main();
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
