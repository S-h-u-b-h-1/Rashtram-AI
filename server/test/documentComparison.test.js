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
      mode: "legal",
      language: "Hindi",
    }),
    {
      documentIds: ["11", "12"],
      mode: "legal",
      language: "Hindi",
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
    "Document not indexed yet",
  );
  assert.equal(
    readinessReason({
      id: "1",
      title: "Bill",
      pdfUrl: "https://example.test/a.pdf",
      researchReady: true,
    }),
    null,
  );
});
