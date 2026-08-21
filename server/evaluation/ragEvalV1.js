const crypto = require("node:crypto");

const REVIEW_STATES = new Set([
  "AUTO_GENERATED_DRAFT", "INTERNAL_REVIEWED", "DOMAIN_REVIEWED",
  "EXPERT_VERIFIED", "REJECTED",
]);

const REVIEW_DECISIONS = new Set([
  "CORRECT", "PARTIALLY_CORRECT", "INCORRECT", "INSUFFICIENT_EVIDENCE",
  "BENCHMARK_CASE_FLAWED",
]);

const CONFIGURATIONS = Object.freeze([
  "fts_only",
  "vector_only",
  "hybrid",
  "hybrid_rrf",
  "hybrid_reranked",
  "knowledge_assisted_hybrid",
]);

const VERSION_FIELDS = Object.freeze([
  "retrievalVersion",
  "embeddingModel",
  "embeddingVersion",
  "chunkingVersion",
  "rerankerVersion",
  "queryPlannerVersion",
  "authorityConfigVersion",
]);

const average = (values) => {
  const usable = values.filter(Number.isFinite);
  return usable.length
    ? Number((usable.reduce((sum, value) => sum + value, 0) / usable.length).toFixed(6))
    : null;
};

const uniqueStrings = (values) => [...new Set((Array.isArray(values) ? values : [])
  .map((value) => String(value ?? "").trim()).filter(Boolean))];

const normalizeEvidence = (value = {}) => ({
  id: String(value.id || [value.documentId, value.chunkId ?? value.section ?? value.clause]
    .filter((item) => item != null).join(":")),
  documentId: value.documentId == null ? null : String(value.documentId),
  chunkId: value.chunkId == null ? null : String(value.chunkId),
  section: value.section == null ? null : String(value.section),
  clause: value.clause == null ? null : String(value.clause),
  text: String(value.text || value.content || "").trim(),
});

const optionalIsoDate = (value, field) => {
  if (value == null || value === "") return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error(`Invalid ${field}: ${value}`);
  return date.toISOString();
};

const normalizeBenchmarkCase = (value = {}) => {
  const id = String(value.id || "").trim();
  const question = String(value.question || "").trim();
  if (!id || !question) throw new Error("Benchmark id and question are required.");
  const reviewStatus = String(value.reviewStatus || value.review_status || "AUTO_GENERATED_DRAFT").toUpperCase();
  if (!REVIEW_STATES.has(reviewStatus)) throw new Error(`Invalid benchmark review status: ${reviewStatus}`);
  const expectedDocumentIds = uniqueStrings(value.expectedDocumentIds || value.expected_document_ids);
  const goldEvidence = [...new Map(
    (value.goldEvidence || value.gold_evidence || []).map(normalizeEvidence)
      .filter((item) => item.id || item.text)
      .map((item) => [item.id || item.text, item]),
  ).values()];
  const acceptableEvidenceVariants = [...new Map(
    (value.acceptableEvidenceVariants || value.acceptable_evidence_variants || [])
      .map(normalizeEvidence)
      .filter((item) => item.id || item.text)
      .map((item) => [item.id || item.text, item]),
  ).values()];
  const answerable = value.answerable !== false;
  if (answerable && !expectedDocumentIds.length && !goldEvidence.length) {
    throw new Error(`Answerable benchmark ${id} requires expected documents or gold evidence.`);
  }
  return {
    id,
    question,
    queryType: String(value.queryType || value.query_type || "FACTUAL").toUpperCase(),
    expectedDocumentIds,
    expectedResourceIds: uniqueStrings(value.expectedResourceIds || value.expected_resource_ids),
    expectedSections: uniqueStrings(value.expectedSections || value.expected_sections),
    expectedClauses: uniqueStrings(value.expectedClauses || value.expected_clauses),
    goldEvidence,
    acceptableEvidenceVariants,
    answerable,
    conflictingEvidenceExpected: Boolean(
      value.conflictingEvidenceExpected ?? value.conflicting_evidence_expected ?? false),
    expectedAuthorityClass: String(value.authorityExpectation || value.authority_expectation ||
      value.expectedAuthorityClass || value.expected_authority_class || "UNKNOWN"),
    effectiveDateContext: value.effectiveDateContext ?? value.effective_date_context ?? null,
    difficulty: String(value.difficulty || "medium").toLowerCase(),
    jurisdiction: String(value.jurisdiction || "unspecified"),
    documentType: String(value.documentType || value.document_type || "unknown"),
    notes: String(value.notes || ""),
    reviewStatus,
    reviewerRole: String(value.reviewerRole || value.reviewer_role || "").trim() || null,
    reviewedAt: optionalIsoDate(value.reviewedAt || value.reviewed_at, "reviewed_at"),
    benchmarkVersion: String(value.benchmarkVersion || value.benchmark_version || "v1"),
    scenarioTags: uniqueStrings(value.scenarioTags || value.scenario_tags).map((item) => item.toUpperCase()),
    answerability: answerable ? "ANSWERABLE" : "UNANSWERABLE",
  };
};

