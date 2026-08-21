const test = require("node:test");
const assert = require("node:assert/strict");

const {
  LARGE_DOCUMENT_THRESHOLD,
  buildStructuralGroups,
  expandLargeDocumentMatches,
  indexLargeDocument,
  largeDocumentPolicy,
} = require("../document/largeDocumentService");

const chunks = (count) => Array.from({ length: count }, (_, index) => ({
  chunk_index: index,
  original_text: `Original Gazette passage ${index}. Licensing obligation number ${index}.`,
  translated_text: null,
  language: "en",
  metadata_json: {
    sectionTitle: `Part ${Math.floor(index / 10) + 1}`,
    sectionId: String(Math.floor(index / 10) + 1),
    pageStart: index + 1,
  },
}));

test("ordinary documents retain the global 100-chunk semantic path", () => {
  assert.equal(LARGE_DOCUMENT_THRESHOLD, 100);
  assert.equal(largeDocumentPolicy(100).mode, "standard");
  assert.equal(largeDocumentPolicy(101).mode, "hierarchical");
});

test("large chunks become bounded contiguous structural groups", () => {
  const groups = buildStructuralGroups(chunks(105), { title: "Test Gazette" });
  assert.ok(groups.length < 20);
  assert.equal(groups[0].childStart, 0);
  assert.equal(groups.at(-1).childEnd, 104);
  assert.equal(groups.reduce((sum, group) => sum + group.childCount, 0), 105);
  assert.ok(groups.every((group) => group.childCount <= 24));
  assert.ok(groups.every((group) => group.representationText.includes("Test Gazette")));
});

test("large-document dry run creates no vectors or database writes", async () => {
  let writes = 0;
  let storeCalls = 0;
  const queryFn = async (sql) => {
    if (/^\s*(BEGIN|COMMIT|ROLLBACK|DELETE|INSERT|UPDATE)/i.test(sql)) writes += 1;
    if (/FROM documents document/.test(sql)) return { rows: [{
      id: 20582, title: "Oversized Gazette", document_type: "gazette",
      visibility_status: "public", search_ready: true, semantic_ready: false,
      hierarchical_semantic_ready: false,
    }] };
    if (/FROM document_text_chunks/.test(sql)) return { rows: chunks(105) };
    throw new Error(`Unexpected query: ${sql}`);
  };
  const result = await indexLargeDocument({
    documentId: 20582, dryRun: true, queryFn,
    storeFn: async () => { storeCalls += 1; },
  });
  assert.equal(result.status, "dry_run");
  assert.equal(result.childChunks, 105);
  assert.ok(result.routingGroups < result.childChunks);
  assert.equal(writes, 0);
  assert.equal(storeCalls, 0);
  assert.equal(result.downloads, 0);
  assert.equal(result.ocrPages, 0);
});

test("routing representations expand only to original child evidence", async () => {
  const selected = chunks(3).slice(1);
  const result = await expandLargeDocumentMatches({
    matches: [{ score: 0.9, metadata: {
      routingOnly: true, childStart: 1, childEnd: 2,
      content: "Generated or derived routing text must never be cited.",
    } }],
    documentId: 20582,
    message: "licensing obligation",
    queryFn: async (sql, params) => {
      assert.match(sql, /document_text_chunks/);
      assert.equal(params[0], 20582);
      return { rows: selected };
    },
  });
  assert.equal(result.length, 2);
  assert.ok(result.every((passage) => passage.routedFromRepresentation));
  assert.ok(result.every((passage) => passage.retrievalMode === "hierarchical_vector"));
  assert.ok(result.every((passage) => !passage.content.includes("routing text")));
  assert.deepEqual(result.map((passage) => passage.pageStart).sort(), [2, 3]);
});

test("non-routing vector matches stay on the ordinary path", async () => {
  const result = await expandLargeDocumentMatches({
    matches: [{ score: 0.8, metadata: { chunkIndex: 2, content: "source" } }],
    documentId: 1,
    message: "source",
    queryFn: async () => { throw new Error("must not query"); },
  });
  assert.equal(result, null);
});
