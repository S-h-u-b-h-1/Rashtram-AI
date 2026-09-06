const test = require("node:test");
const assert = require("node:assert/strict");
const { automaticCandidates } = require("../document/discoveryPreparationService");
const { evaluateBusinessCandidate, inferBusinessSignals, RELEVANCE_TIERS } = require("../document/recommendationService");
const { comparisonAsMarkdown } = require("../document/documentComparisonService");
const { validateComparisonOutput } = require("../document/documentComparisonService");

test("different instruments preserve same-proposition differences without blocking comparison", () => {
  const { assessEvidenceSufficiency, detectEvidenceConflicts } = require("../retrieval/evidenceSafetyService");
  const evidence = [
    { documentId: "1", chunkIndex: 0, content: "The filing deadline period is 30 days for the annual return." },
    { documentId: "2", chunkIndex: 0, content: "The filing deadline period is 60 days for the annual return." },
  ];
  assert.equal(detectEvidenceConflicts(evidence).length, 1);
  const comparisonDifferences = detectEvidenceConflicts(evidence, { compareDocuments: true });
  assert.equal(comparisonDifferences.length, 1);
  assert.equal(comparisonDifferences[0].comparisonDifference, true);
  assert.notEqual(assessEvidenceSufficiency("Compare filing deadlines", evidence, {
    queryType: "COMPARISON", retrievalVerified: true,
  }).level, "CONFLICTING");
  assert.equal(detectEvidenceConflicts([evidence[0], { ...evidence[1], documentId: "1", chunkIndex: 1 }], { compareDocuments: true }).length, 1);
});

test("canonical readiness accepts verified lexical retrieval while semantic indexing is deferred", () => {
  const source = require("node:fs").readFileSync(require.resolve("../document/DocumentRepository"), "utf8");
  assert.equal((source.match(/ps\.embedding_status IN \('fallback', 'deferred'\)/g) || []).length, 2);
  assert.match(source, /ps\.retrieval_mode IN \('local_text', 'fts', 'hybrid'\)/);
  assert.match(source, /AND ps\.retrieval_verified/);
  assert.match(source, /AND ps\.extraction_status = 'ready'/);
});

test("a cited comparison with missing analytical sections is partial, not complete", () => {
  const citations = [{ id: "D1-C1", documentId: "1" }, { id: "D2-C1", documentId: "2" }];
  const generated = { generationMode: "ai", executiveSummary: "The instruments differ in reporting scope [D1-C1] [D2-C1].",
    differences: [{ analysis: "D1 differs from D2: D1 addresses reporting while D2 addresses disclosure.", citations: ["D1-C1", "D2-C1"] }] };
  const result = validateComparisonOutput(generated, citations, { requireCompleteSections: true });
  assert.equal(result.valid, true);
  assert.equal(result.status, "PARTIAL_EVIDENCE");
  assert.ok(result.missingSections.includes("scope"));
  assert.equal(validateComparisonOutput(generated, [...citations, { id: "D3-C1", documentId: "3" }]).valid, false);
});

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
