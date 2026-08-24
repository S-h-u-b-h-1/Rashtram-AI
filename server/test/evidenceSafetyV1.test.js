const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const {
  CLAIM_STATES,
  CLAIM_TYPES,
  SUFFICIENCY_LEVELS,
  assessEvidenceSufficiency,
  buildAbstentionResponse,
  buildGroundedExtractiveAnswer,
  citationSupportsClaim,
  classifyClaim,
  detectEvidenceConflicts,
  extractClaims,
  validateClaims,
  verifyAndRepairAnswer,
  verifyStructuredComparison,
} = require("../retrieval/evidenceSafetyService");
const { QUERY_TYPES } = require("../retrieval/queryPlanner");

const evidence = (overrides = {}) => ({
  documentId: "bill-1",
  documentTitle: "The Public Reporting Bill, 2026",
  chunkIndex: 1,
  passage: 1,
  citationId: "Source 1",
  content: "Section 14(2) requires the Authority to publish an annual compliance report by 30 June.",
  sectionId: "14(2)",
  pageStart: 4,
  sourceUrl: "https://law.gov.in/reporting-bill.pdf",
  authorityClass: "PRIMARY_OFFICIAL",
  ftsScore: 1,
  identifierBoost: 1,
  ...overrides,
});

test("high-confidence exact section evidence receives a HIGH assessment", () => {
  const result = assessEvidenceSufficiency(
    "What does section 14(2) require about the annual compliance report?",
    [evidence(), evidence({ chunkIndex: 2, passage: 2, citationId: "Source 2", content: "The annual report must be published on the Authority website." })],
    { queryType: QUERY_TYPES.EXACT_REFERENCE, retrievalVerified: true },
  );
  assert.equal(result.level, SUFFICIENCY_LEVELS.HIGH);
  assert.equal(result.decision, "SUFFICIENT");
  assert.ok(result.score >= 0.72);
  assert.equal(result.signals.exactReferenceMatch, true);
  assert.equal(result.signals.sourceAuthority, "PRIMARY_OFFICIAL");
  assert.equal(result.signals.sourceConsistency, "CONSISTENT");
  assert.equal(result.signals.documentCapabilities.searchReady, true);
  assert.match(result.reasons.join(" "), /exact structural reference/i);
});

test("a low-evidence query is not marked high confidence", () => {
  const result = assessEvidenceSufficiency(
    "What fiscal impact will the reform have on rural hospitals?",
    [evidence({ content: "The short title of this Act is the Public Reporting Act.", ftsScore: 0, identifierBoost: 0 })],
    { queryType: QUERY_TYPES.POLICY_ANALYSIS, retrievalVerified: true },
  );
  assert.ok([SUFFICIENCY_LEVELS.LOW, SUFFICIENCY_LEVELS.INSUFFICIENT].includes(result.level));
  assert.ok(["LIMITED", "ABSTAIN"].includes(result.decision));
  assert.notEqual(result.level, SUFFICIENCY_LEVELS.HIGH);
});

test("unsupported generated factual claims are detected", () => {
  const claims = extractClaims("The Bill creates a ₹50 crore grant for hospitals. [Source 1]");
  const [validated] = validateClaims(claims, [evidence()]);
  assert.equal(validated.type, CLAIM_TYPES.SOURCE_FACT);
  assert.equal(validated.state, CLAIM_STATES.UNSUPPORTED);
});

test("non-material connective prose does not require a citation", () => {
  const claims = extractClaims("Taken together, the evidence provides useful context.");
  const [validated] = validateClaims(claims, [evidence()]);
  assert.equal(validated.material, false);
  assert.equal(validated.state, CLAIM_STATES.SUPPORTED);
  assert.equal(validated.verificationScope, "non_material");
});

test("material legal claims remain subject to strict citation verification", () => {
  const claims = extractClaims("The Authority must publish the report by 31 March.");
  const [validated] = validateClaims(claims, [evidence()]);
  assert.equal(validated.material, true);
  assert.equal(validated.state, CLAIM_STATES.UNSUPPORTED);
});

test("analytical inference is labeled separately from a source fact", () => {
  assert.equal(
    classifyClaim("Analytical inference: this may increase the Authority's administrative workload."),
    CLAIM_TYPES.ANALYTICAL_INFERENCE,
  );
});

test("a citation supports a claim when the cited passage contains the same fact", () => {
  const support = citationSupportsClaim(
    "The Authority must publish an annual compliance report by 30 June.",
    evidence(),
  );
  assert.equal(support.supported, true);
});

test("a citation does not support an unrelated claim or an invented number", () => {
  const support = citationSupportsClaim(
    "The Authority must distribute ₹50 crore to hospitals.",
    evidence(),
  );
  assert.equal(support.supported, false);
  assert.equal(support.partial, false);
});

test("closely aligned authoritative sources with different values surface a conflict", () => {
  const conflicts = detectEvidenceConflicts([
    evidence({ documentId: "rule-a", content: "The penalty rate for delayed annual filing is 10 percent." }),
    evidence({ documentId: "rule-b", content: "The penalty rate for delayed annual filing is 20 percent." }),
  ]);
  assert.equal(conflicts.length, 1);
  const assessment = assessEvidenceSufficiency("What is the penalty rate for delayed annual filing?", [
    evidence({ documentId: "rule-a", content: "The penalty rate for delayed annual filing is 10 percent." }),
    evidence({ documentId: "rule-b", content: "The penalty rate for delayed annual filing is 20 percent." }),
  ]);
  assert.equal(assessment.level, SUFFICIENCY_LEVELS.CONFLICTING);
  assert.equal(assessment.decision, "CONFLICT");
  assert.equal(assessment.signals.sourceConsistency, "CONFLICTING");
  assert.match(buildAbstentionResponse(assessment), /inconsistent/i);
});

