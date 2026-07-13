const assert = require("node:assert/strict");
const test = require("node:test");

const {
  FAILURE_CODES,
  classifyFailure,
  classifyFailureCode,
  isRetryableFailure,
} = require("../document/failureTaxonomy");

test("failure taxonomy classifies permanent source and PDF failures", () => {
  assert.equal(
    classifyFailureCode({ status: 404, failureReason: "PDF not found" }),
    FAILURE_CODES.DOWNLOAD_NOT_FOUND,
  );
  assert.equal(isRetryableFailure(FAILURE_CODES.DOWNLOAD_NOT_FOUND), false);

  const corrupt = classifyFailure({
    failureReason: "invalid pdf: bad xref table",
    processingStatus: "failed",
  });
  assert.equal(corrupt.failureCode, FAILURE_CODES.PDF_CORRUPT);
  assert.equal(corrupt.retryEligible, false);
  assert.equal(corrupt.pipelineStage, "pdf");
  assert.equal(corrupt.readinessClass, "processing_failed_permanent");
});

test("failure taxonomy classifies transient provider and network failures", () => {
  const network = classifyFailure({
    failureReason: "ECONNRESET while downloading document",
  });
  assert.equal(network.failureCode, FAILURE_CODES.NETWORK_ERROR);
  assert.equal(network.retryEligible, true);
  assert.equal(network.pipelineStage, "download");

  const quota = classifyFailure({
    failureReason: "Gemini provider quota exceeded",
  });
  assert.equal(quota.failureCode, FAILURE_CODES.PROVIDER_QUOTA_ERROR);
  assert.equal(quota.retryEligible, true);
  assert.equal(quota.pipelineStage, "ai_provider");
});

test("failure taxonomy prevents permanent/retryable contradictions", () => {
  const scanned = classifyFailure({
    failureReason: "The scanned PDF is too large for inline OCR processing.",
  });
  assert.equal(scanned.failureCode, FAILURE_CODES.PDF_SCANNED_OCR_REQUIRED);
  assert.equal(scanned.retryEligible, false);
  assert.equal(scanned.readinessClass, "processing_failed_permanent");

  const encoding = classifyFailure({
    failureReason: "unsupported Unicode escape sequence",
  });
  assert.equal(encoding.failureCode, FAILURE_CODES.TEXT_ENCODING_UNSUPPORTED);
  assert.equal(encoding.retryEligible, false);
  assert.equal(encoding.pipelineStage, "chunking");
});

test("failure taxonomy gives chunk and retrieval errors stable codes", () => {
  assert.equal(
    classifyFailureCode({
      failureReason: "Processing completed without creating research passages.",
    }),
    FAILURE_CODES.CHUNKING_EMPTY,
  );
  assert.equal(
    classifyFailureCode({
      failureReason: "Research passages were stored but retrieval verification failed.",
    }),
    FAILURE_CODES.RETRIEVAL_VERIFICATION_FAILED,
  );
});
