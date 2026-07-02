const test = require("node:test");
const assert = require("node:assert/strict");

const {
  normalizeRequest,
  readinessReason,
} = require("../document/documentComparisonService");

test("comparison accepts two to five unique documents", () => {
  assert.deepEqual(
    normalizeRequest({
      documentIds: ["11", "12"],
      comparisonMode: "clause",
      language: "hindi",
      userQuestion: "How do the duties differ?",
    }),
    {
      documentIds: ["11", "12"],
      mode: "clause",
      language: "hindi",
      userQuestion: "How do the duties differ?",
    },
  );
  assert.equal(
    normalizeRequest({ documentIds: ["1", "2", "3", "4", "5"] })
      .documentIds.length,
    5,
  );
});

test("comparison rejects invalid counts, duplicates, modes and languages", () => {
  assert.throws(
    () => normalizeRequest({ documentIds: ["1"] }),
    /between two and five/i,
  );
  assert.throws(
    () => normalizeRequest({ documentIds: ["1", "1"] }),
    /duplicate/i,
  );
  assert.throws(
    () =>
      normalizeRequest({
        documentIds: ["1", "2"],
        mode: "invented",
      }),
    /unsupported comparison mode/i,
  );
  assert.throws(
    () =>
      normalizeRequest({
        documentIds: ["1", "2"],
        language: "French",
      }),
    /unsupported comparison language/i,
  );
});

test("comparison readiness exposes specific disabled reasons", () => {
  assert.equal(readinessReason(null), "Document not found");
  assert.equal(
    readinessReason({ processingStatus: "failed" }),
    "Processing failed",
  );
  assert.equal(
    readinessReason({ processingStatus: null, pdfUrl: null }),
    "PDF unavailable",
  );
  assert.equal(
    readinessReason({
      id: "1",
      title: "Bill",
      pdfUrl: "https://example.test/a.pdf",
      researchReady: false,
    }),
    "Research workspace unavailable",
  );
  assert.equal(
    readinessReason({
      id: "1",
      title: "Bill",
      pdfUrl: "https://example.test/a.pdf",
      researchReady: true,
      extractionStatus: "ready",
      embeddingStatus: "ready",
      chunksCount: 3,
    }),
    null,
  );
});

test("comparison accepts the public API contract and legacy aliases", () => {
  assert.deepEqual(
    normalizeRequest({
      documentIds: [1, 2],
      comparisonMode: "compliance",
      language: "auto",
    }),
    {
      documentIds: ["1", "2"],
      mode: "compliance",
      language: "auto",
      userQuestion: "",
    },
  );
  assert.equal(
    normalizeRequest({
      documentIds: [1, 2],
      mode: "comprehensive",
      language: "English",
    }).mode,
    "full",
  );
});

test("comparison readiness distinguishes pending and unusable text", () => {
  assert.equal(
    readinessReason({
      id: "1",
      title: "Policy",
      pdfUrl: "https://example.test/policy.pdf",
      extractionStatus: "pending",
    }),
    "Text extraction pending",
  );
  assert.equal(
    readinessReason({
      id: "1",
      title: "Policy",
      pdfUrl: "https://example.test/policy.pdf",
      extractionStatus: "ready",
      chunksCount: 0,
    }),
    "No extractable text found",
  );
});
