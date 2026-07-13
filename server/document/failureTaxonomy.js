const FAILURE_CODES = Object.freeze({
  SOURCE_URL_MISSING: "SOURCE_URL_MISSING",
  SOURCE_URL_UNREACHABLE: "SOURCE_URL_UNREACHABLE",
  HTTP_UNAUTHORIZED: "HTTP_UNAUTHORIZED",
  HTTP_FORBIDDEN: "HTTP_FORBIDDEN",
  HTTP_NOT_FOUND: "HTTP_NOT_FOUND",
  HTTP_RATE_LIMITED: "HTTP_RATE_LIMITED",
  HTTP_SERVER_ERROR: "HTTP_SERVER_ERROR",
  DOWNLOAD_TIMEOUT: "DOWNLOAD_TIMEOUT",
  NETWORK_ERROR: "NETWORK_ERROR",
  INVALID_MIME_TYPE: "INVALID_MIME_TYPE",
  PDF_CORRUPT: "PDF_CORRUPT",
  PDF_ENCRYPTED: "PDF_ENCRYPTED",
  PDF_SCANNED_OCR_REQUIRED: "PDF_SCANNED_OCR_REQUIRED",
  OCR_UNAVAILABLE: "OCR_UNAVAILABLE",
  TEXT_EXTRACTION_EMPTY: "TEXT_EXTRACTION_EMPTY",
  TEXT_EXTRACTION_TOO_SHORT: "TEXT_EXTRACTION_TOO_SHORT",
  CHUNKING_EMPTY: "CHUNKING_EMPTY",
  EMBEDDING_PROVIDER_ERROR: "EMBEDDING_PROVIDER_ERROR",
  VECTOR_STORE_ERROR: "VECTOR_STORE_ERROR",
  SUMMARY_PROVIDER_ERROR: "SUMMARY_PROVIDER_ERROR",
  RETRIEVAL_VERIFICATION_FAILED: "RETRIEVAL_VERIFICATION_FAILED",
  DUPLICATE_CANONICAL_CONFLICT: "DUPLICATE_CANONICAL_CONFLICT",
  METADATA_INCOMPLETE: "METADATA_INCOMPLETE",
  PROCESSING_TIMEOUT: "PROCESSING_TIMEOUT",
  PROVIDER_AUTH_ERROR: "PROVIDER_AUTH_ERROR",
  PROVIDER_QUOTA_ERROR: "PROVIDER_QUOTA_ERROR",
  UNKNOWN_PROCESSING_ERROR: "UNKNOWN_PROCESSING_ERROR",
});

const PERMANENT_CODES = new Set([
  FAILURE_CODES.SOURCE_URL_MISSING,
  FAILURE_CODES.HTTP_UNAUTHORIZED,
  FAILURE_CODES.HTTP_FORBIDDEN,
  FAILURE_CODES.HTTP_NOT_FOUND,
  FAILURE_CODES.INVALID_MIME_TYPE,
  FAILURE_CODES.PDF_CORRUPT,
  FAILURE_CODES.PDF_ENCRYPTED,
  FAILURE_CODES.TEXT_EXTRACTION_EMPTY,
  FAILURE_CODES.TEXT_EXTRACTION_TOO_SHORT,
  FAILURE_CODES.CHUNKING_EMPTY,
  FAILURE_CODES.DUPLICATE_CANONICAL_CONFLICT,
  FAILURE_CODES.METADATA_INCOMPLETE,
]);

const STAGE_BY_CODE = Object.freeze({
  [FAILURE_CODES.SOURCE_URL_MISSING]: "source",
  [FAILURE_CODES.SOURCE_URL_UNREACHABLE]: "download",
  [FAILURE_CODES.HTTP_UNAUTHORIZED]: "download",
  [FAILURE_CODES.HTTP_FORBIDDEN]: "download",
  [FAILURE_CODES.HTTP_NOT_FOUND]: "download",
  [FAILURE_CODES.HTTP_RATE_LIMITED]: "download",
  [FAILURE_CODES.HTTP_SERVER_ERROR]: "download",
  [FAILURE_CODES.DOWNLOAD_TIMEOUT]: "download",
  [FAILURE_CODES.NETWORK_ERROR]: "download",
  [FAILURE_CODES.INVALID_MIME_TYPE]: "pdf",
  [FAILURE_CODES.PDF_CORRUPT]: "pdf",
  [FAILURE_CODES.PDF_ENCRYPTED]: "pdf",
  [FAILURE_CODES.PDF_SCANNED_OCR_REQUIRED]: "ocr",
  [FAILURE_CODES.OCR_UNAVAILABLE]: "ocr",
  [FAILURE_CODES.TEXT_EXTRACTION_EMPTY]: "extraction",
  [FAILURE_CODES.TEXT_EXTRACTION_TOO_SHORT]: "extraction",
  [FAILURE_CODES.CHUNKING_EMPTY]: "chunking",
  [FAILURE_CODES.EMBEDDING_PROVIDER_ERROR]: "embedding",
  [FAILURE_CODES.VECTOR_STORE_ERROR]: "vector_store",
  [FAILURE_CODES.SUMMARY_PROVIDER_ERROR]: "summary",
  [FAILURE_CODES.RETRIEVAL_VERIFICATION_FAILED]: "retrieval",
  [FAILURE_CODES.DUPLICATE_CANONICAL_CONFLICT]: "dedupe",
  [FAILURE_CODES.METADATA_INCOMPLETE]: "metadata",
  [FAILURE_CODES.PROCESSING_TIMEOUT]: "processing",
  [FAILURE_CODES.PROVIDER_AUTH_ERROR]: "ai_provider",
  [FAILURE_CODES.PROVIDER_QUOTA_ERROR]: "ai_provider",
  [FAILURE_CODES.UNKNOWN_PROCESSING_ERROR]: "processing",
});

