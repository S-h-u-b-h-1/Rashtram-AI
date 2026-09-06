const test = require("node:test");
const assert = require("node:assert/strict");

const {
  fileCostRank,
  latestDocumentResults,
  recoveryCandidates,
  runCorpusRecoveryWave,
  validateRecoveredDocuments,
} = require("../document/corpusRecoveryService");
const { pdfResourceCandidates } = require("../document/documentResearchService");

const document = (id, recoveryClass, priority = "P1", searchReady = false) => ({
  documentId: String(id), recoveryClass, priority, year: 2026,
  capabilities: { searchReady },
});

test("recovery selection excludes unsafe work and follows cheapest safe recovery order", () => {
  const candidates = recoveryCandidates([
    document(1, "SEMANTIC_ONLY_MISSING", "P0", true),
    document(2, "MANUAL_REVIEW_REQUIRED", "P0"),
    document(3, "RESOURCE_READY_NO_TEXT", "P1"),
    document(4, "RETRYABLE_PROCESSING_FAILURE", "P0"),
    document(5, "READINESS_FLAG_MISMATCH", "P0"),
  ]);
  assert.deepEqual(candidates.map((item) => item.documentId), ["5", "3", "4"]);
});

test("recovery selection excludes resources the worker cannot process", () => {
  const eligible = { ...document(1, "RESOURCE_READY_NO_TEXT", "P1"), processingEligible: true };
  const htmlOnly = { ...document(2, "RESOURCE_READY_NO_TEXT", "P1"), processingEligible: false };
  assert.deepEqual(recoveryCandidates([htmlOnly, eligible]).map((item) => item.documentId), ["1"]);
});

test("recovery selection prefers smaller files within the same legal priority tier", () => {
  const large = { ...document(1, "RESOURCE_READY_NO_TEXT", "P1"), fileSizeBytes: 26_000_000 };
  const small = { ...document(2, "RESOURCE_READY_NO_TEXT", "P1"), fileSizeBytes: 500_000 };
  assert.deepEqual(recoveryCandidates([large, small]).map((item) => item.documentId), ["2", "1"]);
  assert.ok(fileCostRank(small.fileSizeBytes) < fileCostRank(large.fileSizeBytes));
});

test("final validation mode selects at most one document per source and disables retries", async () => {
  const candidates = [
    { ...document(1, "RESOURCE_READY_NO_TEXT", "P0"), sourceHost: "one.test" },
    { ...document(2, "RESOURCE_READY_NO_TEXT", "P0"), sourceHost: "one.test" },
    { ...document(3, "RESOURCE_READY_NO_TEXT", "P0"), sourceHost: "two.test" },
  ];
  const before = {
    totalPublicCatalogue: 3,
    funnel: { searchReady: 0 },
    notSearchReady: 3,
    retryable: 3,
    manualReview: 0,
    byRecoveryClass: { RESOURCE_READY_NO_TEXT: 3 },
    documents: candidates,
  };
  const after = { ...before, funnel: { searchReady: 2 }, documents: undefined };
  let audits = 0;
  let processingOptions;
  await runCorpusRecoveryWave({
    requested: 3,
    oneDocumentPerSource: true,
    auditFn: async () => (audits++ === 0 ? before : after),
    snapshotFn: async () => ({ databaseBytes: 100, objectCount: 0, objectBytes: 0, chunkCount: 0 }),
    capacityFn: async () => ({ bulkProcessingAllowed: true, safeBatchSize: 25 }),
    cancelQueuedFn: async () => 0,
    processBatchFn: async (options) => {
      processingOptions = options;
      return {
        enqueued: 2,
        selection: options.allowedDocumentIds.map((documentId) => ({ jobId: documentId, documentId })),
        results: options.allowedDocumentIds.map((documentId) => ({
          documentId: String(documentId), status: "ready", chunks: 1,
        })),
      };
    },
    validateFn: async (ids) => ids.map((documentId) => ({ documentId, valid: true })),
  });

  assert.equal(processingOptions.maxAttempts, 1);
  assert.deepEqual(processingOptions.allowedDocumentIds, [1, 3]);
});

