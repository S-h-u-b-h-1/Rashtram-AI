const { query } = require("../db");
const { providerConfig } = require("../lib/vectordb");

const COVERAGE_CACHE_TTL_MS = 5 * 60 * 1_000;
let coverageCache = null;

const PRIMARY_SOURCE_PATTERN = /(?:india[- ]?code|egazette|parliament|rbi|sebi|irdai|pfrda|trai|cci|ministry|state[- ]?(?:gazette|legislature)|regulator)/i;

const authorityWeight = (tier) => ({ A: 240, B: 160, C: 80, D: 20 }[
  String(tier || "").toUpperCase()
] || 50);

const documentTypeWeight = (type) => ({
  act: 120,
  regulation: 120,
  rule: 115,
  notification: 110,
  gazette: 110,
  circular: 105,
  order: 100,
  bill: 90,
  ordinance: 90,
  policy: 80,
  guideline: 75,
  consultation_paper: 60,
  committee_report: 55,
  report: 40,
}[String(type || "").toLowerCase()] || 35);

const semanticPriority = (document, now = new Date()) => {
  const demand7d = Math.max(0, Number(document.demand7d || 0));
  const demand30d = Math.max(0, Number(document.demand30d || 0));
  const comparison30d = Math.max(0, Number(document.comparison30d || 0));
  const knowledgeLinks = Math.max(0, Number(document.knowledgeLinks || 0));
  const year = Number(document.year || 0);
  const currentYear = now.getUTCFullYear();
  const source = String(document.source || "");
  const sourcePriority = Number(document.sourcePriority);
  const qualityScore = Math.max(0, Math.min(1, Number(document.qualityScore || 0)));
  const explicitDemand = Boolean(document.explicitDemand);

  let score = authorityWeight(document.authorityTier) + documentTypeWeight(document.documentType);
  if (PRIMARY_SOURCE_PATTERN.test(source)) score += 150;
  if (year >= currentYear) score += 120;
  else if (year === currentYear - 1) score += 80;
  else if (year >= currentYear - 5) score += 40;
  if (Number.isFinite(sourcePriority)) score += Math.max(0, 80 - sourcePriority);
  score += Math.min(160, demand30d * 20);
  score += Math.min(120, comparison30d * 30);
  score += Math.min(50, knowledgeLinks * 10);
  score += Math.round(qualityScore * 50);
  if (explicitDemand) score += 1_000;

  const tier = explicitDemand || demand7d > 0
    ? "P0"
    : score >= 390 || String(document.authorityTier || "").toUpperCase() === "A"
      ? "P1"
      : score >= 220 || demand30d > 0 || comparison30d > 0
        ? "P2"
        : "P3";
  return { tier, score };
};

const publicBackfillEligible = (document) => Boolean(
  document &&
  document.visibilityStatus === "public" &&
  document.searchReady &&
  document.hasChunks &&
  document.retryEligible !== false,
);

const classifyCoverageReason = (row) => {
  if (Number(row.chunk_count || 0) === 0) return "MISSING_CHUNKS";
  if (Number(row.active_vector_refs || 0) > 0 && row.retrieval_verified) {
    return "ACTIVE_NAMESPACE_RECORDED";
  }
  if (Number(row.active_vector_refs || 0) > 0) return "RETRIEVAL_VERIFICATION_REQUIRED";
  if (Number(row.old_namespace_chunks || 0) > 0) return "OLD_NAMESPACE";
  if (Number(row.unversioned_chunks || 0) > 0 && row.embedding_status === "ready") {
    return "OLD_NAMESPACE_UNVERSIONED";
  }
  if (Number(row.active_namespace_chunks || 0) > 0) return "MISSING_VECTOR_RECORD";
  if (row.embedding_status === "fallback" || row.retrieval_mode === "local_text") {
    return "NO_ACTIVE_EMBEDDING_ATTEMPT";
  }
  if (["pending", "processing", "queued"].includes(row.embedding_status)) {
    return "PROCESSING_PENDING";
  }
  if (["failed", "error"].includes(row.embedding_status)) {
    return row.retry_eligible === false
      ? "EMBEDDING_FAILED_PERMANENT"
      : "EMBEDDING_FAILED_RETRYABLE";
  }
  if (Number(row.missing_embedding_hashes || 0) > 0) return "HASH_MISMATCH";
  if (Number(row.text_length || 0) < 200) return "LOW_QUALITY_TEXT";
  if (!row.embedding_status || ["not_started", "missing"].includes(row.embedding_status)) {
    return "NO_EMBEDDING_ATTEMPT";
  }
  return "UNKNOWN";
};

