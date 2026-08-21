const crypto = require("node:crypto");
const { query } = require("../db");

const bounded = (value, maximum = 50) => Array.isArray(value) ? value.slice(0, maximum) : [];
const integer = (value) => Number.isFinite(Number(value)) ? Math.max(0, Math.round(Number(value))) : 0;
const safeObject = (value) => value && typeof value === "object" && !Array.isArray(value) ? value : {};

const validUuid = (value) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || ""));

const normalizeTelemetry = (value = {}) => ({
  queryId: validUuid(value.queryId) ? String(value.queryId) : crypto.randomUUID(),
  queryType: String(value.queryType || "UNKNOWN").slice(0, 50),
  queryPlannerVersion: String(value.queryPlannerVersion || "unknown").slice(0, 100),
  privacyScope: ["public", "account_private"].includes(value.privacyScope) ? value.privacyScope : "public",
  metadataLatency: integer(value.metadataLatency), ftsLatency: integer(value.ftsLatency),
  vectorLatency: integer(value.vectorLatency), graphLatency: integer(value.graphLatency),
  fusionLatency: integer(value.fusionLatency), rerankLatency: integer(value.rerankLatency),
  generationLatency: integer(value.generationLatency), verificationLatency: integer(value.verificationLatency),
  lexicalCandidateCount: integer(value.lexicalCandidateCount),
  vectorCandidateCount: integer(value.vectorCandidateCount), fusedCandidateCount: integer(value.fusedCandidateCount),
  finalEvidenceCount: integer(value.finalEvidenceCount),
  sourceAuthorityDistribution: safeObject(value.sourceAuthorityDistribution),
  topScores: bounded(value.topScores, 10).map(Number).filter(Number.isFinite),
  evidenceSufficiencyLevel: String(value.evidenceSufficiencyLevel || "UNKNOWN").slice(0, 30),
  citationsGenerated: integer(value.citationsGenerated), citationsVerified: integer(value.citationsVerified),
  unsupportedClaimsRemoved: integer(value.unsupportedClaimsRemoved),
  abstained: Boolean(value.abstained), fallbackUsed: Boolean(value.fallbackUsed),
  tokensIn: integer(value.tokensIn), tokensOut: integer(value.tokensOut),
  model: String(value.model || "unknown").slice(0, 120),
  embeddingModel: String(value.embeddingModel || "unknown").slice(0, 120),
  retrievalVersion: String(value.retrievalVersion || "unknown").slice(0, 100),
  cacheStatus: ["hit", "miss", "bypass"].includes(value.cacheStatus) ? value.cacheStatus : "bypass",
  flags: safeObject(value.flags),
});

let writeCount = 0;
const recordResearchTelemetry = async (value, writer = query) => {
  const item = normalizeTelemetry(value);
  try {
    await writer(
      `INSERT INTO research_query_telemetry (
         query_id, query_type, query_planner_version, privacy_scope,
         metadata_latency_ms, fts_latency_ms, vector_latency_ms, graph_latency_ms,
         fusion_latency_ms, rerank_latency_ms, generation_latency_ms, verification_latency_ms,
         lexical_candidate_count, vector_candidate_count, fused_candidate_count, final_evidence_count,
         source_authority_distribution, top_scores, evidence_sufficiency_level,
         citations_generated, citations_verified, unsupported_claims_removed,
         abstained, fallback_used, tokens_in, tokens_out, model, embedding_model,
         retrieval_version, cache_status, flags_json
       ) VALUES (
         $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,
         $17::jsonb,$18::jsonb,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$30,$31::jsonb
       )`,
      [
        item.queryId, item.queryType, item.queryPlannerVersion, item.privacyScope,
        item.metadataLatency, item.ftsLatency, item.vectorLatency, item.graphLatency,
        item.fusionLatency, item.rerankLatency, item.generationLatency, item.verificationLatency,
        item.lexicalCandidateCount, item.vectorCandidateCount, item.fusedCandidateCount,
        item.finalEvidenceCount, JSON.stringify(item.sourceAuthorityDistribution),
        JSON.stringify(item.topScores), item.evidenceSufficiencyLevel,
        item.citationsGenerated, item.citationsVerified, item.unsupportedClaimsRemoved,
        item.abstained, item.fallbackUsed, item.tokensIn, item.tokensOut, item.model,
        item.embeddingModel, item.retrievalVersion, item.cacheStatus, JSON.stringify(item.flags),
      ],
    );
    writeCount += 1;
    if (writeCount % 100 === 0) {
      await writer(`DELETE FROM research_query_telemetry WHERE id IN (
        SELECT id FROM research_query_telemetry
        WHERE created_at < NOW() - INTERVAL '30 days'
        ORDER BY created_at ASC LIMIT 500
      )`);
    }
    return true;
  } catch (error) {
    console.warn("[research-telemetry] write unavailable", { queryId: item.queryId, code: error.code || null });
    return false;
  }
};

const getResearchTelemetrySummary = async () => {
  const result = await query(`
    SELECT query_type, COUNT(*)::INTEGER AS queries,
      ROUND(AVG(fts_latency_ms))::INTEGER AS fts_ms,
      ROUND(AVG(vector_latency_ms))::INTEGER AS vector_ms,
      ROUND(AVG(graph_latency_ms))::INTEGER AS graph_ms,
      ROUND(AVG(rerank_latency_ms))::INTEGER AS rerank_ms,
      ROUND(AVG(generation_latency_ms))::INTEGER AS generation_ms,
      ROUND(AVG(verification_latency_ms))::INTEGER AS verification_ms,
      ROUND(AVG(final_evidence_count), 2) AS final_evidence,
      SUM(citations_generated)::INTEGER AS citations_generated,
      SUM(citations_verified)::INTEGER AS citations_verified,
      SUM(unsupported_claims_removed)::INTEGER AS unsupported_claims_removed,
      COUNT(*) FILTER (WHERE abstained)::INTEGER AS abstained,
      COUNT(*) FILTER (WHERE fallback_used)::INTEGER AS fallbacks,
      COUNT(*) FILTER (WHERE cache_status = 'hit')::INTEGER AS cache_hits
    FROM research_query_telemetry
    WHERE created_at >= NOW() - INTERVAL '24 hours'
    GROUP BY query_type ORDER BY queries DESC, query_type
  `);
  return { window: "24h", byQueryType: result.rows.map((row) => ({
    queryType: row.query_type, queries: integer(row.queries),
    latencyMs: { fts: integer(row.fts_ms), vector: integer(row.vector_ms), graph: integer(row.graph_ms), rerank: integer(row.rerank_ms), generation: integer(row.generation_ms), verification: integer(row.verification_ms) },
    averageFinalEvidence: Number(row.final_evidence || 0),
    citationsGenerated: integer(row.citations_generated), citationsVerified: integer(row.citations_verified),
    unsupportedClaimsRemoved: integer(row.unsupported_claims_removed), abstained: integer(row.abstained),
    fallbacks: integer(row.fallbacks), cacheHits: integer(row.cache_hits),
  })) };
};

module.exports = { getResearchTelemetrySummary, normalizeTelemetry, recordResearchTelemetry };
