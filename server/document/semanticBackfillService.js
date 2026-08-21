const crypto = require("node:crypto");
const { getPool, query } = require("../db");
const { readStorageStatus } = require("../lib/database/capacity");
const { classifyProviderError, sanitizeProviderError } = require("../lib/providerErrorSanitizer");
const {
  estimateEmbeddingTokens,
  providerConfig,
  searchSimilarContent,
  searchSimilarContentForAct,
  searchSimilarContentForEGazette,
  searchSimilarContentForPolicy,
  storeActContentInChunks,
  storeBillContentInChunks,
  storeEGazetteContentInChunks,
  storePolicyContentInChunks,
} = require("../lib/vectordb");
const { effectiveBatchSize } = require("./processingWorkerService");
const { recordStage } = require("./processingStageService");
const { normalizeDocumentType, retrievalFamilyForType } = require("./documentTypes");
const { publicBackfillEligible, semanticPriority } = require("./semanticCoverageService");

const storeByFamily = {
  act: storeActContentInChunks,
  bill: storeBillContentInChunks,
  gazette: storeEGazetteContentInChunks,
  policy: storePolicyContentInChunks,
};
const searchByFamily = {
  act: searchSimilarContentForAct,
  bill: searchSimilarContent,
  gazette: searchSimilarContentForEGazette,
  policy: searchSimilarContentForPolicy,
};
const idKeyByFamily = { act: "actId", bill: "billId", gazette: "gazetteId", policy: "policyId" };

const sha256 = (value) => crypto.createHash("sha256")
  .update(String(value || ""))
  .digest("hex");

const tierRank = (tier) => ({ P0: 0, P1: 1, P2: 2, P3: 3 }[tier] ?? 4);
const queuePriorityForTier = (tier) => ({ P0: 100, P1: 80, P2: 60, P3: 40 }[tier] || 40);

const retryableEmbeddingFailure = (error) => [
  "rate_limited", "quota_or_billing", "timeout", "provider_unavailable", "network", "unknown",
].includes(classifyProviderError(error));