const resultIdentity = (value = {}) => String(value.evidenceId || value.id || [
  value.documentId,
  value.chunkId ?? value.section ?? value.clause ?? value.rank,
].filter((item) => item != null).join(":"));

const deduplicateRankedResults = (results = []) => {
  const seen = new Set();
  return results.filter((item) => {
    const identity = resultIdentity(item);
    if (!identity || seen.has(identity)) return false;
    seen.add(identity);
    return true;
  }).map((item, index) => ({ ...item, rank: index + 1 }));
};

const relevanceFor = (benchmark, result) => {
  const documentMatch = benchmark.expectedDocumentIds.includes(String(result.documentId));
  const evidenceIdMatch = benchmark.goldEvidence.some((gold) => gold.id && gold.id === resultIdentity(result));
  const sectionMatch = benchmark.expectedSections.length &&
    benchmark.expectedSections.includes(String(result.section || result.sectionId || ""));
  const clauseMatch = benchmark.expectedClauses.length &&
    benchmark.expectedClauses.includes(String(result.clause || result.clauseId || ""));
  if (evidenceIdMatch || clauseMatch) return 3;
  if (sectionMatch) return 2;
  return documentMatch ? 1 : 0;
};

const dcg = (relevances) => relevances.reduce(
  (sum, relevance, index) => sum + ((2 ** relevance - 1) / Math.log2(index + 2)),
  0,
);

const evaluateRetrievalCase = (caseValue, rawResults = []) => {
  const benchmark = normalizeBenchmarkCase(caseValue);
  const results = deduplicateRankedResults(rawResults);
  const expected = new Set(benchmark.expectedDocumentIds);
  const firstDocumentRank = results.findIndex((item) => expected.has(String(item.documentId)));
  const recallAt = (k) => {
    if (!expected.size) return null;
    const found = new Set(results.slice(0, k).map((item) => String(item.documentId))
      .filter((id) => expected.has(id)));
    return found.size / expected.size;
  };
  const relevances = results.slice(0, 10).map((item) => relevanceFor(benchmark, item));
  const idealRelevances = [
    ...benchmark.goldEvidence.map(() => 3),
    ...benchmark.expectedSections.map(() => 2),
    ...benchmark.expectedDocumentIds.map(() => 1),
  ].sort((left, right) => right - left).slice(0, 10);
  const ideal = dcg(idealRelevances);
  const directEvidenceFound = benchmark.goldEvidence.length
    ? [...benchmark.goldEvidence, ...benchmark.acceptableEvidenceVariants]
      .some((gold) => results.some((item) =>
        resultIdentity(item) === gold.id || (
          gold.documentId && String(item.documentId) === gold.documentId &&
          (gold.chunkId == null || String(item.chunkId) === gold.chunkId)
        ),
      ))
    : null;
  const documentHit = expected.size
    ? results.some((item) => expected.has(String(item.documentId)))
    : null;
  const topExpectedResult = results.find((item) => expected.has(String(item.documentId)));
  const primarySourcePreferred = benchmark.expectedAuthorityClass === "PRIMARY_OFFICIAL" &&
    topExpectedResult?.authorityClass
    ? String(topExpectedResult.authorityClass).toUpperCase() === "PRIMARY_OFFICIAL"
    : null;
  return {
    recallAt1: recallAt(1),
    recallAt3: recallAt(3),
    recallAt5: recallAt(5),
    recallAt10: recallAt(10),
    reciprocalRank: firstDocumentRank >= 0 ? 1 / (firstDocumentRank + 1) : 0,
    ndcgAt10: ideal > 0 ? dcg(relevances) / ideal : null,
    directEvidenceFound,
    documentHit,
    exactReferenceHit: benchmark.queryType === "EXACT_REFERENCE"
      ? Boolean(directEvidenceFound || relevances.some((value) => value >= 2))
      : null,
    primarySourcePreferred,
    retrieved: results,
  };
};

const normalizeCitation = (value) => String(value?.id || value?.citationId || value || "").trim();

