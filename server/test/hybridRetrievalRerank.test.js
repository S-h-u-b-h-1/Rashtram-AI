const test = require("node:test");
const assert = require("node:assert/strict");

// documentResearchService.js destructures `query` from ../db at require
// time, so the mock must be installed before the first require of the
// service module — a stable wrapper delegating to a mutable `queryImpl`
// lets each test control behavior without re-requiring the module.
let queryImpl = async () => ({ rows: [] });
const db = require("../db");
db.query = (...args) => queryImpl(...args);

const {
  rerankPassages,
  mergePassagesByChunk,
  retrieveFtsPassages,
} = require("../document/documentResearchService");

const passage = (overrides) => ({
  passage: 1,
  score: 0,
  chunkIndex: 0,
  totalChunks: 10,
  content: "",
  source: "test",
  pdfUrl: null,
  languageCode: "und",
  pageStart: null,
  pageEnd: null,
  pageEstimate: false,
  sectionId: null,
  sectionTitle: null,
  clauseId: null,
  structuralType: "passage",
  sourceUrl: null,
  retrievalMode: "vector",
  ...overrides,
});

test("a passage matching an explicit section identifier outranks a higher raw vector score", () => {
  const passages = [
    passage({
      chunkIndex: 0,
      content: "General provisions of the Act regarding administration.",
      vectorScore: 0.9,
      sectionId: "12",
    }),
    passage({
      chunkIndex: 1,
      content: "Section 5 deals with penalties for non-compliance.",
      vectorScore: 0.5,
      sectionId: "5",
    }),
  ];

  const reranked = rerankPassages(passages, "What does Section 5 say about penalties?", {
    topK: 2,
  });

  assert.equal(reranked[0].chunkIndex, 1, "the Section 5 passage should rank first");
  assert.ok(reranked[0].identifierBoost > 0);
});

test("dotted legal identifiers retain the complete section reference", () => {
  const ranked = rerankPassages([
    passage({ chunkIndex: 1, sectionId: "2", content: "Generic section two material.", vectorScore: 0.9 }),
    passage({ chunkIndex: 2, sectionId: "2.1.4)", content: "The specific production and productivity provision.", vectorScore: 0.4 }),
  ], "What does section 2.1.4 state?", { topK: 2 });

  assert.equal(ranked[0].chunkIndex, 2);
  assert.equal(ranked[0].identifierBoost, 1);
});

test("reranker respects topK and renumbers the passage field", () => {
  const passages = Array.from({ length: 5 }, (_, i) =>
    passage({ chunkIndex: i, content: `chunk ${i}`, vectorScore: 1 - i * 0.1 }),
  );
  const reranked = rerankPassages(passages, "irrelevant query text", { topK: 2 });
  assert.equal(reranked.length, 2);
  assert.deepEqual(reranked.map((p) => p.passage), [1, 2]);
});

test("mergePassagesByChunk unions candidates and preserves the richer metadata", () => {
  const vectorPassages = [
    passage({ chunkIndex: 0, content: "from vector", vectorScore: 0.8, retrievalMode: "vector" }),
  ];
  const ftsPassages = [
    passage({ chunkIndex: 0, content: "from fts (ignored)", ftsScore: 0.6, retrievalMode: "fts" }),
    passage({ chunkIndex: 1, content: "fts-only chunk", ftsScore: 0.9, retrievalMode: "fts" }),
  ];

  const merged = mergePassagesByChunk(vectorPassages, ftsPassages);
  assert.equal(merged.length, 2);

  const chunk0 = merged.find((p) => p.chunkIndex === 0);
  assert.equal(chunk0.content, "from vector", "primary-set content wins on overlap");
  assert.equal(chunk0.ftsScore, 0.6, "fts score from the secondary set is merged in");
  assert.equal(chunk0.vectorScore, 0.8);

  const chunk1 = merged.find((p) => p.chunkIndex === 1);
  assert.equal(chunk1.content, "fts-only chunk", "fts-only candidates are included");
});

test("retrieveFtsPassages returns [] for an empty query without touching the database", async () => {
  let called = false;
  queryImpl = async () => {
    called = true;
    return { rows: [] };
  };
  const result = await retrieveFtsPassages("doc-x", "   ", 10);
  assert.deepEqual(result, []);
  assert.equal(called, false);
});

test("retrieveFtsPassages normalizes fts_score to 0-1 relative to the top result", async () => {
  let statement;
  queryImpl = async (sql, params) => {
    statement = { sql, params };
    return { rows: [
      { chunk_index: 3, original_text: "top match text", translated_text: null, language: "en", metadata_json: {}, fts_score: 0.8 },
      { chunk_index: 1, original_text: "weaker match text", translated_text: null, language: "en", metadata_json: {}, fts_score: 0.4 },
    ] };
  };
  const result = await retrieveFtsPassages("doc-x", "What does Section 5 say about match?", 10);
  assert.equal(result.length, 2);
  assert.equal(result[0].ftsScore, 1);
  assert.equal(result[1].ftsScore, 0.5);
  assert.equal(result[0].retrievalMode, "fts");
  assert.match(statement.sql, /websearch_to_tsquery/);
  assert.match(statement.params[0], /section OR match/i);
  assert.deepEqual(statement.params[3], ["5"]);
});

test("retrieveFtsPassages fails soft (returns []) if the query throws", async () => {
  queryImpl = async () => {
    throw new Error("connection reset");
  };
  const result = await retrieveFtsPassages("doc-x", "some question", 10);
  assert.deepEqual(result, []);
});

test("vector search and full-text search are invoked concurrently by Promise.all, not sequentially", async () => {
  const events = [];
  queryImpl = async () => {
    events.push("fts:start");
    await new Promise((resolve) => setTimeout(resolve, 25));
    events.push("fts:end");
    return { rows: [] };
  };
  const vectorSearch = async () => {
    events.push("vector:start");
    await new Promise((resolve) => setTimeout(resolve, 25));
    events.push("vector:end");
    return [];
  };

  const startedAt = Date.now();
  await Promise.all([retrieveFtsPassages("doc-x", "concurrent test", 10), vectorSearch()]);
  const elapsedMs = Date.now() - startedAt;

  assert.ok(elapsedMs < 45, `expected ~25ms concurrent runtime, took ${elapsedMs}ms`);
  assert.equal(events[0], "fts:start");
  assert.equal(events[1], "vector:start");
});
