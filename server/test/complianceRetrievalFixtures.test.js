const test = require("node:test");
const assert = require("node:assert/strict");

const {
  RELEVANCE_TIERS,
  authorityWeight,
  evaluateBusinessCandidate,
  inferBusinessSignals,
} = require("../document/recommendationService");
const {
  evaluateCompliancePassage,
  shapeComplianceResult,
} = require("../product/complianceCopilotService");

const positiveProblems = [
  ["An NBFC offers digital loans across India.", "financial services", "RBI"],
  ["I operate an EV battery recycling facility in Gujarat.", "environment and recycling", "CPCB"],
  ["I am starting a food manufacturing company in West Bengal.", "food manufacturing", "FSSAI"],
  ["I run an insurance brokerage in Maharashtra.", "insurance", "IRDAI"],
  ["I operate a SaaS platform handling customer personal data in Karnataka.", "digital services and data", "Digital Personal Data Protection"],
];

test("compliance fixture domains expand to sector-specific legal vocabulary", () => {
  for (const [problem, sector, expansion] of positiveProblems) {
    const signals = inferBusinessSignals({ problem });
    assert.ok(signals.sectors.includes(sector), problem);
    assert.ok(signals.expansions.some((item) => item.includes(expansion)), problem);
  }
});

test("all required state fixtures are inferred without a separate form field", () => {
  for (const state of ["Gujarat", "West Bengal", "Maharashtra", "Karnataka", "Delhi"]) {
    const signals = inferBusinessSignals({ problem: `I operate a regulated facility in ${state}.` });
    assert.ok(signals.jurisdictions.includes(state), state);
  }
});

test("broad business input requests specificity instead of inventing matches", () => {
  const signals = inferBusinessSignals({ problem: "I run a business in India" });
  assert.equal(signals.needsSpecificity, true);
  assert.deepEqual(signals.sectors, []);
});

test("low-confidence candidates remain discovery-only", () => {
  const input = { problem: "An NBFC offers digital loans across India." };
  const relevance = evaluateBusinessCandidate({
    title: "Financial Inclusion Conference Report",
    document_type: "report",
    jurisdiction: "India",
    source_authority_tier: "RESEARCH",
    problem_rank: 0.01,
  }, input, inferBusinessSignals(input));
  assert.ok([RELEVANCE_TIERS.LOW, RELEVANCE_TIERS.REJECTED].includes(relevance.tier));
});

test("broad sector articles cannot satisfy a specific compliance intent", () => {
  const fixtures = [
    [
      "An NBFC offers digital loans across India.",
      { title: "Micro-Loan Delinquency Surges in Rural India", document_type: "report", jurisdiction: "India", problem_rank: 1 },
    ],
    [
      "I operate an EV battery recycling facility in Gujarat.",
      { title: "Critical Mineral Recycling Incentive Scheme", document_type: "scheme", jurisdiction: "India", problem_rank: 1 },
    ],
    [
      "I am starting a food manufacturing company in West Bengal.",
      { title: "Plant Protein Technology for Food Processing", document_type: "report", jurisdiction: "India", problem_rank: 1 },
    ],
  ];
  for (const [problem, candidate] of fixtures) {
    const relevance = evaluateBusinessCandidate(candidate, { problem }, inferBusinessSignals({ problem }));
    assert.ok([RELEVANCE_TIERS.LOW, RELEVANCE_TIERS.REJECTED].includes(relevance.tier), problem);
  }
});

