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
  mapRelationshipSafely,
  mapDocumentResourceSafely,
  mapDocumentSourceSafely,
  mapDocument,
} = require("../document/DocumentRepository");
const { PDFProcessor } = require("../lib/pdfProcessor");
const {
  sanitizeProviderError,
} = require("../lib/providerErrorSanitizer");
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

  const providerBilling = classifyProcessingFailure({
    message: "429 Your account is not active, please check billing details.",
    response: { status: 429 },
  });
  assert.equal(providerBilling.retriable, true);
  assert.equal(providerBilling.readinessClass, "processing_failed_retriable");
  assert.equal(
    providerBilling.failureReason,
    "AI generation provider unavailable.",
  );
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

test("verified PolicyEdge HTML readiness is never overwritten by missing PDF", () => {
  const mapped = mapDocument({
    id: 1250,
    title: "PolicyEdge HTML research record",
    document_type: "report",
    canonical_source: "policy-edge",
    canonical_url: "https://www.policyedge.in/p/research-record",
    pdf_url: null,
    research_ready: true,
    comparison_ready: true,
    readiness_class: "comparison_ready",
    capability_state: {
      catalogued: true,
      resourceReady: true,
      textReady: true,
      searchReady: true,
      semanticReady: false,
      chatReady: true,
      comparisonReady: true,
    },
  });

  assert.equal(mapped.pdfUrl, null);
  assert.equal(mapped.readiness, "research_ready");
  assert.equal(mapped.researchReady, true);
  assert.equal(mapped.chatReady, true);
  assert.equal(mapped.searchReady, true);
  assert.equal(mapped.semanticReady, false);
  assert.equal(mapped.comparisonReady, true);
});

test("semantic failure does not remove verified lexical research readiness", () => {
  const mapped = mapDocument({
    id: 1251,
    title: "Lexical fallback record",
    document_type: "act",
    canonical_url: "https://example.gov.in/act",
    pdf_url: "https://example.gov.in/act.pdf",
    research_ready: true,
    comparison_ready: true,
    embedding_status: "failed",
    capability_state: {
      resourceReady: true,
      textReady: true,
      searchReady: true,
      semanticReady: false,
      chatReady: true,
      comparisonReady: true,
    },
  });
  assert.equal(mapped.readiness, "research_ready");
  assert.equal(mapped.researchReady, true);
  assert.equal(mapped.semanticReady, false);
});

test("document mapping exposes permanent download failures for source-only UI", () => {
  const mapped = mapDocument({
    id: 2,
    title: "HTML landing page masquerading as PDF",
    document_type: "bill",
    canonical_url: "https://example.test/source",
    pdf_url: "https://example.test/not-a-pdf.pdf",
    processing_status: "failed",
    extraction_status: "failed",
    failure_code: "DOWNLOAD_HTML_RESPONSE",
    retry_eligible: false,
    pipeline_stage: "download",
    failure_reason: "Downloaded response is HTML, not a PDF.",
    readiness_class: "processing_failed_permanent",
    readiness_reason: "Downloaded response is HTML, not a PDF.",
  });

  assert.equal(mapped.researchReady, false);
  assert.equal(mapped.comparisonReady, false);
  assert.equal(mapped.failureCode, "DOWNLOAD_HTML_RESPONSE");
  assert.equal(mapped.retryEligible, false);
  assert.equal(mapped.pipelineStage, "download");
  assert.equal(mapped.readinessClass, "processing_failed_permanent");
});

test("document mapping tolerates malformed JSON and optional child rows", () => {
  const mapped = mapDocument({
    id: 10,
    title: "Malformed metadata record",
    document_type: "gazette",
    source_metadata: "{not json",
    metadata_json: null,
    failure_details_json: "[]",
    publication_date: "not-a-date",
  });
  assert.deepEqual(mapped.metadata, {});
  assert.deepEqual(mapped.failureDetails, {});
  assert.equal(mapped.publicationDate, null);
  assert.equal(mapped.title, "Malformed metadata record");

  assert.deepEqual(
    mapDocumentResourceSafely({
      id: 7,
      label: null,
      resource_type: null,
      url: " https://example.test/file.pdf ",
      metadata_json: "{bad",
      is_accessible: true,
    }),
    {
      id: "7",
      label: "Document resource",
      resourceType: "link",
      category: null,
      url: "https://example.test/file.pdf",
      mimeType: null,
      fileExtension: null,
      fileSize: null,
      language: null,
      isPrimary: false,
      isAccessible: true,
      lastCheckedAt: null,
      metadata: {},
    },
  );

  const source = mapDocumentSourceSafely({
    id: 8,
    source_name: "egazette",
    source_priority: "x",
    raw_metadata_json: "{\"ok\":true}",
  });
  assert.equal(source.id, "8");
  assert.equal(source.sourceName, "egazette");
  assert.equal(source.sourcePriority, 100);
  assert.deepEqual(source.metadata, { ok: true });

  const relationship = mapRelationshipSafely({
    id: 9,
    relationshipType: null,
    document: {
      id: 11,
      title: null,
      publicationDate: "not-a-date",
    },
  });
  assert.equal(relationship.relationshipType, "related");
  assert.equal(relationship.document.id, "11");
  assert.equal(relationship.document.title, "Related document");
  assert.equal(relationship.document.publicationDate, null);
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
  assert.match(summary, /AI generation provider unavailable/);
  assert.doesNotMatch(summary, /429 billing inactive/);
  assert.ok(sections.executive_summary);
  assert.ok(sections.key_source_excerpts);
  assert.ok(sections.suggested_questions);
});

test("provider fallback metadata never exposes raw credentials", () => {
  const sanitized = sanitizeProviderError(
    "401 Incorrect API key provided: credential-value-redacted",
  );
  assert.equal(sanitized, "AI generation provider unavailable.");
  assert.doesNotMatch(sanitized, /AQ\.|key|401/i);
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
  assert.match(workerSource, /isTransientDatabaseError/);
  assert.match(workerSource, /transient claim failure/);
});
