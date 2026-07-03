const test = require("node:test");
const assert = require("node:assert/strict");
const {
  buildFilters,
} = require("../egazette/egazetteService");
const { generateLocalEmbedding } = require("../lib/vectordb");

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
