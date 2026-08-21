const test = require("node:test");
const assert = require("node:assert/strict");

const {
  classifyCoverageReason,
  demandWeightedCoverage,
  publicBackfillEligible,
  semanticPriority,
  summarizeCoverage,
} = require("../document/semanticCoverageService");
const {
  backfillSemanticDocument,
  buildVectorChunks,
  completeBackfillJob,
  loadBackfillCandidates,
  retryableEmbeddingFailure,
  runSemanticBackfill,
  sha256,
  updateSemanticState,
} = require("../document/semanticBackfillService");
const {
  reconcileSemanticReadinessTruth,
  semanticReadinessTruth,
} = require("../document/semanticReconciliationService");

const config = {
  embeddingProvider: "gemini",
  embeddingModel: "gemini-embedding-001",
  embeddingDimension: 768,
  vectorNamespace: "gemini-embedding-001-768-v1",
};

const document = (overrides = {}) => ({
  id: 7,
  title: "Official Regulatory Act, 2026",
  document_type: "act",
  visibilityStatus: "public",
  searchReady: true,
  hasChunks: true,
  retryEligible: true,
  priorityTier: "P1",
  priorityScore: 500,
  ...overrides,
});

const row = (overrides = {}) => ({
  chunk_index: 0,
  original_text: "Section 1 creates a verified regulatory obligation.",
  translated_text: null,
  language: "en",
  vector_reference: "act-7-chunk-0",
  metadata_json: {},
  embedding_namespace: null,
  embedding_input_sha256: null,
  ...overrides,
});

const noOps = {
  createJobFn: async () => 1,
  completeJobFn: async () => undefined,
  updateChunkMetadataFn: async () => undefined,
  recordStageFn: async () => undefined,
};

test("search-ready non-semantic candidates use public chunk-only selection", async () => {
  let sql = "";
  const rows = [{
    id: 1, title: "A", document_type: "act", year: 2026,
    source_authority_tier: "A", source_priority: 1, quality_score: 1,
    visibility_status: "public", source: "india-code", search_ready: true,
    semantic_ready: false, retrieval_verified: true, retry_eligible: true,
    chunk_count: 2, demand_7d: 0, demand_30d: 0, comparison_30d: 0,
    knowledge_links: 0,
  }];
  const result = await loadBackfillCandidates({ queryFn: async (value) => {
    sql = value;
    return { rows };
  }, limit: 5 });
  assert.equal(result.length, 1);
  assert.match(sql, /visibility_status = 'public'/);
  assert.match(sql, /state\.search_ready/);
  assert.match(sql, /retry_eligible/);
  assert.doesNotMatch(sql, /original_text|download|ocr/i);
});

test("P0 demand outranks P3 long-tail deterministically", () => {
  const p0 = semanticPriority({ explicitDemand: true, authorityTier: "D", documentType: "report", year: 2010 });
  const p3 = semanticPriority({ authorityTier: "D", documentType: "report", year: 2010 });
  assert.equal(p0.tier, "P0");
  assert.equal(p3.tier, "P3");
  assert.ok(p0.score > p3.score);
});

test("authority and primary-source weights raise semantic priority", () => {
  const official = semanticPriority({ authorityTier: "A", source: "india-code", documentType: "act", year: 2026 });
  const secondary = semanticPriority({ authorityTier: "C", source: "research-blog", documentType: "report", year: 2026 });
  assert.ok(official.score > secondary.score);
  assert.equal(official.tier, "P1");
});

test("private and account-owned documents cannot enter public backfill", () => {
  assert.equal(publicBackfillEligible(document()), true);
  assert.equal(publicBackfillEligible(document({ visibilityStatus: "private" })), false);
  assert.equal(publicBackfillEligible(document({ visibilityStatus: "account" })), false);
});

test("backlog reasons distinguish old namespaces and missing vectors", () => {
  assert.equal(classifyCoverageReason({ chunk_count: 1, old_namespace_chunks: 1 }), "OLD_NAMESPACE");
  assert.equal(classifyCoverageReason({ chunk_count: 1, unversioned_chunks: 1, embedding_status: "ready" }), "OLD_NAMESPACE_UNVERSIONED");
  assert.equal(classifyCoverageReason({ chunk_count: 1, active_namespace_chunks: 1 }), "MISSING_VECTOR_RECORD");
});

