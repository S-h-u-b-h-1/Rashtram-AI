const { getPool, query } = require("../db");
const { readStorageStatus } = require("../lib/database/capacity");
const { runProcessingBatch } = require("./processingWorkerService");
const { runResearchReadinessAudit } = require("./researchReadinessAuditService");

const AUTOMATIC_RECOVERY_CLASSES = new Set([
  "RESOURCE_FETCH_FAILED",
  "RESOURCE_READY_NO_TEXT",
  "TEXT_EXTRACTION_FAILED",
  "TEXT_LOW_QUALITY",
  "TEXT_READY_NO_CHUNKS",
  "CHUNKS_MISSING",
  "CHUNKS_INVALID",
  "FTS_NOT_INDEXED",
  "READINESS_FLAG_MISMATCH",
  "RETRYABLE_PROCESSING_FAILURE",
  "ALREADY_USABLE_BUT_FLAGS_STALE",
]);

const recoveryCostRank = (value) => ({
  ALREADY_USABLE_BUT_FLAGS_STALE: 0,
  READINESS_FLAG_MISMATCH: 0,
  FTS_NOT_INDEXED: 1,
  CHUNKS_MISSING: 2,
  CHUNKS_INVALID: 2,
  TEXT_READY_NO_CHUNKS: 2,
  RESOURCE_READY_NO_TEXT: 3,
  TEXT_EXTRACTION_FAILED: 4,
  TEXT_LOW_QUALITY: 5,
  RETRYABLE_PROCESSING_FAILURE: 6,
  RESOURCE_FETCH_FAILED: 7,
}[value] ?? 99);

const priorityRank = (value) => ({ P0: 0, P1: 1, P2: 2, P3: 3 }[value] ?? 4);
const fileCostRank = (value) => {
  const bytes = Number(value);
  if (!Number.isFinite(bytes) || bytes <= 0) return 4;
  if (bytes <= 2_000_000) return 0;
  if (bytes <= 10_000_000) return 1;
  if (bytes <= 25_000_000) return 2;
  return 3;
};

const recoveryCandidates = (documents = []) => {
  const sorted = documents
    .filter((document) => !document.capabilities?.searchReady)
    .filter((document) => !document.activeProcessingJob)
    .filter((document) => document.sourceRetryAvailable !== false)
    .filter((document) => document.processingEligible !== false)
    .filter((document) => AUTOMATIC_RECOVERY_CLASSES.has(document.recoveryClass))
    .sort((left, right) =>
    recoveryCostRank(left.recoveryClass) - recoveryCostRank(right.recoveryClass) ||
    priorityRank(left.priority) - priorityRank(right.priority) ||
    fileCostRank(left.fileSizeBytes) - fileCostRank(right.fileSizeBytes) ||
    Number(left.fileSizeBytes || Number.MAX_SAFE_INTEGER) -
      Number(right.fileSizeBytes || Number.MAX_SAFE_INTEGER) ||
    Number(right.year || 0) - Number(left.year || 0) ||
    Number(left.documentId) - Number(right.documentId));
  const tiers = new Map();
  for (const document of sorted) {
    const tierKey = `${recoveryCostRank(document.recoveryClass)}:${priorityRank(document.priority)}`;
    const sourceKey = document.sourceHost || document.source || "unknown";
    if (!tiers.has(tierKey)) tiers.set(tierKey, new Map());
    const buckets = tiers.get(tierKey);
    if (!buckets.has(sourceKey)) buckets.set(sourceKey, []);
    buckets.get(sourceKey).push(document);
  }
  const ordered = [];
  for (const buckets of tiers.values()) {
    while (buckets.size) {
      for (const [sourceKey, bucket] of buckets) {
        const next = bucket.shift();
        if (next) ordered.push(next);
        if (!bucket.length) buckets.delete(sourceKey);
      }
    }
  }
  return ordered;
};

const readRecoveryStorageSnapshot = async ({ queryFn = query } = {}) => {
  const result = await queryFn(`
    SELECT pg_database_size(current_database())::BIGINT AS database_bytes,
      COALESCE((SELECT COUNT(*) FROM document_artifact_objects
        WHERE status IN ('verified', 'active')), 0)::BIGINT AS object_count,
      COALESCE((SELECT SUM(byte_size) FROM document_artifact_objects
        WHERE status IN ('verified', 'active')), 0)::BIGINT AS object_bytes,
      COALESCE((SELECT COUNT(*) FROM document_text_chunks), 0)::BIGINT AS chunk_count
  `);
  const row = result.rows[0] || {};
  return {
    databaseBytes: Number(row.database_bytes || 0),
    objectCount: Number(row.object_count || 0),
    objectBytes: Number(row.object_bytes || 0),
    chunkCount: Number(row.chunk_count || 0),
  };
};

