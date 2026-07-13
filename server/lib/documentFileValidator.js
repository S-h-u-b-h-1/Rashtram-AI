const crypto = require("node:crypto");
const pdf = require("pdf-parse");
const { FAILURE_CODES } = require("../document/failureTaxonomy");

const PDF_MAGIC = "%PDF";
const HTML_PATTERN = /^\s*(?:<!doctype\s+html|<html[\s>]|<head[\s>]|<body[\s>])/i;

const sha256Buffer = (buffer) =>
  crypto.createHash("sha256").update(buffer).digest("hex");

const hasPdfSignature = (buffer) =>
  Buffer.isBuffer(buffer) && buffer.subarray(0, 4).toString("latin1") === PDF_MAGIC;

const looksLikeHtml = (buffer, contentType = "") => {
  if (/text\/html|application\/xhtml/i.test(String(contentType || ""))) {
    return true;
  }
  return HTML_PATTERN.test(
    Buffer.from(buffer || Buffer.alloc(0))
      .subarray(0, 2048)
      .toString("utf8"),
  );
};

const detectEncryptedPdf = (buffer) =>
  /\/Encrypt\b/.test(
    Buffer.from(buffer || Buffer.alloc(0))
      .subarray(0, Math.min(buffer.length || 0, 1_000_000))
      .toString("latin1"),
  );

const validateDownloadedFile = async (
  buffer,
  {
    url = null,
    contentType = null,
    contentLength = null,
    expectedExtension = "pdf",
    existingChecksums = new Set(),
    minimumPdfBytes = 512,
  } = {},
) => {
  const value = Buffer.from(buffer || Buffer.alloc(0));
  const checksumSha256 = sha256Buffer(value);
  const declaredLength = Number(contentLength || 0);
  const validation = {
    ok: false,
    url,
    checksumSha256,
    sizeBytes: value.length,
    contentType: contentType || null,
    contentLength: declaredLength || null,
    expectedExtension,
    isPdfSignature: hasPdfSignature(value),
    isHtml: looksLikeHtml(value, contentType),
    isEncrypted: false,
    pageCount: 0,
    duplicateExistingFile: existingChecksums.has(checksumSha256),
    failureCode: null,
    failureReason: null,
  };

  if (!value.length) {
    validation.failureCode = FAILURE_CODES.DOWNLOAD_ZERO_BYTE;
    validation.failureReason = "Downloaded file is zero bytes.";
    return validation;
  }
  if (declaredLength && declaredLength !== value.length) {
    validation.failureCode = FAILURE_CODES.DOWNLOAD_TRUNCATED;
    validation.failureReason = `Content-Length mismatch: expected ${declaredLength}, received ${value.length}.`;
    return validation;
  }
  if (validation.isHtml) {
    validation.failureCode = FAILURE_CODES.DOWNLOAD_HTML_RESPONSE;
    validation.failureReason = "Downloaded response is HTML, not a PDF.";
    return validation;
  }
  if (expectedExtension === "pdf" && !validation.isPdfSignature) {
    validation.failureCode = FAILURE_CODES.DOWNLOAD_UNSUPPORTED_CONTENT;
    validation.failureReason = "Downloaded resource does not have a valid PDF signature.";
    return validation;
  }
  if (expectedExtension === "pdf" && value.length < minimumPdfBytes) {
    validation.failureCode = FAILURE_CODES.DOWNLOAD_TRUNCATED;
    validation.failureReason = "Downloaded PDF is suspiciously small.";
    return validation;
  }
  try {
    const parsed = await pdf(value);
    validation.pageCount = Number(parsed.numpages || 0);
    if (validation.pageCount <= 0) {
      validation.failureCode = FAILURE_CODES.PDF_CORRUPT;
      validation.failureReason = "PDF parser did not find a valid page.";
      return validation;
    }
  } catch (error) {
    validation.isEncrypted = detectEncryptedPdf(value);
    validation.failureCode = validation.isEncrypted
      ? FAILURE_CODES.PDF_ENCRYPTED
      : FAILURE_CODES.PDF_CORRUPT;
    validation.failureReason = validation.isEncrypted
      ? "Encrypted PDF cannot be processed."
      : `Corrupted PDF could not be parsed: ${error.message}`;
    return validation;
  }

  validation.ok = true;
  return validation;
};

module.exports = {
  detectEncryptedPdf,
  hasPdfSignature,
  looksLikeHtml,
  sha256Buffer,
  validateDownloadedFile,
};