const coverageRows = async ({ queryFn = query, activeNamespace = providerConfig().vectorNamespace } = {}) => {
  const result = await queryFn(
    `WITH chunk_state AS (
       SELECT document_id,
         COUNT(*)::INTEGER AS chunk_count,
         COUNT(*) FILTER (WHERE embedding_namespace = $1)::INTEGER AS active_namespace_chunks,
         COUNT(*) FILTER (
           WHERE embedding_namespace = $1
             AND vector_reference IS NOT NULL AND vector_reference <> ''
         )::INTEGER AS active_vector_refs,
         COUNT(*) FILTER (
           WHERE embedding_namespace IS NOT NULL AND embedding_namespace <> $1
         )::INTEGER AS old_namespace_chunks,
         COUNT(*) FILTER (WHERE embedding_namespace IS NULL)::INTEGER AS unversioned_chunks,
         COUNT(*) FILTER (
           WHERE embedding_input_sha256 IS NULL OR embedding_input_sha256 = ''
         )::INTEGER AS missing_embedding_hashes
       FROM document_text_chunks GROUP BY document_id
     )
     SELECT d.id, d.document_type, d.year, d.source_authority_tier,
       d.source_priority, d.quality_score, d.visibility_status,
       COALESCE(NULLIF(legacy.canonical_source, ''), NULLIF(legacy.source_name, ''), 'unknown') AS source,
       COALESCE(d.jurisdiction, 'unknown') AS jurisdiction,
       state.resource_ready, state.text_ready, state.search_ready,
       state.semantic_ready, state.chat_ready,
       state.capability_comparison_ready AS comparison_ready,
       state.embedding_status, state.retrieval_mode, state.retrieval_verified,
       state.retry_eligible, state.text_length,
       COALESCE(chunk.chunk_count, 0)::INTEGER AS chunk_count,
       COALESCE(chunk.active_namespace_chunks, 0)::INTEGER AS active_namespace_chunks,
       COALESCE(chunk.active_vector_refs, 0)::INTEGER AS active_vector_refs,
       COALESCE(chunk.old_namespace_chunks, 0)::INTEGER AS old_namespace_chunks,
       COALESCE(chunk.unversioned_chunks, 0)::INTEGER AS unversioned_chunks,
       COALESCE(chunk.missing_embedding_hashes, 0)::INTEGER AS missing_embedding_hashes
     FROM documents d
     LEFT JOIN legislative_documents legacy ON legacy.id = d.id
     LEFT JOIN document_processing_state state ON state.document_id = d.id
     LEFT JOIN chunk_state chunk ON chunk.document_id = d.id
     WHERE d.visibility_status = 'public'`,
    [activeNamespace],
  );
  return result.rows;
};

