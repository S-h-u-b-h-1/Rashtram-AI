const fs = require("node:fs");
const fsp = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const axios = require("axios");
const { FAILURE_CODES } = require("../document/failureTaxonomy");
const { validateDownloadedFile } = require("./documentFileValidator");

const DEFAULT_USER_AGENT =
  "RashtramAI-DocumentAcquisition/1.0 (+https://rashtram-ai.vercel.app; contact=rashtram.ai@rishihood.edu.in)";

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const jitter = (baseMs) =>
  Math.max(0, Math.round(baseMs * (0.8 + Math.random() * 0.4)));

const retryAfterMs = (value) => {
  if (!value) return null;
  const seconds = Number(value);
  if (Number.isFinite(seconds)) return Math.max(0, seconds * 1000);
  const date = Date.parse(value);
  return Number.isFinite(date) ? Math.max(0, date - Date.now()) : null;
};

const isPrivateHostname = (hostname = "") =>
  /^(?:localhost|0\.0\.0\.0|\[?::1\]?|127\.|10\.|192\.168\.|169\.254\.)/i
    .test(hostname);

const parseDownloadUrl = (url, { allowPrivateNetwork = false } = {}) => {
  if (!url) {
    const error = new Error("The download URL is missing.");
    error.status = 422;
    error.failureCode = FAILURE_CODES.DOWNLOAD_URL_MISSING;
    throw error;
  }
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    const error = new Error("The download URL is invalid.");
    error.status = 422;
    error.failureCode = FAILURE_CODES.DOWNLOAD_URL_INVALID;
    throw error;
  }
  if (!["http:", "https:"].includes(parsed.protocol)) {
    const error = new Error("The download URL uses an unsupported protocol.");
    error.status = 422;
    error.failureCode = FAILURE_CODES.DOWNLOAD_URL_INVALID;
    throw error;
  }
  if (!allowPrivateNetwork && isPrivateHostname(parsed.hostname)) {
    const error = new Error("Private network download URLs are not allowed.");
    error.status = 422;
    error.failureCode = FAILURE_CODES.DOWNLOAD_URL_INVALID;
    throw error;
  }
  return parsed;
};

const classifyDownloadError = (error) => {
  if (error.failureCode) return error.failureCode;
  const status = Number(error?.response?.status || error?.status || 0);
  const code = String(error?.code || "").toUpperCase();
  const message = String(error?.message || "").toLowerCase();
  if (status === 401 || status === 403) return FAILURE_CODES.DOWNLOAD_ACCESS_DENIED;
  if (status === 404 || status === 410) return FAILURE_CODES.DOWNLOAD_NOT_FOUND;
  if (status === 429) return FAILURE_CODES.DOWNLOAD_RATE_LIMITED;
  if (status >= 500) return FAILURE_CODES.DOWNLOAD_SERVER_ERROR;
  if (code === "ENOTFOUND" || code === "EAI_AGAIN") return FAILURE_CODES.DOWNLOAD_DNS_FAILED;
  if (/certificate|tls|ssl|self signed|unable to verify/.test(message)) {
    return FAILURE_CODES.DOWNLOAD_TLS_FAILED;
  }
  if (/max redirects|redirect/.test(message)) {
    return FAILURE_CODES.DOWNLOAD_REDIRECT_LOOP;
  }
  if (code === "ECONNABORTED" || /timeout|timed out/.test(message)) {
    return FAILURE_CODES.DOWNLOAD_TIMEOUT;
  }
  if (/content-length mismatch|truncated|premature/.test(message)) {
    return FAILURE_CODES.DOWNLOAD_TRUNCATED;
  }
  return FAILURE_CODES.DOWNLOAD_UNKNOWN;
};

const isRetryableDownloadCode = (code) =>
  new Set([
    FAILURE_CODES.DOWNLOAD_DNS_FAILED,
    FAILURE_CODES.DOWNLOAD_TIMEOUT,
    FAILURE_CODES.DOWNLOAD_RATE_LIMITED,
    FAILURE_CODES.DOWNLOAD_SERVER_ERROR,
    FAILURE_CODES.DOWNLOAD_UNKNOWN,
  ]).has(code);

