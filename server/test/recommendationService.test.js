const test = require("node:test");
const assert = require("node:assert/strict");

const {
  confidenceForScore,
  isRecommendationEligible,
  normalizeTypes,
  scoreRecommendation,
  validateProblemRequest,
} = require("../document/recommendationService");

test("recommendation scoring rewards grounded catalogue signals", () => {
  const weak = scoreRecommendation({
    qualityScore: 50,
    researchReady: true,
  });
  const strong = scoreRecommendation({
    relationship: true,
    sameMinistry: true,
    sameJurisdiction: true,
    semanticMatch: true,
    researchReady: true,
    qualityScore: 90,
  });
  assert.ok(strong > weak);
  assert.equal(confidenceForScore(strong), "high");
  assert.equal(confidenceForScore(0.2), "low");
});

test("recommendations exclude low-quality, hidden and non-ready records", () => {
  const base = {
    title: "Verified policy",
    sourceUrl: "https://example.test/policy",
    visibilityStatus: "public",
    qualityScore: 80,
    researchReady: true,
  };
  assert.equal(isRecommendationEligible(base), true);
  assert.equal(
    isRecommendationEligible({ ...base, qualityScore: 20 }),
    false,
  );
  assert.equal(
    isRecommendationEligible({ ...base, visibilityStatus: "hidden_invalid" }),
    false,
  );
  assert.equal(
    isRecommendationEligible({ ...base, researchReady: false }),
    false,
  );
});

test("recommendation type filters expand policy and gazette families", () => {
  const types = normalizeTypes(["policy", "gazette"]);
  assert.equal(types.includes("policy"), true);
  assert.equal(types.includes("notification"), true);
  assert.equal(types.includes("circular"), true);
  assert.deepEqual(normalizeTypes("all"), []);
});

test("problem recommender validates and normalizes bounded input", () => {
  const value = validateProblemRequest({
    problem: "We need to understand logistics licensing across two states.",
    industry: "logistics",
    states: ["West Bengal", "Odisha", "Odisha"],
    documentTypes: ["policy", "act"],
    limit: 200,
  });
  assert.deepEqual(value.states, ["West Bengal", "Odisha"]);
  assert.equal(value.documentTypes.includes("policy"), true);
  assert.equal(value.limit, 20);
  assert.throws(
    () => validateProblemRequest({ problem: "too short" }),
    /12 to 2,000/i,
  );
});
