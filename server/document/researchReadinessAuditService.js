const { query } = require("../db");
const { classifyFailureCode, isRetryableFailure } = require("./failureTaxonomy");

const FAILURE_REASONS = Object.freeze({
  NO_RESOURCE: "NO_RESOURCE",
  RESOURCE_FETCH_FAILED: "RESOURCE_FETCH_FAILED",
  RESOURCE_ACCESS_DENIED: "RESOURCE_ACCESS_DENIED",
  INVALID_RESOURCE: "INVALID_RESOURCE",
  PDF_DOWNLOAD_FAILED: "PDF_DOWNLOAD_FAILED",
  PDF_INVALID: "PDF_INVALID",
  PDF_TEXT_CORRUPTED: "PDF_TEXT_CORRUPTED",
  PDF_OCR_REQUIRED: "PDF_OCR_REQUIRED",
  PDF_OCR_FAILED: "PDF_OCR_FAILED",
  PDF_PARTIAL_EXTRACTION: "PDF_PARTIAL_EXTRACTION",
  HTML_FETCH_FAILED: "HTML_FETCH_FAILED",
  HTML_DYNAMIC_CONTENT: "HTML_DYNAMIC_CONTENT",
  HTML_LOW_QUALITY: "HTML_LOW_QUALITY",
  HTML_EXTRACTION_FAILED: "HTML_EXTRACTION_FAILED",
  TEXT_NOT_EXTRACTED: "TEXT_NOT_EXTRACTED",
  NO_VALID_CHUNKS: "NO_VALID_CHUNKS",
  CHUNKING_FAILED: "CHUNKING_FAILED",
  FTS_INDEX_FAILED: "FTS_INDEX_FAILED",
  RETRIEVAL_PROBE_FAILED: "RETRIEVAL_PROBE_FAILED",
  PROCESSING_PENDING: "PROCESSING_PENDING",
  PROCESSING_FAILED: "PROCESSING_FAILED",
  DEAD_LETTER: "DEAD_LETTER",
  UNSUPPORTED_RESOURCE: "UNSUPPORTED_RESOURCE",
  MANUAL_REVIEW_REQUIRED: "MANUAL_REVIEW_REQUIRED",
});

const number = (value) => Number(value || 0);
const lower = (value) => String(value || "").toLowerCase();

