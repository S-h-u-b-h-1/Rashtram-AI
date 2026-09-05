import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  MAX_RESEARCH_PDF_BYTES,
  normalizeResearchUploadError,
  researchUploadFailureStage,
  validateResearchPdfCandidate,
} from "../src/lib/research-upload.mjs";

test("research PDF validation keeps the exact 50 MB boundary", () => {
  const file = { size: MAX_RESEARCH_PDF_BYTES, type: "application/pdf" };
  assert.equal(validateResearchPdfCandidate(file), file);
});

test("research PDF validation rejects oversized files with 413 semantics", () => {
  assert.throws(
    () => validateResearchPdfCandidate({
      size: MAX_RESEARCH_PDF_BYTES + 1,
      type: "application/pdf",
    }),
    (error) => {
      assert.equal(error.status, 413);
      assert.equal(error.code, "FILE_TOO_LARGE");
      assert.equal(error.message, "This file exceeds the 50 MB upload limit.");
      return true;
    },
  );
});

test("research PDF validation rejects empty and non-PDF files as invalid documents", () => {
  for (const file of [
    { size: 0, type: "application/pdf" },
    { size: 1024, type: "text/html" },
  ]) {
    assert.throws(
      () => validateResearchPdfCandidate(file),
      (error) => {
        assert.equal(error.status, 422);
        assert.equal(error.code, "INVALID_DOCUMENT");
        return true;
      },
    );
  }
});

test("upload error normalization preserves safe 413, 422, and 503 product messages", () => {
  const tooLarge = normalizeResearchUploadError({ status: 413 });
  assert.equal(tooLarge.message, "This file exceeds the 50 MB upload limit.");
  assert.equal(researchUploadFailureStage(tooLarge), "File too large");

  const invalid = normalizeResearchUploadError({
    status: 422,
    code: "INVALID_DOCUMENT",
    message: "The uploaded file is not a valid PDF.",
  });
  assert.equal(invalid.message, "The uploaded file is not a valid PDF.");
  assert.equal(researchUploadFailureStage(invalid), "Invalid PDF");

  const unavailable = normalizeResearchUploadError({
    status: 503,
    code: "STORAGE_UNAVAILABLE",
    message: "Failed to fetch",
  });
  assert.equal(
    unavailable.message,
    "Private document storage is temporarily unavailable. Please retry later.",
  );
  assert.equal(researchUploadFailureStage(unavailable), "Storage unavailable");
});

test("generic browser network errors no longer surface as Failed to fetch", () => {
  const normalized = normalizeResearchUploadError(new TypeError("Failed to fetch"));
  assert.equal(
    normalized.message,
    "The upload service could not be reached. Check your connection and try again.",
  );
  assert.equal(normalized.code, "UPLOAD_NETWORK_ERROR");
});

test("the study-source UI renders an actionable error and never uses the old generic upload stage", () => {
  const source = fs.readFileSync(
    path.join(process.cwd(), "src/components/document-chat/StudySourcesPanel.jsx"),
    "utf8",
  );
  assert.match(source, /normalizeResearchUploadError/);
  assert.match(source, /researchUploadFailureStage/);
  assert.match(source, /role="alert"/);
  assert.doesNotMatch(source, /setUploadStage\("Upload failed"\)/);
});
