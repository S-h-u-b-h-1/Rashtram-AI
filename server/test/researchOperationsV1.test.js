const assert = require("node:assert/strict");
const test = require("node:test");

const {
  BoundedVersionedCache,
  analysisCacheKey,
  privacyScope,
  retrievalCacheKey,
} = require("../retrieval/researchCache");
const {
  applyResearchFlags,
  resolveResearchFlags,
} = require("../retrieval/featureFlags");
const {
  normalizeTelemetry,
  recordResearchTelemetry,
} = require("../retrieval/researchTelemetry");
const observabilityMigration = require("../migrations/031_research_query_observability");

test("bounded caches expire, clone values, and evict oldest entries", () => {
  const cache = new BoundedVersionedCache({ name: "test", maxEntries: 2, ttlMs: 10 });
  const originalNow = Date.now;
  let now = 100;
  Date.now = () => now;
  try {
    cache.set("a", { nested: { value: 1 } });
    const first = cache.get("a");
    first.nested.value = 9;
    assert.equal(cache.get("a").nested.value, 1);
    cache.set("b", 2);
    cache.set("c", 3);
    assert.equal(cache.get("a"), null);
    now = 200;
    assert.equal(cache.get("b"), null);
    assert.ok(cache.stats().evictions >= 1);
  } finally {
    Date.now = originalNow;
  }
});

test("retrieval cache keys change with evidence versions and isolate private accounts", () => {
  const base = {
    query: "What does section 4 require?", documentId: "1", documentType: "act",
    documentVersion: "doc-v1", resourceHash: "hash-v1", topK: 6,
    plan: { queryType: "EXACT_REFERENCE" },
    versions: {
      retrievalVersion: "retrieval-v3.0", embeddingVersion: "embed-v1",
      rerankerVersion: "rerank-v1", authorityConfigVersion: "authority-v1",
    },
  };
  assert.notEqual(retrievalCacheKey(base), retrievalCacheKey({ ...base, resourceHash: "hash-v2" }));
  assert.notEqual(
    retrievalCacheKey({ ...base, userId: "1", privateSourceIds: ["private-a"] }),
    retrievalCacheKey({ ...base, userId: "2", privateSourceIds: ["private-a"] }),
  );
  assert.equal(privacyScope({ privateSourceIds: ["private-a"] }), null);
  assert.equal(retrievalCacheKey({ ...base, documentVersion: null }), null);
});

test("safe repeat analyses require model, prompt, evidence and account identity", () => {
  const base = {
    kind: "comparison", userId: "7", documentIds: ["2", "1"], mode: "full",
    language: "english", question: "Compare them", model: "gemini-flash",
    promptVersion: "comparison-v3", evidenceHash: "evidence-a",
    versions: { retrievalVersion: "v3" },
  };
  assert.ok(analysisCacheKey(base));
  assert.equal(analysisCacheKey({ ...base, evidenceHash: null }), null);
  assert.notEqual(analysisCacheKey(base), analysisCacheKey({ ...base, evidenceHash: "evidence-b" }));
  assert.notEqual(analysisCacheKey(base), analysisCacheKey({ ...base, userId: "8" }));
});

test("rollout flags are deterministic and retain a legacy path", () => {
  const all = resolveResearchFlags({ actorId: "account-1", env: { RESEARCH_V3_ROLLOUT_PERCENT: "100" } });
  assert.equal(all.queryPlanner, true);
  assert.equal(all.legacyPathAvailable, true);
  const none = resolveResearchFlags({ actorId: "account-1", env: { RESEARCH_V3_ROLLOUT_PERCENT: "0" } });
  assert.equal(none.queryPlanner, false);
  const legacy = applyResearchFlags({ queryType: "METADATA", useMetadata: true }, none);
  assert.equal(legacy.plannerVersion, "legacy-hybrid-planner-v1");
  assert.equal(legacy.useVector, true);
});

test("telemetry is bounded and never accepts raw question or source text fields", async () => {
  const normalized = normalizeTelemetry({
    queryId: "not-a-uuid", queryType: "FACTUAL", rawQuestion: "private question",
    sourceText: "private document", topScores: Array.from({ length: 30 }, (_, index) => index),
    flags: { caching: true },
  });
  assert.match(normalized.queryId, /^[0-9a-f-]{36}$/);
  assert.equal(normalized.rawQuestion, undefined);
  assert.equal(normalized.sourceText, undefined);
  assert.equal(normalized.topScores.length, 10);
  let capturedSql = "";
  let capturedParameters = [];
  const written = await recordResearchTelemetry({
    queryType: "FACTUAL", rawQuestion: "do not persist me", model: "gemini",
  }, async (sql, parameters = []) => {
    capturedSql = sql;
    capturedParameters = parameters;
    return { rows: [] };
  });
  assert.equal(written, true);
  assert.doesNotMatch(capturedSql, /raw_question|source_text/i);
  assert.doesNotMatch(JSON.stringify(capturedParameters), /do not persist me/i);
});

test("observability migration is indexed and excludes raw research content", () => {
  const calls = [];
  observabilityMigration.up({ query: async (sql) => calls.push(sql) });
  const sql = calls.join("\n");
  assert.match(sql, /research_query_telemetry_created_idx/);
  assert.match(sql, /query_type, created_at DESC/);
  assert.doesNotMatch(sql, /raw_question|source_text|assistant_answer/i);
});