const primaryFailureReason = (row, capabilities) => {
  if (capabilities.searchReady) return null;
  const code = row.failure_code || classifyFailureCode({
    failureReason: row.failure_reason,
    failureStage: row.failure_stage,
    processingStatus: row.processing_status,
    extractionStatus: row.extraction_status,
    chunksCount: row.chunk_count,
    hasPdf: Boolean(row.pdf_url),
    hasAccessibleResource: number(row.accessible_resource_count) > 0,
  });
  const combined = lower([code, row.failure_reason, row.readiness_reason, row.failure_stage].join(" "));
  if (row.dead_letter) return FAILURE_REASONS.DEAD_LETTER;
  if (/access.denied|forbidden|unauthorized|403|401/.test(combined)) return FAILURE_REASONS.RESOURCE_ACCESS_DENIED;
  if (/html.dynamic/.test(combined)) return FAILURE_REASONS.HTML_DYNAMIC_CONTENT;
  if (/html.*low.quality|html.*empty/.test(combined)) return FAILURE_REASONS.HTML_LOW_QUALITY;
  if (/html.*fetch|html.*redirect|html.*content.type/.test(combined)) return FAILURE_REASONS.HTML_FETCH_FAILED;
  if (/html.*extract/.test(combined)) return FAILURE_REASONS.HTML_EXTRACTION_FAILED;
  if (/ocr.required|scanned/.test(combined) || row.ocr_status === "pending") return FAILURE_REASONS.PDF_OCR_REQUIRED;
  if (/ocr/.test(combined) && /fail|unavailable|error/.test(combined)) return FAILURE_REASONS.PDF_OCR_FAILED;
  if (number(row.failed_page_count) > 0 && number(row.usable_chunk_count) > 0) return FAILURE_REASONS.PDF_PARTIAL_EXTRACTION;
  if (/pdf.corrupt|pdf.encrypted|invalid.pdf/.test(combined)) return FAILURE_REASONS.PDF_INVALID;
  if (/encoding|replacement|font|corrupt.*text/.test(combined)) return FAILURE_REASONS.PDF_TEXT_CORRUPTED;
  if (/download|dns|tls|timeout|not.found|404|410/.test(combined) && row.pdf_url) return FAILURE_REASONS.PDF_DOWNLOAD_FAILED;
  if (!capabilities.resourceReady) {
    if (row.source_url || row.canonical_url) return FAILURE_REASONS.RESOURCE_FETCH_FAILED;
    return FAILURE_REASONS.NO_RESOURCE;
  }
  if (["queued", "running", "processing"].includes(row.processing_status)) return FAILURE_REASONS.PROCESSING_PENDING;
  if (!capabilities.textReady && row.extraction_status === "failed") return FAILURE_REASONS.TEXT_NOT_EXTRACTED;
  if (number(row.chunk_count) === 0 && row.chunking_status === "failed") return FAILURE_REASONS.CHUNKING_FAILED;
  if (number(row.usable_chunk_count) === 0) return FAILURE_REASONS.NO_VALID_CHUNKS;
  if (!row.lexical_ready) return FAILURE_REASONS.FTS_INDEX_FAILED;
  if (!row.retrieval_verified) return FAILURE_REASONS.RETRIEVAL_PROBE_FAILED;
  if (/unsupported/.test(combined)) return FAILURE_REASONS.UNSUPPORTED_RESOURCE;
  if (row.processing_status === "failed") return FAILURE_REASONS.PROCESSING_FAILED;
  return FAILURE_REASONS.MANUAL_REVIEW_REQUIRED;
};