test("corpus wave stops before expansion when a recovered document fails validation", async () => {
  const before = {
    totalPublicCatalogue: 2,
    funnel: { searchReady: 0 }, notSearchReady: 2, retryable: 2,
    manualReview: 0, byRecoveryClass: { RESOURCE_READY_NO_TEXT: 2 },
    documents: [document(1, "RESOURCE_READY_NO_TEXT", "P0"), document(2, "RESOURCE_READY_NO_TEXT", "P0")],
  };
  const after = { ...before, funnel: { searchReady: 1 }, documents: undefined };
  let audits = 0;
  let processingOptions = null;
  const report = await runCorpusRecoveryWave({
    requested: 2,
    concurrency: 3,
    auditFn: async () => (audits++ === 0 ? before : after),
    snapshotFn: async () => ({ databaseBytes: 100, objectCount: 0, objectBytes: 0, chunkCount: 0 }),
    capacityFn: async () => ({ bulkProcessingAllowed: true, safeBatchSize: 25 }),
    cancelQueuedFn: async () => 0,
    processBatchFn: async (options) => {
      processingOptions = options;
      return { enqueued: 2, results: [
        { documentId: "1", status: "ready", chunks: 1 },
        { documentId: "2", status: "ready", chunks: 1 },
      ] };
    },
    validateFn: async () => [{ documentId: "1", valid: false }, { documentId: "2", valid: true }],
  });
  assert.equal(report.gatePassed, false);
  assert.equal(report.stopReason, "recovered_document_failed_integrity_or_retrieval_probe");
  assert.equal(processingOptions.skipSemantic, true);
  assert.equal(processingOptions.skipSummary, true);
  assert.equal(processingOptions.concurrency, 3);
});

test("corpus recovery can use an accessible PDF resource when the legacy PDF field is empty", () => {
  assert.deepEqual(pdfResourceCandidates({ pdfUrl: null }, [
    { resourceType: "html", url: "https://example.test/page", isAccessible: true },
    { resourceType: "pdf", url: "https://example.test/document.pdf", isAccessible: true },
    { resourceType: "pdf", url: "https://example.test/blocked.pdf", isAccessible: false },
  ]), ["https://example.test/document.pdf"]);
  assert.deepEqual(pdfResourceCandidates({
    pdfUrl: "https://example.test/legacy.pdf",
  }, [
    { resourceType: "pdf", url: "https://official.test/canonical.pdf", isAccessible: true },
  ]), [
    "https://official.test/canonical.pdf",
    "https://example.test/legacy.pdf",
  ]);
});

test("corpus recovery keeps unselected candidates available for the next bounded batch", async () => {
  const candidates = Array.from({ length: 30 }, (_, index) =>
    document(index + 1, "RESOURCE_READY_NO_TEXT", "P0"));
  const before = {
    totalPublicCatalogue: 30,
    funnel: { searchReady: 0 },
    notSearchReady: 30,
    retryable: 30,
    manualReview: 0,
    byRecoveryClass: { RESOURCE_READY_NO_TEXT: 30 },
    documents: candidates,
  };
  const after = { ...before, funnel: { searchReady: 2 }, documents: undefined };
  let audits = 0;
  const windows = [];
  const report = await runCorpusRecoveryWave({
    requested: 2,
    auditFn: async () => (audits++ === 0 ? before : after),
    snapshotFn: async () => ({ databaseBytes: 100, objectCount: 0, objectBytes: 0, chunkCount: 0 }),
    capacityFn: async () => ({ bulkProcessingAllowed: true, safeBatchSize: 1 }),
    cancelQueuedFn: async () => 0,
    processBatchFn: async (options) => {
      windows.push(options.allowedDocumentIds.map(String));
      const selected = windows.length === 1 ? "30" : "29";
      return {
        enqueued: 1,
        selection: [{ jobId: String(windows.length), documentId: selected }],
        results: [{ documentId: selected, status: "ready", chunks: 1 }],
      };
    },
    validateFn: async (ids) => ids.map((documentId) => ({ documentId, valid: true })),
  });
  assert.equal(report.gatePassed, true);
  assert.equal(windows.length, 2);
  assert.equal(windows[1].includes("30"), false);
  assert.equal(windows[1].includes("1"), true);
});