test("specific regulatory anchors permit genuinely relevant candidates", () => {
  const fixtures = [
    ["An NBFC offers digital loans across India.", "RBI Digital Lending Directions for NBFC Registration", "regulation"],
    ["I operate an EV battery recycling facility in Gujarat.", "Battery Waste EPR Registration Rules", "rule"],
    ["I am starting a food manufacturing company in West Bengal.", "FSSAI Food Manufacturing Licence and Safety Regulations", "regulation"],
    ["I run an insurance brokerage in Maharashtra.", "IRDAI Insurance Broker Registration Regulations", "regulation"],
    ["I operate a SaaS company in India handling customer personal data.", "Digital Personal Data Protection Act: Consent Duties", "act"],
  ];
  for (const [problem, title, documentType] of fixtures) {
    const relevance = evaluateBusinessCandidate({
      title,
      document_type: documentType,
      jurisdiction: "India",
      source_authority_tier: "A",
      problem_rank: 1,
      semantic_match: true,
    }, { problem }, inferBusinessSignals({ problem }));
    assert.ok([RELEVANCE_TIERS.HIGH, RELEVANCE_TIERS.MEDIUM].includes(relevance.tier), problem);
    assert.equal(relevance.domainAnchorMatch, true);
    assert.equal(relevance.regulatoryAnchorMatch, true);
  }
});

test("official authority improves an equally relevant match but cannot create relevance", () => {
  const input = { problem: "An NBFC offers digital loans across India." };
  const inferred = inferBusinessSignals(input);
  const base = {
    title: "Digital Lending and NBFC Registration Requirements",
    document_type: "regulation",
    jurisdiction: "India",
    authority: "RBI",
    problem_rank: 0.8,
  };
  const primary = evaluateBusinessCandidate({ ...base, source_authority_tier: "PRIMARY_OFFICIAL" }, input, inferred);
  const secondary = evaluateBusinessCandidate({ ...base, source_authority_tier: "RESEARCH", authority: "PolicyEdge" }, input, inferred);
  const irrelevantOfficial = evaluateBusinessCandidate({
    title: "Official Crop Production Survey",
    document_type: "report",
    jurisdiction: "India",
    source_authority_tier: "PRIMARY_OFFICIAL",
  }, input, inferred);
  assert.ok(primary.score > secondary.score);
  assert.ok(secondary.score > irrelevantOfficial.score);
  assert.equal(authorityWeight({ canonical_source: "policyedge" }).class, "SECONDARY_RESEARCH");
  assert.equal(authorityWeight({ source_authority_tier: "A" }).class, "PRIMARY_OFFICIAL");
});

test("jurisdiction mismatch is rejected even when words and authority look attractive", () => {
  const input = { problem: "I operate an EV battery recycling facility in Gujarat." };
  const relevance = evaluateBusinessCandidate({
    title: "Battery Waste Registration Rules",
    document_type: "rule",
    schema_state: "Delhi",
    authority: "Pollution Control Board",
    source_authority_tier: "PRIMARY_OFFICIAL",
    problem_rank: 1,
    semantic_match: true,
  }, input, inferBusinessSignals(input));
  assert.equal(relevance.tier, RELEVANCE_TIERS.REJECTED);
  assert.equal(relevance.jurisdictionMismatch, true);
});

test("only relevant normative passages can become cited obligations", () => {
  const input = { problem: "An NBFC offers digital loans across India." };
  const recommendation = { relevanceTier: RELEVANCE_TIERS.HIGH };
  const metadata = evaluateCompliancePassage({
    content: "Title: Digital Lending Report. Document type: report. Status: Published. Source: RBI.",
  }, input, recommendation);
  const obligation = evaluateCompliancePassage({
    content: "Every NBFC offering digital loans must disclose the annual percentage rate to the borrower.",
  }, input, recommendation);
  assert.equal(metadata.normative, false);
  assert.equal(obligation.normative, true);
});