const classifyAuditRow = (row = {}) => {
  const chunkCount = number(row.chunk_count);
  const usableChunkCount = number(row.usable_chunk_count);
  const vectorCount = number(row.vector_reference_count);
  const policyEdgeHtml = ["policyedge", "policy-edge"].includes(lower(row.source)) && !row.pdf_url;
  const resourceType = number(row.html_resource_count) > 0 || policyEdgeHtml
    ? "HTML"
    : row.pdf_url || number(row.pdf_resource_count) > 0
      ? "PDF"
      : number(row.text_resource_count) > 0
        ? "TEXT"
        : "OTHER";
  const resourceReady = Boolean(
    row.resource_ready || number(row.accessible_resource_count) > 0 ||
    (policyEdgeHtml && row.canonical_url),
  );
  const textReady = Boolean(row.text_ready && chunkCount > 0 && usableChunkCount > 0);
  const lexicalReady = Boolean(row.search_ready && textReady && row.lexical_ready);
  const retrievalVerified = Boolean(row.retrieval_verified && lexicalReady);
  const semanticReady = Boolean(
    row.semantic_ready && vectorCount > 0 && vectorCount >= usableChunkCount &&
    row.embedding_status === "ready",
  );
  const capabilities = {
    catalogued: Boolean(row.catalogued ?? true),
    resourceReady,
    textReady,
    searchReady: lexicalReady && retrievalVerified,
    semanticReady,
    chatReady: Boolean(row.chat_ready && lexicalReady && retrievalVerified),
    comparisonReady: Boolean(row.capability_comparison_ready && row.chat_ready && lexicalReady && retrievalVerified),
  };
  const failureReason = primaryFailureReason(row, capabilities);
  const combinedFailure = lower([row.failure_code, row.failure_reason, failureReason].join(" "));
  const retryable = Boolean(row.retry_eligible ?? isRetryableFailure(row.failure_code));
  const manual = [
    FAILURE_REASONS.RESOURCE_ACCESS_DENIED,
    FAILURE_REASONS.INVALID_RESOURCE,
    FAILURE_REASONS.PDF_INVALID,
    FAILURE_REASONS.UNSUPPORTED_RESOURCE,
    FAILURE_REASONS.MANUAL_REVIEW_REQUIRED,
    FAILURE_REASONS.DEAD_LETTER,
  ].includes(failureReason);
  let recoveryGroup = null;
  if (!capabilities.searchReady) {
    if (manual) recoveryGroup = "F_MANUAL_RESTRICTED";
    else if (textReady || usableChunkCount > 0) recoveryGroup = "A_CHEAP_AUTOMATIC";
    else if (resourceType === "HTML") recoveryGroup = "D_HTML_PREPARATION";
    else if (/ocr|scanned/.test(combinedFailure)) recoveryGroup = "C_SELECTIVE_OCR";
    else if (resourceType === "PDF" && (number(row.text_length) > 500_000 || lower(row.document_type) === "gazette")) recoveryGroup = "E_LARGE_DOCUMENT";
    else if (resourceType === "PDF") recoveryGroup = "B_NATIVE_EXTRACTION";
    else recoveryGroup = retryable ? "A_CHEAP_AUTOMATIC" : "F_MANUAL_RESTRICTED";
  }
  const accessed = number(row.interaction_count) > 0;
  const primaryAuthority = /^(a|primary|official|statutory)/.test(lower(row.authority_class));
  const recent = row.publication_date && new Date(row.publication_date).getTime() >= Date.now() - 730 * 24 * 60 * 60 * 1000;
  const priority = accessed ? "P0" : primaryAuthority || recent || lower(row.document_type).match(/act|rule|regulation|notification|circular/) ? "P1" : number(row.year) >= 2000 ? "P2" : "P3";
  return {
    documentId: String(row.document_id),
    source: row.source || "unknown",
    authorityClass: row.authority_class || "UNKNOWN",
    documentType: row.document_type || "document",
    jurisdiction: row.jurisdiction || null,
    state: row.state || null,
    year: row.year == null ? null : number(row.year),
    title: row.title || "Untitled document",
    resourceType,
    resourceAvailable: resourceReady,
    resourceFetchable: number(row.accessible_resource_count) > 0 || policyEdgeHtml,
    capabilities,
    chunkCount,
    usableChunkCount,
    failedPageCount: number(row.failed_page_count),
    extractionMethod: row.extraction_method || null,
    qualityState: row.quality_state || null,
    processingStage: row.pipeline_stage || row.failure_stage || row.processing_status || "not_started",
    lastFailure: row.failure_reason || row.readiness_reason || null,
    failureClass: failureReason,
    failureCount: number(row.retry_count),
    retryable,
    recoveryGroup,
    priority,
  };
};

const increment = (target, key) => {
  const safeKey = key || "unknown";
  target[safeKey] = (target[safeKey] || 0) + 1;
};