const writeStreamToFile = (stream, filePath, limitBytes) =>
  new Promise((resolve, reject) => {
    let bytes = 0;
    const output = fs.createWriteStream(filePath, { flags: "wx" });
    stream.on("data", (chunk) => {
      bytes += chunk.length;
      if (bytes > limitBytes) {
        stream.destroy(new Error(`Download exceeded ${limitBytes}-byte limit.`));
      }
    });
    stream.on("error", reject);
    output.on("error", reject);
    output.on("finish", () => resolve(bytes));
    stream.pipe(output);
  });

const downloadAndValidateDocument = async (
  url,
  {
    accept = "application/pdf",
    expectedExtension = "pdf",
    connectTimeoutMs = Number(process.env.DOWNLOAD_CONNECT_TIMEOUT_MS || 10_000),
    responseTimeoutMs = Number(process.env.DOWNLOAD_RESPONSE_TIMEOUT_MS || 45_000),
    maxRedirects = Number(process.env.DOWNLOAD_MAX_REDIRECTS || 5),
    maxBytes = Number(process.env.DOWNLOAD_MAX_BYTES || 30 * 1024 * 1024),
    retries = Number(process.env.DOWNLOAD_RETRIES || 2),
    headers = {},
    userAgent = DEFAULT_USER_AGENT,
    existingChecksums = new Set(),
    tempDir = process.env.DOWNLOAD_TEMP_DIR || os.tmpdir(),
    allowPrivateNetwork = false,
  } = {},
) => {
  const parsed = parseDownloadUrl(url, { allowPrivateNetwork });
  const attempts = [];
  await fsp.mkdir(tempDir, { recursive: true });

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const startedAt = Date.now();
    const tempPath = path.join(
      tempDir,
      `rashtram-download-${process.pid}-${Date.now()}-${attempt}.tmp`,
    );
    try {
      const response = await axios.get(parsed.href, {
        responseType: "stream",
        timeout: connectTimeoutMs + responseTimeoutMs,
        maxRedirects,
        validateStatus: (status) => status >= 200 && status < 400,
        headers: {
          Accept: accept,
          "User-Agent": userAgent,
          ...headers,
        },
      });
      const bytes = await writeStreamToFile(response.data, tempPath, maxBytes);
      const buffer = await fsp.readFile(tempPath);
      const validation = await validateDownloadedFile(buffer, {
        url: parsed.href,
        contentType: response.headers["content-type"],
        contentLength: response.headers["content-length"],
        expectedExtension,
        existingChecksums,
      });
      attempts.push({
        attempt: attempt + 1,
        status: response.status,
        finalUrl: response.request?.res?.responseUrl || parsed.href,
        durationMs: Date.now() - startedAt,
        bytes,
        contentType: response.headers["content-type"] || null,
        redirectCount: response.request?._redirectable?._redirectCount || 0,
        validation,
      });
      if (!validation.ok) {
        const error = new Error(validation.failureReason);
        error.status = 422;
        error.failureCode = validation.failureCode;
        error.validation = validation;
        throw error;
      }
      await fsp.rm(tempPath, { force: true });
      return {
        buffer,
        attempts,
        validation,
        finalUrl: response.request?.res?.responseUrl || parsed.href,
      };
    } catch (error) {
      await fsp.rm(tempPath, { force: true }).catch(() => undefined);
      const failureCode = classifyDownloadError(error);
      const status = Number(error?.response?.status || error?.status || 0) || null;
      attempts.push({
        attempt: attempt + 1,
        status,
        durationMs: Date.now() - startedAt,
        failureCode,
        message: String(error.message || error).slice(0, 500),
        retryable: isRetryableDownloadCode(failureCode),
      });
      if (attempt >= retries || !isRetryableDownloadCode(failureCode)) {
        error.failureCode = failureCode;
        error.downloadAttempts = attempts;
        throw error;
      }
      const waitMs =
        retryAfterMs(error?.response?.headers?.["retry-after"]) ||
        jitter(Math.min(8_000, 500 * 2 ** attempt));
      await sleep(waitMs);
    }
  }

  const error = new Error("Download failed for an unknown reason.");
  error.failureCode = FAILURE_CODES.DOWNLOAD_UNKNOWN;
  error.downloadAttempts = attempts;
  throw error;
};

module.exports = {
  DEFAULT_USER_AGENT,
  classifyDownloadError,
  downloadAndValidateDocument,
  isPrivateHostname,
  isRetryableDownloadCode,
  parseDownloadUrl,
  retryAfterMs,
};