const evaluateAnswerCase = (caseValue, answer = {}) => {
  const benchmark = normalizeBenchmarkCase(caseValue);
  const validEvidence = new Set(benchmark.goldEvidence.map((item) => item.id).filter(Boolean));
  const citations = uniqueStrings((answer.citations || []).map(normalizeCitation));
  const matched = citations.filter((citation) => validEvidence.has(citation));
  const citationPrecision = citations.length ? matched.length / citations.length : benchmark.answerable ? 0 : null;
  const citationRecall = validEvidence.size ? new Set(matched).size / validEvidence.size : null;
  const materialClaims = (answer.claims || []).filter((claim) => claim.material !== false);
  const unsupported = materialClaims.filter((claim) =>
    ["UNSUPPORTED", "CONFLICTING"].includes(String(claim.state || "").toUpperCase()),
  );
  const supported = materialClaims.filter((claim) =>
    ["SUPPORTED", "PARTIALLY_SUPPORTED"].includes(String(claim.state || "").toUpperCase()),
  );
  const abstained = Boolean(answer.abstained);
  const conflictDetected = typeof answer.conflictDetected === "boolean"
    ? answer.conflictDetected
    : typeof answer.conflict_detected === "boolean" ? answer.conflict_detected : null;
  const temporalCorrect = typeof answer.temporalCorrect === "boolean"
    ? answer.temporalCorrect
    : typeof answer.temporal_correct === "boolean" ? answer.temporal_correct : null;
  return {
    citationPrecision,
    citationRecall,
    unsupportedFactualClaimRate: materialClaims.length ? unsupported.length / materialClaims.length : 0,
    evidenceFaithfulness: materialClaims.length ? supported.length / materialClaims.length : 1,
    abstained,
    abstentionTruePositive: !benchmark.answerable && abstained ? 1 : 0,
    abstentionFalsePositive: benchmark.answerable && abstained ? 1 : 0,
    abstentionFalseNegative: !benchmark.answerable && !abstained ? 1 : 0,
    answerable: benchmark.answerable,
    conflictDetectionCorrect: conflictDetected == null
      ? null : conflictDetected === benchmark.conflictingEvidenceExpected,
    temporalAnswerCorrect: benchmark.effectiveDateContext == null ? null : temporalCorrect,
  };
};

const groupedMetrics = (evaluated, field) => Object.fromEntries(
  [...new Set(evaluated.map((item) => item.benchmark[field] || "unspecified"))]
    .map((value) => [value, aggregateEvaluation(evaluated.filter((item) =>
      (item.benchmark[field] || "unspecified") === value,
    ), { includeGroups: false })]),
);

const aggregateEvaluation = (evaluated = [], options = {}) => {
  const retrieval = evaluated.filter((item) => item.retrieval && item.benchmark.answerable);
  const answers = evaluated.filter((item) => item.answer);
  const unanswerable = answers.filter((item) => !item.answer.answerable);
  const answerable = answers.filter((item) => item.answer.answerable);
  const metrics = {
    cases: evaluated.length,
    recallAt1: average(retrieval.map((item) => item.retrieval.recallAt1)),
    recallAt3: average(retrieval.map((item) => item.retrieval.recallAt3)),
    recallAt5: average(retrieval.map((item) => item.retrieval.recallAt5)),
    recallAt10: average(retrieval.map((item) => item.retrieval.recallAt10)),
    mrr: average(retrieval.map((item) => item.retrieval.reciprocalRank)),
    ndcgAt10: average(retrieval.map((item) => item.retrieval.ndcgAt10)),
    documentHitRate: average(retrieval.map((item) =>
      item.retrieval.documentHit == null ? null : Number(item.retrieval.documentHit))),
    exactReferenceHitRate: average(retrieval.map((item) =>
      item.retrieval.exactReferenceHit == null ? null : Number(item.retrieval.exactReferenceHit))),
    primarySourcePreferenceRate: average(retrieval.map((item) =>
      item.retrieval.primarySourcePreferred == null ? null : Number(item.retrieval.primarySourcePreferred))),
    citationPrecision: average(answers.map((item) => item.answer.citationPrecision)),
    citationRecall: average(answers.map((item) => item.answer.citationRecall)),
    unsupportedFactualClaimRate: average(answers.map((item) => item.answer.unsupportedFactualClaimRate)),
    evidenceFaithfulness: average(answers.map((item) => item.answer.evidenceFaithfulness)),
    abstentionPrecision: (() => {
      const truePositive = unanswerable.reduce((sum, item) => sum + item.answer.abstentionTruePositive, 0);
      const falsePositive = answerable.reduce((sum, item) => sum + item.answer.abstentionFalsePositive, 0);
      return truePositive + falsePositive ? truePositive / (truePositive + falsePositive) : null;
    })(),
    abstentionRecall: (() => {
      const truePositive = unanswerable.reduce((sum, item) => sum + item.answer.abstentionTruePositive, 0);
      const falseNegative = unanswerable.reduce((sum, item) => sum + item.answer.abstentionFalseNegative, 0);
      return truePositive + falseNegative ? truePositive / (truePositive + falseNegative) : null;
    })(),
    conflictDetectionAccuracy: average(answers.map((item) =>
      item.answer.conflictDetectionCorrect == null
        ? null : Number(item.answer.conflictDetectionCorrect))),
    temporalAnswerAccuracy: average(answers.map((item) =>
      item.answer.temporalAnswerCorrect == null
        ? null : Number(item.answer.temporalAnswerCorrect))),
  };
  if (options.includeGroups === false) return metrics;
  return {
    ...metrics,
    byDocumentType: groupedMetrics(evaluated, "documentType"),
    byQueryType: groupedMetrics(evaluated, "queryType"),
    byJurisdiction: groupedMetrics(evaluated, "jurisdiction"),
    byAuthorityClass: groupedMetrics(evaluated, "expectedAuthorityClass"),
    byDifficulty: groupedMetrics(evaluated, "difficulty"),
    byAnswerability: groupedMetrics(evaluated, "answerability"),
    byReviewMaturity: groupedMetrics(evaluated, "reviewStatus"),
  };
};