test("coverage summary requires active namespace, capability state, and verification", () => {
  const report = summarizeCoverage([
    { id: 1, chunk_count: 2, search_ready: true, semantic_ready: true, retrieval_verified: true, active_namespace_chunks: 2, active_vector_refs: 2, source: "x" },
    { id: 2, chunk_count: 2, search_ready: true, semantic_ready: true, retrieval_verified: true, active_vector_refs: 0, unversioned_chunks: 2, embedding_status: "ready", source: "x" },
  ], config.vectorNamespace);
  assert.equal(report.activeSemanticDocuments, 1);
  assert.equal(report.searchReadyWithoutActiveSemantic, 1);
  assert.equal(report.backlogReasons.OLD_NAMESPACE_UNVERSIONED, 1);
});

test("demand-weighted coverage remains unavailable without aggregate demand", async () => {
  let sql = "";
  const result = await demandWeightedCoverage({ activeNamespace: config.vectorNamespace, queryFn: async (value) => {
    sql = value;
    return { rows: [{ demanded_documents: 0, demand_events: 0, semantic_demand_events: 0 }] };
  } });
  assert.equal(result.available, false);
  assert.equal(result.percent, null);
  assert.equal(result.rawQueriesUsed, false);
  assert.doesNotMatch(sql, /search_query/);
});

test("unchanged active embedding hashes are reusable", () => {
  const text = row().original_text;
  const chunks = buildVectorChunks({
    document: document(), family: "act", config,
    rows: [row({ embedding_namespace: config.vectorNamespace, embedding_input_sha256: sha256(text) })],
  });
  assert.equal(chunks[0].previousNamespace, config.vectorNamespace);
  assert.equal(chunks[0].previousEmbeddingInputHash, chunks[0].embeddingInputHash);
});

test("outdated embedding namespace requires regeneration", async () => {
  const result = await backfillSemanticDocument({
    document: document(), dryRun: true, config,
    loadChunksFn: async () => [row({ embedding_namespace: "old-model-768-v1" })],
  });
  assert.equal(result.reusableChunks, 0);
  assert.equal(result.chunksToGenerate, 1);
});

test("valid current vectors reconcile without duplicate embedding calls", async () => {
  const text = row().original_text;
  let storeCalls = 0;
  let state = null;
  const result = await backfillSemanticDocument({
    document: document(), config,
    loadChunksFn: async () => [row({ embedding_namespace: config.vectorNamespace, embedding_input_sha256: sha256(text) })],
    storeOverrides: { act: async () => { storeCalls += 1; } },
    probeFn: async () => ({ verified: true, attempts: 1, matches: 1 }),
    updateStateFn: async (value) => { state = value; return true; },
    ...noOps,
  });
  assert.equal(result.status, "reconciled");
  assert.equal(result.embeddingsReused, 1);
  assert.equal(storeCalls, 0);
  assert.equal(state.verified, true);
});

test("known missing Pinecone IDs are regenerated despite matching PostgreSQL hashes", async () => {
  const text = row().original_text;
  let unchanged = null;
  const result = await backfillSemanticDocument({
    document: document(), config,
    loadChunksFn: async () => [row({
      embedding_namespace: config.vectorNamespace,
      embedding_input_sha256: sha256(text),
    })],
    missingVectorIds: new Set(["act-7-chunk-0"]),
    storeOverrides: { act: async (_chunks, options) => {
      unchanged = options.unchangedChunkIds;
      return { embeddingCacheHits: 0, embeddingCacheMisses: 1, metrics: {} };
    } },
    probeFn: async () => ({ verified: true, attempts: 1, matches: 1 }),
    updateStateFn: async () => true,
    ...noOps,
  });
  assert.equal(result.status, "indexed");
  assert.equal(result.embeddingsGenerated, 1);
  assert.equal(unchanged.size, 0);
});

test("Pinecone write alone does not imply semantic readiness", async () => {
  const states = [];
  const result = await backfillSemanticDocument({
    document: document(), config,
    loadChunksFn: async () => [row()],
    storeOverrides: { act: async () => ({ embeddingCacheHits: 0, embeddingCacheMisses: 1, metrics: {} }) },
    probeFn: async () => ({ verified: false, attempts: 3 }),
    updateStateFn: async (value) => { states.push(value); return true; },
    ...noOps,
  });
  assert.equal(result.status, "failed");
  assert.equal(states.at(-1).verified, false);
});

test("retrieval verification failure preserves lexical search readiness", async () => {
  let sql = "";
  await updateSemanticState({
    documentId: 1, chunksCount: 1, verified: false,
    error: new Error("temporary vector outage"),
    queryFn: async (value) => { sql = value; return { rows: [] }; },
  });
  assert.match(sql, /semantic_ready = \$3/);
  assert.doesNotMatch(sql, /search_ready\s*=/);
});

test("provider failures retain retryability while auth failures are permanent", () => {
  assert.equal(retryableEmbeddingFailure(Object.assign(new Error("temporarily unavailable"), { status: 503 })), true);
  assert.equal(retryableEmbeddingFailure(Object.assign(new Error("forbidden"), { status: 403 })), false);
});