const loadBackfillCandidates = async ({
  queryFn = query,
  activeNamespace = providerConfig().vectorNamespace,
  limit = 25,
  priority = null,
  documentId = null,
  source = null,
  maxChunks = 100,
  now = new Date(),
} = {}) => {
  const params = [activeNamespace];
  const filters = [
    "document.visibility_status = 'public'",
    "state.search_ready",
    "COALESCE(state.retry_eligible, TRUE)",
    "COALESCE(chunk.chunk_count, 0) > 0",
    `(
      NOT state.semantic_ready
      OR NOT state.retrieval_verified
      OR COALESCE(chunk.active_vector_refs, 0) < COALESCE(chunk.chunk_count, 0)
      OR COALESCE(chunk.active_hashes, 0) < COALESCE(chunk.chunk_count, 0)
    )`,
  ];
  const add = (value) => {
    params.push(value);
    return `$${params.length}`;
  };
  filters.push(`COALESCE(chunk.chunk_count, 0) <= ${add(Math.max(1, Number(maxChunks) || 100))}`);
  if (documentId != null) filters.push(`document.id = ${add(String(documentId))}`);
  if (source) filters.push(`COALESCE(legacy.canonical_source, legacy.source_name, '') ILIKE ${add(`%${String(source).replace(/[\\%_]/g, "\\$&")}%`)} ESCAPE '\\'`);
  const candidatePoolLimit = add(Math.min(5_000, Math.max(500, Number(limit || 25) * 50)));
  const result = await queryFn(
    `WITH chunk AS (
       SELECT document_id, COUNT(*)::INTEGER AS chunk_count,
         COUNT(*) FILTER (
           WHERE embedding_namespace = $1
             AND vector_reference IS NOT NULL AND vector_reference <> ''
         )::INTEGER AS active_vector_refs,
         COUNT(*) FILTER (
           WHERE embedding_namespace = $1
             AND embedding_input_sha256 IS NOT NULL AND embedding_input_sha256 <> ''
         )::INTEGER AS active_hashes
       FROM document_text_chunks GROUP BY document_id
     ), demand AS (
       SELECT document_id,
         COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '7 days')::INTEGER AS demand_7d,
         COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '30 days')::INTEGER AS demand_30d,
         COUNT(*) FILTER (
           WHERE created_at >= NOW() - INTERVAL '30 days'
             AND event_type ILIKE '%compar%'
         )::INTEGER AS comparison_30d
       FROM user_activity_events
       WHERE document_id IS NOT NULL AND created_at >= NOW() - INTERVAL '30 days'
       GROUP BY document_id
     ), knowledge AS (
       SELECT document_id, COUNT(*)::INTEGER AS links
       FROM knowledge_evidence
       WHERE document_id IS NOT NULL AND owner_user_id IS NULL
       GROUP BY document_id
     )
     SELECT document.id, document.title, document.document_type,
       document.year, document.source_authority_tier, document.source_priority,
       document.quality_score, document.visibility_status,
       COALESCE(legacy.canonical_source, legacy.source_name, 'unknown') AS source,
       state.search_ready, state.semantic_ready, state.retrieval_verified,
       state.retry_eligible, COALESCE(chunk.chunk_count, 0)::INTEGER AS chunk_count,
       COALESCE(demand.demand_7d, 0)::INTEGER AS demand_7d,
       COALESCE(demand.demand_30d, 0)::INTEGER AS demand_30d,
       COALESCE(demand.comparison_30d, 0)::INTEGER AS comparison_30d,
       COALESCE(knowledge.links, 0)::INTEGER AS knowledge_links
     FROM documents document
     JOIN document_processing_state state ON state.document_id = document.id
     LEFT JOIN legislative_documents legacy ON legacy.id = document.id
     LEFT JOIN chunk ON chunk.document_id = document.id
     LEFT JOIN demand ON demand.document_id = document.id
     LEFT JOIN knowledge ON knowledge.document_id = document.id
     WHERE ${filters.join("\n       AND ")}
     ORDER BY
       CASE
         WHEN COALESCE(demand.demand_7d, 0) > 0 THEN 0
         WHEN document.source_authority_tier = 'A' THEN 1
         WHEN COALESCE(legacy.canonical_source, legacy.source_name, '') ~*
           '(india[- ]?code|egazette|parliament|rbi|sebi|irdai|pfrda|trai|cci|ministry|state[- ]?(gazette|legislature)|regulator)'
           THEN 2
         WHEN document.source_authority_tier = 'B' THEN 3
         ELSE 4
       END,
       COALESCE(demand.demand_30d, 0) DESC,
       document.source_priority ASC NULLS LAST,
       document.year DESC NULLS LAST,
       document.id ASC
     LIMIT ${candidatePoolLimit}`,
    params,
  );
  const ranked = result.rows.map((row) => {
    const rank = semanticPriority({
      authorityTier: row.source_authority_tier,
      documentType: row.document_type,
      source: row.source,
      sourcePriority: row.source_priority,
      qualityScore: row.quality_score,
      year: row.year,
      demand7d: row.demand_7d,
      demand30d: row.demand_30d,
      comparison30d: row.comparison_30d,
      knowledgeLinks: row.knowledge_links,
      explicitDemand: documentId != null && String(row.id) === String(documentId),
    }, now);
    return {
      ...row,
      visibilityStatus: row.visibility_status,
      searchReady: Boolean(row.search_ready),
      hasChunks: Number(row.chunk_count || 0) > 0,
      retryEligible: row.retry_eligible !== false,
      priorityTier: rank.tier,
      priorityScore: rank.score,
    };
  }).filter(publicBackfillEligible)
    .filter((row) => !priority || row.priorityTier === String(priority).toUpperCase())
    .sort((left, right) =>
      tierRank(left.priorityTier) - tierRank(right.priorityTier) ||
      right.priorityScore - left.priorityScore ||
      Number(left.id) - Number(right.id));
  return ranked.slice(0, Math.max(1, Number(limit) || 25));
};