const demandWeightedCoverage = async ({
  queryFn = query,
  activeNamespace = providerConfig().vectorNamespace,
} = {}) => {
  const result = await queryFn(`
    WITH demand AS (
      SELECT document_id, COUNT(*)::NUMERIC AS weight
      FROM user_activity_events
      WHERE document_id IS NOT NULL
        AND created_at >= NOW() - INTERVAL '30 days'
      GROUP BY document_id
    ), active AS (
      SELECT document_id
      FROM document_text_chunks
      GROUP BY document_id
      HAVING COUNT(*) FILTER (
        WHERE embedding_namespace = $1
          AND vector_reference IS NOT NULL AND vector_reference <> ''
      ) = COUNT(*)
    )
    SELECT COUNT(*)::INTEGER AS demanded_documents,
      COALESCE(SUM(weight), 0)::INTEGER AS demand_events,
      COALESCE(SUM(weight) FILTER (
        WHERE state.semantic_ready AND state.retrieval_verified
          AND active.document_id IS NOT NULL
      ), 0)::INTEGER
        AS semantic_demand_events
    FROM demand
    JOIN documents document ON document.id = demand.document_id
    JOIN document_processing_state state ON state.document_id = document.id
    LEFT JOIN active ON active.document_id = document.id
    WHERE document.visibility_status = 'public'
  `, [activeNamespace]);
  const row = result.rows[0] || {};
  const total = Number(row.demand_events || 0);
  const covered = Number(row.semantic_demand_events || 0);
  return {
    windowDays: 30,
    demandedDocuments: Number(row.demanded_documents || 0),
    demandEvents: total,
    semanticDemandEvents: covered,
    percent: total > 0 ? Number(((covered / total) * 100).toFixed(2)) : null,
    available: total > 0,
    rawQueriesUsed: false,
  };
};

const summarizeCoverage = (rows, activeNamespace) => {
  const searchReady = rows.filter((row) => row.search_ready);
  const active = searchReady.filter((row) =>
    Number(row.chunk_count || 0) > 0 &&
    Number(row.active_vector_refs || 0) >= Number(row.chunk_count || 0) &&
    Number(row.active_namespace_chunks || 0) >= Number(row.chunk_count || 0) &&
    row.retrieval_verified && row.semantic_ready);
  const activeIds = new Set(active.map((row) => String(row.id)));
  const backlog = searchReady.filter((row) => !activeIds.has(String(row.id)));
  const reasons = {};
  const priorities = { P0: 0, P1: 0, P2: 0, P3: 0 };
  let namespaceMismatchCount = 0;
  let staleOrUnversionedVectorReferenceCount = 0;
  for (const row of backlog) {
    const reason = classifyCoverageReason(row);
    reasons[reason] = (reasons[reason] || 0) + 1;
    if (["OLD_NAMESPACE", "OLD_NAMESPACE_UNVERSIONED"].includes(reason)) {
      namespaceMismatchCount += 1;
      staleOrUnversionedVectorReferenceCount +=
        Number(row.old_namespace_chunks || 0) + Number(row.unversioned_chunks || 0);
    }
    const priority = semanticPriority({
      authorityTier: row.source_authority_tier,
      documentType: row.document_type,
      source: row.source,
      sourcePriority: row.source_priority,
      qualityScore: row.quality_score,
      year: row.year,
    });
    priorities[priority.tier] += 1;
  }
  const group = (field) => Object.values(searchReady.reduce((map, row) => {
    const key = String(row[field] || "unknown");
    const value = map[key] || { value: key, searchReady: 0, activeSemantic: 0, backlog: 0 };
    value.searchReady += 1;
    if (activeIds.has(String(row.id))) value.activeSemantic += 1;
    else value.backlog += 1;
    map[key] = value;
    return map;
  }, {})).sort((a, b) => b.searchReady - a.searchReady);
  return {
    activeNamespace,
    totalCatalogue: rows.length,
    resourceReady: rows.filter((row) => row.resource_ready).length,
    textReady: rows.filter((row) => row.text_ready).length,
    searchReady: searchReady.length,
    capabilityMarkedSemanticReady: rows.filter((row) => row.semantic_ready).length,
    activeSemanticDocuments: active.length,
    activeVectorDocuments: active.length,
    postgresActiveVectorChunks: active.reduce(
      (sum, row) => sum + Number(row.active_vector_refs || 0), 0),
    activeVectorChunks: active.reduce(
      (sum, row) => sum + Number(row.active_vector_refs || 0), 0),
    activeVectorChunkSource: "PostgreSQL active-namespace references; direct Pinecone census is emitted by semantic:audit.",
    semanticCoveragePercent: searchReady.length
      ? Number(((active.length / searchReady.length) * 100).toFixed(2))
      : 0,
    searchReadyWithoutActiveSemantic: searchReady.length - active.length,
    backlogReasons: reasons,
    embeddingBacklogByPriority: priorities,
    namespaceMismatchCount,
    staleVectorCount: staleOrUnversionedVectorReferenceCount,
    staleVectorCountMethod: "PostgreSQL references with old or absent namespace metadata; Pinecone cleanup remains explicit and non-destructive.",
    breakdowns: {
      source: group("source"),
      authorityClass: group("source_authority_tier"),
      documentType: group("document_type"),
      year: group("year"),
      jurisdiction: group("jurisdiction"),
    },
  };
};