const summarize = (documents, timings, databaseBytes) => {
  const funnel = {
    catalogued: 0,
    resourceReady: 0,
    textReady: 0,
    searchReady: 0,
    chatReady: 0,
    comparisonReady: 0,
    semanticReady: 0,
  };
  const bySource = {};
  const byResourceType = {};
  const byFailureReason = {};
  const byRecoveryGroup = {};
  const byPriority = {};
  for (const document of documents) {
    for (const key of Object.keys(funnel)) {
      if (document.capabilities[key]) funnel[key] += 1;
    }
    increment(bySource, document.source);
    increment(byResourceType, document.resourceType);
    increment(byFailureReason, document.failureClass);
    increment(byRecoveryGroup, document.recoveryGroup);
    increment(byPriority, document.priority);
  }
  const timingByGroup = Object.fromEntries(timings.map((item) => [item.recovery_group, {
    completed: number(item.completed),
    averageMs: number(item.average_ms),
    p50Ms: number(item.p50_ms),
    p95Ms: number(item.p95_ms),
  }]));
  const eta = Object.entries(byRecoveryGroup)
    .filter(([group]) => group !== "unknown" && group !== "F_MANUAL_RESTRICTED")
    .map(([group, count]) => ({
      group,
      count,
      measuredAverageMs: timingByGroup[group]?.averageMs || null,
      sequentialMs: timingByGroup[group]?.averageMs
        ? count * timingByGroup[group].averageMs
        : null,
    }));
  const estimatedSequentialMs = eta.every((item) => item.sequentialMs != null)
    ? eta.reduce((sum, item) => sum + item.sequentialMs, 0)
    : null;
  return {
    generatedAt: new Date().toISOString(),
    readOnly: true,
    totalPublicCatalogue: documents.length,
    funnel,
    notSearchReady: documents.length - funnel.searchReady,
    automaticallyRecoverable: documents.filter((item) => item.recoveryGroup && item.recoveryGroup !== "F_MANUAL_RESTRICTED").length,
    retryable: documents.filter((item) => !item.capabilities.searchReady && item.retryable).length,
    manualReview: documents.filter((item) => item.recoveryGroup === "F_MANUAL_RESTRICTED").length,
    permanentlyUnavailable: documents.filter((item) => !item.capabilities.searchReady && !item.retryable && item.recoveryGroup === "F_MANUAL_RESTRICTED").length,
    bySource,
    byResourceType,
    byFailureReason,
    byRecoveryGroup,
    byPriority,
    measuredTiming: timingByGroup,
    eta: {
      groups: eta,
      sequentialMs: estimatedSequentialMs,
      safeBatchMs: estimatedSequentialMs == null ? null : Math.ceil(estimatedSequentialMs / 3),
      assumptions: "ETA uses completed production job durations grouped by observed extraction mode. Missing group measurements remain null rather than using a guessed average.",
    },
    databaseBytes: number(databaseBytes),
  };
};