const loadChunks = async (documentId, queryFn = query) => {
  const result = await queryFn(
    `SELECT chunk_index, original_text, translated_text, language,
       vector_reference, metadata_json, embedding_namespace,
       embedding_input_sha256
     FROM document_text_chunks
     WHERE document_id = $1 ORDER BY chunk_index ASC`,
    [documentId],
  );
  return result.rows;
};

const buildVectorChunks = ({ document, rows, family, config }) => {
  const idKey = idKeyByFamily[family];
  return rows.map((row, index) => {
    const embeddingText = String(row.translated_text || row.original_text || "").trim();
    const content = String(row.original_text || row.translated_text || "").trim();
    const chunkIndex = Number(row.chunk_index ?? index);
    return {
      id: row.vector_reference || `${family}-${document.id}-chunk-${chunkIndex}`,
      [idKey]: document.id,
      documentId: document.id,
      title: document.title,
      content,
      translatedText: row.translated_text || null,
      embeddingText,
      embeddingInputHash: sha256(embeddingText),
      previousEmbeddingInputHash: row.embedding_input_sha256,
      previousNamespace: row.embedding_namespace,
      chunkIndex,
      totalChunks: rows.length,
      metadata: {
        ...(row.metadata_json || {}),
        documentId: String(document.id),
        documentType: document.document_type,
        languageCode: row.language || "und",
        embeddingProvider: config.embeddingProvider,
        embeddingModel: config.embeddingModel,
        embeddingDimension: String(config.embeddingDimension),
        vectorNamespace: config.vectorNamespace,
      },
    };
  }).filter((chunk) => chunk.content && chunk.embeddingText);
};

const probeSemanticRetrieval = async ({ family, document, chunks, attempts = 3, waitMs = 250 }) => {
  const search = searchByFamily[family];
  if (!search) return { verified: false, attempts: 0, reason: "unsupported_retrieval_family" };
  const probeText = String(document.title || chunks[0]?.embeddingText || "").trim().slice(0, 500);
  if (!probeText) return { verified: false, attempts: 0, reason: "missing_probe_text" };
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const matches = await search(probeText, document.id, 3);
    const valid = matches.some((match) =>
      Number(match.relevanceScore ?? match.score ?? 0) > 0 &&
      String(match.content || match.metadata?.content || "").trim().length > 0);
    if (valid) return { verified: true, attempts: attempt, matches: matches.length };
    if (attempt < attempts) await new Promise((resolve) => setTimeout(resolve, waitMs));
  }
  return { verified: false, attempts, reason: "no_relevant_chunk_recovered" };
};

const updateChunkEmbeddingMetadata = async ({ documentId, chunks, config, queryFn = query }) => {
  for (const chunk of chunks) {
    await queryFn(
      `UPDATE document_text_chunks SET
         embedding_namespace = $3,
         embedding_input_sha256 = $4,
         metadata_json = metadata_json || jsonb_build_object(
           'embeddingProvider', $5::TEXT,
           'embeddingModel', $6::TEXT,
           'embeddingDimension', $7::TEXT,
           'vectorNamespace', $3::TEXT,
           'semanticBackfilledAt', NOW()
         ), updated_at = NOW()
       WHERE document_id = $1 AND chunk_index = $2`,
      [documentId, chunk.chunkIndex, config.vectorNamespace,
        chunk.embeddingInputHash, config.embeddingProvider,
        config.embeddingModel, String(config.embeddingDimension)],
    );
  }
};

const createBackfillJob = async ({ document, queryFn = query }) => {
  const result = await queryFn(
    `INSERT INTO document_processing_jobs (
       document_id, status, priority, attempt, requested_by,
       metadata_json, started_at, claimed_at, heartbeat_at,
       worker_id, pipeline_stage
     ) VALUES ($1, 'running', $2, 1, NULL,
       jsonb_build_object('reason', 'semantic_backfill', 'priorityTier', $3::TEXT),
       NOW(), NOW(), NOW(), 'semantic-backfill-v1', 'embedding')
     RETURNING id`,
    [document.id, queuePriorityForTier(document.priorityTier), document.priorityTier],
  );
  return result.rows[0]?.id;
};