const validateRecoveredDocuments = async (documentIds, { queryFn = query } = {}) => {
  const ids = [...new Set(documentIds.map(Number).filter(Number.isFinite))];
  if (!ids.length) return [];
  const result = await queryFn(`
    WITH chunk_stats AS (
      SELECT chunk.document_id,
        COUNT(*)::INTEGER AS chunks,
        COUNT(*) FILTER (WHERE LENGTH(TRIM(chunk.original_text)) > 0)::INTEGER AS non_empty_chunks,
        COUNT(*) FILTER (WHERE LENGTH(TRIM(chunk.original_text)) >= 20)::INTEGER AS substantive_chunks,
        COUNT(DISTINCT chunk.chunk_index)::INTEGER AS distinct_chunk_indexes,
        MIN(chunk.chunk_index)::INTEGER AS first_chunk_index,
        (ARRAY_AGG(chunk.original_text ORDER BY chunk.chunk_index))[1] AS first_chunk_text,
        BOOL_OR(
          NULLIF(chunk.metadata_json->>'sourceUrl', '') IS NOT NULL OR
          NULLIF(chunk.metadata_json->>'pdfUrl', '') IS NOT NULL OR
          NULLIF(chunk.metadata_json->>'source', '') IS NOT NULL
        ) AS source_identity_preserved
      FROM document_text_chunks chunk
      WHERE chunk.document_id = ANY($1::BIGINT[])
      GROUP BY chunk.document_id
    ), probe AS (
      SELECT stats.document_id,
        CASE
          WHEN NULLIF(TRIM(stats.first_chunk_text), '') IS NULL THEN FALSE
          ELSE to_tsvector('simple', stats.first_chunk_text) @@
            COALESCE((
              SELECT STRING_AGG(QUOTE_LITERAL(token), ' & ')::tsquery
              FROM (
                SELECT token
                FROM UNNEST(tsvector_to_array(to_tsvector('simple', stats.first_chunk_text))) token
                WHERE LENGTH(token) >= 3
                LIMIT 4
              ) phrase_tokens
            ), ''::tsquery)
        END AS phrase_retrievable
      FROM chunk_stats stats
    )
    SELECT document.id, document.title, document.document_type,
      state.resource_ready, state.text_ready, state.search_ready,
      state.chat_ready, state.capability_comparison_ready,
      state.semantic_ready, state.retrieval_verified,
      state.retrieval_mode, state.processing_status,
      state.extraction_status, state.chunking_status,
      COALESCE(stats.chunks, 0)::INTEGER AS chunks,
      COALESCE(stats.non_empty_chunks, 0)::INTEGER AS non_empty_chunks,
      COALESCE(stats.substantive_chunks, 0)::INTEGER AS substantive_chunks,
      COALESCE(stats.distinct_chunk_indexes, 0)::INTEGER AS distinct_chunk_indexes,
      COALESCE(stats.source_identity_preserved, FALSE) AS source_identity_preserved,
      COALESCE(probe.phrase_retrievable, FALSE) AS phrase_retrievable,
      TO_REGCLASS('document_text_chunks_original_text_fts_idx') IS NOT NULL AS fts_indexed
    FROM documents document
    JOIN document_processing_state state ON state.document_id = document.id
    LEFT JOIN chunk_stats stats ON stats.document_id = document.id
    LEFT JOIN probe ON probe.document_id = document.id
    WHERE document.id = ANY($1::BIGINT[])
    ORDER BY document.id
  `, [ids]);
  return result.rows.map((row) => {
    const chunks = Number(row.chunks || 0);
    const valid = Boolean(
      row.resource_ready && row.text_ready && row.search_ready && row.chat_ready &&
      row.capability_comparison_ready && row.retrieval_verified && row.fts_indexed &&
      row.phrase_retrievable && row.source_identity_preserved && chunks > 0 &&
      Number(row.non_empty_chunks) === chunks && Number(row.substantive_chunks) > 0 &&
      Number(row.distinct_chunk_indexes) === chunks,
    );
    return {
      documentId: String(row.id),
      title: row.title,
      documentType: row.document_type,
      valid,
      chunks,
      semanticReady: Boolean(row.semantic_ready),
      retrievalMode: row.retrieval_mode,
      checks: {
        resourceReady: Boolean(row.resource_ready),
        textReady: Boolean(row.text_ready),
        searchReady: Boolean(row.search_ready),
        chatReady: Boolean(row.chat_ready),
        comparisonReady: Boolean(row.capability_comparison_ready),
        retrievalVerified: Boolean(row.retrieval_verified),
        exactTitleRetrieval: Boolean(row.retrieval_verified),
        ftsIndexed: Boolean(row.fts_indexed),
        phraseRetrievable: Boolean(row.phrase_retrievable),
        sourceIdentityPreserved: Boolean(row.source_identity_preserved),
        validChunks: Number(row.non_empty_chunks) === chunks &&
          Number(row.substantive_chunks) > 0 && chunks > 0,
        uniqueChunkIndexes: Number(row.distinct_chunk_indexes) === chunks && chunks > 0,
      },
    };
  });
};