test("safe batch never exceeds requested or computed capacity", async () => {
  let candidateQueryCalled = false;
  const blocked = await runSemanticBackfill({
    requested: 25,
    capacityFn: async () => ({ safeBatchSize: 0, bulkProcessingAllowed: false, reason: "capacity" }),
    queryFn: async () => { candidateQueryCalled = true; return { rows: [] }; },
  });
  assert.equal(blocked.effective, 0);
  assert.equal(candidateQueryCalled, false);
  const bounded = await runSemanticBackfill({
    requested: 25,
    capacityFn: async () => ({ safeBatchSize: 3, bulkProcessingAllowed: true }),
    queryFn: async () => ({ rows: [] }),
  });
  assert.equal(bounded.effective, 3);
});

test("semantic dry run never downloads or repeats OCR", async () => {
  const result = await backfillSemanticDocument({
    document: document(), dryRun: true, config,
    loadChunksFn: async () => [row()],
  });
  assert.equal(result.downloads, 0);
  assert.equal(result.ocrPages, 0);
});

test("semantic attempt duration uses one PostgreSQL integer parameter type", async () => {
  const statements = [];
  await completeBackfillJob({
    jobId: 11,
    document: document(),
    status: "completed",
    metrics: { durationMs: 1250, embeddingInputTokens: 42 },
    queryFn: async (sql, params) => {
      statements.push({ sql, params });
      return { rows: [] };
    },
  });
  assert.equal(statements.length, 2);
  assert.match(
    statements[1].sql,
    /NOW\(\) - \(\$8::INTEGER \* INTERVAL '1 millisecond'\)/,
  );
  assert.equal(statements[1].params[7], 1250);
});

test("active embedding metadata stays provider/model/dimension/version consistent", () => {
  const [chunk] = buildVectorChunks({ document: document(), family: "act", config, rows: [row()] });
  assert.equal(chunk.metadata.embeddingProvider, "gemini");
  assert.equal(chunk.metadata.embeddingModel, "gemini-embedding-001");
  assert.equal(chunk.metadata.embeddingDimension, "768");
  assert.equal(chunk.metadata.vectorNamespace, "gemini-embedding-001-768-v1");
});

test("semantic readiness truth requires current hashes, namespace, vectors, and probe", () => {
  const text = "A current authoritative provision.";
  const current = {
    document_id: 1, chunk_index: 0, title: "Current", document_type: "act",
    visibility_status: "public", search_ready: true, semantic_ready: false,
    retrieval_verified: true, retry_eligible: true, original_text: text,
    translated_text: null, vector_reference: "act-1-chunk-0",
    embedding_namespace: config.vectorNamespace,
    embedding_input_sha256: sha256(text),
  };
  const stale = {
    ...current, document_id: 2, title: "Stale", semantic_ready: true,
    vector_reference: "act-2-chunk-0", embedding_namespace: "old-namespace",
  };
  const truth = semanticReadinessTruth({
    activeNamespace: config.vectorNamespace,
    missing: [],
    rows: [current, stale],
  });
  assert.equal(truth.flaggedSemanticReady, 1);
  assert.equal(truth.derivedSemanticReady, 1);
  assert.equal(truth.difference, 0);
  assert.deepEqual(truth.mismatches.map((item) => item.documentId), ["1", "2"]);
});

test("readiness reconciliation changes only mismatched semantic flags", async () => {
  const text = "Verified active evidence.";
  const statements = [];
  const audit = {
    activeNamespace: config.vectorNamespace,
    missing: [],
    rows: [{
      document_id: 3, chunk_index: 0, title: "Verified", document_type: "act",
      visibility_status: "public", search_ready: true, semantic_ready: false,
      retrieval_verified: true, retry_eligible: true, original_text: text,
      translated_text: null, vector_reference: "act-3-chunk-0",
      embedding_namespace: config.vectorNamespace,
      embedding_input_sha256: sha256(text),
    }],
  };
  const result = await reconcileSemanticReadinessTruth({
    audit,
    queryFn: async (sql, params) => {
      statements.push({ sql, params });
      return { rowCount: 1, rows: [{ document_id: 3, semantic_ready: true }] };
    },
  });
  assert.equal(result.updates.length, 1);
  assert.deepEqual(JSON.parse(statements[0].params[0]), [
    { document_id: "3", semantic_ready: true },
  ]);
  assert.match(statements[0].sql, /SET semantic_ready = truth\.semantic_ready/);
  assert.doesNotMatch(statements[0].sql, /search_ready\s*=/);
});
