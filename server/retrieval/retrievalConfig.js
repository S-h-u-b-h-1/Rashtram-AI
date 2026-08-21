const boundedInteger = (value, fallback, minimum, maximum) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed)
    ? Math.min(maximum, Math.max(minimum, parsed))
    : fallback;
};

const retrievalConfig = () => ({
  lexicalCandidates: boundedInteger(process.env.RETRIEVAL_LEXICAL_CANDIDATES, 30, 20, 40),
  vectorCandidates: boundedInteger(process.env.RETRIEVAL_VECTOR_CANDIDATES, 30, 20, 40),
  exactCandidates: boundedInteger(process.env.RETRIEVAL_EXACT_CANDIDATES, 15, 10, 20),
  fusedCandidates: boundedInteger(process.env.RETRIEVAL_FUSED_CANDIDATES, 24, 15, 30),
  finalPassages: boundedInteger(process.env.RETRIEVAL_FINAL_PASSAGES, 8, 5, 10),
  minimumLexicalEvidence: boundedInteger(process.env.RETRIEVAL_MIN_LEXICAL_EVIDENCE, 3, 1, 8),
  graphCandidates: boundedInteger(process.env.RETRIEVAL_GRAPH_CANDIDATES, 8, 3, 12),
  rrfK: boundedInteger(process.env.RETRIEVAL_RRF_K, 60, 20, 100),
  contextTokenBudget: boundedInteger(process.env.RETRIEVAL_CONTEXT_TOKEN_BUDGET, 5000, 1500, 9000),
  vectorTimeBudgetMs: boundedInteger(process.env.RETRIEVAL_VECTOR_TIME_BUDGET_MS, 2500, 500, 10000),
  versions: {
    retrieval: "retrieval-v3.0",
    retrievalVersion: "retrieval-v3.0",
    fusion: "rrf-v1",
    reranker: "deterministic-reranker-v2",
    rerankerVersion: "deterministic-reranker-v2",
    chunkingVersion: "legal-multilingual-chunking-v2",
    authorityConfigVersion: "authority-config-v1",
  },
});

const candidateLimitsFor = (queryType, config = retrievalConfig()) => {
  const bounded = (value, maximum) => Math.min(Number(value), maximum);
  const profiles = {
    FACTUAL: { lexical: 24, vector: 20, fused: 20 },
    SEMANTIC: { lexical: 30, vector: 24, fused: 24 },
    RELATIONSHIP: { lexical: 24, vector: 20, fused: 20 },
    TIMELINE: { lexical: 24, vector: 20, fused: 20 },
    COMPARISON: { lexical: 30, vector: 30, fused: 24 },
    COMPLIANCE: { lexical: 30, vector: 24, fused: 24 },
    POLICY_ANALYSIS: { lexical: 30, vector: 24, fused: 24 },
  };
  const profile = profiles[queryType] || {
    lexical: config.lexicalCandidates,
    vector: config.vectorCandidates,
    fused: config.fusedCandidates,
  };
  return {
    lexical: bounded(config.lexicalCandidates, profile.lexical),
    vector: bounded(config.vectorCandidates, profile.vector),
    fused: bounded(config.fusedCandidates, profile.fused),
  };
};

module.exports = { candidateLimitsFor, retrievalConfig };
