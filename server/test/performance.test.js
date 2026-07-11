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