const isRetryableFailure = (code) =>
  Boolean(code) && !PERMANENT_CODES.has(code);

const normalizeMessage = (value) =>
  String(value || "").normalize("NFKC").toLowerCase();

const statusCodeFrom = (input = {}) =>
  Number(input.httpStatus || input.status || input.error?.response?.status || input.error?.status || 0);

const messageFrom = (input = {}) =>
  normalizeMessage([
    input.failureReason,
    input.readinessReason,
    input.errorMessage,
    input.error?.message,
    input.error?.code,
    input.failureStage,
    input.pipelineStage,
    input.readinessClass,
    input.pdfStatus,
    input.extractionStatus,
    input.embeddingStatus,
    input.summaryStatus,
    input.ocrStatus,
    input.mimeType,
  ].filter(Boolean).join(" "));

const classifyFailureCode = (input = {}) => {
  const status = statusCodeFrom(input);
  const message = messageFrom(input);

  if (!input.hasPdf && !input.hasAccessibleResource && /missing_pdf|source only|no verified pdf|no accessible/.test(message)) {
    return FAILURE_CODES.SOURCE_URL_MISSING;
  }
  if (status === 401) return FAILURE_CODES.HTTP_UNAUTHORIZED;
  if (status === 403) return FAILURE_CODES.HTTP_FORBIDDEN;
  if (status === 404 || status === 410 || /404|410|not found/.test(message)) {
    return FAILURE_CODES.HTTP_NOT_FOUND;
  }
  if (status === 429 || /429|rate limit/.test(message)) {
    return FAILURE_CODES.HTTP_RATE_LIMITED;
  }
  if (status >= 500 || /502|503|504|server error|unavailable/.test(message)) {
    return FAILURE_CODES.HTTP_SERVER_ERROR;
  }
  if (/timeout|timed out|deadline|aborted/.test(message)) {
    return /download|fetch/.test(message)
      ? FAILURE_CODES.DOWNLOAD_TIMEOUT
      : FAILURE_CODES.PROCESSING_TIMEOUT;
  }
  if (/enotfound|econn|socket hang up|network|dns|reset/.test(message)) {
    return FAILURE_CODES.NETWORK_ERROR;
  }
  if (/unsupported file|unsupported mime|invalid mime|content[- ]type|not a pdf/.test(message)) {
    return FAILURE_CODES.INVALID_MIME_TYPE;
  }
  if (/encrypted pdf|password/.test(message)) {
    return FAILURE_CODES.PDF_ENCRYPTED;
  }
  if (/invalid pdf|corrupt|malformed pdf|bad xref/.test(message)) {
    return FAILURE_CODES.PDF_CORRUPT;
  }
  if (/scanned|ocr required|ocr_required/.test(message)) {
    return FAILURE_CODES.PDF_SCANNED_OCR_REQUIRED;
  }
  if (/ocr.*unavailable|tesseract|vision unavailable/.test(message)) {
    return FAILURE_CODES.OCR_UNAVAILABLE;
  }
  if (/no usable text|empty text|extraction.*empty/.test(message)) {
    return FAILURE_CODES.TEXT_EXTRACTION_EMPTY;
  }
  if (/too short|insufficient text|insufficient to create/.test(message)) {
    return FAILURE_CODES.TEXT_EXTRACTION_TOO_SHORT;
  }
  if (/chunk|passage/.test(message) && /empty|no usable|without creating/.test(message)) {
    return FAILURE_CODES.CHUNKING_EMPTY;
  }
  if (/retrieval verification failed|retrieval.*failed|no retrieval path/.test(message)) {
    return FAILURE_CODES.RETRIEVAL_VERIFICATION_FAILED;
  }
  if (/embed|embedding/.test(message)) {
    return FAILURE_CODES.EMBEDDING_PROVIDER_ERROR;
  }
  if (/pinecone|vector/.test(message)) {
    return FAILURE_CODES.VECTOR_STORE_ERROR;
  }
  if (/summary|gemini|openai|model|generation/.test(message)) {
    if (/auth|api key|credential|unauthorized|forbidden/.test(message)) {
      return FAILURE_CODES.PROVIDER_AUTH_ERROR;
    }
    if (/billing|quota|limit/.test(message)) {
      return FAILURE_CODES.PROVIDER_QUOTA_ERROR;
    }
    return FAILURE_CODES.SUMMARY_PROVIDER_ERROR;
  }
  if (/duplicate|canonical conflict/.test(message)) {
    return FAILURE_CODES.DUPLICATE_CANONICAL_CONFLICT;
  }
  if (/metadata|title|date|ministry|jurisdiction/.test(message)) {
    return FAILURE_CODES.METADATA_INCOMPLETE;
  }
  if (input.ocrStatus === "pending") return FAILURE_CODES.PDF_SCANNED_OCR_REQUIRED;
  if (input.chunksCount === 0 && input.processingStatus === "failed") {
    return FAILURE_CODES.CHUNKING_EMPTY;
  }
  return FAILURE_CODES.UNKNOWN_PROCESSING_ERROR;
};

const classifyFailure = (input = {}) => {
  const failureCode = classifyFailureCode(input);
  const retryEligible = isRetryableFailure(failureCode);
  return {
    failureCode,
    retryEligible,
    pipelineStage: STAGE_BY_CODE[failureCode] || "processing",
    readinessClass: retryEligible
      ? "processing_failed_retriable"
      : "processing_failed_permanent",
  };
};

module.exports = {
  FAILURE_CODES,
  STAGE_BY_CODE,
  classifyFailure,
  classifyFailureCode,
  isRetryableFailure,
};