const runResearchReadinessAudit = async ({ includeDocuments = false, sampleLimit = 25 } = {}) => {
  const [rows, timingResult, sizeResult] = await Promise.all([
    query(`
      SELECT
        document.id AS document_id, document.title, document.document_type,
        document.jurisdiction, document.state, document.year,
        document.source_authority_tier AS authority_class,
        document.publication_date,
        COALESCE(legacy.canonical_source, legacy.source_name, 'unknown') AS source,
        COALESCE(legacy.canonical_url, legacy.detail_url, legacy.source_url) AS canonical_url,
        legacy.source_url, legacy.pdf_url,
        state.catalogued, state.resource_ready, state.text_ready,
        state.search_ready, state.semantic_ready, state.chat_ready,
        state.capability_comparison_ready, state.processing_status,
        state.extraction_status, state.chunking_status, state.embedding_status,
        state.ocr_status, state.extraction_method, state.text_length,
        state.retrieval_mode, state.retrieval_verified, state.pipeline_stage,
        state.failure_stage, state.failure_code, state.failure_reason,
        state.readiness_reason, state.retry_eligible, state.retry_count,
        COALESCE(resources.accessible_resource_count, 0)::INTEGER AS accessible_resource_count,
        COALESCE(resources.pdf_resource_count, 0)::INTEGER AS pdf_resource_count,
        COALESCE(resources.html_resource_count, 0)::INTEGER AS html_resource_count,
        COALESCE(resources.text_resource_count, 0)::INTEGER AS text_resource_count,
        COALESCE(chunks.chunk_count, 0)::INTEGER AS chunk_count,
        COALESCE(chunks.usable_chunk_count, 0)::INTEGER AS usable_chunk_count,
        COALESCE(chunks.vector_reference_count, 0)::INTEGER AS vector_reference_count,
        COALESCE(interactions.interaction_count, 0)::INTEGER AS interaction_count,
        COALESCE(ocr.failed_page_count, 0)::INTEGER AS failed_page_count,
        state.search_ready AS lexical_ready,
        state.readiness_class AS quality_state,
        EXISTS (
          SELECT 1 FROM document_processing_jobs job
          WHERE job.document_id = document.id AND job.status = 'dead_letter'
        ) AS dead_letter
      FROM documents document
      JOIN legislative_documents legacy ON legacy.id = document.id
      LEFT JOIN document_processing_state state ON state.document_id = document.id
      LEFT JOIN LATERAL (
        SELECT
          COUNT(*) FILTER (WHERE is_accessible AND resource_type IN ('pdf', 'html', 'text')) AS accessible_resource_count,
          COUNT(*) FILTER (WHERE is_accessible AND resource_type = 'pdf') AS pdf_resource_count,
          COUNT(*) FILTER (WHERE is_accessible AND resource_type = 'html') AS html_resource_count,
          COUNT(*) FILTER (WHERE is_accessible AND resource_type = 'text') AS text_resource_count
        FROM document_resources resource WHERE resource.document_id = document.id
      ) resources ON TRUE
      LEFT JOIN LATERAL (
        SELECT COUNT(*) AS chunk_count,
          COUNT(*) FILTER (WHERE LENGTH(TRIM(original_text)) > 0) AS usable_chunk_count,
          COUNT(vector_reference) AS vector_reference_count
        FROM document_text_chunks chunk WHERE chunk.document_id = document.id
      ) chunks ON TRUE
      LEFT JOIN LATERAL (
        SELECT COALESCE(SUM(count), 0) AS interaction_count
        FROM user_document_interactions interaction WHERE interaction.document_id = document.id
      ) interactions ON TRUE
      LEFT JOIN LATERAL (
        SELECT CASE
          WHEN JSONB_TYPEOF(metadata_json -> 'failedPages') = 'array'
          THEN JSONB_ARRAY_LENGTH(metadata_json -> 'failedPages')
          ELSE 0 END AS failed_page_count
        FROM document_processing_stages stage
        WHERE stage.document_id = document.id AND stage.stage = 'OCR'
        LIMIT 1
      ) ocr ON TRUE
      WHERE document.visibility_status = 'public'
      ORDER BY document.id
    `),
    query(`
      SELECT recovery_group, COUNT(*)::INTEGER AS completed,
        ROUND(AVG(duration_ms))::INTEGER AS average_ms,
        PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY duration_ms)::INTEGER AS p50_ms,
        PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY duration_ms)::INTEGER AS p95_ms
      FROM (
        SELECT job.duration_ms,
          CASE
            WHEN state.extraction_method = 'source_html' THEN 'D_HTML_PREPARATION'
            WHEN state.extraction_method ILIKE '%ocr%' THEN 'C_SELECTIVE_OCR'
            WHEN document.document_type = 'gazette' OR state.text_length > 500000 THEN 'E_LARGE_DOCUMENT'
            ELSE 'B_NATIVE_EXTRACTION'
          END AS recovery_group
        FROM document_processing_jobs job
        JOIN document_processing_state state ON state.document_id = job.document_id
        JOIN documents document ON document.id = job.document_id
        WHERE job.status = 'completed' AND job.duration_ms > 0
      ) measured
      GROUP BY recovery_group
    `),
    query("SELECT PG_DATABASE_SIZE(CURRENT_DATABASE())::BIGINT AS bytes"),
  ]);
  const documents = rows.rows.map(classifyAuditRow);
  const summary = summarize(documents, timingResult.rows, sizeResult.rows[0]?.bytes);
  const nonReady = documents.filter((item) => !item.capabilities.searchReady);
  return {
    ...summary,
    samples: {
      nonReady: nonReady.slice(0, sampleLimit),
      manualReview: nonReady.filter((item) => item.recoveryGroup === "F_MANUAL_RESTRICTED").slice(0, sampleLimit),
      retryable: nonReady.filter((item) => item.retryable).slice(0, sampleLimit),
    },
    ...(includeDocuments ? { documents } : {}),
  };
};

module.exports = {
  FAILURE_REASONS,
  classifyAuditRow,
  primaryFailureReason,
  runResearchReadinessAudit,
  summarize,
};
