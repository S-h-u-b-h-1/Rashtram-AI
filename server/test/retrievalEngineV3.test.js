const test = require("node:test");
const assert = require("node:assert/strict");

const { QUERY_TYPES, classifyQuery, planQuery } = require("../retrieval/queryPlanner");
const { reciprocalRankFusion, canonicalChunkIdentity } = require("../retrieval/rankFusion");
const { SOURCE_AUTHORITY } = require("../retrieval/sourceAuthority");
const { selectContextPassages } = require("../retrieval/contextBuilder");
const { retrieveDocumentContext, rerankPassages } = require("../document/documentResearchService");

const passage = (overrides = {}) => ({
  passage: 1,
  score: 0.7,
  documentId: "1",
  chunkIndex: 0,
  content: "The authority shall publish its compliance report every year.",
  retrievalMode: "fts",
  sourceUrl: "https://example.org/document.pdf",
  ...overrides,
});

test("query planner deterministically covers every Retrieval V3 query type", () => {
  const fixtures = [
    ["Who published this document?", QUERY_TYPES.METADATA],
    ["What does section 14(2) state?", QUERY_TYPES.EXACT_REFERENCE],
    ["What reporting duty is stated?", QUERY_TYPES.FACTUAL],
    ["Why is this reform significant?", QUERY_TYPES.SEMANTIC],
    ["Which Act does this rule amend?", QUERY_TYPES.RELATIONSHIP],
    ["Give the implementation timeline", QUERY_TYPES.TIMELINE],
    ["Compare these two Acts", QUERY_TYPES.COMPARISON],
    ["What compliance penalties apply?", QUERY_TYPES.COMPLIANCE],
    ["Identify implementation risks and affected groups", QUERY_TYPES.POLICY_ANALYSIS],
  ];
  fixtures.forEach(([query, expected]) => assert.equal(classifyQuery(query), expected));
  assert.equal(classifyQuery("Show the timeline and effective dates"), QUERY_TYPES.TIMELINE);
  assert.equal(classifyQuery("Which authority has compliance obligations?"), QUERY_TYPES.COMPLIANCE);
  assert.equal(classifyQuery("What does clause (2) state?"), QUERY_TYPES.EXACT_REFERENCE);
  assert.equal(classifyQuery("Explain clause 2.30"), QUERY_TYPES.EXACT_REFERENCE);
  assert.equal(classifyQuery("What is section 14(2)(a)?"), QUERY_TYPES.EXACT_REFERENCE);
});

test("exact section retrieval never invokes vector search", async () => {
  let vectorCalls = 0;
  const result = await retrieveDocumentContext("bill", "1", "What does section 14(2) state?", {
    adapters: {
      ftsSearch: async () => [passage({ sectionId: "14", content: "Section 14(2) establishes the filing duty." })],
      localSearch: async () => [],
      metadataSearch: async () => [],
      vectorSearch: async () => { vectorCalls += 1; return []; },
    },
  });
  assert.equal(result.plan.queryType, QUERY_TYPES.EXACT_REFERENCE);
  assert.equal(vectorCalls, 0);
  assert.match(result.passages[0].content, /14\(2\)/);
});

test("metadata questions use structured fields without vector or lexical search", async () => {
  let vectorCalls = 0;
  let lexicalCalls = 0;
  const result = await retrieveDocumentContext("bill", "1", "Who published this document?", {
    adapters: {
      metadataSearch: async () => [passage({ chunkIndex: "metadata", content: "Ministry: Finance", retrievalMode: "metadata" })],
      ftsSearch: async () => { lexicalCalls += 1; return []; },
      localSearch: async () => [],
      vectorSearch: async () => { vectorCalls += 1; return []; },
    },
  });
  assert.equal(result.plan.queryType, QUERY_TYPES.METADATA);
  assert.equal(vectorCalls, 0);
  assert.equal(lexicalCalls, 0);
  assert.equal(result.retrievalMode, "metadata");
  assert.match(result.passages[0].content, /Finance/);
});

test("semantic and policy questions use bounded hybrid retrieval", async () => {
  let vectorCalls = 0;
  let lexicalCalls = 0;
  const result = await retrieveDocumentContext("policy", "1", "Why is this policy significant?", {
    adapters: {
      metadataSearch: async () => [],
      ftsSearch: async () => { lexicalCalls += 1; return [passage()]; },
      localSearch: async () => [],
      vectorSearch: async () => { vectorCalls += 1; return [passage({ retrievalMode: "vector", vectorScore: 0.8 })]; },
    },
  });
  assert.equal(result.plan.queryType, QUERY_TYPES.SEMANTIC);
  assert.equal(vectorCalls, 1);
  assert.equal(lexicalCalls, 1);
  assert.equal(result.retrievalMode, "hybrid");
});

test("hybrid lexical and vector candidate retrieval starts concurrently", async () => {
  const events = [];
  const wait = () => new Promise((resolve) => setTimeout(resolve, 15));
  await retrieveDocumentContext("policy", "1", "Why is this policy significant?", {
    adapters: {
      metadataSearch: async () => [],
      localSearch: async () => [],
      ftsSearch: async () => {
        events.push("lexical:start");
        await wait();
        events.push("lexical:end");
        return [passage()];
      },
      vectorSearch: async () => {
        events.push("vector:start");
        await wait();
        events.push("vector:end");
        return [passage({ retrievalMode: "vector", vectorScore: 0.8 })];
      },
    },
  });
  assert.deepEqual(events.slice(0, 2), ["lexical:start", "vector:start"]);
});

