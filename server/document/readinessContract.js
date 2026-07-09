const { query } = require("../db");
const DocumentRepository = require("./DocumentRepository");
const { isExtractableSourceDocument } = require("./documentResearchService");

const READY_STATUSES = new Set(["ready"]);
const PROCESSING_STATUSES = new Set(["queued", "processing", "running"]);

const getDocumentReadiness = async (documentId) => {
  const document = await DocumentRepository.getById(documentId);
  if (!document) return null;

  const countsResult = await query(
    `SELECT
       COUNT(*)::INTEGER AS chunks,
       COUNT(vector_reference)::INTEGER AS vector_refs,
       COALESCE(SUM(CASE WHEN LENGTH(TRIM(original_text)) > 0 THEN 1 ELSE 0 END), 0)::INTEGER
         AS text_chunks
     FROM document_text_chunks
     WHERE document_id = $1`,
    [document.id],
  );
  const resourceResult = await query(
    `SELECT
       BOOL_OR(resource_type IN ('pdf', 'text', 'html') AND is_accessible)
         AS has_accessible_resource,
       BOOL_OR(resource_type = 'pdf' AND is_accessible) AS has_pdf,
       BOOL_OR(resource_type IN ('text', 'html') AND is_accessible)
         AS has_text_or_html
     FROM document_resources
     WHERE document_id = $1`,
    [document.id],
  );
  const counts = countsResult.rows[0] || {};
  const resources = resourceResult.rows[0] || {};
  const chunkCount = Number(counts.chunks || 0);
  const textChunkCount = Number(counts.text_chunks || 0);
  const vectorRefs = Number(counts.vector_refs || 0);
  const embeddings = Number(document.embeddingsCount || 0);
  const hasChunks = chunkCount > 0 && textChunkCount > 0;
  const hasVectorRetrieval =
    document.embeddingStatus === "ready" &&
    embeddings >= chunkCount &&
    vectorRefs >= chunkCount &&
    hasChunks;
  const hasLocalTextRetrieval = hasChunks;
  const hasRetrieval = hasVectorRetrieval || hasLocalTextRetrieval;
  const processableBySource =
    Boolean(document.pdfUrl) ||
    Boolean(resources.has_accessible_resource) ||
    isExtractableSourceDocument(document);
  const processingStatus = document.processingStatus || "not_started";
  const extractionReady = document.extractionStatus === "ready";
  const processingReady = READY_STATUSES.has(processingStatus);
  const failed =
    processingStatus === "failed" ||
    document.extractionStatus === "failed" ||
    document.embeddingStatus === "failed";
  const processing = PROCESSING_STATUSES.has(processingStatus);
  const genuinelyReady =
    document.visibilityStatus !== "hidden_invalid" &&
    Boolean(document.title) &&
    processableBySource &&
    processingReady &&
    extractionReady &&
    document.chunkingStatus === "ready" &&
    hasRetrieval &&
    Boolean(document.retrievalVerified || hasLocalTextRetrieval) &&
    !document.processingError &&
    !document.failureReason;

  let status = "not_ready";
  let reason = null;
  if (genuinelyReady) {
    status = "ready";
  } else if (document.visibilityStatus === "hidden_invalid") {
    status = "failed";
    reason = "Invalid or quarantined catalogue record.";
  } else if (processing) {
    status = "processing";
    reason = "Document processing is in progress.";
  } else if (failed) {
    status = "failed";
    reason =
      document.failureReason ||
      document.readinessReason ||
      document.processingError ||
      "Document processing failed.";
  } else if (!processableBySource) {
    status = document.sourceUrl ? "source_only" : "not_ready";
    reason = document.sourceUrl
      ? "Only a source page is currently available."
      : "No accessible PDF, text, or extractable source is available.";
  } else if (!processingReady) {
    reason =
      document.readinessReason ||
      "This document can be prepared for research and comparison.";
  } else if (!extractionReady) {
    reason = "Text extraction has not completed.";
  } else if (!hasChunks) {
    reason = "No extracted text chunks are available.";
  } else if (!hasRetrieval) {
    reason = "No retrieval path is available for this document.";
  }

  const retrievalMode = hasVectorRetrieval
    ? (hasLocalTextRetrieval ? "hybrid" : "vector")
    : hasLocalTextRetrieval
      ? "local_text"
      : document.retrievalMode || "unknown";
  const canPrepare = !genuinelyReady && processableBySource && !processing;

  return {
    documentId: document.id,
    researchReady: genuinelyReady,
    comparisonReady: genuinelyReady,
    canPrepare,
    status,
    reason,
    requirements: {
      hasValidSource: Boolean(document.title && document.visibilityStatus !== "hidden_invalid"),
      hasAccessibleResource: processableBySource,
      hasExtractedText: extractionReady && hasChunks,
      hasChunks,
      hasEmbeddingsOrFallbackRetrieval: hasRetrieval,
      retrievalVerified: Boolean(document.retrievalVerified || hasLocalTextRetrieval),
    },
    counts: {
      chunks: chunkCount,
      embeddings,
      vectorRefs,
    },
    retrievalMode,
    embeddingStatus: hasVectorRetrieval
      ? "success"
      : hasLocalTextRetrieval
        ? "fallback"
        : document.embeddingStatus || "not_started",
    lastProcessedAt: document.processedAt || null,
    failureStage: document.failureStage,
    failureReason: document.failureReason,
    readinessClass: document.readinessClass,
    readinessReason: reason || document.readinessReason,
    document,
  };
};

module.exports = {
  getDocumentReadiness,
};
