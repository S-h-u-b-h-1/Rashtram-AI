const FAILURE_CODES = Object.freeze({
  SOURCE_URL_MISSING: "SOURCE_URL_MISSING",
  SOURCE_URL_UNREACHABLE: "SOURCE_URL_UNREACHABLE",
  DOWNLOAD_URL_MISSING: "DOWNLOAD_URL_MISSING",
  DOWNLOAD_URL_INVALID: "DOWNLOAD_URL_INVALID",
  DOWNLOAD_DNS_FAILED: "DOWNLOAD_DNS_FAILED",
  DOWNLOAD_TLS_FAILED: "DOWNLOAD_TLS_FAILED",
  DOWNLOAD_REDIRECT_LOOP: "DOWNLOAD_REDIRECT_LOOP",
  DOWNLOAD_ACCESS_DENIED: "DOWNLOAD_ACCESS_DENIED",
  DOWNLOAD_NOT_FOUND: "DOWNLOAD_NOT_FOUND",
  DOWNLOAD_RATE_LIMITED: "DOWNLOAD_RATE_LIMITED",
  DOWNLOAD_SERVER_ERROR: "DOWNLOAD_SERVER_ERROR",
  DOWNLOAD_HTML_RESPONSE: "DOWNLOAD_HTML_RESPONSE",
  DOWNLOAD_UNSUPPORTED_CONTENT: "DOWNLOAD_UNSUPPORTED_CONTENT",
  DOWNLOAD_ZERO_BYTE: "DOWNLOAD_ZERO_BYTE",
  DOWNLOAD_TRUNCATED: "DOWNLOAD_TRUNCATED",
  DOWNLOAD_CHECKSUM_MISMATCH: "DOWNLOAD_CHECKSUM_MISMATCH",
  DOWNLOAD_EXISTING_FILE_AVAILABLE: "DOWNLOAD_EXISTING_FILE_AVAILABLE",
  DOWNLOAD_CANONICAL_VARIANT_AVAILABLE: "DOWNLOAD_CANONICAL_VARIANT_AVAILABLE",
  DOWNLOAD_UNKNOWN: "DOWNLOAD_UNKNOWN",
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
  TEXT_ENCODING_UNSUPPORTED: "TEXT_ENCODING_UNSUPPORTED",
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
  FAILURE_CODES.DOWNLOAD_URL_MISSING,
  FAILURE_CODES.DOWNLOAD_URL_INVALID,
  FAILURE_CODES.DOWNLOAD_ACCESS_DENIED,
  FAILURE_CODES.DOWNLOAD_NOT_FOUND,
  FAILURE_CODES.DOWNLOAD_HTML_RESPONSE,
  FAILURE_CODES.DOWNLOAD_UNSUPPORTED_CONTENT,
  FAILURE_CODES.DOWNLOAD_ZERO_BYTE,
  FAILURE_CODES.DOWNLOAD_TRUNCATED,
  FAILURE_CODES.DOWNLOAD_CHECKSUM_MISMATCH,
  FAILURE_CODES.HTTP_UNAUTHORIZED,
  FAILURE_CODES.HTTP_FORBIDDEN,
  FAILURE_CODES.HTTP_NOT_FOUND,
  FAILURE_CODES.INVALID_MIME_TYPE,
  FAILURE_CODES.PDF_CORRUPT,
  FAILURE_CODES.PDF_ENCRYPTED,
  FAILURE_CODES.PDF_SCANNED_OCR_REQUIRED,
  FAILURE_CODES.TEXT_EXTRACTION_EMPTY,
  FAILURE_CODES.TEXT_EXTRACTION_TOO_SHORT,
  FAILURE_CODES.TEXT_ENCODING_UNSUPPORTED,
  FAILURE_CODES.CHUNKING_EMPTY,
  FAILURE_CODES.DUPLICATE_CANONICAL_CONFLICT,
  FAILURE_CODES.METADATA_INCOMPLETE,
]);