const classifyFailures = (item) => {
  const failures = [];
  if (item.retrieval?.recallAt10 === 0) failures.push("correct_document_not_retrieved");
  else if (item.retrieval?.directEvidenceFound === false) failures.push("wrong_chunk_ranked");
  if (item.answer?.citationPrecision != null && item.answer.citationPrecision < 1) failures.push("citation_unsupported");
  if (item.answer?.unsupportedFactualClaimRate > 0) failures.push("unsupported_factual_claim");
  if (item.answer?.abstentionFalsePositive) failures.push("abstention_false_positive");
  if (item.answer?.abstentionFalseNegative) failures.push("abstention_false_negative");
  return failures;
};

const versionManifest = (value = {}) => {
  const manifest = Object.fromEntries(VERSION_FIELDS.map((field) => [field, String(value[field] || "unknown")]));
  return {
    ...manifest,
    fingerprint: crypto.createHash("sha256").update(JSON.stringify(manifest)).digest("hex").slice(0, 16),
  };
};

const evaluateRun = ({ cases, retrievalResults = {}, answerResults = {}, versions = {} }) => {
  const evaluated = cases.map(normalizeBenchmarkCase).map((benchmark) => {
    const retrieval = evaluateRetrievalCase(benchmark, retrievalResults[benchmark.id] || []);
    const answer = answerResults[benchmark.id]
      ? evaluateAnswerCase(benchmark, answerResults[benchmark.id])
      : null;
    const item = { benchmark, retrieval, answer };
    return { ...item, failures: classifyFailures(item) };
  });
  return {
    evaluator: {
      type: "deterministic",
      version: "rag-eval-v1",
      model: null,
      promptVersion: null,
    },
    versions: versionManifest(versions),
    metrics: aggregateEvaluation(evaluated),
    cases: evaluated,
  };
};

const compareConfigurations = ({ cases, configurations, versions = {} }) => ({
  versions: versionManifest(versions),
  configurations: Object.fromEntries(Object.entries(configurations).map(([name, run]) => {
    if (!CONFIGURATIONS.includes(name)) throw new Error(`Unsupported evaluation configuration: ${name}`);
    return [name, evaluateRun({ cases, ...run, versions }).metrics];
  })),
});

const compareWithBaseline = (metrics, baseline, policy) => {
  const checks = ["recallAt10", "mrr", "citationPrecision"].map((metric) => {
    const current = Number(metrics[metric]);
    const previous = Number(baseline[metric]);
    const allowedDrop = Number(policy[metric]?.maximumAbsoluteDrop || 0);
    return {
      metric,
      current,
      baseline: previous,
      allowedDrop,
      passed: Number.isFinite(current) && Number.isFinite(previous) && current + allowedDrop >= previous,
    };
  });
  return { passed: checks.every((item) => item.passed), checks };
};

module.exports = {
  CONFIGURATIONS,
  REVIEW_DECISIONS,
  REVIEW_STATES,
  VERSION_FIELDS,
  aggregateEvaluation,
  compareConfigurations,
  compareWithBaseline,
  deduplicateRankedResults,
  evaluateAnswerCase,
  evaluateRetrievalCase,
  evaluateRun,
  normalizeBenchmarkCase,
  versionManifest,
};
