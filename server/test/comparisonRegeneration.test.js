const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const {
  assertCitationDocumentScope,
  readinessReason,
  resolveRegenerationRequest,
  sameDocumentScope,
} = require("../document/documentComparisonService");

const existing = {
  id: "41",
  documentIds: ["101", "202"],
  mode: "full",
  language: "auto",
  userQuestion: "Original focus",
};

test("successful regeneration preserves scope while accepting current settings", () => {
  assert.deepEqual(resolveRegenerationRequest(existing, {
    documentIds: ["101", "202"],
    comparisonMode: "impact",
    language: "english",
    userQuestion: "Changed focus",
  }), {
    documentIds: ["101", "202"],
    mode: "impact",
    language: "english",
    userQuestion: "Changed focus",
  });
  assert.equal(sameDocumentScope(["101", "202"], [101, 202]), true);
});

test("regeneration rejects reordered, substituted and invalid document scope", () => {
  assert.throws(
    () => resolveRegenerationRequest(existing, { documentIds: ["202", "101"] }),
    /documents already saved/i,
  );
  assert.throws(
    () => resolveRegenerationRequest(existing, { documentIds: ["101", "303"] }),
    /documents already saved/i,
  );
  assert.throws(() => resolveRegenerationRequest(null, {}), /not found/i);
});

test("regenerated citations cannot escape the selected documents", () => {
  assert.equal(assertCitationDocumentScope({ citations: [
    { id: "D1-C1", documentId: "101" },
    { id: "D2-C1", documentId: "202" },
  ] }, ["101", "202"]), true);
  assert.throws(
    () => assertCitationDocumentScope({ citations: [
      { id: "D3-C1", documentId: "303" },
    ] }, ["101", "202"]),
    /out-of-scope citation/i,
  );
});

test("SEARCH_READY non-semantic, HTML and repaired PDF evidence remain comparison-capable", () => {
  const base = {
    id: "101",
    title: "Research source",
    hasAccessibleResource: true,
    researchReady: true,
    comparisonReady: true,
    processingStatus: "ready",
    extractionStatus: "ready",
    embeddingStatus: "fallback",
    chunksCount: 4,
    embeddingsCount: 0,
    semanticReady: false,
    retrievalVerified: true,
  };
  assert.equal(readinessReason({ ...base, resourceType: "html", pdfUrl: null }), null);
  assert.equal(readinessReason({
    ...base,
    resourceType: "pdf",
    pdfUrl: "https://official.example/repaired.pdf",
    metadata: { excludedUnreadablePages: [3] },
  }), null);
});

test("backend regeneration uses one canonical generator, bypasses generated-text cache and versions atomically", () => {
  const source = fs.readFileSync(
    path.join(__dirname, "../document/documentComparisonService.js"),
    "utf8",
  );
  assert.match(source, /createComparison\(userId, request, \{/);
  assert.match(source, /forceGeneration: true/);
  assert.match(source, /!forceGeneration && analysisKey/);
  assert.match(source, /document_comparison_versions/);
  assert.match(source, /FOR UPDATE/);
  assert.match(source, /regeneration_status = 'processing'/);
});

test("known regeneration failures preserve the current row and expose bounded stages", () => {
  const source = fs.readFileSync(
    path.join(__dirname, "../document/documentComparisonService.js"),
    "utf8",
  );
  assert.match(source, /releaseFailedRegeneration/);
  assert.match(source, /previous comparison has been preserved/);
  assert.match(source, /generationMode !== "evidence_abstention"/);
});
