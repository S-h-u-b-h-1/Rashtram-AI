const SOURCE_ONLY_FAILURE_CODES = new Set([
  "DOWNLOAD_URL_MISSING",
  "DOWNLOAD_URL_INVALID",
  "DOWNLOAD_ACCESS_DENIED",
  "DOWNLOAD_NOT_FOUND",
  "DOWNLOAD_HTML_RESPONSE",
  "DOWNLOAD_UNSUPPORTED_CONTENT",
  "DOWNLOAD_ZERO_BYTE",
  "DOWNLOAD_TRUNCATED",
  "DOWNLOAD_CHECKSUM_MISMATCH",
  "INVALID_MIME_TYPE",
  "PDF_CORRUPT",
  "PDF_ENCRYPTED",
  "TEXT_EXTRACTION_EMPTY",
  "TEXT_EXTRACTION_TOO_SHORT",
  "TEXT_ENCODING_UNSUPPORTED",
  "CHUNKING_EMPTY",
]);

const retryableReadinessClasses = new Set([
  "pdf_available",
  "pdf_available_not_processed",
  "source_extractable_not_processed",
  "processing_failed_retriable",
  "ocr_required",
]);

const sourceOnlyReadinessClasses = new Set([
  "source_only",
  "missing_pdf",
  "processing_failed_permanent",
  "unsupported_file_type",
  "invalid_or_quarantined",
]);

const textIncludesTerminalFailure = (document = {}) =>
  [
    document.readinessReason,
    document.failureReason,
    document.processingError,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase()
    .match(/html, not a pdf|not a pdf|unsupported file|invalid pdf|corrupt|encrypted pdf|not found|access denied|zero bytes/);

export const documentReadinessClass = (document = {}) =>
  isResearchReady(document)
    ? "research_ready"
    : document.readinessClass || document.readiness || "";

export const documentCapabilities = (document = {}) => {
  const capabilities = document?.capabilities || {};
  const searchReady =
    capabilities.searchReady ?? document.searchReady ?? document.researchReady ?? false;
  const chatReady =
    capabilities.chatReady ?? document.chatReady ?? document.researchReady ?? false;
  const comparisonReady =
    capabilities.comparisonReady ??
    document.comparisonReady ??
    false;
  return {
    catalogued: capabilities.catalogued ?? true,
    resourceReady:
      capabilities.resourceReady ??
      document.resourceReady ??
      document.hasAccessibleResource ??
      Boolean(document.pdfUrl),
    textReady:
      capabilities.textReady ?? document.textReady ?? Boolean(searchReady),
    searchReady: Boolean(searchReady),
    semanticReady: Boolean(
      capabilities.semanticReady ?? document.semanticReady ?? false,
    ),
    chatReady: Boolean(chatReady),
    comparisonReady: Boolean(comparisonReady && chatReady),
  };
};

export const isResearchReady = (document = {}) =>
  documentCapabilities(document).chatReady;

export const isComparisonReady = (document = {}) =>
  documentCapabilities(document).comparisonReady;

export const isSourceOnlyResearchDocument = (document = {}) => {
  if (!document || isResearchReady(document)) return false;
  const readiness = documentReadinessClass(document);
  if (readiness === "ocr_required") return false;
  if (SOURCE_ONLY_FAILURE_CODES.has(document.failureCode)) return true;
  if (
    document.retryEligible === false &&
    document.failureCode !== "PDF_SCANNED_OCR_REQUIRED"
  ) {
    return true;
  }
  if (sourceOnlyReadinessClasses.has(readiness)) return true;
  return Boolean(textIncludesTerminalFailure(document));
};

export const canPrepareDocumentForResearch = (document = {}) => {
  if (!document || isResearchReady(document)) return false;
  if (isSourceOnlyResearchDocument(document)) return false;
  const readiness = documentReadinessClass(document);
  if (retryableReadinessClasses.has(readiness)) return true;
  return Boolean(document.pdfUrl) || (
    (document.type === "policy" || document.documentType === "policy") &&
    String(document.sourceName || document.source || "")
      .toLowerCase()
      .includes("policyedge") &&
    Boolean(document.sourceUrl)
  );
};

export const shouldShowPdfAction = (document = {}) =>
  Boolean(document.pdfUrl) && !isSourceOnlyResearchDocument(document);
