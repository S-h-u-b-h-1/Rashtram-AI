const test = require("node:test");
const assert = require("node:assert/strict");

process.env.EMBEDDING_PROVIDER = "local";
const vectordb = require("../lib/vectordb");

// A minimal stateful fake that behaves like a real Pinecone namespace: it
// actually tracks what's "in the index" across calls, rather than just
// recording calls, so this test exercises the real interaction between
// upsert and the stale-vector cleanup added for the reprocessing bug —
// not just that the right functions were called.
const statefulFakeIndex = () => {
  const store = new Map();
  return {
    upsert: async (vectors) => {
      for (const vector of vectors) store.set(vector.id, vector);
    },
    query: async ({ filter }) => {
      const wanted = filter?.billId?.$eq;
      const matches = [...store.values()]
        .filter((v) => !wanted || v.metadata.billId === wanted)
        .map((v) => ({ id: v.id, score: 1, metadata: v.metadata }));
      return { matches };
    },
    deleteMany: async (ids) => {
      for (const id of ids) store.delete(id);
    },
    _size: () => store.size,
  };
};

test("citations can never reference a chunk removed by reprocessing", async () => {
  const documentId = "doc-citation-1";
  const index = statefulFakeIndex();

  const oldChunks = Array.from({ length: 10 }, (_, i) => ({
    id: `bill-${documentId}-chunk-${i}`,
    billId: documentId,
    chunkIndex: i,
    content: `original content for chunk ${i}`,
    title: "Test bill",
  }));
  await vectordb.storeContentInChunks({
    chunks: oldChunks,
    index,
    idField: "billId",
    titleField: "billTitle",
    chunkIdField: "billId",
  });
  assert.equal(index._size(), 10, "sanity: all 10 old chunks are indexed");

  // Reprocess produces only 6 chunks — chunk indices 6-9 no longer exist.
  const newChunks = Array.from({ length: 6 }, (_, i) => ({
    id: `bill-${documentId}-chunk-${i}`,
    billId: documentId,
    chunkIndex: i,
    content: `revised content for chunk ${i}`,
    title: "Test bill",
  }));
  await vectordb.storeContentInChunks({
    chunks: newChunks,
    index,
    idField: "billId",
    titleField: "billTitle",
    chunkIdField: "billId",
  });

  // Simulate what a citation-producing retrieval would see: a vector
  // search scoped to this document, mapped the same way
  // passageFromVectorMatch does in documentResearchService.js.
  const { matches } = await index.query({
    filter: { billId: { $eq: documentId } },
  });
  const citableChunkIndexes = matches
    .map((match) => match.metadata.chunkIndex)
    .sort((a, b) => a - b);

  assert.deepEqual(
    citableChunkIndexes,
    [0, 1, 2, 3, 4, 5],
    "no citation can reference chunk indices 6-9 after they were removed by reprocessing",
  );
  assert.equal(index._size(), 6);

  // And the content actually retrievable for a surviving index is the
  // *revised* text, not a stale copy from the old run.
  const chunk0 = matches.find((m) => m.metadata.chunkIndex === 0);
  assert.equal(chunk0.metadata.content, "revised content for chunk 0");
});

test("a cleanup failure never leaves citations pointing at half-written state", async () => {
  const documentId = "doc-citation-2";
  const index = statefulFakeIndex();
  index.query = async () => {
    throw new Error("pinecone read unavailable during cleanup");
  };

  const chunks = Array.from({ length: 3 }, (_, i) => ({
    id: `bill-${documentId}-chunk-${i}`,
    billId: documentId,
    chunkIndex: i,
    content: `content ${i}`,
    title: "Test bill",
  }));

  const result = await vectordb.storeContentInChunks({
    chunks,
    index,
    idField: "billId",
    titleField: "billTitle",
    chunkIdField: "billId",
  });

  // The write itself must still have succeeded even though cleanup's
  // read failed — a citation for the newly-written chunks is valid;
  // there just might be stale leftovers from before (logged, not fatal).
  assert.equal(result.success, true);
  assert.equal(result.chunksStored, 3);
  assert.equal(result.staleVectorsRemoved, 0);
});
