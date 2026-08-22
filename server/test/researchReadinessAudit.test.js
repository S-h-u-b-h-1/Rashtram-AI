const test = require("node:test");
const assert = require("node:assert/strict");

const {
  FAILURE_REASONS,
  classifyAuditRow,
  summarize,
} = require("../document/researchReadinessAuditService");

const readyBase = {
  document_id: 1,
  title: "Verified document",
  document_type: "act",
  source: "india-code",
  authority_class: "PRIMARY_OFFICIAL",
  catalogued: true,
  resource_ready: true,
  text_ready: true,
  search_ready: true,
  chat_ready: true,
  capability_comparison_ready: true,
  retrieval_verified: true,
  lexical_ready: true,
  chunk_count: 3,
  usable_chunk_count: 3,
  pdf_url: "https://example.gov.in/act.pdf",
  accessible_resource_count: 1,
  pdf_resource_count: 1,
};

test("fixture: search-ready without vectors remains chat and comparison ready", () => {
  const item = classifyAuditRow({
    ...readyBase,
    semantic_ready: false,
    embedding_status: "fallback",
    vector_reference_count: 0,
  });
  assert.equal(item.capabilities.searchReady, true);
  assert.equal(item.capabilities.semanticReady, false);
  assert.equal(item.capabilities.chatReady, true);
  assert.equal(item.capabilities.comparisonReady, true);
  assert.equal(item.failureClass, null);
});

test("fixture: PolicyEdge HTML can be research-ready without a PDF", () => {
  const item = classifyAuditRow({
    ...readyBase,
    document_id: 2,
    source: "policy-edge",
    document_type: "report",
    pdf_url: null,
    pdf_resource_count: 0,
    html_resource_count: 1,
    extraction_method: "source_html",
  });
  assert.equal(item.resourceType, "HTML");
  assert.equal(item.capabilities.searchReady, true);
  assert.equal(item.capabilities.chatReady, true);
});

test("fixture: accessible native PDF without text enters native extraction", () => {
  const item = classifyAuditRow({
    ...readyBase,
    document_id: 3,
    text_ready: false,
    search_ready: false,
    chat_ready: false,
    capability_comparison_ready: false,
    retrieval_verified: false,
    lexical_ready: false,
    chunk_count: 0,
    usable_chunk_count: 0,
    processing_status: "not_started",
    extraction_status: "not_started",
  });
  assert.equal(item.failureClass, FAILURE_REASONS.NO_VALID_CHUNKS);
  assert.equal(item.recoveryGroup, "B_NATIVE_EXTRACTION");
});

test("fixture: scanned PDF enters selective OCR and retries stay bounded", () => {
  const item = classifyAuditRow({
    ...readyBase,
    document_id: 4,
    text_ready: false,
    search_ready: false,
    chat_ready: false,
    capability_comparison_ready: false,
    retrieval_verified: false,
    lexical_ready: false,
    chunk_count: 0,
    usable_chunk_count: 0,
    ocr_status: "pending",
    failure_code: "PDF_SCANNED_OCR_REQUIRED",
    retry_eligible: true,
    retry_count: 2,
  });
  assert.equal(item.failureClass, FAILURE_REASONS.PDF_OCR_REQUIRED);
  assert.equal(item.recoveryGroup, "C_SELECTIVE_OCR");
  assert.equal(item.failureCount, 2);
});

test("fixture: partial PDF excludes failed pages but keeps valid evidence readiness", () => {
  const item = classifyAuditRow({
    ...readyBase,
    document_id: 5,
    failed_page_count: 2,
    chunk_count: 5,
    usable_chunk_count: 5,
  });
  assert.equal(item.capabilities.searchReady, true);
  assert.equal(item.failedPageCount, 2);
  assert.equal(item.failureClass, null);
});

test("fixture: access-denied and dynamic HTML enter explainable non-looping classes", () => {
  const denied = classifyAuditRow({
    document_id: 6,
    title: "Restricted source",
    source: "ministry",
    source_url: "https://example.gov.in/restricted",
    failure_code: "DOWNLOAD_ACCESS_DENIED",
    retry_eligible: false,
  });
  const dynamic = classifyAuditRow({
    document_id: 7,
    title: "Dynamic shell",
    source: "policy-edge",
    canonical_url: "https://www.policyedge.in/p/shell",
    failure_code: "HTML_DYNAMIC_CONTENT_UNAVAILABLE",
    retry_eligible: true,
  });
  assert.equal(denied.failureClass, FAILURE_REASONS.RESOURCE_ACCESS_DENIED);
  assert.equal(denied.recoveryGroup, "F_MANUAL_RESTRICTED");
  assert.equal(dynamic.failureClass, FAILURE_REASONS.HTML_DYNAMIC_CONTENT);
  assert.equal(dynamic.recoveryGroup, "D_HTML_PREPARATION");
});

test("audit summary refuses to invent ETA without measured group timing", () => {
  const documents = [
    classifyAuditRow({ ...readyBase, document_id: 8 }),
    classifyAuditRow({
      ...readyBase,
      document_id: 9,
      text_ready: false,
      search_ready: false,
      chat_ready: false,
      capability_comparison_ready: false,
      retrieval_verified: false,
      lexical_ready: false,
      chunk_count: 0,
      usable_chunk_count: 0,
    }),
  ];
  const report = summarize(documents, [], 1000);
  assert.equal(report.funnel.searchReady, 1);
  assert.equal(report.notSearchReady, 1);
  assert.equal(report.eta.sequentialMs, null);
  assert.equal(report.databaseBytes, 1000);
});