const completeBackfillJob = async ({
  jobId, document, status, metrics, error = null, retryEligible = true, queryFn = query,
}) => {
  const durationMs = Number(metrics.durationMs || 0);
  const failureKind = error ? classifyProviderError(error) : null;
  const failureReason = error ? sanitizeProviderError(error) : null;
  await queryFn(
    `UPDATE document_processing_jobs SET status = $2,
       completed_at = NOW(), updated_at = NOW(), duration_ms = $3,
       stage_metrics_json = $4::jsonb, usage_json = $5::jsonb,
       failure_reason = $6, failure_code = $7,
       retry_eligible = $8, pipeline_stage = 'semantic_backfill'
     WHERE id = $1`,
    [jobId, status, durationMs, JSON.stringify(metrics), JSON.stringify({
      embeddingInputTokens: metrics.embeddingInputTokens || 0,
    }), failureReason, failureKind, retryEligible],
  );
  await queryFn(
    `INSERT INTO document_processing_attempts (
       job_id, document_id, worker_id, attempt, status,
       failure_stage, failure_reason, stage_metrics_json, usage_json,
       duration_ms, started_at, completed_at, pipeline_stage,
       failure_code, retry_eligible, failure_detail_json,
       ai_provider, ai_model
     ) VALUES ($1, $2, 'semantic-backfill-v1', 1, $3,
       $4, $5, $6::jsonb, $7::jsonb, $8,
       NOW() - ($8::INTEGER * INTERVAL '1 millisecond'), NOW(),
       'semantic_backfill', $9, $10, '{}'::jsonb, $11, $12)`,
    [jobId, document.id, status === "completed" ? "completed" : "failed",
      error ? "embedding" : null, failureReason, JSON.stringify(metrics),
      JSON.stringify({ embeddingInputTokens: metrics.embeddingInputTokens || 0 }),
      durationMs, failureKind, retryEligible,
      providerConfig().embeddingProvider, providerConfig().embeddingModel],
  );
};

const updateSemanticState = async ({ documentId, chunksCount, verified, error = null, queryFn = query }) => {
  const retryEligible = error ? retryableEmbeddingFailure(error) : true;
  await queryFn(
    `UPDATE document_processing_state SET
       embedding_status = $2,
       semantic_ready = $3,
       embeddings_count = CASE WHEN $3 THEN $4 ELSE embeddings_count END,
       embedding_provider = $5,
       failure_stage = CASE WHEN $3 THEN NULL ELSE 'embedding' END,
       failure_reason = CASE WHEN $3 THEN NULL ELSE $6 END,
       failure_code = CASE WHEN $3 THEN NULL ELSE $7 END,
       retry_eligible = $8,
       retry_count = CASE WHEN $3 THEN COALESCE(retry_count, 0)
         ELSE COALESCE(retry_count, 0) + 1 END,
       capabilities_updated_at = NOW(), updated_at = NOW()
     WHERE document_id = $1`,
    [documentId, verified ? "ready" : "failed", Boolean(verified), chunksCount,
      providerConfig().embeddingProvider,
      error ? sanitizeProviderError(error) : "Semantic retrieval verification failed.",
      error ? classifyProviderError(error) : "retrieval_probe_failed", retryEligible],
  );
  return retryEligible;
};

