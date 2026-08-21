const crypto = require("node:crypto");

const normalize = (value) => String(value || "")
  .normalize("NFKC").toLowerCase().replace(/\s+/g, " ").trim();

const stableHash = (value) => crypto.createHash("sha256")
  .update(typeof value === "string" ? value : JSON.stringify(value))
  .digest("hex");

class BoundedVersionedCache {
  constructor({ name, maxEntries = 250, ttlMs = 60_000 } = {}) {
    this.name = name || "cache";
    this.maxEntries = Math.max(1, Number(maxEntries) || 250);
    this.ttlMs = Math.max(1, Number(ttlMs) || 60_000);
    this.entries = new Map();
    this.metrics = { hits: 0, misses: 0, writes: 0, evictions: 0 };
  }

  get(key) {
    const entry = this.entries.get(key);
    if (!entry || entry.expiresAt <= Date.now()) {
      if (entry) this.entries.delete(key);
      this.metrics.misses += 1;
      return null;
    }
    this.entries.delete(key);
    this.entries.set(key, entry);
    this.metrics.hits += 1;
    return structuredClone(entry.value);
  }

  set(key, value, ttlMs = this.ttlMs) {
    if (!key || value == null) return;
    if (this.entries.has(key)) this.entries.delete(key);
    this.entries.set(key, {
      value: structuredClone(value),
      expiresAt: Date.now() + Math.max(1, Number(ttlMs) || this.ttlMs),
    });
    this.metrics.writes += 1;
    while (this.entries.size > this.maxEntries) {
      this.entries.delete(this.entries.keys().next().value);
      this.metrics.evictions += 1;
    }
  }

  clear() { this.entries.clear(); }

  stats() {
    return { name: this.name, entries: this.entries.size, ...this.metrics };
  }
}

const caches = {
  catalogue: new BoundedVersionedCache({ name: "catalogue", maxEntries: 200, ttlMs: 30_000 }),
  retrieval: new BoundedVersionedCache({ name: "retrieval", maxEntries: 300, ttlMs: 5 * 60_000 }),
  analysis: new BoundedVersionedCache({ name: "safe_repeat_analysis", maxEntries: 100, ttlMs: 10 * 60_000 }),
  queryEmbedding: new BoundedVersionedCache({ name: "query_embedding", maxEntries: 500, ttlMs: 10 * 60_000 }),
};
const queryEmbeddingInflight = new Map();
const MAX_QUERY_EMBEDDING_INFLIGHT = 100;

const queryEmbeddingCacheKey = ({ query, provider, model, version, dimension } = {}) => {
  const normalizedQuery = normalize(query);
  if (!normalizedQuery || !model || !version) return null;
  return stableHash({
    kind: "query_embedding",
    normalizedQueryHash: stableHash(normalizedQuery),
    provider: String(provider || "unknown"),
    model: String(model),
    version: String(version),
    dimension: Number(dimension || 0),
  });
};

const getOrCreateQueryEmbedding = async (options, factory) => {
  if (typeof factory !== "function") {
    throw new TypeError("Query embedding factory is required");
  }
  const key = queryEmbeddingCacheKey(options);
  if (!key) {
    return { embedding: await factory(), cacheStatus: "bypass" };
  }
  const cached = caches.queryEmbedding.get(key);
  if (cached) return { embedding: cached, cacheStatus: "hit" };
  const inFlight = queryEmbeddingInflight.get(key);
  if (inFlight) return { embedding: await inFlight, cacheStatus: "coalesced" };
  if (queryEmbeddingInflight.size >= MAX_QUERY_EMBEDDING_INFLIGHT) {
    return { embedding: await factory(), cacheStatus: "bypass_capacity" };
  }
  const pending = Promise.resolve().then(factory);
  queryEmbeddingInflight.set(key, pending);
  try {
    const embedding = await pending;
    caches.queryEmbedding.set(key, embedding);
    return { embedding, cacheStatus: "miss" };
  } finally {
    queryEmbeddingInflight.delete(key);
  }
};

const privacyScope = ({ userId, privateSourceIds = [] } = {}) => {
  const privateIds = [...new Set((privateSourceIds || []).map(String))].sort();
  if (!privateIds.length) return "public";
  if (!userId) return null;
  return `account:${stableHash(String(userId)).slice(0, 16)}:sources:${stableHash(privateIds).slice(0, 16)}`;
};

const retrievalCacheKey = ({
  query, documentId, documentType, documentVersion, resourceHash, topK,
  plan, versions, userId, privateSourceIds,
} = {}) => {
  const scope = privacyScope({ userId, privateSourceIds });
  if (!scope || !documentVersion || !versions?.retrievalVersion) return null;
  return stableHash({
    kind: "retrieval",
    queryFingerprint: stableHash(normalize(query)),
    documentId: String(documentId),
    documentType: String(documentType || "document"),
    documentVersion: String(documentVersion),
    resourceHash: String(resourceHash || "none"),
    topK: Number(topK),
    queryType: plan?.queryType,
    queryPlannerVersion: plan?.plannerVersion,
    scope,
    retrievalVersion: versions.retrievalVersion,
    fusionVersion: versions.fusion,
    embeddingVersion: versions.embeddingVersion,
    rerankerVersion: versions.rerankerVersion,
    authorityConfigVersion: versions.authorityConfigVersion,
  });
};

const analysisCacheKey = ({
  kind, userId, documentIds, mode, language, question, model,
  promptVersion, evidenceHash, versions,
} = {}) => {
  if (!userId || !evidenceHash || !model || !promptVersion) return null;
  return stableHash({
    kind: kind || "analysis",
    account: stableHash(String(userId)).slice(0, 16),
    documents: [...new Set((documentIds || []).map(String))].sort(),
    mode, language,
    queryFingerprint: stableHash(normalize(question)),
    model, promptVersion, evidenceHash,
    retrievalVersion: versions?.retrievalVersion,
    embeddingVersion: versions?.embeddingVersion,
    rerankerVersion: versions?.rerankerVersion,
    authorityConfigVersion: versions?.authorityConfigVersion,
  });
};

const cacheStats = () => Object.fromEntries(
  Object.entries(caches).map(([name, cache]) => [name, cache.stats()]),
);

module.exports = {
  BoundedVersionedCache,
  analysisCacheKey,
  cacheStats,
  caches,
  getOrCreateQueryEmbedding,
  normalize,
  privacyScope,
  queryEmbeddingCacheKey,
  retrievalCacheKey,
  stableHash,
};
