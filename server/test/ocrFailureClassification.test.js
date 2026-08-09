const test = require("node:test");
const assert = require("node:assert/strict");
const {
  classifyFailure,
  classifyFailureCode,
  isRetryableFailure,
} = require("../document/failureTaxonomy");

// Regression cover for a real production misdiagnosis: 326 documents
// failed at the OCR stage with the message "OpenAI OCR is disabled
// because Gemini is the configured AI provider". That string hit the
// generic /summary|gemini|openai|model|generation/ branch and was filed
// as SUMMARY_PROVIDER_ERROR — which reads as benign, because summaries do
// not gate readiness. In reality OCR never ran, so none of those
// documents could ever become research-ready.

test("an OCR-stage failure is not misfiled as a summary provider error", () => {
  const code = classifyFailureCode({
    failureStage: "ocr",
    failureReason:
      "OpenAI OCR is disabled because Gemini is the configured AI provider.",
  });
  assert.notEqual(code, "SUMMARY_PROVIDER_ERROR", "must not look like a summary problem");
  assert.equal(code, "OCR_UNAVAILABLE");
});

test("the corrected message also classifies to OCR, not a provider error", () => {
  const code = classifyFailureCode({
    failureStage: "ocr",
    failureReason:
      "OCR is unavailable: no Gemini API key is configured, and the OpenAI OCR " +
      "path requires AI_PROVIDER=openai to be set explicitly.",
  });
  assert.equal(code, "OCR_UNAVAILABLE");
});

test("an OCR config failure stays retryable so it recovers once config is fixed", () => {
  const { failureCode, retryEligible } = classifyFailure({
    failureStage: "ocr",
    failureReason: "OCR is unavailable: no Gemini API key is configured.",
  });
  assert.equal(failureCode, "OCR_UNAVAILABLE");
  assert.equal(
    retryEligible,
    true,
    "a configuration fault must not be recorded as permanently unprocessable",
  );
});

test("a genuinely scanned-PDF signal is still reported as OCR-required, not config", () => {
  // This one IS a property of the document rather than the environment,
  // so it must keep its own distinct code.
  const code = classifyFailureCode({
    failureStage: "ocr",
    failureReason: "Document is a scanned PDF and ocr required before extraction",
  });
  assert.equal(code, "PDF_SCANNED_OCR_REQUIRED");
});

test("an explicit stage does not hijack unrelated failures", () => {
  // Download and summary failures must still classify normally when the
  // stage says so — the new rule is scoped to OCR only.
  assert.equal(
    classifyFailureCode({ failureStage: "download", failureReason: "503 server error" }),
    "DOWNLOAD_SERVER_ERROR",
  );
  assert.equal(
    classifyFailureCode({
      failureStage: "summary",
      failureReason: "gemini generation model returned an error",
    }),
    "SUMMARY_PROVIDER_ERROR",
  );
});

test("an explicitly supplied failureCode still wins over stage inference", () => {
  assert.equal(
    classifyFailureCode({ failureCode: "PDF_CORRUPT", failureStage: "ocr" }),
    "PDF_CORRUPT",
    "callers that already know the exact code must not be overridden",
  );
});

test("OCR_UNAVAILABLE is not in the permanent set", () => {
  assert.equal(isRetryableFailure("OCR_UNAVAILABLE"), true);
  assert.equal(isRetryableFailure("PDF_SCANNED_OCR_REQUIRED"), false);
});