const backfillSemanticDocument = async ({
  document,
  dryRun = false,
  queryFn = query,
  config = providerConfig(),
  storeOverrides = {},
  probeFn = probeSemanticRetrieval,
  loadChunksFn = loadChunks,
  createJobFn = createBackfillJob,
  completeJobFn = completeBackfillJob,
  updateStateFn = updateSemanticState,
  updateChunkMetadataFn = updateChunkEmbeddingMetadata,
  recordStageFn = recordStage,
} = {}) => {
  if (!publicBackfillEligible(document)) {
    return { documentId: String(document?.id || ""), status: "skipped", reason: "not_public_backfill_eligible" };
  }
  const family = retrievalFamilyForType(normalizeDocumentType(document.document_type));
  const store = storeOverrides[family] || storeByFamily[family];
  if (!store) return { documentId: String(document.id), status: "skipped", reason: "unsupported_retrieval_family" };
  const rows = await loadChunksFn(document.id, queryFn);
  const chunks = buildVectorChunks({ document, rows, family, config });
  if (!chunks.length) return { documentId: String(document.id), status: "skipped", reason: "missing_valid_chunks" };
  const reusableIds = new Set(chunks.filter((chunk) =>
    chunk.previousNamespace === config.vectorNamespace &&
    chunk.previousEmbeddingInputHash === chunk.embeddingInputHash).map((chunk) => chunk.id));
  const embeddingInputTokens = chunks.reduce((sum, chunk) => sum + estimateEmbeddingTokens(chunk.embeddingText), 0);
  if (dryRun) return {
    documentId: String(document.id), status: "dry_run", family,
    priorityTier: document.priorityTier, priorityScore: document.priorityScore,
    chunks: chunks.length, reusableChunks: reusableIds.size,
    chunksToGenerate: chunks.length - reusableIds.size, embeddingInputTokens,
    downloads: 0, ocrPages: 0,
  };

  const startedAt = Date.now();
  const jobId = await createJobFn({ document, queryFn });
  let stored = null;
  try {
    if (reusableIds.size === chunks.length) {
      const existingProbe = await probeFn({ family, document, chunks });
      if (existingProbe.verified) {
        await updateStateFn({ documentId: document.id, chunksCount: chunks.length, verified: true, queryFn });
        const metrics = {
          durationMs: Date.now() - startedAt, chunks: chunks.length,
          embeddingsReused: chunks.length, embeddingsGenerated: 0,
          embeddingInputTokens: 0, retrievalProbeAttempts: existingProbe.attempts,
          namespaceMismatch: false, downloads: 0, ocrPages: 0,
        };
        await completeJobFn({ jobId, document, status: "completed", metrics, queryFn });
        return { documentId: String(document.id), status: "reconciled", ...metrics };
      }
      reusableIds.clear();
    }

    await recordStageFn({
      documentId: document.id, jobId, stage: "EMBED", status: "running",
      inputHash: sha256(chunks.map((chunk) => chunk.embeddingInputHash).join(":")),
      metadata: { semanticBackfill: true, priorityTier: document.priorityTier },
    });
    stored = await store(chunks, { unchangedChunkIds: reusableIds });
    await recordStageFn({
      documentId: document.id, jobId, stage: "EMBED", status: "completed",
      inputHash: sha256(chunks.map((chunk) => chunk.embeddingInputHash).join(":")),
      durationMs: stored.metrics?.embeddingsMs || 0,
      metadata: { semanticBackfill: true, generated: stored.embeddingCacheMisses || 0, reused: stored.embeddingCacheHits || 0 },
    });
    await updateChunkMetadataFn({ documentId: document.id, chunks, config, queryFn });
    const probe = await probeFn({ family, document, chunks });
    if (!probe.verified) {
      const probeError = new Error("Semantic retrieval probe failed after vector indexing.");
      probeError.code = "retrieval_probe_failed";
      throw probeError;
    }
    await recordStageFn({
      documentId: document.id, jobId, stage: "RETRIEVAL_VERIFY", status: "completed",
      inputHash: sha256(`${config.vectorNamespace}:${document.id}`),
      metadata: { semanticBackfill: true, probeAttempts: probe.attempts, matches: probe.matches || 0 },
    });
    await updateStateFn({ documentId: document.id, chunksCount: chunks.length, verified: true, queryFn });
    const generated = Number(stored.embeddingCacheMisses ?? chunks.length - reusableIds.size);
    const metrics = {
      durationMs: Date.now() - startedAt, chunks: chunks.length,
      embeddingsReused: chunks.length - generated, embeddingsGenerated: generated,
      embeddingInputTokens: generated > 0 ? embeddingInputTokens : 0,
      retrievalProbeAttempts: probe.attempts,
      namespaceMismatch: chunks.some((chunk) => chunk.previousNamespace !== config.vectorNamespace),
      staleVectorsRemoved: Number(stored.staleVectorsRemoved || 0),
      downloads: 0, ocrPages: 0,
    };
    await completeJobFn({ jobId, document, status: "completed", metrics, queryFn });
    return { documentId: String(document.id), status: "indexed", ...metrics };
  } catch (error) {
    const retryEligible = await updateStateFn({
      documentId: document.id, chunksCount: chunks.length, verified: false, error, queryFn,
    });
    await recordStageFn({
      documentId: document.id, jobId, stage: /probe/i.test(error.message) ? "RETRIEVAL_VERIFY" : "EMBED",
      status: "failed", failureCategory: classifyProviderError(error),
      failureReason: sanitizeProviderError(error), retryable: retryEligible,
      metadata: { semanticBackfill: true },
    });
    const metrics = {
      durationMs: Date.now() - startedAt, chunks: chunks.length,
      embeddingsReused: Number(stored?.embeddingCacheHits || 0),
      embeddingsGenerated: Number(stored?.embeddingCacheMisses || 0),
      embeddingInputTokens: stored ? embeddingInputTokens : 0,
      downloads: 0, ocrPages: 0,
    };
    await completeJobFn({
      jobId, document, status: "failed", metrics, error, retryEligible, queryFn,
    });
    return {
      documentId: String(document.id), status: "failed",
      reason: classifyProviderError(error), retryEligible, ...metrics,
    };
  }
};

