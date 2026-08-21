const test = require("node:test");
const assert = require("node:assert/strict");
const {
  buildFilters,
} = require("../egazette/egazetteService");
const {
  buildEmbeddingBatches,
  estimateEmbeddingTokens,
  generateLocalEmbedding,
  providerConfig,
} = require("../lib/vectordb");
const { candidateLimitsFor, retrievalConfig } = require("../retrieval/retrievalConfig");
const {
  caches,
  getOrCreateQueryEmbedding,
  queryEmbeddingCacheKey,
} = require("../retrieval/researchCache");
const {
  awaitWithinTimeBudget,
  retrieveDocumentContext,
} = require("../document/documentResearchService");

test("catalogue filter construction remains bounded under repeated requests", () => {
  const startedAt = performance.now();
  for (let index = 0; index < 10_000; index += 1) {
    const filters = buildFilters({
      search: `notification ${index}`,
      ministry: "Ministry of Finance",
      year: "2026",
      hasPdf: true,
    });
    assert.equal(filters.parameters.length, 3);
  }
  assert.ok(
    performance.now() - startedAt < 1_500,
    "10,000 parameterized filter plans should complete within 1.5 seconds",
  );
});

test("local embedding fallback stays deterministic", () => {
  assert.deepEqual(
    generateLocalEmbedding("Income tax notification"),
    generateLocalEmbedding("Income tax notification"),
  );
});

test("embedding batches stay below the configured token budget", () => {
  const texts = [
    "a".repeat(16_000),
    "क".repeat(6_000),
    "b".repeat(16_000),
  ];
  const batches = buildEmbeddingBatches(texts, {
    maxInputs: 50,
    tokenBudget: 8_000,
  });

  assert.deepEqual(batches.map((batch) => batch.length), [1, 1, 1]);
  assert.equal(estimateEmbeddingTokens(texts[0]), 4_000);
  assert.equal(estimateEmbeddingTokens(texts[1]), 6_000);
});

test("AI provider config reports model readiness without exposing secrets", () => {
  const config = providerConfig();
  assert.equal(typeof config.aiProvider, "string");
  assert.equal(typeof config.chatModelConfigured, "boolean");
  assert.equal(typeof config.embeddingModelConfigured, "boolean");
  assert.ok(!Object.keys(config).some((key) => /api.*key|secret|token/i.test(key)));
  assert.ok(!JSON.stringify(config).includes("sk-"));
  assert.ok(!JSON.stringify(config).includes("AQ."));
});

test("query embedding keys contain model/version identity but no raw question", () => {
  const options = {
    query: "  What applies to NBFCs?  ", provider: "gemini",
    model: "gemini-embedding-001", version: "gemini-embedding-001-768-v1", dimension: 768,
  };
  const key = queryEmbeddingCacheKey(options);
  assert.equal(key, queryEmbeddingCacheKey({ ...options, query: "what applies to nbfcs?" }));
  assert.notEqual(key, queryEmbeddingCacheKey({ ...options, model: "future-model" }));
  assert.equal(key.includes("NBFC"), false);
});

test("identical concurrent query embeddings are coalesced and cached", async () => {
  caches.queryEmbedding.clear();
  let calls = 0;
  const options = {
    query: "same bounded question", provider: "gemini", model: "model",
    version: "model-768-v1", dimension: 768,
  };
  const factory = async () => {
    calls += 1;
    await new Promise((resolve) => setTimeout(resolve, 5));
    return [0.1, 0.2];
  };
  const [first, second] = await Promise.all([
    getOrCreateQueryEmbedding(options, factory),
    getOrCreateQueryEmbedding(options, factory),
  ]);
  const third = await getOrCreateQueryEmbedding(options, factory);
  assert.equal(calls, 1);
  assert.deepEqual(first.embedding, second.embedding);
  assert.equal(third.cacheStatus, "hit");
});

test("candidate profiles reduce expensive vectors while preserving comparison breadth", () => {
  const config = retrievalConfig();
  assert.equal(candidateLimitsFor("COMPLIANCE", config).vector, 24);
  assert.equal(candidateLimitsFor("RELATIONSHIP", config).vector, 20);
  assert.equal(candidateLimitsFor("COMPARISON", config).vector, 30);
});

test("time budget resolves without cancelling evidence already available", async () => {
  const outcome = await awaitWithinTimeBudget(
    new Promise((resolve) => setTimeout(() => resolve("late"), 50)), 10,
  );
  assert.equal(outcome.timedOut, true);
});

test("sufficient lexical evidence can continue after a bounded vector wait", async () => {
  const lexical = Array.from({ length: 3 }, (_, index) => ({
    documentId: "1", chunkIndex: index, content: `Verified obligation evidence ${index}`,
    ftsScore: 1 - index / 10, retrievalMode: "fts",
  }));
  const startedAt = Date.now();
  const result = await retrieveDocumentContext("policy", "1", "Explain the compliance impact", {
    vectorTimeBudgetMs: 10,
    adapters: {
      ftsSearch: async () => lexical,
      localSearch: async () => [],
      metadataSearch: async () => [],
      vectorSearch: async () => {
        await new Promise((resolve) => setTimeout(resolve, 50));
        return [];
      },
    },
  });
  assert.ok(Date.now() - startedAt < 45);
  assert.equal(result.diagnostics.vectorTimedOut, true);
  assert.equal(result.retrievalVerified, true);
  assert.equal(result.passages.length, 3);
});

test("insufficient lexical evidence waits for vector evidence despite the budget", async () => {
  const startedAt = Date.now();
  const result = await retrieveDocumentContext("policy", "1", "Why is this policy significant?", {
    vectorTimeBudgetMs: 10,
    adapters: {
      ftsSearch: async () => [],
      localSearch: async () => [],
      metadataSearch: async () => [],
      vectorSearch: async () => {
        await new Promise((resolve) => setTimeout(resolve, 20));
        return [{ documentId: "1", chunkIndex: 1, content: "Relevant vector evidence",
          vectorScore: 0.9, retrievalMode: "vector" }];
      },
    },
  });
  assert.ok(Date.now() - startedAt >= 15);
  assert.equal(result.diagnostics.vectorTimedOut, false);
  assert.equal(result.retrievalMode, "vector");
});
