const test = require("node:test");
const assert = require("node:assert/strict");

const {
  FAILURE_REASONS,
  RECOVERY_CLASSES,
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
  extraction_status: "ready",
  search_ready: true,
  chat_ready: true,
  capability_comparison_ready: true,
  retrieval_verified: true,
  lexical_ready: true,
  fts_index_available: true,
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
  assert.equal(item.recoveryClass, "SEMANTIC_ONLY_MISSING");
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
  assert.equal(item.recoveryClass, "RESOURCE_READY_NO_TEXT");
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
  assert.deepEqual(Object.keys(report.byRecoveryClass), RECOVERY_CLASSES);
  assert.equal(report.byRecoveryClass.SEMANTIC_ONLY_MISSING, 1);
  assert.equal(report.byRecoveryClass.RESOURCE_READY_NO_TEXT, 1);
  assert.equal(report.eta.sequentialMs, null);
  assert.equal(report.databaseBytes, 1000);
});

test("Release B audit separates theoretical recovery from current eligibility blockers", () => {
  const pending = (overrides = {}) => classifyAuditRow({
    ...readyBase,
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
    ...overrides,
  });
  const documents = [
    pending({ document_id: 20 }),
    pending({
      document_id: 21,
      processing_status: "failed",
      failure_code: "DOWNLOAD_TLS_FAILED",
      retry_eligible: true,
      source_retry_available: false,
      source_cooldown_active: true,
      source_window_exhausted: true,
    }),
    pending({ document_id: 22, active_processing_job: true }),
    pending({ document_id: 23, pdf_url: null, pdf_resource_count: 0 }),
  ];

  const report = summarize(documents, [], 1000);
  assert.equal(report.recoveryEligibility.theoreticallyProcessable, 3);
  assert.equal(report.recoveryEligibility.actuallyRecoverableNow, 1);
  assert.equal(report.recoveryEligibility.blockedBySourceFailure, 1);
  assert.equal(report.recoveryEligibility.blockedByRetryControls, 1);
  assert.equal(report.recoveryEligibility.blockedByCooldown, 1);
  assert.equal(report.recoveryEligibility.unsupportedNonPdfNonPolicyEdge, 1);
  assert.equal(report.recoveryEligibility.alreadyQueuedOrClaimed, 1);
});

test("semantic audit never promotes PostgreSQL vector metadata over reconciled readiness truth", () => {
  const item = classifyAuditRow({
    ...readyBase,
    semantic_ready: false,
    embedding_status: "ready",
    active_vector_reference_count: 3,
    active_embedding_hash_count: 3,
  });
  assert.equal(item.capabilities.semanticReady, false);
});

test("readiness audit supports compact reports without document samples", async () => {
  const service = require("../document/researchReadinessAuditService");
  assert.equal(typeof service.runResearchReadinessAudit, "function");
});

test("Release B recovery classes distinguish cheap repair from unsafe processing", () => {
  const stale = classifyAuditRow({
    ...readyBase,
    search_ready: false,
    chat_ready: false,
    capability_comparison_ready: false,
    embedding_status: "fallback",
    vector_reference_count: 0,
  });
  const missingChunks = classifyAuditRow({
    ...readyBase,
    search_ready: false,
    chat_ready: false,
    capability_comparison_ready: false,
    retrieval_verified: false,
    chunk_count: 0,
    usable_chunk_count: 0,
    claimed_chunk_count: 3,
    artifact_text_length: 5_000,
  });
  const invalidChunks = classifyAuditRow({
    ...readyBase,
    search_ready: false,
    chat_ready: false,
    capability_comparison_ready: false,
    retrieval_verified: false,
    chunk_count: 2,
    usable_chunk_count: 1,
  });
  const manual = classifyAuditRow({
    ...readyBase,
    search_ready: false,
    chat_ready: false,
    capability_comparison_ready: false,
    retrieval_verified: false,
    chunk_count: 0,
    usable_chunk_count: 0,
    processing_status: "failed",
    failure_code: "PDF_ENCRYPTED",
    failure_reason: "Password-protected PDF",
    retry_eligible: false,
  });

  assert.equal(stale.recoveryClass, "ALREADY_USABLE_BUT_FLAGS_STALE");
  assert.equal(missingChunks.recoveryClass, "CHUNKS_MISSING");
  assert.equal(invalidChunks.recoveryClass, "CHUNKS_INVALID");
  assert.equal(manual.recoveryClass, "MANUAL_REVIEW_REQUIRED");
});

test("Release B recovery priority keeps primary law ahead of reports", () => {
  const act = classifyAuditRow({ ...readyBase, document_type: "act", year: 2025 });
  const bill = classifyAuditRow({ ...readyBase, document_type: "bill", year: 2025 });
  const report = classifyAuditRow({ ...readyBase, document_type: "report", year: 2025 });
  const archive = classifyAuditRow({ ...readyBase, document_type: "report", year: 1998 });
  assert.deepEqual(
    [act.priority, bill.priority, report.priority, archive.priority],
    ["P0", "P1", "P2", "P3"],
  );
});