const runSemanticBackfill = async ({
  requested = 5,
  priority = null,
  documentId = null,
  source = null,
  maxChunks = 100,
  dryRun = false,
  groupSize = 5,
  queryFn = query,
  capacityFn = () => readStorageStatus(getPool()),
  processDocument = backfillSemanticDocument,
} = {}) => {
  let storage = await capacityFn();
  const effective = dryRun
    ? Math.min(requested, 250)
    : effectiveBatchSize({ requested, safe: storage.safeBatchSize });
  if (!dryRun && (!storage.bulkProcessingAllowed || effective <= 0)) {
    return { requested, effective: 0, processed: 0, stopReason: storage.reason || "capacity_guard", storage, results: [] };
  }
  const candidates = await loadBackfillCandidates({
    queryFn, limit: effective || requested, priority, documentId, source, maxChunks,
  });
  const results = [];
  let consecutiveFailures = 0;
  let stopReason = null;
  for (let offset = 0; offset < candidates.length; offset += groupSize) {
    if (!dryRun && offset > 0) {
      storage = await capacityFn();
      if (!storage.bulkProcessingAllowed || storage.safeBatchSize <= 0) {
        stopReason = storage.reason || "capacity_guard";
        break;
      }
    }
    for (const document of candidates.slice(offset, offset + groupSize)) {
      const result = await processDocument({ document, dryRun, queryFn });
      results.push(result);
      consecutiveFailures = result.status === "failed" ? consecutiveFailures + 1 : 0;
      if (!dryRun && consecutiveFailures >= 3) {
        stopReason = "provider_or_vector_health_degraded_after_three_consecutive_failures";
        break;
      }
    }
    if (stopReason) break;
  }
  return {
    requested, effective, candidates: candidates.length, processed: results.length,
    succeeded: results.filter((result) => ["indexed", "reconciled"].includes(result.status)).length,
    failed: results.filter((result) => result.status === "failed").length,
    embeddingsReused: results.reduce((sum, result) => sum + Number(result.embeddingsReused || result.reusableChunks || 0), 0),
    embeddingsGenerated: results.reduce((sum, result) => sum + Number(result.embeddingsGenerated || result.chunksToGenerate || 0), 0),
    stopReason, storage, results,
  };
};

module.exports = {
  backfillSemanticDocument,
  buildVectorChunks,
  completeBackfillJob,
  loadBackfillCandidates,
  probeSemanticRetrieval,
  queuePriorityForTier,
  retryableEmbeddingFailure,
  runSemanticBackfill,
  sha256,
  tierRank,
  updateSemanticState,
};
