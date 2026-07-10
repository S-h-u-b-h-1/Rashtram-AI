const assert = require("node:assert/strict");
const test = require("node:test");
const fs = require("node:fs");
const path = require("node:path");
const {
  classifyProcessingFailure,
  normalizeBatchType,
} = require("../document/readinessService");
const {
  buildFilters,
  mapDocument,
} = require("../document/DocumentRepository");
const { PDFProcessor } = require("../lib/pdfProcessor");
const {
  buildExtractiveSummary,
  parseSummarySections,
} = require("../document/documentResearchService");

test("PDF failures are classified by permanent and retriable cause", () => {
  const missing = classifyProcessingFailure({
    message: "PDF download returned 404 not found",
    response: { status: 404 },
  });
  assert.equal(missing.failureStage, "pdf");
  assert.equal(missing.permanent, true);
  assert.equal(missing.readinessClass, "processing_failed_permanent");

  const forbidden = classifyProcessingFailure({
    message: "Request failed with status code 403",
    response: { status: 403 },
  });
  assert.equal(forbidden.failureStage, "pdf");
  assert.equal(forbidden.permanent, true);
  assert.equal(forbidden.readinessClass, "processing_failed_permanent");

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
    types: ["bill"],
    stateOnly: true,
  });
  assert.deepEqual(normalizeBatchType("act"), {
    type: "act",
    types: ["act"],
    stateOnly: false,
  });
  assert.deepEqual(normalizeBatchType("gazette"), {
    type: "gazette",
    types: [
      "gazette",
      "notification",
      "rule",
      "regulation",
      "order",
      "circular",
      "ordinance",
    ],
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

test("PDF quality and legal chunk metadata remain explicit", () => {
  const processor = new PDFProcessor();
  const quality = processor.classifyPdfQuality({
    buffer: Buffer.alloc(50_000),
    nativeText: "A".repeat(2_000),
    numPages: 2,
    ocrUsed: false,
    language: { isBilingual: false },
  });
  assert.equal(quality.qualityClass, "native_text");
  assert.equal(quality.charactersPerPage, 1_000);

  const text = [
    "Section 4. Definitions",
    "In this Act, authority means the competent authority.",
    "4.1 The authority shall publish the prescribed form.",
  ].join("\n");
  const metadata = processor.structuralChunkMetadata(
    text,
    text,
    0,
    3,
  );
  assert.equal(metadata.structuralType, "section");
  assert.equal(metadata.sectionId, "4.");
  assert.equal(metadata.pageStart, 1);
  assert.ok(metadata.pageEnd >= metadata.pageStart);
});

test("cached research summaries preserve structured sections", () => {
  assert.deepEqual(
    parseSummarySections(
      "## Executive Summary\nGrounded overview.\n## Key Provisions\n- Duty",
    ),
    {
      executive_summary: "Grounded overview.",
      key_provisions: "- Duty",
    },
  );
});

test("extractive fallback summary preserves processing readiness when AI is unavailable", () => {
  const summary = buildExtractiveSummary(
    "bill",
    [
      "This Bill establishes a statutory authority for implementation and monitoring of the scheme across affected districts.",
      "The authority shall publish rules, maintain records, and submit annual compliance reports to the State Government.",
      "Penalties apply where regulated entities fail to provide information required under the prescribed process.",
    ].join("\n\n"),
    {
      sourceLanguage: "en",
      generationError: new Error("429 billing inactive"),
    },
  );
  const sections = parseSummarySections(summary);
  assert.match(summary, /extractive fallback/);
  assert.match(summary, /429 billing inactive/);
  assert.ok(sections.executive_summary);
  assert.ok(sections.key_source_excerpts);
  assert.ok(sections.suggested_questions);
});

test("typed processing batches only claim jobs selected for that batch", () => {
  const workerSource = fs.readFileSync(
    path.join(__dirname, "..", "document", "processingWorkerService.js"),
    "utf8",
  );
  assert.match(workerSource, /allowedDocumentIds/);
  assert.match(workerSource, /document\.document_type = ANY\(\$1::TEXT\[\]\)/);
  assert.match(workerSource, /queued\.document_id = ANY\(\$3::BIGINT\[\]\)/);
  assert.match(workerSource, /document_id = ANY\(\$1::BIGINT\[\]\)/);
  assert.match(workerSource, /enqueued\.jobs\.map/);
});
