const {
  REVIEW_DECISIONS,
  REVIEW_STATES,
  normalizeBenchmarkCase,
} = require("./ragEvalV1");

const normalizeDecision = (value) => String(value || "").trim().toUpperCase();

const buildReviewPack = ({ cases = [], run = {}, benchmarkVersion = "v1" } = {}) => ({
  format: "rashtram-benchmark-review-pack-v1",
  benchmarkVersion,
  generatedAt: new Date().toISOString(),
  instructions: {
    decisions: [...REVIEW_DECISIONS],
    evidenceRule: "Review original evidence and citations; vector scores are not required.",
  },
  cases: cases.map((rawCase) => {
    const benchmark = normalizeBenchmarkCase(rawCase);
    return {
      id: benchmark.id,
      question: benchmark.question,
      queryType: benchmark.queryType,
      jurisdiction: benchmark.jurisdiction,
      documentType: benchmark.documentType,
      answerable: benchmark.answerable,
      conflictingEvidenceExpected: benchmark.conflictingEvidenceExpected,
      effectiveDateContext: benchmark.effectiveDateContext,
      expectedDocumentIds: benchmark.expectedDocumentIds,
      expectedResourceIds: benchmark.expectedResourceIds,
      expectedSections: benchmark.expectedSections,
      expectedClauses: benchmark.expectedClauses,
      goldEvidence: benchmark.goldEvidence,
      acceptableEvidenceVariants: benchmark.acceptableEvidenceVariants,
      retrievedPassages: run.retrievalResults?.[benchmark.id] || [],
      systemAnswer: run.answerResults?.[benchmark.id] || null,
      citations: run.answerResults?.[benchmark.id]?.citations || [],
      abstained: Boolean(run.answerResults?.[benchmark.id]?.abstained),
      currentReviewStatus: benchmark.reviewStatus,
      review: {
        decision: null,
        reviewStatus: benchmark.reviewStatus,
        reviewerRole: benchmark.reviewerRole,
        reviewedAt: benchmark.reviewedAt,
        notes: "",
      },
    };
  }),
});

const validateReviewPack = (pack = {}) => {
  if (pack.format !== "rashtram-benchmark-review-pack-v1") {
    throw new Error("Unsupported benchmark review-pack format.");
  }
  if (!Array.isArray(pack.cases)) throw new Error("Review pack cases must be an array.");
  const ids = new Set();
  const reviewed = pack.cases.map((item) => {
    const id = String(item.id || "").trim();
    if (!id || ids.has(id)) throw new Error(`Missing or duplicate review case id: ${id || "(empty)"}`);
    ids.add(id);
    const decision = normalizeDecision(item.review?.decision);
    if (!REVIEW_DECISIONS.has(decision)) {
      throw new Error(`Invalid reviewer decision for ${id}: ${decision || "(empty)"}`);
    }
    const reviewStatus = String(item.review?.reviewStatus || "").trim().toUpperCase();
    if (!REVIEW_STATES.has(reviewStatus)) {
      throw new Error(`Invalid review status for ${id}: ${reviewStatus || "(empty)"}`);
    }
    const reviewerRole = String(item.review?.reviewerRole || "").trim() || null;
    const reviewedAt = item.review?.reviewedAt == null
      ? null : new Date(item.review.reviewedAt);
    if (reviewedAt && Number.isNaN(reviewedAt.getTime())) {
      throw new Error(`Invalid reviewedAt for ${id}.`);
    }
    if (["DOMAIN_REVIEWED", "EXPERT_VERIFIED"].includes(reviewStatus) &&
        (!reviewerRole || !reviewedAt)) {
      throw new Error(`${reviewStatus} requires reviewerRole and reviewedAt for ${id}.`);
    }
    return {
      id,
      decision,
      reviewStatus,
      reviewerRole,
      reviewedAt: reviewedAt?.toISOString() || null,
      notes: String(item.review?.notes || "").trim(),
    };
  });
  const byDecision = Object.fromEntries([...REVIEW_DECISIONS]
    .map((decision) => [decision, reviewed.filter((item) => item.decision === decision).length]));
  const byStatus = Object.fromEntries([...REVIEW_STATES]
    .map((status) => [status, reviewed.filter((item) => item.reviewStatus === status).length]));
  return { valid: true, cases: reviewed.length, byDecision, byStatus, reviewed };
};

module.exports = {
  buildReviewPack,
  normalizeDecision,
  validateReviewPack,
};
