const test = require("node:test");
const assert = require("node:assert/strict");

const {
  ANSWER_INTENTS,
  CLAIM_CLASSES,
  FRESHNESS_CLASSES,
  buildAdaptivePromptLayers,
  classifyAnswerIntent,
  classifyFreshness,
  classifyMaterialClaim,
  detectAnswerStyle,
  enforceFreshnessGuard,
  generationProfileFor,
  requiresCurrentVerification,
} = require("../retrieval/adaptiveIntelligenceService");
const {
  CLAIM_STATES,
  CLAIM_TYPES,
  extractClaims,
  validateClaims,
  verifyAndRepairAnswer,
} = require("../retrieval/evidenceSafetyService");
const {
  assessCurrentVerification,
  loadDocumentSourceFreshness,
  parseTemporalIntent,
} = require("../document/temporalLegalService");
const { classifyQuery, QUERY_TYPES } = require("../retrieval/queryPlanner");

const source = (overrides = {}) => ({
  passage: 1,
  citationId: "Source 1",
  documentId: "7",
  chunkIndex: 2,
  content: "Section 8 requires regulated entities to submit a quarterly report.",
  authorityClass: "PRIMARY_OFFICIAL",
  sourceUrl: "https://official.example/rule.pdf",
  ...overrides,
});

test("answer intent classifier covers factual, analytical, perspective, hypothetical, current and drafting work", () => {
  assert.equal(classifyAnswerIntent("What does section 8 say?"), ANSWER_INTENTS.SOURCE_FACT);
  assert.equal(classifyAnswerIntent("Explain why this matters"), ANSWER_INTENTS.EXPLANATION);
  assert.equal(classifyAnswerIntent("Analyse the implementation risks"), ANSWER_INTENTS.IMPLICATION);
  assert.equal(classifyAnswerIntent("Give the strongest criticism"), ANSWER_INTENTS.CRITIQUE);
  assert.equal(classifyAnswerIntent("Explain from a startup perspective"), ANSWER_INTENTS.PERSPECTIVE);
  assert.equal(classifyAnswerIntent("If costs doubled, what might happen?"), ANSWER_INTENTS.HYPOTHETICAL);
  assert.equal(classifyAnswerIntent("Is this Bill still pending?"), ANSWER_INTENTS.CURRENT_STATUS);
  assert.equal(classifyAnswerIntent("Compare these rules", { documentCount: 2 }), ANSWER_INTENTS.COMPARISON);
  assert.equal(classifyAnswerIntent("Draft a policy", { task: "policy_draft" }), ANSWER_INTENTS.POLICY_DRAFT);
});

test("freshness decisions never treat current status as model-memory general knowledge", () => {
  assert.equal(classifyFreshness("What is an ordinance?", ANSWER_INTENTS.GENERAL_CONTEXT), FRESHNESS_CLASSES.STATIC);
  assert.equal(classifyFreshness("What does section 8 say?", ANSWER_INTENTS.SOURCE_FACT), FRESHNESS_CLASSES.DOCUMENT_BOUND);
  assert.equal(classifyFreshness("What is the current regulator?", ANSWER_INTENTS.CURRENT_STATUS), FRESHNESS_CLASSES.CURRENT_STATUS);
  assert.equal(requiresCurrentVerification(FRESHNESS_CLASSES.CURRENT_STATUS), true);
  assert.equal(classifyQuery("Is this Bill still pending?"), QUERY_TYPES.TIMELINE);
  assert.equal(parseTemporalIntent("Is this Bill still pending?").asksCurrentStatus, true);
});

test("layered prompt makes document truth authoritative while allowing reasoning", () => {
  const prompt = buildAdaptivePromptLayers({
    task: "document_chat",
    question: "Explain from a business perspective",
    intent: ANSWER_INTENTS.PERSPECTIVE,
    freshnessClass: FRESHNESS_CLASSES.DOCUMENT_BOUND,
    conversationHistory: "Assistant: An earlier political framing",
  });
  assert.match(prompt, /passages are authoritative/i);
  assert.match(prompt, /may reason beyond quotation/i);
  assert.match(prompt, /Conversation history helps resolve references and style; it is not factual evidence/i);
  assert.match(prompt, /newest analytical direction/i);
  assert.match(prompt, /PERSPECTIVE/);
});

test("current-status prompt explicitly abstains when verification is unavailable", () => {
  const prompt = buildAdaptivePromptLayers({
    question: "Is this circular still operative?",
    intent: ANSWER_INTENTS.CURRENT_STATUS,
    freshnessClass: FRESHNESS_CLASSES.CURRENT_STATUS,
    currentVerification: { status: "UNVERIFIED", connectorStatus: "stale" },
  });
  assert.match(prompt, /Do not guess or use model memory/i);
  assert.match(prompt, /later amendment, repeal, superseding instrument/i);
  assert.match(prompt, /connector status: stale/i);
});

test("freshness guard never lets an unqualified current-status answer escape", () => {
  const guarded = enforceFreshnessGuard("The selected 2022 notification states X. [Source 1]", {
    required: true,
    status: "UNVERIFIED",
  });
  assert.match(guarded, /could not verify/i);
  assert.match(guarded, /later amendment, repeal, or superseding instrument/i);
  assert.equal(enforceFreshnessGuard("Verified answer", {
    required: true, status: "VERIFIED_CURRENT",
  }), "Verified answer");
  const contradictory = enforceFreshnessGuard(
    "The Bill is currently at the introduction stage. Its passed status is unverified.",
    { required: true, status: "PARTIALLY_VERIFIED" },
  );
  assert.doesNotMatch(contradictory, /is currently at/i);
  assert.match(contradictory, /is described in the selected document as at the introduction stage/i);
});

