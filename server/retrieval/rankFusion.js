const { authorityAdjustment, classifySourceAuthority } = require("./sourceAuthority");

const canonicalChunkIdentity = (passage = {}) => [
  String(passage.documentId || "document"),
  passage.chunkIndex == null ? String(passage.id || passage.vectorId || passage.passage || "unknown") : String(passage.chunkIndex),
].join(":");

const richerValue = (left, right) => {
  if (left == null || left === "") return right;
  if (right == null || right === "") return left;
  if (typeof left === "string" && typeof right === "string") {
    return right.length > left.length ? right : left;
  }
  return left;
};

const SCORE_FIELDS = new Set([
  "score", "vectorScore", "ftsScore", "lexicalScore", "identifierBoost",
]);

const reciprocalRankFusion = (rankedLists, options = {}) => {
  const k = Math.max(1, Number(options.k || 60));
  const limit = Math.max(1, Number(options.limit || 24));
  const byIdentity = new Map();
  for (const list of rankedLists.filter(Array.isArray)) {
    list.forEach((passage, index) => {
      const identity = canonicalChunkIdentity(passage);
      const existing = byIdentity.get(identity) || {
        ...passage,
        documentId: passage.documentId == null ? options.documentId : passage.documentId,
        rrfScore: 0,
        rankingReasons: [],
      };
      for (const [key, value] of Object.entries(passage)) {
        existing[key] = SCORE_FIELDS.has(key)
          ? Math.max(Number(existing[key] || 0), Number(value || 0))
          : richerValue(existing[key], value);
      }
      existing.rrfScore += 1 / (k + index + 1);
      const mode = passage.retrievalMode || "candidate";
      if (!existing.rankingReasons.includes(mode)) existing.rankingReasons.push(mode);
      byIdentity.set(identity, existing);
    });
  }
  return [...byIdentity.values()]
    .map((passage) => {
      const authorityClass = passage.authorityClass || classifySourceAuthority(passage);
      const relevance = Math.max(
        Number(passage.vectorScore || 0), Number(passage.ftsScore || 0),
        Number(passage.lexicalScore || 0), Number(passage.score || 0),
      );
      const authorityBoost = options.useAuthority === false
        ? 0
        : authorityAdjustment(authorityClass, relevance);
      return {
        ...passage,
        authorityClass,
        authorityBoost,
        score: Number(passage.rrfScore || 0) + authorityBoost,
      };
    })
    .sort((left, right) => right.score - left.score || Number(left.chunkIndex || 0) - Number(right.chunkIndex || 0))
    .slice(0, limit);
};

const legacyCandidateMerge = (rankedLists, options = {}) => {
  const byIdentity = new Map();
  for (const list of rankedLists.filter(Array.isArray)) {
    for (const passage of list) {
      const identity = canonicalChunkIdentity(passage);
      const existing = byIdentity.get(identity) || {
        ...passage,
        documentId: passage.documentId == null ? options.documentId : passage.documentId,
        rankingReasons: [],
      };
      for (const [key, value] of Object.entries(passage)) {
        existing[key] = SCORE_FIELDS.has(key)
          ? Math.max(Number(existing[key] || 0), Number(value || 0))
          : richerValue(existing[key], value);
      }
      const mode = passage.retrievalMode || "candidate";
      if (!existing.rankingReasons.includes(mode)) existing.rankingReasons.push(mode);
      byIdentity.set(identity, existing);
    }
  }
  return [...byIdentity.values()].map((passage) => {
    const authorityClass = passage.authorityClass || classifySourceAuthority(passage);
    const relevance = Math.max(
      Number(passage.vectorScore || 0), Number(passage.ftsScore || 0),
      Number(passage.lexicalScore || 0), Number(passage.score || 0),
    );
    const authorityBoost = options.useAuthority === false ? 0 : authorityAdjustment(authorityClass, relevance);
    return { ...passage, authorityClass, authorityBoost, score: relevance + authorityBoost };
  }).sort((left, right) => right.score - left.score)
    .slice(0, Math.max(1, Number(options.limit || 24)));
};

module.exports = { canonicalChunkIdentity, legacyCandidateMerge, reciprocalRankFusion };
