const test = require("node:test");
const assert = require("node:assert/strict");

const {
  RELEVANCE_TIERS,
  confidenceForScore,
  evaluateBusinessCandidate,
  hasDocumentSummarySubjectOverlap,
  hasDocumentTitleSubjectOverlap,
  hasSubstantiveRecommendationAffinity,
  inferBusinessSignals,
  isRecommendationEligible,
  normalizeTypes,
  stateOnlyRequested,
  scoreRecommendation,
  validateComparisonRecommendationRequest,
  validateProblemRequest,
} = require("../document/recommendationService");

test("document recommendations require shared subject matter, not generic metadata", () => {
  assert.equal(
    hasSubstantiveRecommendationAffinity({
      sameJurisdiction: true,
      sameType: true,
      sameYear: true,
      recent: true,
      researchReady: true,
      qualityScore: 90,
    }),
    false,
  );
  assert.equal(
    hasSubstantiveRecommendationAffinity({
      semanticMatch: true,
      sameCategory: true,
    }),
    true,
  );
  assert.equal(
    hasSubstantiveRecommendationAffinity({ semanticMatch: true }),
    false,
  );
  assert.equal(
    hasSubstantiveRecommendationAffinity({
      semanticMatch: true,
      sameType: true,
      sameJurisdiction: true,
    }),
    false,
  );
  assert.equal(
    hasSubstantiveRecommendationAffinity({
      relationship: true,
      sameMinistry: true,
    }),
    false,
  );
  assert.equal(
    hasSubstantiveRecommendationAffinity({ sharedLegalIdentifier: true }),
    true,
  );
});

test("document title affinity keeps shared policy subjects and rejects broad tax noise", () => {
  assert.equal(
    hasDocumentTitleSubjectOverlap(
      "The Manipur Goods and Services Tax (Amendment) Bill, 2025",
      "The Central Goods and Services Tax Bill, 2017",
    ),
    true,
  );
  assert.equal(
    hasDocumentTitleSubjectOverlap(
      "The Manipur Goods and Services Tax (Amendment) Bill, 2025",
      "The Income-tax Bill, 2025",
    ),
    false,
  );
});

test("stored summaries establish subject affinity without treating generic legal prose as a match", () => {
  assert.equal(
    hasDocumentSummarySubjectOverlap(
      "The measure changes goods and services tax registration, input tax credit, electronic invoices, returns, taxable supplies, small dealers, and compliance procedures.",
      "This GST proposal addresses goods and services tax registration, input tax credit, electronic invoices, returns, taxable supplies, small dealers, and compliance procedures.",
    ),
    true,
  );
  assert.equal(
    hasDocumentSummarySubjectOverlap(
      "The measure changes goods and services tax registration, input tax credit, electronic invoices, returns, taxable supplies, small dealers, and compliance procedures.",
      "The mining framework regulates mineral auctions, exploration leases, royalty payments, mine closure, environmental restoration, concession holders, and geological surveys.",
    ),
    false,
  );
  assert.equal(
    hasDocumentSummarySubjectOverlap(
      "This Bill aims to amend an existing Act, provide a stable framework, improve implementation, and give the Central Government powers to issue provisions for affected persons.",
      "This Bill aims to amend another Act, provide a stable framework, improve implementation, and give the Central Government powers to issue provisions for affected institutions.",
    ),
    false,
  );
});

test("recommendation scoring rewards grounded catalogue signals", () => {
  const weak = scoreRecommendation({
    qualityScore: 50,
    researchReady: true,
  });
  const strong = scoreRecommendation({
    relationship: true,
    relationshipVerified: true,
    sameMinistry: true,
    sameJurisdiction: true,
    semanticMatch: true,
    researchReady: true,
    qualityScore: 90,
  });
  assert.ok(strong > weak);
  assert.equal(confidenceForScore(strong), "high");
  assert.equal(confidenceForScore(0.2), "low");
  assert.ok(
    scoreRecommendation({
      relationship: true,
      relationshipVerified: true,
      researchReady: true,
      comparisonReady: true,
      qualityScore: 80,
    }) >
      scoreRecommendation({
        semanticMatch: true,
        researchReady: true,
        comparisonReady: true,
        qualityScore: 80,
      }),
  );
});

test("comparison recommendation input prevents duplicate selections", () => {
  assert.deepEqual(
    validateComparisonRecommendationRequest({
      selectedDocumentIds: [1, "2"],
      preferredTypes: ["bill", "act"],
      limit: 99,
      query: "  labour reform  ",
    }),
    {
      selectedDocumentIds: ["1", "2"],
      preferredTypes: ["bill", "act"],
      limit: 20,
      query: "labour reform",
    },
  );
  assert.throws(
    () =>
      validateComparisonRecommendationRequest({
        selectedDocumentIds: ["1", "1"],
      }),
    /duplicate/i,
  );
  assert.throws(
    () => validateComparisonRecommendationRequest({ selectedDocumentIds: [] }),
    /one and five/i,
  );
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
  assert.deepEqual(normalizeTypes("state_bill"), ["bill"]);
  assert.equal(stateOnlyRequested("state_bill"), true);
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

test("business signals expand regulated activities without generic policy noise", () => {
  const signals = inferBusinessSignals({
    problem: "I operate an EV battery recycling facility in Gujarat.",
  });
  assert.ok(signals.sectors.includes("environment and recycling"));
  assert.ok(signals.jurisdictions.includes("Gujarat"));
  assert.ok(signals.expansions.includes("EPR"));
  assert.ok(signals.regulators.includes("CPCB"));
});

test("jurisdiction and sector mismatch reject attractive but irrelevant distractors", () => {
  const input = {
    problem: "I operate an EV battery recycling facility in Gujarat.",
    states: [],
  };
  const inferred = inferBusinessSignals(input);
  const relevant = evaluateBusinessCandidate({
    title: "Gujarat Battery Waste Management and EPR Rules",
    document_type: "rule",
    schema_state: "Gujarat",
    authority: "Gujarat Pollution Control Board",
    source_authority_tier: "PRIMARY_OFFICIAL",
    problem_rank: 0.8,
    semantic_match: true,
  }, input, inferred);
  const distractor = evaluateBusinessCandidate({
    title: "Digital Education Infrastructure Strategy",
    document_type: "report",
    schema_state: "West Bengal",
    authority: "Education Department",
    source_authority_tier: "PRIMARY_OFFICIAL",
    problem_rank: 0.2,
    semantic_match: true,
  }, input, inferred);
  assert.ok([RELEVANCE_TIERS.HIGH, RELEVANCE_TIERS.MEDIUM].includes(relevant.tier));
  assert.equal(distractor.tier, RELEVANCE_TIERS.REJECTED);
  assert.equal(distractor.jurisdictionMismatch, true);
});

test("official authority cannot rescue an irrelevant compliance document", () => {
  const input = { problem: "An NBFC offers digital loans across India.", states: [] };
  const inferred = inferBusinessSignals(input);
  const irrelevant = evaluateBusinessCandidate({
    title: "Civil Registration Annual Report",
    document_type: "report",
    jurisdiction: "India",
    source_authority_tier: "PRIMARY_OFFICIAL",
    semantic_match: true,
  }, input, inferred);
  assert.ok([RELEVANCE_TIERS.LOW, RELEVANCE_TIERS.REJECTED].includes(irrelevant.tier));
});