const cancelQueuedCanarySelections = async (selection = [], { queryFn = query } = {}) => {
  const jobIds = selection.map((item) => Number(item.jobId)).filter(Number.isFinite);
  if (!jobIds.length) return 0;
  const result = await queryFn(`
    UPDATE document_processing_jobs
    SET status = 'cancelled', completed_at = NOW(),
      failure_reason = 'Bounded Release B canary pass ended before this selected job was claimed.',
      retry_eligible = TRUE, updated_at = NOW()
    WHERE id = ANY($1::BIGINT[]) AND status = 'queued'
    RETURNING id
  `, [jobIds]);
  return result.rows.length;
};

const compactReadiness = (report) => ({
  totalPublicCatalogue: report.totalPublicCatalogue,
  funnel: report.funnel,
  notSearchReady: report.notSearchReady,
  retryable: report.retryable,
  manualReview: report.manualReview,
  byRecoveryClass: report.byRecoveryClass,
});

const latestDocumentResults = (results = []) => {
  const latest = new Map();
  for (const result of results) {
    if (result?.documentId != null) latest.set(String(result.documentId), result);
  }
  return [...latest.values()];
};

const runCorpusRecoveryWave = async ({
  requested,
  concurrency = 1,
  oneDocumentPerSource = false,
  maxWallClockMs = 60 * 60_000,
  maxRetryableFailureRate = 0.35,
  auditFn = runResearchReadinessAudit,
  processBatchFn = runProcessingBatch,
  snapshotFn = readRecoveryStorageSnapshot,
  validateFn = validateRecoveredDocuments,
  cancelQueuedFn = cancelQueuedCanarySelections,
  capacityFn = () => readStorageStatus(getPool()),
} = {}) => {
  const target = Math.min(500, Math.max(1, Number(requested) || 5));
  const startedAt = Date.now();
  const minimumFailureGateSample = Math.min(25, target);
  const [beforeAudit, storageBefore] = await Promise.all([
    auditFn({ includeDocuments: true, includeSamples: false }),
    snapshotFn(),
  ]);
  let candidates = recoveryCandidates(beforeAudit.documents);
  if (oneDocumentPerSource) {
    const seenSources = new Set();
    candidates = candidates.filter((candidate) => {
      const sourceKey = candidate.sourceHost || candidate.source || "unknown";
      if (seenSources.has(sourceKey)) return false;
      seenSources.add(sourceKey);
      return true;
    });
  }
  let candidateQueue = [...candidates];
  const runId = `release_b_corpus_${target}_${Date.now()}`;
  const results = [];
  const validations = [];
  let stopReason = null;

  while (latestDocumentResults(results).length < target && candidateQueue.length) {
    if (Date.now() - startedAt >= maxWallClockMs) {
      stopReason = "validation_wall_clock_limit_reached";
      break;
    }
    const storage = await capacityFn();
    if (!storage.bulkProcessingAllowed || storage.safeBatchSize <= 0) {
      stopReason = storage.reason || "capacity_guard";
      break;
    }
    const remaining = target - latestDocumentResults(results).length;
    const requestedBatch = Math.min(remaining, storage.safeBatchSize, 25);
    const candidateWindow = candidateQueue.slice(0, Math.max(500, requestedBatch * 10));
    const batch = await processBatchFn({
      limit: requestedBatch,
      concurrency: Math.min(4, Math.max(1, Number(concurrency) || 1)),
      sourceConcurrency: 2,
      idlePollLimit: 10,
      capacityCheckInterval: 5,
      maxAttempts: oneDocumentPerSource ? 1 : 3,
      reason: runId,
      allowedDocumentIds: candidateWindow.map((item) => Number(item.documentId)),
      discoverGraph: false,
      skipSemantic: true,
      skipSummary: true,
      capacityReader: capacityFn,
    });
    const batchResults = (batch.results || []).filter((item) => item.documentId);
    const selectedIds = new Set((batch.selection || [])
      .map((item) => String(item.documentId)));
    if (selectedIds.size) {
      candidateQueue = candidateQueue.filter((item) => !selectedIds.has(String(item.documentId)));
    } else {
      const skippedIds = new Set(candidateWindow.map((item) => String(item.documentId)));
      candidateQueue = candidateQueue.filter((item) => !skippedIds.has(String(item.documentId)));
    }
    await cancelQueuedFn(batch.selection || []);
    results.push(...batchResults);
    const readyIds = batchResults.filter((item) => item.status === "ready")
      .map((item) => item.documentId);
    const batchValidation = await validateFn(readyIds);
    validations.push(...batchValidation);
    if (batchValidation.some((item) => !item.valid)) {
      stopReason = "recovered_document_failed_integrity_or_retrieval_probe";
      break;
    }
    const documentResults = latestDocumentResults(results);
    const failures = documentResults.filter((item) => item.status !== "ready");
    const retryableFailures = failures.filter((item) => item.retryEligible);
    if (documentResults.length >= minimumFailureGateSample &&
        retryableFailures.length / documentResults.length > maxRetryableFailureRate) {
      stopReason = "retryable_failure_rate_exceeded_canary_threshold";
      break;
    }
    if (!batchResults.length && !batch.enqueued) continue;
    if (!batchResults.length) {
      stopReason = batch.stopReason || "selected_jobs_could_not_be_processed";
      break;
    }
  }

  const [afterAudit, storageAfter] = await Promise.all([
    auditFn({ includeDocuments: false, includeSamples: false }),
    snapshotFn(),
  ]);
  const documentResults = latestDocumentResults(results);
  const ready = documentResults.filter((item) => item.status === "ready");
  const failed = documentResults.filter((item) => item.status !== "ready");
  const retryableFailed = failed.filter((item) => item.retryEligible);
  const durationMs = results.reduce((sum, item) => sum + Number(item.durationMs || 0), 0);
  const byExtractionMethod = {};
  for (const item of ready) {
    const key = item.extractionMethod || "unknown";
    byExtractionMethod[key] = (byExtractionMethod[key] || 0) + 1;
  }
  const byFailureCode = {};
  for (const item of failed) {
    const key = item.failureCode || item.classification || "unknown";
    byFailureCode[key] = (byFailureCode[key] || 0) + 1;
  }
  const elapsedHours = Math.max(durationMs / 3_600_000, 1 / 3600);
  const databaseGrowth = storageAfter.databaseBytes - storageBefore.databaseBytes;
  const objectGrowth = storageAfter.objectBytes - storageBefore.objectBytes;
  const invalidRecovered = validations.filter((item) => !item.valid);
  return {
    generatedAt: new Date().toISOString(),
    runId,
    requested: target,
    attempted: documentResults.length,
    processingAttempts: results.length,
    retryAttempts: Math.max(0, results.length - documentResults.length),
    recovered: ready.length,
    failed: failed.length,
    retryableFailures: retryableFailed.length,
    retryableFailureRate: documentResults.length
      ? Number((retryableFailed.length / documentResults.length).toFixed(4)) : 0,
    gatePassed: documentResults.length === target && !stopReason && invalidRecovered.length === 0 &&
      (retryableFailed.length / Math.max(1, documentResults.length)) <= maxRetryableFailureRate,
    stopReason,
    processing: {
      chunksCreated: ready.reduce((sum, item) => sum + Number(item.chunks || 0), 0),
      ocrDocuments: ready.filter((item) => item.ocrUsed).length,
      byExtractionMethod,
      byFailureCode,
      cumulativeProcessingMs: durationMs,
      docsPerHour: Number((ready.length / elapsedHours).toFixed(2)),
    },
    storage: {
      before: storageBefore,
      after: storageAfter,
      databaseGrowthBytes: databaseGrowth,
      objectGrowthBytes: objectGrowth,
      databaseGrowthPer100Docs: ready.length
        ? Math.round((databaseGrowth / ready.length) * 100) : null,
      objectGrowthPer100Docs: ready.length
        ? Math.round((objectGrowth / ready.length) * 100) : null,
    },
    readiness: {
      before: compactReadiness(beforeAudit),
      after: compactReadiness(afterAudit),
      newlySearchReady: afterAudit.funnel.searchReady - beforeAudit.funnel.searchReady,
    },
    integrity: {
      validated: validations.length,
      passed: validations.filter((item) => item.valid).length,
      failed: invalidRecovered.length,
    },
    candidateClasses: Object.fromEntries(documentResults.map((result) =>
      candidates.find((candidate) => candidate.documentId === result.documentId))
      .filter(Boolean)
      .reduce((counts, item) => counts.set(
        item.recoveryClass,
        (counts.get(item.recoveryClass) || 0) + 1,
      ), new Map())),
    results,
    documentResults,
    validations,
  };
};

module.exports = {
  AUTOMATIC_RECOVERY_CLASSES,
  cancelQueuedCanarySelections,
  compactReadiness,
  fileCostRank,
  latestDocumentResults,
  readRecoveryStorageSnapshot,
  recoveryCandidates,
  runCorpusRecoveryWave,
  validateRecoveredDocuments,
};