test("an empty evidence set returns an explainable abstention decision", () => {
  const result = assessEvidenceSufficiency("What changed?", [], { retrievalVerified: false });
  assert.equal(result.level, SUFFICIENCY_LEVELS.INSUFFICIENT);
  assert.equal(result.decision, "ABSTAIN");
  assert.equal(result.signals.sourceDiversity, "NONE");
  assert.equal(result.signals.documentCapabilities.searchReady, false);
});

test("absent page or section metadata is never fabricated in extractive fallback", () => {
  const answer = buildGroundedExtractiveAnswer("What is required?", [
    evidence({ pageStart: undefined, sectionId: undefined, content: "The Authority shall publish the report." }),
  ]);
  assert.match(answer, /Authority shall publish/);
  assert.doesNotMatch(answer, /Page \d|Section \d/);
});

test("generation-provider failure retains a source-only cited fallback", () => {
  const answer = buildGroundedExtractiveAnswer("What does the bill require?", [evidence()]);
  assert.match(answer, /generation is temporarily unavailable/i);
  assert.match(answer, /\[Source 1\]/);
  assert.match(answer, /30 June/);
});

test("verifier failure falls back to deterministic claim extraction", async () => {
  const result = await verifyAndRepairAnswer(
    "The Authority must publish an annual compliance report by 30 June. [Source 1]",
    [evidence()],
    { verifier: async () => { throw new Error("verifier unavailable"); } },
  );
  assert.equal(result.verifierFallback, true);
  assert.equal(result.abstained, false);
});

test("a failed repair is bounded to one attempt", async () => {
  let calls = 0;
  const result = await verifyAndRepairAnswer(
    "The Bill creates a ₹50 crore grant. [Source 1]",
    [evidence()],
    {
      repair: async () => {
        calls += 1;
        throw new Error("repair unavailable");
      },
    },
  );
  assert.equal(calls, 1);
  assert.equal(result.repairAttempts, 1);
  assert.equal(result.abstained, true);
});

test("the system ultimately abstains when unsupported facts remain", async () => {
  const result = await verifyAndRepairAnswer(
    "The Bill creates a ₹50 crore grant. [Source 1]",
    [evidence()],
    { repair: async (answer) => answer },
  );
  assert.equal(result.unsupportedAfterRepair, 1);
  assert.equal(result.abstained, true);
  assert.match(result.answer, /do not contain sufficient evidence/i);
});

test("researcher-added source retrieval remains account scoped", () => {
  const source = fs.readFileSync(path.join(__dirname, "../research/sourceService.js"), "utf8");
  assert.match(source, /WHERE s\.user_id = \$1 AND s\.id = ANY\(\$2::BIGINT\[\]\)/);
  assert.match(source, /authorityClass: "USER_SOURCE"/);
  assert.doesNotMatch(source, /WHERE s\.id = ANY\(\$1::BIGINT\[\]\)/);
});

test("bounded neighboring passage can support a cited factual claim", () => {
  const claims = extractClaims("The annual report must be published on the Authority website. [Source 1]");
  const [validated] = validateClaims(claims, [
    evidence({ chunkIndex: 1, content: "Section 14(2) establishes an annual reporting duty." }),
    evidence({ chunkIndex: 2, passage: 2, citationId: "Source 2", content: "The annual report must be published on the Authority website." }),
  ]);
  assert.equal(validated.state, CLAIM_STATES.SUPPORTED);
});

test("selected private-source citations resolve to the exact selected passage", () => {
  const claims = extractClaims(
    "The field study records 42 participating institutions. [User source: Field study | Passage 2]",
  );
  const [validated] = validateClaims(claims, [{
    documentId: "user-source-7",
    documentTitle: "Field study",
    chunkIndex: 1,
    passage: 2,
    content: "The field study records 42 participating institutions.",
    userSource: true,
    authorityClass: "USER_SOURCE",
  }]);
  assert.equal(validated.state, CLAIM_STATES.SUPPORTED);
});

test("structured comparison removes unsupported items and repairs an unsafe summary", () => {
  const result = verifyStructuredComparison({
    executiveSummary: "The Bill creates a ₹50 crore grant without any compliance duty.",
    similarities: [
      { point: "Both passages require annual compliance reporting.", citations: ["D1-C1"] },
      { point: "Both passages create a ₹50 crore grant.", citations: ["D1-C1"] },
    ],
  }, [{ id: "D1-C1", snippet: "The Authority must publish an annual compliance report." }]);
  assert.equal(result.generated.similarities.length, 1);
  assert.equal(result.report.removedUnsupportedItems, 1);
  assert.equal(result.report.executiveSummaryRepaired, true);
  assert.match(result.generated.executiveSummary, /unsupported generated points were removed/i);
});

test("structured comparison verifies analytical premises without demanding the inference verbatim", () => {
  const result = verifyStructuredComparison({
    executiveSummary: "The cited rule creates quarterly reporting duties. [D1-C1]",
    impactAssessment: [{
      point: "From a small-business perspective, quarterly reporting could increase administrative workload.",
      citations: ["D1-C1"],
    }],
  }, [{ id: "D1-C1", snippet: "The rule requires every regulated entity to file a quarterly report." }]);
  assert.equal(result.generated.impactAssessment.length, 1);
});
