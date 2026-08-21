const assert = require("node:assert/strict");
const test = require("node:test");

const {
  compareConfigurations,
  compareWithBaseline,
  evaluateAnswerCase,
  evaluateRetrievalCase,
  evaluateRun,
  normalizeBenchmarkCase,
  versionManifest,
} = require("../evaluation/ragEvalV1");
const {
  buildReviewPack,
  validateReviewPack,
} = require("../evaluation/benchmarkReview");

const benchmark = (overrides = {}) => ({
  id: "case-1",
  question: "What does section 4 require?",
  query_type: "EXACT_REFERENCE",
  expected_document_ids: ["doc-a"],
  expected_sections: ["4"],
  expected_clauses: ["4(1)"],
  gold_evidence: [{
    id: "doc-a:chunk-1",
    documentId: "doc-a",
    chunkId: "chunk-1",
    section: "4",
    clause: "4(1)",
    text: "The producer shall register.",
  }],
  answerable: true,
  expected_authority_class: "PRIMARY_OFFICIAL",
  difficulty: "medium",
  jurisdiction: "India",
  document_type: "rule",
  notes: "Synthetic test case.",
  review_status: "AUTO_GENERATED_DRAFT",
  ...overrides,
});

test("duplicate acceptable gold passages are counted once", () => {
  const duplicate = benchmark({
    gold_evidence: [benchmark().gold_evidence[0], benchmark().gold_evidence[0]],
  });
  const normalized = normalizeBenchmarkCase(duplicate);
  assert.equal(normalized.goldEvidence.length, 1);
  const answer = evaluateAnswerCase(duplicate, {
    citations: ["doc-a:chunk-1"],
    claims: [{ material: true, state: "SUPPORTED" }],
  });
  assert.equal(answer.citationRecall, 1);
});

test("multiple acceptable documents receive partial then complete recall", () => {
  const value = benchmark({ expected_document_ids: ["doc-a", "doc-b"] });
  const result = evaluateRetrievalCase(value, [
    { documentId: "doc-a", chunkId: "chunk-1" },
    { documentId: "noise", chunkId: "1" },
    { documentId: "doc-b", chunkId: "2" },
  ]);
  assert.equal(result.recallAt1, 0.5);
  assert.equal(result.recallAt3, 1);
});

test("unanswerable questions are excluded from retrieval recall and score abstention", () => {
  const value = benchmark({
    expected_document_ids: [],
    expected_sections: [],
    expected_clauses: [],
    gold_evidence: [],
    answerable: false,
  });
  assert.equal(evaluateRetrievalCase(value, []).recallAt10, null);
  const answer = evaluateAnswerCase(value, { abstained: true, citations: [], claims: [] });
  assert.equal(answer.abstentionTruePositive, 1);
  assert.equal(answer.abstentionFalseNegative, 0);
});

test("rank calculations produce reciprocal rank and bounded nDCG", () => {
  const result = evaluateRetrievalCase(benchmark(), [
    { documentId: "noise", chunkId: "1" },
    { documentId: "doc-a", chunkId: "chunk-1", evidenceId: "doc-a:chunk-1", section: "4", clause: "4(1)" },
  ]);
  assert.equal(result.reciprocalRank, 0.5);
  assert.ok(result.ndcgAt10 > 0 && result.ndcgAt10 <= 1);
});

test("citation precision and recall distinguish valid and unsupported labels", () => {
  const answer = evaluateAnswerCase(benchmark(), {
    citations: ["doc-a:chunk-1", "invented:9"],
    claims: [
      { material: true, state: "SUPPORTED" },
      { material: true, state: "UNSUPPORTED" },
      { material: false, state: "UNSUPPORTED" },
    ],
  });
  assert.equal(answer.citationPrecision, 0.5);
  assert.equal(answer.citationRecall, 1);
  assert.equal(answer.unsupportedFactualClaimRate, 0.5);
  assert.equal(answer.evidenceFaithfulness, 0.5);
});

test("abstention precision and recall account for false positives and negatives", () => {
  const unanswerable = benchmark({
    id: "no-answer",
    expected_document_ids: [], expected_sections: [], expected_clauses: [],
    gold_evidence: [], answerable: false,
  });
  const report = evaluateRun({
    cases: [benchmark(), unanswerable],
    retrievalResults: { "case-1": [{ documentId: "doc-a", chunkId: "chunk-1" }] },
    answerResults: {
      "case-1": { abstained: true, citations: [], claims: [] },
      "no-answer": { abstained: true, citations: [], claims: [] },
    },
  });
  assert.equal(report.metrics.abstentionPrecision, 0.5);
  assert.equal(report.metrics.abstentionRecall, 1);
});

test("missing required benchmark data fails explicitly", () => {
  assert.throws(() => normalizeBenchmarkCase({}), /id and question are required/i);
  assert.throws(
    () => normalizeBenchmarkCase(benchmark({ expected_document_ids: [], gold_evidence: [] })),
    /requires expected documents or gold evidence/i,
  );
  assert.throws(
    () => normalizeBenchmarkCase(benchmark({ review_status: "EXPERTISH" })),
    /invalid benchmark review status/i,
  );
});