test("obligations retain the intended document and passage citation identity", () => {
  const input = { problem: "An NBFC offers digital loans across India." };
  const result = shapeComplianceResult({
    input,
    recommendations: [{
      id: "101", title: "RBI Digital Lending Directions", documentType: "regulation",
      jurisdiction: "India", authority: "RBI", sourceUrl: "https://rbi.example/directions",
      relevanceTier: RELEVANCE_TIERS.HIGH, authorityClass: "PRIMARY_OFFICIAL",
      reason: "Matches NBFC digital lending and RBI regulation.",
    }],
    knowledge: { concepts: [] },
    documentRuns: [{
      document: { id: "101", title: "RBI Digital Lending Directions", sourceUrl: "https://rbi.example/directions" },
      recommendation: { relevanceTier: RELEVANCE_TIERS.HIGH, authorityClass: "PRIMARY_OFFICIAL" },
      passages: [{
        content: "Every NBFC offering digital loans shall disclose the annual percentage rate to the borrower.",
        authorityClass: "PRIMARY_OFFICIAL", sourceUrl: "https://rbi.example/directions",
      }],
      sufficiency: { level: "HIGH", decision: "SUFFICIENT", reasons: [] },
    }],
  });
  assert.equal(result.evidenceBackedObligations.length, 1);
  assert.equal(result.evidenceBackedObligations[0].documentId, "101");
  assert.deepEqual(result.evidenceBackedObligations[0].citations, ["D1-C1"]);
  assert.equal(result.evidence[0].documentId, "101");
  assert.equal(result.relevantPrimaryDocuments.length, 1);
});

test("no evidence abstains and secondary-only evidence exposes a primary-source gap", () => {
  const empty = shapeComplianceResult({
    input: { problem: "A specific regulated business activity needs guidance." },
    recommendations: [], knowledge: { concepts: [] }, documentRuns: [],
  });
  assert.match(empty.abstention, /insufficient relevant evidence/i);
  assert.equal(empty.evidenceBackedObligations.length, 0);

  const secondary = shapeComplianceResult({
    input: { problem: "An NBFC offers digital loans across India." },
    recommendations: [{
      id: "202", title: "PolicyEdge Digital Lending Analysis", documentType: "report",
      jurisdiction: "India", authority: "PolicyEdge", sourceUrl: "https://policyedge.example/article",
      relevanceTier: RELEVANCE_TIERS.HIGH, authorityClass: "SECONDARY_RESEARCH",
    }],
    knowledge: { concepts: [] },
    documentRuns: [{
      document: { id: "202", title: "PolicyEdge Digital Lending Analysis" },
      recommendation: { relevanceTier: RELEVANCE_TIERS.HIGH, authorityClass: "SECONDARY_RESEARCH" },
      passages: [{ content: "An NBFC offering digital loans must provide specified disclosures.", resourceType: "html" }],
      sufficiency: { level: "HIGH", decision: "SUFFICIENT", reasons: [] },
    }],
  });
  assert.match(secondary.primarySourceGap, /primary official source/i);
  assert.equal(secondary.evidence[0].pageStart, null);
  assert.equal(secondary.evidenceStatus, "insufficient_relevant_evidence");
  assert.match(secondary.abstention, /primary-official, normative passage/i);
});

test("descriptive or secondary passages never make a compliance run complete", () => {
  const input = { problem: "I operate an EV battery recycling facility in Gujarat." };
  const result = shapeComplianceResult({
    input,
    recommendations: [{
      id: "301", title: "Battery Recycling Outlook", documentType: "report",
      jurisdiction: "Gujarat", authority: "Research Institute",
      relevanceTier: RELEVANCE_TIERS.HIGH, authorityClass: "SECONDARY_RESEARCH",
    }],
    knowledge: { concepts: [] },
    documentRuns: [{
      document: { id: "301", title: "Battery Recycling Outlook" },
      recommendation: { relevanceTier: RELEVANCE_TIERS.HIGH, authorityClass: "SECONDARY_RESEARCH" },
      passages: [{
        content: "Battery recycling operators in Gujarat must study evolving collection practices.",
        authorityClass: "SECONDARY_RESEARCH",
      }],
      sufficiency: { level: "HIGH", decision: "SUFFICIENT", reasons: [] },
    }],
  });
  assert.equal(result.evidence.length, 1);
  assert.deepEqual(result.evidenceBackedObligations, []);
  assert.equal(result.evidenceStatus, "insufficient_relevant_evidence");
});