const getSemanticCoverageReport = async (options = {}) => {
  const cacheable = !options.queryFn && !options.activeNamespace;
  if (cacheable && coverageCache && Date.now() - coverageCache.createdAt < COVERAGE_CACHE_TTL_MS) {
    return structuredClone(coverageCache.value);
  }
  const activeNamespace = options.activeNamespace || providerConfig().vectorNamespace;
  const [rows, demand] = await Promise.all([
    coverageRows({ ...options, activeNamespace }),
    demandWeightedCoverage({ ...options, activeNamespace }),
  ]);
  const value = { ...summarizeCoverage(rows, activeNamespace), demandWeightedCoverage: demand };
  if (cacheable) coverageCache = { createdAt: Date.now(), value: structuredClone(value) };
  return value;
};

const clearSemanticCoverageCache = () => {
  coverageCache = null;
};

const getSemanticBackfillMetrics = async ({ queryFn = query } = {}) => {
  const result = await queryFn(`
    SELECT COUNT(*)::INTEGER AS attempts,
      COUNT(*) FILTER (WHERE status = 'completed')::INTEGER AS succeeded,
      COUNT(*) FILTER (WHERE status = 'failed')::INTEGER AS failed,
      COALESCE(SUM(NULLIF(stage_metrics_json ->> 'embeddingsReused', '')::INTEGER), 0)::INTEGER
        AS embeddings_reused,
      COALESCE(SUM(NULLIF(stage_metrics_json ->> 'embeddingsGenerated', '')::INTEGER), 0)::INTEGER
        AS embeddings_generated,
      COUNT(*) FILTER (
        WHERE status = 'completed' AND completed_at >= NOW() - INTERVAL '24 hours'
      )::INTEGER AS semantic_ready_24h,
      ROUND(AVG(duration_ms) FILTER (WHERE status = 'completed'))::INTEGER
        AS average_duration_ms
    FROM document_processing_attempts
    WHERE pipeline_stage = 'semantic_backfill'
  `);
  const row = result.rows[0] || {};
  const attempts = Number(row.attempts || 0);
  const succeeded = Number(row.succeeded || 0);
  const failed = Number(row.failed || 0);
  return {
    attempts,
    succeeded,
    failed,
    successRate: attempts ? Number((succeeded / attempts).toFixed(4)) : null,
    failureRate: attempts ? Number((failed / attempts).toFixed(4)) : null,
    embeddingsReused: Number(row.embeddings_reused || 0),
    embeddingsGenerated: Number(row.embeddings_generated || 0),
    semanticReadyLast24h: Number(row.semantic_ready_24h || 0),
    semanticReadyPerHour: Number((Number(row.semantic_ready_24h || 0) / 24).toFixed(2)),
    averageDurationMs: Number(row.average_duration_ms || 0),
  };
};

module.exports = {
  PRIMARY_SOURCE_PATTERN,
  authorityWeight,
  clearSemanticCoverageCache,
  classifyCoverageReason,
  coverageRows,
  demandWeightedCoverage,
  documentTypeWeight,
  getSemanticCoverageReport,
  getSemanticBackfillMetrics,
  publicBackfillEligible,
  semanticPriority,
  summarizeCoverage,
};
