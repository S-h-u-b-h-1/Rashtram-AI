const test = require("node:test");
const assert = require("node:assert/strict");
const {
  checkVectorNamespaces,
  summarizeNamespaces,
} = require("../lib/vectorNamespaceHealth");

// The vector namespace is derived from the embedding model, so switching
// embedding provider silently changes which namespace is read. Nothing
// errors when the new namespace is empty — Pinecone just returns no
// matches and retrieval falls back to lexical search. These tests pin the
// detection of that silent failure, using the real production numbers.

test("detects an orphaned namespace (the live rashtram-acts case)", () => {
  const summary = summarizeNamespaces(
    {
      "text-embedding-3-large-768-v1": { recordCount: 1890 },
      "openai-text-embedding-3-large-768-v1": { recordCount: 787 },
      "text-embedding-004-768-v1": { recordCount: 211 },
      "local-hash-v1": { recordCount: 40 },
    },
    "gemini-embedding-001-768-v1",
  );

  assert.equal(summary.state, "orphaned");
  assert.equal(summary.activeRecords, 0);
  assert.equal(summary.totalRecords, 2928);
  assert.match(summary.message, /contains no vectors/);
});

test("detects low occupancy (the live rashtram-bills case)", () => {
  const summary = summarizeNamespaces(
    {
      "text-embedding-3-large-768-v1": { recordCount: 8912 },
      "openai-text-embedding-3-large-768-v1": { recordCount: 480 },
      "local-hash-v1": { recordCount: 236 },
      "gemini-embedding-001-768-v1": { recordCount: 132 },
      "text-embedding-004-768-v1": { recordCount: 33 },
    },
    "gemini-embedding-001-768-v1",
  );

  assert.equal(summary.state, "low_occupancy");
  assert.equal(summary.activeRecords, 132);
  assert.equal(summary.totalRecords, 9793);
});

test("a correctly-pointed namespace is healthy", () => {
  const summary = summarizeNamespaces(
    {
      "text-embedding-3-large-768-v1": { recordCount: 8912 },
      "gemini-embedding-001-768-v1": { recordCount: 132 },
    },
    "text-embedding-3-large-768-v1",
  );
  assert.equal(summary.state, "ok");
  assert.equal(summary.message, null);
});

test("namespaces are ranked largest-first to reveal the intended target", () => {
  const summary = summarizeNamespaces(
    {
      small: { recordCount: 10 },
      largest: { recordCount: 9000 },
      middle: { recordCount: 500 },
    },
    "small",
  );
  assert.equal(
    summary.namespaces[0].namespace,
    "largest",
    "diagnosing a misconfiguration should surface the populated namespace first",
  );
});

test("an empty index is distinguished from a misconfigured namespace", () => {
  // Nothing embedded yet is a different problem from pointing at the
  // wrong namespace, and warrants different action.
  const summary = summarizeNamespaces({}, "gemini-embedding-001-768-v1");
  assert.equal(summary.state, "empty_index");
});

test("checkVectorNamespaces reports unhealthy when any index is orphaned", async () => {
  const result = await checkVectorNamespaces(
    [
      {
        name: "bills",
        index: {
          describeIndexStats: async () => ({
            namespaces: { "ns-a": { recordCount: 100 } },
          }),
        },
      },
      {
        name: "acts",
        index: {
          describeIndexStats: async () => ({
            namespaces: { "ns-b": { recordCount: 50 } },
          }),
        },
      },
    ],
    "ns-a",
  );

  assert.equal(result.healthy, false, "acts is orphaned under ns-a");
  assert.equal(result.indexes.bills.state, "ok");
  assert.equal(result.indexes.acts.state, "orphaned");
});

test("a Pinecone failure degrades to 'unavailable' and never throws", async () => {
  const result = await checkVectorNamespaces(
    [
      {
        name: "bills",
        index: {
          describeIndexStats: async () => {
            throw new Error("pinecone unreachable");
          },
        },
      },
    ],
    "ns-a",
  );
  assert.equal(result.indexes.bills.state, "unavailable");
  // Unavailable is not the same as degraded — we do not know either way,
  // and must not raise a false alarm about corpus reachability.
  assert.equal(result.healthy, true);
});
