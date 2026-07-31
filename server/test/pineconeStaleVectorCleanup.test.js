const test = require("node:test");
const assert = require("node:assert/strict");
const { cleanupStaleVectors } = require("../lib/vectordb");

const chunk = (documentId, index) => ({
  id: `bill-${documentId}-chunk-${index}`,
  billId: documentId,
  chunkIndex: index,
});

const fakeIndex = (existingIds, { queryError, deleteSpy } = {}) => ({
  query: async () => {
    if (queryError) throw queryError;
    return { matches: existingIds.map((id) => ({ id })) };
  },
  deleteMany: async (ids) => {
    if (deleteSpy) deleteSpy(ids);
  },
});

test("reprocess with fewer chunks deletes exactly the stale vector IDs", async () => {
  const documentId = "doc-1";
  const oldIds = Array.from({ length: 10 }, (_, i) => `bill-${documentId}-chunk-${i}`);
  const newChunks = Array.from({ length: 6 }, (_, i) => chunk(documentId, i));

  let deletedIds = null;
  const index = fakeIndex(oldIds, { deleteSpy: (ids) => (deletedIds = ids) });

  const removed = await cleanupStaleVectors({
    chunks: newChunks,
    index,
    idField: "billId",
    chunkIdField: "billId",
  });

  assert.equal(removed, 4);
  assert.deepEqual(
    [...deletedIds].sort(),
    [6, 7, 8, 9].map((i) => `bill-${documentId}-chunk-${i}`).sort(),
  );
});

test("superset/unchanged chunk set never calls deleteMany", async () => {
  const documentId = "doc-2";
  const existingIds = Array.from({ length: 5 }, (_, i) => `bill-${documentId}-chunk-${i}`);
  const newChunks = Array.from({ length: 5 }, (_, i) => chunk(documentId, i));

  let deleteCalled = false;
  const index = fakeIndex(existingIds, { deleteSpy: () => (deleteCalled = true) });

  const removed = await cleanupStaleVectors({
    chunks: newChunks,
    index,
    idField: "billId",
    chunkIdField: "billId",
  });

  assert.equal(removed, 0);
  assert.equal(deleteCalled, false);
});

test("cleanup failure does not throw and does not block the caller", async () => {
  const documentId = "doc-3";
  const newChunks = Array.from({ length: 3 }, (_, i) => chunk(documentId, i));
  const index = fakeIndex([], { queryError: new Error("pinecone unavailable") });

  const removed = await cleanupStaleVectors({
    chunks: newChunks,
    index,
    idField: "billId",
    chunkIdField: "billId",
  });

  assert.equal(removed, 0, "a failed cleanup must resolve, not reject");
});

test("empty document id short-circuits without querying", async () => {
  let queried = false;
  const index = {
    query: async () => {
      queried = true;
      return { matches: [] };
    },
    deleteMany: async () => {},
  };

  const removed = await cleanupStaleVectors({
    chunks: [{ id: "orphan-chunk-0" }],
    index,
    idField: "billId",
    chunkIdField: "billId",
  });

  assert.equal(removed, 0);
  assert.equal(queried, false);
});
