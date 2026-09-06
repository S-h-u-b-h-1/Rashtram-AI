const test = require("node:test");
const assert = require("node:assert/strict");

// EMBEDDING_PROVIDER is captured as a module-level const in vectordb.js at
// require time — force the deterministic local provider before the first
// require so "changed" chunks can be embedded without real API calls.
process.env.EMBEDDING_PROVIDER = "local";

let queryImpl = async () => ({ rows: [] });
const db = require("../db");
db.query = (...args) => queryImpl(...args);

const vectordb = require("../lib/vectordb");
const { saveNormalizedChunks } = require("../document/documentResearchService");

const currentNamespace = vectordb.providerConfig().vectorNamespace;

test("saveNormalizedChunks marks a chunk reusable only when hash AND namespace both match", async () => {
  const crypto = require("node:crypto");
  const hashOf = (text) => crypto.createHash("sha256").update(text).digest("hex");
  const unchangedContent = "unchanged content";
  const changedContent = "new content, different from before";
  const namespaceMismatchContent = "same-hash-different-namespace-content";

  const inserted = [];
  queryImpl = async (sql, params) => {
    if (sql.includes("SELECT chunk_index, content_hash")) {
      return {
        rows: [
          { chunk_index: 0, content_hash: hashOf(unchangedContent), embedding_namespace: currentNamespace, vector_reference: "doc-1-chunk-0" },
          { chunk_index: 1, content_hash: "HASH_STALE", embedding_namespace: currentNamespace, vector_reference: "doc-1-chunk-1" },
          { chunk_index: 2, content_hash: hashOf(namespaceMismatchContent), embedding_namespace: "old-model-512-v1", vector_reference: "doc-1-chunk-2" },
        ],
      };
    }
    if (sql.includes("DELETE FROM document_text_chunks")) return { rows: [] };
    if (sql.includes("INSERT INTO document_text_chunks")) {
      inserted.push(params);
      return { rows: [] };
    }
    return { rows: [] };
  };

  const chunks = [
    { id: "doc-1-chunk-0", chunkIndex: 0, content: unchangedContent },
    { id: "doc-1-chunk-1", chunkIndex: 1, content: changedContent },
    { id: "doc-1-chunk-2", chunkIndex: 2, content: namespaceMismatchContent },
  ];

  const result = await saveNormalizedChunks("doc-1", chunks, "en");

  assert.equal(result.unchangedChunkIds.has("doc-1-chunk-0"), true, "matching hash+namespace is reusable");
  assert.equal(result.unchangedChunkIds.has("doc-1-chunk-1"), false, "changed content is not reusable");
  assert.equal(
    result.unchangedChunkIds.has("doc-1-chunk-2"), false,
    "matching hash but different namespace must not be reused",
  );
  assert.equal(result.cacheHits, 1);
  assert.equal(result.cacheMisses, 2);
});

test("storeContentInChunks skips embedding entirely when every chunk is unchanged", async () => {
  const documentId = "doc-2";
  const chunkIds = Array.from({ length: 4 }, (_, i) => `bill-${documentId}-chunk-${i}`);
  let upsertCalled = false;
  let deleteManyCalled = null;

  const fakeIndex = {
    upsert: async () => {
      upsertCalled = true;
    },
    query: async () => ({ matches: chunkIds.map((id) => ({ id })) }),
    deleteMany: async (ids) => {
      deleteManyCalled = ids;
    },
  };

  const chunks = chunkIds.map((id, i) => ({
    id,
    billId: documentId,
    chunkIndex: i,
    content: `content ${i}`,
    title: "Test bill",
  }));

  const result = await vectordb.storeContentInChunks({
    chunks,
    index: fakeIndex,
    idField: "billId",
    titleField: "billTitle",
    chunkIdField: "billId",
    unchangedChunkIds: new Set(chunkIds),
  });

  assert.equal(upsertCalled, false, "no embedding/upsert call should happen when nothing changed");
  assert.equal(result.chunksStored, 0);
  assert.equal(result.embeddingCacheHits, 4);
  assert.equal(result.embeddingCacheMisses, 0);
  // cleanupStaleVectors still runs against the FULL chunk id set, so
  // nothing here should look stale even though none were re-upserted.
  assert.equal(deleteManyCalled, null, "unchanged-but-still-valid chunks must not be deleted as stale");
});

test("storeContentInChunks only embeds the changed subset, keeping the full set for cleanup", async () => {
  const documentId = "doc-3";
  const chunkIds = Array.from({ length: 4 }, (_, i) => `bill-${documentId}-chunk-${i}`);
  let upsertedVectors = null;

  const fakeIndex = {
    upsert: async (vectors) => {
      upsertedVectors = vectors;
    },
    query: async () => ({ matches: chunkIds.map((id) => ({ id })) }),
    deleteMany: async () => {
      throw new Error("should not be called — chunk set is unchanged");
    },
  };

  const chunks = chunkIds.map((id, i) => ({
    id,
    billId: documentId,
    chunkIndex: i,
    content: `content ${i}`,
    title: "Test bill",
  }));

  // chunk-0 and chunk-2 are cached; chunk-1 and chunk-3 need fresh embeddings.
  const unchangedChunkIds = new Set([chunkIds[0], chunkIds[2]]);

  const result = await vectordb.storeContentInChunks({
    chunks,
    index: fakeIndex,
    idField: "billId",
    titleField: "billTitle",
    chunkIdField: "billId",
    unchangedChunkIds,
  });

  assert.equal(result.embeddingCacheHits, 2);
  assert.equal(result.embeddingCacheMisses, 2);
  assert.equal(upsertedVectors.length, 2, "only the two changed chunks should be embedded and upserted");
  assert.deepEqual(
    upsertedVectors.map((v) => v.id).sort(),
    [chunkIds[1], chunkIds[3]].sort(),
  );
});
