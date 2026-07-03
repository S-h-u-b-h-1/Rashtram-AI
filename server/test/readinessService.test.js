const assert = require("node:assert/strict");
const test = require("node:test");
const {
  classifyProcessingFailure,
  normalizeBatchType,
} = require("../document/readinessService");
const {
  buildFilters,
  mapDocument,
} = require("../document/DocumentRepository");
const { PDFProcessor } = require("../lib/pdfProcessor");

test("PDF failures are classified by permanent and retriable cause", () => {
  const missing = classifyProcessingFailure({
    message: "PDF download returned 404 not found",
    response: { status: 404 },
  });
  assert.equal(missing.failureStage, "pdf");
  assert.equal(missing.permanent, true);
  assert.equal(missing.readinessClass, "processing_failed_permanent");

  const timeout = classifyProcessingFailure({
    message: "Pinecone embedding request timed out",
    code: "ETIMEDOUT",
  });
  assert.equal(timeout.failureStage, "embedding");
  assert.equal(timeout.retriable, true);
  assert.equal(timeout.readinessClass, "processing_failed_retriable");
});

test("batch processing recognizes state document aliases", () => {
  assert.deepEqual(normalizeBatchType("state_bill"), {
    type: "bill",
    stateOnly: true,
  });
  assert.deepEqual(normalizeBatchType("act"), {
    type: "act",
    stateOnly: false,
  });
});

test("readiness filters remain server-side and parameterized", () => {
  const ready = buildFilters({
    researchReady: "true",
    comparisonReady: "true",
  });
  assert.match(ready.where, /readiness_document\.research_ready/);
  assert.match(ready.where, /readiness_document\.comparison_ready/);
});

test("document mapping never infers comparison readiness", () => {
  const mapped = mapDocument({
    id: 1,
    title: "Test Act",
    document_type: "act",
    canonical_url: "https://example.test/act",
    pdf_url: "https://example.test/act.pdf",
    research_ready: true,
    comparison_ready: false,
    readiness_class: "research_ready",
    readiness_reason: "Retrieval verification is pending.",
  });
  assert.equal(mapped.researchReady, true);
  assert.equal(mapped.comparisonReady, false);
  assert.equal(mapped.readinessReason, "Retrieval verification is pending.");
});

test("PDF processing rejects unsupported and private URLs before download", async () => {
  const processor = new PDFProcessor();
  await assert.rejects(
    processor.downloadPDF("file:///tmp/document.pdf"),
    /unsupported protocol/,
  );
  await assert.rejects(
    processor.downloadPDF("http://127.0.0.1/document.pdf"),
    /Private network/,
  );
});