test("relationship queries request verified graph evidence as well as text evidence", () => {
  const plan = planQuery("Which Act does this notification amend?");
  assert.equal(plan.queryType, QUERY_TYPES.RELATIONSHIP);
  assert.equal(plan.useGraph, true);
  assert.equal(plan.useLexical, true);
  const graphSource = require("node:fs").readFileSync(
    require("node:path").join(__dirname, "../graph/knowledgeGraphService.js"),
    "utf8",
  );
  assert.match(graphSource, /filter\(\(relationship\) => relationship\.isVerified\)/);
});

test("RRF deduplicates canonical chunks and preserves strongest metadata", () => {
  const fused = reciprocalRankFusion([
    [passage({ content: "short", retrievalMode: "fts", ftsScore: 0.8 })],
    [passage({ content: "a longer authoritative passage", retrievalMode: "vector", vectorScore: 0.9, pageStart: 4 })],
  ], { documentId: "1", limit: 20 });
  assert.equal(fused.length, 1);
  assert.equal(fused[0].pageStart, 4);
  assert.equal(fused[0].content, "a longer authoritative passage");
  assert.deepEqual(fused[0].rankingReasons.sort(), ["fts", "vector"]);
});

test("primary authority helps relevant evidence but cannot rescue irrelevant evidence", () => {
  const relevantOfficial = reciprocalRankFusion([[
    passage({ documentId: "official", sourceUrl: "https://law.gov.in/file.pdf", ftsScore: 0.8 }),
  ]])[0];
  assert.equal(relevantOfficial.authorityClass, SOURCE_AUTHORITY.PRIMARY_OFFICIAL);
  assert.ok(relevantOfficial.authorityBoost > 0);

  const ranked = rerankPassages([
    passage({ documentId: "official", chunkIndex: 1, content: "Unrelated navigation", sourceUrl: "https://law.gov.in", authorityClass: SOURCE_AUTHORITY.PRIMARY_OFFICIAL, authorityBoost: 0 }),
    passage({ documentId: "research", chunkIndex: 2, content: "The licence reporting obligation applies annually.", ftsScore: 1, authorityClass: SOURCE_AUTHORITY.RESEARCH, authorityBoost: 0.04 }),
  ], "What licence reporting obligation applies?", { topK: 2 });
  assert.equal(ranked[0].documentId, "research");
});

test("reranking reduces a bounded fused pool to the requested final set", () => {
  const candidates = Array.from({ length: 30 }, (_, index) => passage({
    chunkIndex: index,
    content: `reporting obligation evidence ${index}`,
    ftsScore: 1 - index / 40,
  }));
  assert.equal(rerankPassages(candidates, "reporting obligation", { topK: 8 }).length, 8);
});

test("comparison identity keeps equal chunk indexes from different documents separate", () => {
  const left = passage({ documentId: "101", chunkIndex: 2 });
  const right = passage({ documentId: "202", chunkIndex: 2 });
  assert.notEqual(canonicalChunkIdentity(left), canonicalChunkIdentity(right));
  assert.equal(reciprocalRankFusion([[left], [right]], { limit: 20 }).length, 2);
});

test("Pinecone or embedding failure preserves PostgreSQL lexical evidence", async () => {
  const result = await retrieveDocumentContext("policy", "1", "Explain the implementation impact", {
    adapters: {
      ftsSearch: async () => [passage({ ftsScore: 1 })],
      localSearch: async () => [],
      metadataSearch: async () => [],
      vectorSearch: async () => { throw new Error("Pinecone unavailable"); },
    },
  });
  assert.equal(result.retrievalVerified, true);
  assert.equal(result.diagnostics.vectorDegraded, true);
  assert.equal(result.passages.length, 1);
});

test("dynamic context removes near duplicates while retaining citation coordinates", () => {
  const selected = selectContextPassages([
    passage({ pageStart: 2, content: "The authority shall publish the annual compliance report by June." }),
    passage({ pageStart: 3, content: "The authority shall publish the annual compliance report by June." }),
    passage({ pageStart: 5, content: "A penalty applies after the deadline." }),
  ], { tokenBudget: 1000 });
  assert.equal(selected.length, 2);
  assert.equal(selected[0].pageStart, 2);
  assert.equal(selected[1].pageStart, 5);
});

test("private researcher-source retrieval remains explicitly account scoped", () => {
  const source = require("node:fs").readFileSync(
    require("node:path").join(__dirname, "../research/sourceService.js"),
    "utf8",
  );
  assert.match(source, /s\.user_id = \$1/);
  assert.match(source, /s\.id = ANY\(\$2::BIGINT\[\]\)/);
  assert.match(source, /authorityClass: "USER_SOURCE"/);
});

test("legacy retrievePassages API remains exported for older callers", () => {
  const service = require("../document/documentResearchService");
  assert.equal(typeof service.retrievePassages, "function");
});
