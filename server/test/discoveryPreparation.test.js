const test = require("node:test");
const assert = require("node:assert/strict");
const { automaticCandidates } = require("../document/discoveryPreparationService");
const { evaluateBusinessCandidate, inferBusinessSignals, RELEVANCE_TIERS } = require("../document/recommendationService");
const { comparisonAsMarkdown } = require("../document/documentComparisonService");

test("automatic preparation preserves relevance order, excludes ready/secondary records and caps at three", () => {
  const items = Array.from({ length: 7 }, (_, id) => ({ id, authorityClass: "PRIMARY_OFFICIAL", relevanceTier: RELEVANCE_TIERS.HIGH, researchReady: false }));
  items[0].researchReady = true;
  items[1].authorityClass = "SECONDARY_RESEARCH";
  items[2].relevanceTier = RELEVANCE_TIERS.LOW;
  assert.deepEqual(automaticCandidates(items).map((item) => item.id), [3, 4, 5]);
});

test("food legislation is discovered before preparation without claiming official hosting", () => {
  const input = { problem: "Food manufacturing and packaging business in Maharashtra", states: [] };
  const row = { title: "The Food Safety And Standards Act 2006", document_type: "act", jurisdiction: "India", canonical_url: "https://prsindia.org/files/bills_acts/acts_parliament/2006/food.pdf", problem_rank: 1 };
  const unready = evaluateBusinessCandidate({ ...row, research_ready: false }, input);
  assert.equal(unready.authorityClass, "PRIMARY_LEGAL_TEXT");
  assert.ok([RELEVANCE_TIERS.HIGH, RELEVANCE_TIERS.MEDIUM].includes(unready.tier));
  assert.deepEqual(evaluateBusinessCandidate({ ...row, research_ready: true }, input), unready);
});

test("specific recycling intent does not broaden into unrelated manufacturing recommendations", () => {
  const inferred = inferBusinessSignals({ problem: "Battery recycling manufacturing in Gujarat" });
  assert.deepEqual(inferred.sectors, ["environment and recycling"]);
});

test("comparison export retains all persisted findings, nested values and citation labels", () => {
  const content = comparisonAsMarkdown({ createdAt: "2026-09-06T00:00:00Z", result: {
    executiveSummary: "A differs from B [C1, C2].",
    differences: Array.from({ length: 25 }, (_, index) => ({ finding: `Unique finding ${index}`, documentA: { description: "A finding" }, documentB: "B finding", citations: ["C1", "C2"] })),
    keyTakeaways: [null, { synthesis: "Final synthesis retained" }],
  } });
  assert.match(content, /Unique finding 24/);
  assert.match(content, /Final synthesis retained/);
  assert.match(content, /C1; C2/);
  assert.doesNotMatch(content, /\[object Object\]/);
});