test("task profiles keep extraction conservative and synthesis moderately flexible", () => {
  const factual = generationProfileFor({ intent: ANSWER_INTENTS.SOURCE_FACT });
  const analytical = generationProfileFor({ intent: ANSWER_INTENTS.PERSPECTIVE });
  const comparison = generationProfileFor({ task: "comparison", intent: ANSWER_INTENTS.COMPARISON });
  assert.ok(factual.temperature < analytical.temperature);
  assert.ok(comparison.maxOutputTokens > factual.maxOutputTokens);
  assert.ok(analytical.temperature < 0.5);
});

test("claim classes distinguish source, current external, inference, perspective and hypothetical", () => {
  assert.equal(classifyMaterialClaim("Section 8 requires reporting."), CLAIM_CLASSES.SOURCE_FACT);
  assert.equal(classifyMaterialClaim("The rule is currently in force."), CLAIM_CLASSES.EXTERNAL_FACT);
  assert.equal(classifyMaterialClaim("This could increase workload."), CLAIM_CLASSES.INFERENCE);
  assert.equal(classifyMaterialClaim("From a small-business perspective, this is burdensome."), CLAIM_CLASSES.PERSPECTIVE);
  assert.equal(classifyMaterialClaim("If costs doubled, firms might consolidate."), CLAIM_CLASSES.HYPOTHETICAL);
});

test("analytical statements are retained while their factual premise remains citation verified", async () => {
  const answer = [
    "Section 8 requires regulated entities to submit a quarterly report. [Source 1]",
    "From a small-business perspective, one concern could be additional administrative workload.",
  ].join("\n");
  const result = await verifyAndRepairAnswer(answer, [source()]);
  assert.equal(result.abstained, false);
  assert.equal(result.supportedFacts, 1);
  assert.equal(result.analyticalTrace.length, 1);
  assert.deepEqual(result.analyticalTrace[0].supportingCitations, ["Source 1"]);
});

test("invented legal facts still fail even when analysis is enabled", () => {
  const claims = extractClaims("Section 8 creates a ₹50 crore subsidy. [Source 1]");
  const [validated] = validateClaims(claims, [source()]);
  assert.equal(validated.type, CLAIM_TYPES.SOURCE_FACT);
  assert.equal(validated.state, CLAIM_STATES.UNSUPPORTED);
});

test("stable general context is permitted only when explicitly enabled", () => {
  const claims = extractClaims("An ordinance is a temporary legal instrument.");
  assert.equal(claims[0].type, CLAIM_TYPES.EXTERNAL_FACT);
  assert.equal(validateClaims(claims, [source()])[0].state, CLAIM_STATES.UNSUPPORTED);
  const [allowed] = validateClaims(claims, [source()], {
    allowStableGeneralKnowledge: true,
  });
  assert.equal(allowed.state, CLAIM_STATES.SUPPORTED);
  assert.equal(allowed.verificationScope, "stable_general_knowledge");
});

test("old and later instruments are only called current with fresh connector and later evidence", () => {
  const old = source({ retrievalMode: "temporal", relationshipType: null });
  const later = source({
    passage: 2,
    documentId: "9",
    retrievalMode: "temporal_fts",
    temporalRole: "later_version",
    relationshipType: "SUPERSEDED_BY",
    content: "The 2025 notification supersedes the 2023 notification.",
    sourceUrl: "https://egazette.gov.in/notification-2025.pdf",
    authorityClass: "PRIMARY_OFFICIAL",
  });
  assert.equal(assessCurrentVerification({
    document: { publicationDate: "2023-01-01" },
    passages: [old],
    freshness: { status: "fresh", checkedThrough: "2026-08-20T00:00:00.000Z" },
  }).status, "PARTIALLY_VERIFIED");
  assert.equal(assessCurrentVerification({
    document: { publicationDate: "2023-01-01" },
    passages: [old, later],
    freshness: { status: "fresh", checkedThrough: "2026-08-20T00:00:00.000Z" },
  }).status, "VERIFIED_CURRENT");
});

test("stale or failed connector state is never reported as current verification", () => {
  const result = assessCurrentVerification({
    passages: [{ retrievalMode: "temporal_fts", temporalRole: "later_version" }],
    freshness: { status: "degraded" },
  });
  assert.notEqual(result.status, "VERIFIED_CURRENT");
  assert.match(result.connectorWarning, /could not be fully verified/i);
});

test("source freshness failures degrade safely without leaking the database error", async () => {
  const result = await loadDocumentSourceFreshness(
    { source: "india-code" },
    async () => { throw new Error("database secret detail"); },
  );
  assert.equal(result.status, "error");
  assert.doesNotMatch(JSON.stringify(result), /database secret detail/);
});

test("format requests are recognized without becoming new factual research", () => {
  assert.equal(detectAnswerStyle("Give a short answer"), "concise");
  assert.equal(detectAnswerStyle("Explain simply to a university student"), "plain_language");
  assert.equal(detectAnswerStyle("Present this in a table"), "table");
  assert.equal(detectAnswerStyle("Write a UPSC-style answer"), "upsc");
});