const STAGE_BY_CODE = Object.freeze({
  [FAILURE_CODES.SOURCE_URL_MISSING]: "source",
  [FAILURE_CODES.SOURCE_URL_UNREACHABLE]: "download",
  [FAILURE_CODES.DOWNLOAD_URL_MISSING]: "download",
  [FAILURE_CODES.DOWNLOAD_URL_INVALID]: "download",
  [FAILURE_CODES.DOWNLOAD_DNS_FAILED]: "download",
  [FAILURE_CODES.DOWNLOAD_TLS_FAILED]: "download",
  [FAILURE_CODES.DOWNLOAD_REDIRECT_LOOP]: "download",
  [FAILURE_CODES.DOWNLOAD_ACCESS_DENIED]: "download",
  [FAILURE_CODES.DOWNLOAD_NOT_FOUND]: "download",
  [FAILURE_CODES.DOWNLOAD_RATE_LIMITED]: "download",
  [FAILURE_CODES.DOWNLOAD_SERVER_ERROR]: "download",
  [FAILURE_CODES.DOWNLOAD_HTML_RESPONSE]: "download",
  [FAILURE_CODES.DOWNLOAD_UNSUPPORTED_CONTENT]: "download",
  [FAILURE_CODES.DOWNLOAD_ZERO_BYTE]: "download",
  [FAILURE_CODES.DOWNLOAD_TRUNCATED]: "download",
  [FAILURE_CODES.DOWNLOAD_CHECKSUM_MISMATCH]: "download",
  [FAILURE_CODES.DOWNLOAD_EXISTING_FILE_AVAILABLE]: "download",
  [FAILURE_CODES.DOWNLOAD_CANONICAL_VARIANT_AVAILABLE]: "download",
  [FAILURE_CODES.DOWNLOAD_UNKNOWN]: "download",
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
  [FAILURE_CODES.TEXT_ENCODING_UNSUPPORTED]: "chunking",
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
  if (input.failureCode && FAILURE_CODES[input.failureCode]) {
    return input.failureCode;
  }
  if (input.error?.failureCode && FAILURE_CODES[input.error.failureCode]) {
    return input.error.failureCode;
  }
  const status = statusCodeFrom(input);
  const message = messageFrom(input);

  if (!input.hasPdf && !input.hasAccessibleResource && /missing_pdf|source only|no verified pdf|no accessible/.test(message)) {
    return FAILURE_CODES.DOWNLOAD_URL_MISSING;
  }
  if (/invalid url|unsupported protocol|private network/.test(message)) {
    return FAILURE_CODES.DOWNLOAD_URL_INVALID;
  }
  if (status === 401) return FAILURE_CODES.DOWNLOAD_ACCESS_DENIED;
  if (status === 403) return FAILURE_CODES.DOWNLOAD_ACCESS_DENIED;
  if (status === 404 || status === 410 || /404|410|not found/.test(message)) {
    return FAILURE_CODES.DOWNLOAD_NOT_FOUND;
  }
  if (status === 429 || /429|rate limit/.test(message)) {
    return FAILURE_CODES.DOWNLOAD_RATE_LIMITED;
  }
  if (status >= 500 || /502|503|504|server error|unavailable/.test(message)) {
    return FAILURE_CODES.DOWNLOAD_SERVER_ERROR;
  }
  if (/timeout|timed out|deadline|aborted/.test(message)) {
    return /download|fetch|pdf/.test(message)
      ? FAILURE_CODES.DOWNLOAD_TIMEOUT
      : FAILURE_CODES.PROCESSING_TIMEOUT;
  }
  if (/too many redirects|redirect loop|max redirects/.test(message)) {
    return FAILURE_CODES.DOWNLOAD_REDIRECT_LOOP;
  }
  if (/certificate|tls|ssl|self signed|unable to verify/.test(message)) {
    return FAILURE_CODES.DOWNLOAD_TLS_FAILED;
  }
  if (/enotfound|econn|socket hang up|network|dns|reset/.test(message)) {
    return /enotfound|dns/.test(message)
      ? FAILURE_CODES.DOWNLOAD_DNS_FAILED
      : FAILURE_CODES.NETWORK_ERROR;
  }
  if (/html|text\/html|doctype|error page|consent page|landing page/.test(message)) {
    return FAILURE_CODES.DOWNLOAD_HTML_RESPONSE;
  }
  if (/unsupported file|unsupported mime|invalid mime|content[- ]type|not a pdf/.test(message)) {
    return FAILURE_CODES.DOWNLOAD_UNSUPPORTED_CONTENT;
  }
  if (/zero[- ]?byte|empty file|0 bytes/.test(message)) {
    return FAILURE_CODES.DOWNLOAD_ZERO_BYTE;
  }
  if (/truncated|content[- ]length mismatch|premature end/.test(message)) {
    return FAILURE_CODES.DOWNLOAD_TRUNCATED;
  }
  if (/checksum mismatch/.test(message)) {
    return FAILURE_CODES.DOWNLOAD_CHECKSUM_MISMATCH;
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
  if (/unsupported unicode|unicode escape|invalid unicode|encoding/.test(message)) {
    return FAILURE_CODES.TEXT_ENCODING_UNSUPPORTED;
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