test("benchmark maturity and legal-review metadata are normalized without identities", () => {
  const normalized = normalizeBenchmarkCase(benchmark({
    review_status: "DOMAIN_REVIEWED",
    reviewer_role: "chartered accountant reviewer",
    reviewed_at: "2026-08-20T10:00:00Z",
    expected_resource_ids: ["resource-1"],
    acceptable_evidence_variants: [{ id: "doc-a:variant", text: "Equivalent passage." }],
    conflicting_evidence_expected: true,
    effective_date_context: { as_of: "2025-01-01" },
    benchmark_version: "legal-policy-v1",
    scenario_tags: ["multi_version"],
  }));
  assert.equal(normalized.reviewStatus, "DOMAIN_REVIEWED");
  assert.equal(normalized.reviewerRole, "chartered accountant reviewer");
  assert.equal(normalized.reviewedAt, "2026-08-20T10:00:00.000Z");
  assert.deepEqual(normalized.expectedResourceIds, ["resource-1"]);
  assert.equal(normalized.acceptableEvidenceVariants.length, 1);
  assert.deepEqual(normalized.scenarioTags, ["MULTI_VERSION"]);
});

test("evaluation reports new metrics and review-maturity segmentation separately", () => {
  const report = evaluateRun({
    cases: [benchmark({ review_status: "INTERNAL_REVIEWED" })],
    retrievalResults: {
      "case-1": [{
        documentId: "doc-a", chunkId: "chunk-1", evidenceId: "doc-a:chunk-1",
        section: "4", clause: "4(1)", authorityClass: "PRIMARY_OFFICIAL",
      }],
    },
    answerResults: { "case-1": { citations: ["doc-a:chunk-1"], claims: [] } },
  });
  assert.equal(report.metrics.documentHitRate, 1);
  assert.equal(report.metrics.exactReferenceHitRate, 1);
  assert.equal(report.metrics.primarySourcePreferenceRate, 1);
  assert.equal(report.metrics.byReviewMaturity.INTERNAL_REVIEWED.cases, 1);
  assert.equal(report.metrics.byAnswerability.ANSWERABLE.cases, 1);
});

test("review packs expose evidence and enforce governed reviewer decisions", () => {
  const pack = buildReviewPack({
    cases: [benchmark()],
    run: {
      retrievalResults: { "case-1": [{ documentId: "doc-a", chunkId: "chunk-1" }] },
      answerResults: { "case-1": { citations: ["doc-a:chunk-1"], abstained: false } },
    },
  });
  assert.equal(pack.cases[0].retrievedPassages.length, 1);
  assert.deepEqual(pack.cases[0].citations, ["doc-a:chunk-1"]);
  pack.cases[0].review = {
    decision: "correct",
    reviewStatus: "DOMAIN_REVIEWED",
    reviewerRole: "policy researcher",
    reviewedAt: "2026-08-20T10:00:00Z",
    notes: "Verified against the bounded source passage.",
  };
  const result = validateReviewPack(pack);
  assert.equal(result.valid, true);
  assert.equal(result.byDecision.CORRECT, 1);
  assert.equal(result.byStatus.DOMAIN_REVIEWED, 1);
  pack.cases[0].review.reviewerRole = null;
  assert.throws(() => validateReviewPack(pack), /requires reviewerRole and reviewedAt/i);
});

test("evaluation is deterministic for identical inputs", () => {
  const input = {
    cases: [benchmark()],
    retrievalResults: { "case-1": [{ documentId: "doc-a", chunkId: "chunk-1" }] },
    answerResults: { "case-1": { citations: ["doc-a:chunk-1"], claims: [] } },
  };
  const first = evaluateRun(input);
  assert.deepEqual(first, evaluateRun(input));
  assert.deepEqual(first.evaluator, {
    type: "deterministic",
    version: "rag-eval-v1",
    model: null,
    promptVersion: null,
  });
});

test("comparative experiments keep production configurations isolated", () => {
  const result = compareConfigurations({
    cases: [benchmark()],
    configurations: {
      fts_only: { retrievalResults: { "case-1": [] } },
      hybrid_reranked: { retrievalResults: { "case-1": [{ documentId: "doc-a", chunkId: "chunk-1" }] } },
    },
  });
  assert.equal(result.configurations.fts_only.recallAt10, 0);
  assert.equal(result.configurations.hybrid_reranked.recallAt10, 1);
  assert.throws(() => compareConfigurations({ cases: [], configurations: { production: {} } }), /unsupported/i);
});

test("retrieval versions are complete and baseline changes are intentional", () => {
  const manifest = versionManifest({ retrievalVersion: "v3" });
  assert.equal(manifest.retrievalVersion, "v3");
  assert.equal(manifest.embeddingVersion, "unknown");
  assert.match(manifest.fingerprint, /^[a-f0-9]{16}$/);
  const regression = compareWithBaseline(
    { recallAt10: 0.99, mrr: 0.96, citationPrecision: 1 },
    { recallAt10: 1, mrr: 1, citationPrecision: 1 },
    {
      recallAt10: { maximumAbsoluteDrop: 0.02 },
      mrr: { maximumAbsoluteDrop: 0.03 },
      citationPrecision: { maximumAbsoluteDrop: 0.01 },
    },
  );
  assert.equal(regression.passed, false);
  assert.equal(regression.checks.find((item) => item.metric === "mrr").passed, false);
});