test("large recovery waves evaluate retry failures on a representative batch", async () => {
  const candidates = Array.from({ length: 100 }, (_, index) =>
    document(index + 1, "RESOURCE_READY_NO_TEXT", "P0"));
  const before = {
    totalPublicCatalogue: 100,
    funnel: { searchReady: 0 },
    notSearchReady: 100,
    retryable: 100,
    manualReview: 0,
    byRecoveryClass: { RESOURCE_READY_NO_TEXT: 100 },
    documents: candidates,
  };
  const after = { ...before, funnel: { searchReady: 18 }, documents: undefined };
  let audits = 0;
  let batch = 0;
  let nextDocumentId = 1;
  const report = await runCorpusRecoveryWave({
    requested: 100,
    auditFn: async () => (audits++ === 0 ? before : after),
    snapshotFn: async () => ({ databaseBytes: 100, objectCount: 0, objectBytes: 0, chunkCount: 0 }),
    capacityFn: async () => ({ bulkProcessingAllowed: true, safeBatchSize: 25 }),
    cancelQueuedFn: async () => 0,
    processBatchFn: async () => {
      batch += 1;
      const count = Math.min(batch === 1 ? 7 : 25, 101 - nextDocumentId);
      const offset = nextDocumentId - 1;
      nextDocumentId += count;
      return {
        enqueued: count,
        selection: Array.from({ length: count }, (_, index) => ({
          jobId: String(offset + index + 1),
          documentId: String(offset + index + 1),
        })),
        results: Array.from({ length: count }, (_, index) => ({
          documentId: String(offset + index + 1),
          status: batch === 1 ? "failed" : "ready",
          retryEligible: batch === 1,
          chunks: batch === 1 ? 0 : 1,
        })),
      };
    },
    validateFn: async (ids) => ids.map((documentId) => ({ documentId, valid: true })),
  });
  assert.equal(batch >= 2, true);
  assert.notEqual(report.attempted, 7);
});

test("corpus metrics count unique documents and retain the latest retry outcome", () => {
  const result = latestDocumentResults([
    { documentId: "1", status: "failed", retryEligible: true },
    { documentId: "2", status: "ready" },
    { documentId: "1", status: "ready" },
  ]);
  assert.equal(result.length, 2);
  assert.equal(result.find((item) => item.documentId === "1").status, "ready");
});

test("recovered-document validation accepts non-empty short labels alongside substantive chunks", async () => {
  const rows = [{
    id: "20539",
    title: "Example",
    document_type: "report",
    resource_ready: true,
    text_ready: true,
    search_ready: true,
    chat_ready: true,
    capability_comparison_ready: true,
    semantic_ready: false,
    retrieval_verified: true,
    retrieval_mode: "fts",
    processing_status: "ready",
    extraction_status: "ready",
    chunking_status: "ready",
    chunks: 3,
    non_empty_chunks: 3,
    substantive_chunks: 2,
    distinct_chunk_indexes: 3,
    source_identity_preserved: true,
    phrase_retrievable: true,
    fts_indexed: true,
  }];
  const result = await validateRecoveredDocuments([20539], {
    queryFn: async () => ({ rows }),
  });
  assert.equal(result[0].valid, true);
  assert.equal(result[0].checks.validChunks, true);
});
