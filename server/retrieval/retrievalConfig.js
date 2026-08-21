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

module.exports = { retrievalConfig };
