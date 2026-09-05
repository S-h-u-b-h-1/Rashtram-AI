const crypto = require("node:crypto");
const dns = require("node:dns").promises;
const net = require("node:net");
const axios = require("axios");
const cheerio = require("cheerio");
const { getPool, query } = require("../db");
const { pdfProcessor } = require("../lib/pdfProcessor");
const {
  createObjectStorage,
  objectStorageConfig,
  userSourceObjectKey,
  userSourceIntentObjectKey,
} = require("../lib/storage/objectStorage");
const { httpsAgentForUrl } = require("../lib/ingestion/core/tlsTrust");
const {
  chunkStructuredHtml,
  extractStructuredHtml,
} = require("../document/htmlResourceService");

const MAX_SOURCE_BYTES = 50 * 1024 * 1024;
const MAX_LEGACY_UPLOAD_BYTES = 3 * 1024 * 1024;
const MAX_ACTIVE_UPLOAD_INTENTS_PER_USER = 3;
const UPLOAD_INTENT_STALE_MINUTES = 15;
const UPLOAD_PROCESSING_STALE_MINUTES = 60;
const MAX_GLOBAL_STALE_UPLOAD_SWEEP = 100;
const DIRECT_UPLOAD_EXPIRES_SECONDS = 300;
const MAX_SOURCE_TEXT = 500_000;
const MAX_CONTEXT_CHARS = 9_000;
const SOURCE_LIFECYCLE_LOCK_NAMESPACE = "research-source-upload:";

const sha256 = (buffer) => crypto.createHash("sha256").update(buffer).digest("hex");

const validatePdfUploadIntent = ({ mimeType, sizeBytes, checksumSha256 }) => {
  const size = Number(sizeBytes);
  const normalizedMimeType = String(mimeType || "application/pdf").trim().toLowerCase();
  const checksum = String(checksumSha256 || "").trim().toLowerCase();

  if (Number.isFinite(size) && size > MAX_SOURCE_BYTES) {
    const error = new Error("This file exceeds the 50 MB upload limit.");
    error.status = 413;
    error.failureCode = "FILE_TOO_LARGE";
    throw error;
  }
  if (!Number.isSafeInteger(size) || size < 1) {
    const error = new Error("The selected PDF is empty or has an invalid size.");
    error.status = 422;
    error.failureCode = "INVALID_DOCUMENT";
    throw error;
  }
  if (normalizedMimeType !== "application/pdf") {
    const error = new Error("The uploaded file is not a valid PDF.");
    error.status = 422;
    error.failureCode = "INVALID_DOCUMENT";
    throw error;
  }
  if (!/^[a-f0-9]{64}$/.test(checksum)) {
    const error = new Error("The PDF checksum is missing or invalid.");
    error.status = 422;
    error.failureCode = "INVALID_DOCUMENT";
    throw error;
  }

  return { size, mimeType: normalizedMimeType, checksum };
};

const assertPdfUploadStorageAvailable = (env = process.env) => {
  if (objectStorageConfig(env).configured) return;
  const error = new Error("Private document storage is temporarily unavailable. Please retry later.");
  error.status = 503;
  error.publicMessage = error.message;
  error.failureCode = "STORAGE_UNAVAILABLE";
  error.publicCode = error.failureCode;
  throw error;
};

const isOwnedUserSourceObjectKey = (objectKey, userId) =>
  ["rashtram/user-sources/", "rashtram/user-source-intents/"].some((prefix) =>
    String(objectKey || "").startsWith(`${prefix}${String(userId)}/`),
  );

const storageUnavailableError = (cause) => {
  const error = new Error("Private document storage is temporarily unavailable. Please retry later.");
  error.status = 503;
  error.publicMessage = error.message;
  error.failureCode = "STORAGE_UNAVAILABLE";
  error.publicCode = error.failureCode;
  error.cause = cause;
  return error;
};

const safeProcessingFailure = (failure) => {
  const code = String(failure?.failureCode || failure?.publicCode || "").toUpperCase();
  if (code === "STORAGE_UNAVAILABLE" || Number(failure?.status) === 503) {
    return { code: "STORAGE_UNAVAILABLE", message: "Private document storage is temporarily unavailable. Please retry later." };
  }
  if (code === "PDF_SIZE_MISMATCH") {
    return { code, message: "The uploaded file size did not match the selected PDF." };
  }
  if (code === "PDF_CHECKSUM_MISMATCH") {
    return { code, message: "The uploaded PDF did not match the selected file." };
  }
  if (code === "INVALID_DOCUMENT") {
    return { code, message: "The uploaded file is not a valid PDF." };
  }
  if (code === "LOW_QUALITY_TEXT") {
    return { code, message: "No citation-ready passages could be extracted from this PDF." };
  }
  return { code: "PDF_PROCESSING_FAILED", message: "The uploaded PDF could not be processed." };
};

const withUserSourceLifecycleLock = async (
  userId,
  work,
  { pool = getPool() } = {},
) => {
  const client = await pool.connect();
  let locked = false;
  try {
    await client.query(
      "SELECT pg_advisory_lock(hashtextextended($1 || $2::text, 0))",
      [SOURCE_LIFECYCLE_LOCK_NAMESPACE, userId],
    );
    locked = true;
    return await work();
  } finally {
    if (locked) {
      await client.query(
        "SELECT pg_advisory_unlock(hashtextextended($1 || $2::text, 0))",
        [SOURCE_LIFECYCLE_LOCK_NAMESPACE, userId],
      ).catch(() => undefined);
    }
    client.release();
  }
};

const reservePdfUploadIntentRecord = async ({
  pool = getPool(),
  userId,
  uploadId,
  objectKey,
  fileName,
  validated,
  maxActive = MAX_ACTIVE_UPLOAD_INTENTS_PER_USER,
  staleMinutes = UPLOAD_INTENT_STALE_MINUTES,
  processingStaleMinutes = UPLOAD_PROCESSING_STALE_MINUTES,
  lockUser = true,
}) => {
  const client = await pool.connect();
  let transactionOpen = false;
  try {
    await client.query("BEGIN");
    transactionOpen = true;
    if (lockUser) {
      await client.query(
        "SELECT pg_advisory_xact_lock(hashtextextended('research-source-upload:' || $1::text, 0))",
        [userId],
      );
    }
    const active = await client.query(
      `SELECT COUNT(*)::INTEGER AS active_count
         FROM research_sources
        WHERE user_id = $1
          AND source_type = 'pdf_upload'
          AND (
            (status = 'processing' AND updated_at >= NOW() - ($3 * INTERVAL '1 minute'))
            OR metadata_json->>'uploadStage' IN ('cleanup_pending', 'cleanup_claimed')
            OR (
              metadata_json->>'uploadStage' = 'cancel_pending'
              AND COALESCE(
                NULLIF(metadata_json->>'uploadExpiresAt', '')::timestamptz,
                created_at + ($2 * INTERVAL '1 minute')
              ) + INTERVAL '1 minute' > NOW()
            )
            OR (
              metadata_json ? 'uploadId'
              AND COALESCE(
                NULLIF(metadata_json->>'uploadExpiresAt', '')::timestamptz,
                created_at + ($2 * INTERVAL '1 minute')
              ) > NOW()
            )
          )`,
      [
        userId,
        Math.ceil(DIRECT_UPLOAD_EXPIRES_SECONDS / 60),
        Math.max(staleMinutes, processingStaleMinutes),
      ],
    );
    if (Number(active.rows[0]?.active_count || 0) >= maxActive) {
      const error = new Error("Too many PDF uploads are already in progress. Please wait and retry.");
      error.status = 429;
      error.failureCode = "UPLOAD_INTENT_LIMIT";
      error.details = { retryAfterSeconds: staleMinutes * 60 };
      throw error;
    }
    const inserted = await client.query(
      `INSERT INTO research_sources (
         user_id, title, source_type, file_name, mime_type, object_key,
         checksum_sha256, size_bytes, status, metadata_json
       ) VALUES ($1, $2, 'pdf_upload', $3, $4, $5, $6, $7, 'processing', $8::jsonb)
       RETURNING *`,
      [
        userId, fileName.replace(/\.pdf$/i, "") || "Uploaded PDF", fileName,
        validated.mimeType, objectKey, validated.checksum, validated.size,
        JSON.stringify({
          uploaded: true,
          uploadStage: "awaiting_upload",
          uploadId,
          uploadIssuedAt: new Date().toISOString(),
          uploadExpiresAt: new Date(Date.now() + DIRECT_UPLOAD_EXPIRES_SECONDS * 1000).toISOString(),
        }),
      ],
    );
    await client.query("COMMIT");
    transactionOpen = false;
    return inserted.rows[0];
  } catch (error) {
    if (transactionOpen) await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
};

const sweepStalePdfUploadIntents = async ({
  pool = getPool(),
  storage = createObjectStorage(),
  limit = MAX_GLOBAL_STALE_UPLOAD_SWEEP,
  staleMinutes = UPLOAD_INTENT_STALE_MINUTES,
  processingStaleMinutes = UPLOAD_PROCESSING_STALE_MINUTES,
  queryFn = null,
} = {}) => {
  const boundedLimit = Math.min(Math.max(Number(limit) || 1, 1), MAX_GLOBAL_STALE_UPLOAD_SWEEP);
  const client = await pool.connect();
  const summary = {
    selected: 0,
    deleted: 0,
    cleanupPending: 0,
    ownershipRejected: 0,
    preservedForRetry: 0,
  };
  const claimId = crypto.randomUUID();
  let staleRows = [];
  let transactionOpen = false;
  try {
    await client.query("BEGIN");
    transactionOpen = true;
    const stale = await client.query(
      `SELECT id, user_id, object_key, status, metadata_json
         FROM research_sources
        WHERE source_type = 'pdf_upload'
          AND (
            (status = 'processing'
              AND metadata_json->>'uploadStage' = 'awaiting_upload'
              AND created_at < NOW() - ($1 * INTERVAL '1 minute'))
            OR (status = 'processing'
              AND updated_at < NOW() - ($2 * INTERVAL '1 minute'))
            OR (metadata_json->>'uploadStage' IN ('cleanup_pending', 'cancel_pending')
              AND COALESCE(NULLIF(metadata_json->>'uploadExpiresAt', '')::timestamptz, created_at) + INTERVAL '1 minute' <= NOW())
            OR (metadata_json->>'uploadStage' = 'cleanup_claimed'
              AND updated_at < NOW() - ($2 * INTERVAL '1 minute'))
            OR (
              metadata_json ? 'temporaryObjectKeyToDelete'
              AND metadata_json->>'temporaryObjectKeyToDelete' IS NOT NULL
              AND COALESCE(
                NULLIF(metadata_json->>'uploadExpiresAt', '')::timestamptz,
                created_at
              ) + INTERVAL '1 minute' <= NOW()
            )
          )
          AND pg_try_advisory_xact_lock(
            hashtextextended($4 || user_id::text, 0)
          )
        ORDER BY updated_at ASC, id ASC
        LIMIT $3
        FOR UPDATE SKIP LOCKED`,
      [
        staleMinutes,
        processingStaleMinutes,
        boundedLimit,
        SOURCE_LIFECYCLE_LOCK_NAMESPACE,
      ],
    );
    staleRows = stale.rows;
    summary.selected = staleRows.length;
    for (const row of staleRows) {
      await client.query(
        `UPDATE research_sources
            SET status = CASE WHEN status = 'ready' THEN status ELSE 'failed' END,
                metadata_json = metadata_json || $1::jsonb, updated_at = NOW()
          WHERE id = $2 AND user_id = $3`,
        [JSON.stringify({ uploadStage: "cleanup_claimed", cleanupClaimId: claimId }), row.id, row.user_id],
      );
    }
    await client.query("COMMIT");
    transactionOpen = false;
  } catch (error) {
    if (transactionOpen) await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }

  const execute = queryFn || (async (sql, params) => {
    const updateClient = await pool.connect();
    try {
      return await updateClient.query(sql, params);
    } finally {
      updateClient.release();
    }
  });

  // Storage calls intentionally happen after the short claim transaction so a
  // slow/versioned provider cannot hold PostgreSQL locks or starve chat cleanup.
  for (const row of staleRows) {
    const plannedKey = row.metadata_json?.durableObjectKeyPlanned || null;
    const temporaryKey = row.metadata_json?.temporaryObjectKeyToDelete || null;
    const hasDurableOriginal = row.metadata_json?.durableOriginal === true &&
      String(row.object_key || "").startsWith(
        `rashtram/user-sources/${String(row.user_id)}/`,
      );
    const deletionPending = row.metadata_json?.deletionPending === true;
    const preserveDurableOriginal = hasDurableOriginal && !deletionPending;
    const keys = [...new Set([
      ...(preserveDurableOriginal ? [] : [row.object_key]),
      plannedKey,
      temporaryKey,
    ].filter(Boolean))];
    if (keys.some((key) => !isOwnedUserSourceObjectKey(key, row.user_id))) {
      summary.ownershipRejected += 1;
      await execute(
        `UPDATE research_sources SET error_message = $1,
            metadata_json = metadata_json || $2::jsonb, updated_at = NOW()
          WHERE id = $3 AND user_id = $4 AND metadata_json->>'cleanupClaimId' = $5`,
        [
          "The private upload could not be safely cleaned up.",
          JSON.stringify({ uploadStage: "cleanup_pending", failureCode: "UPLOAD_OBJECT_OWNERSHIP_INVALID" }),
          row.id, row.user_id, claimId,
        ],
      );
      continue;
    }
    try {
      for (const key of keys) await storage.deleteArtifact(key);
      if (preserveDurableOriginal) {
        const wasReady = row.status === "ready";
        const preserved = await execute(
          `UPDATE research_sources
              SET status = $1, error_message = $2,
                  metadata_json = metadata_json || $3::jsonb,
                  updated_at = NOW()
            WHERE id = $4 AND user_id = $5
              AND metadata_json->>'cleanupClaimId' = $6
            RETURNING id`,
          [
            wasReady ? "ready" : "failed",
            wasReady
              ? null
              : "The uploaded PDF is preserved and ready to process again.",
            JSON.stringify({
              uploadStage: wasReady ? "ready" : "failed_retryable",
              failureCode: wasReady ? null : "PDF_PROCESSING_RETRY_REQUIRED",
              durableObjectKeyPlanned: null,
              temporaryObjectKeyToDelete: null,
              cleanupClaimId: null,
            }),
            row.id,
            row.user_id,
            claimId,
          ],
        );
        if (preserved.rows[0]) summary.preservedForRetry += 1;
      } else {
        const deleted = await execute(
          `DELETE FROM research_sources
            WHERE id = $1 AND user_id = $2 AND metadata_json->>'cleanupClaimId' = $3
            RETURNING id`,
          [row.id, row.user_id, claimId],
        );
        if (deleted.rows[0]) summary.deleted += 1;
      }
    } catch {
      summary.cleanupPending += 1;
      await execute(
        `UPDATE research_sources SET error_message = $1,
            metadata_json = metadata_json || $2::jsonb, updated_at = NOW()
          WHERE id = $3 AND user_id = $4 AND metadata_json->>'cleanupClaimId' = $5`,
        [
          "Private document storage is temporarily unavailable. Please retry later.",
          JSON.stringify({ uploadStage: "cleanup_pending", failureCode: "UPLOAD_OBJECT_CLEANUP_PENDING" }),
          row.id, row.user_id, claimId,
        ],
      );
    }
  }
  return { ...summary, limit: boundedLimit };
};

const isPrivateAddress = (address = "") => {
  const normalized = String(address).toLowerCase();
  if (normalized === "::1" || normalized === "0:0:0:0:0:0:0:1") return true;
  if (net.isIPv4(normalized)) {
    const [a, b] = normalized.split(".").map(Number);
    return a === 10 || a === 127 || a === 169 && b === 254 ||
      a === 192 && b === 168 || a === 172 && b >= 16 && b <= 31 ||
      a === 0;
  }
  return net.isIPv6(normalized) && (
    normalized.startsWith("fc") || normalized.startsWith("fd") ||
    normalized.startsWith("fe8") || normalized.startsWith("fe9") ||
    normalized.startsWith("fea") || normalized.startsWith("feb")
  );
};

const assertPublicUrl = async (value) => {
  let parsed;
  try {
    parsed = new URL(String(value || "").trim());
  } catch {
    const error = new Error("Enter a valid http or https link.");
    error.status = 422;
    error.failureCode = "URL_INVALID";
    throw error;
  }
  if (!['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password) {
    const error = new Error("Only public http or https links are supported.");
    error.status = 422;
    error.failureCode = "URL_UNSUPPORTED";
    throw error;
  }
  const hostname = parsed.hostname.toLowerCase();
  if (hostname === "localhost" || hostname.endsWith(".localhost") ||
      hostname.endsWith(".local") || hostname.endsWith(".internal") ||
      isPrivateAddress(hostname)) {
    const error = new Error("Private and internal network links are not allowed.");
    error.status = 422;
    error.failureCode = "URL_UNSUPPORTED";
    throw error;
  }
  try {
    const addresses = await dns.lookup(hostname, { all: true });
    if (addresses.some(({ address }) => isPrivateAddress(address))) {
      const error = new Error("Private and internal network links are not allowed.");
      error.status = 422;
      error.failureCode = "URL_UNSUPPORTED";
      throw error;
    }
    Object.defineProperty(parsed, "resolvedAddresses", {
      value: addresses,
      enumerable: false,
    });
  } catch (error) {
    if (error.status) throw error;
    error.status = 422;
    error.message = "The source link could not be resolved.";
    error.failureCode = "URL_INVALID";
    throw error;
  }
  return parsed;
};

const cleanSourceText = (value) =>
  String(value || "")
    .normalize("NFKC")
    .replace(/\u0000/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, MAX_SOURCE_TEXT);

const extractHtml = (buffer, url) => {
  const extracted = extractStructuredHtml({
    html: buffer.toString("utf8"),
    url,
  });
  if (!extracted.quality.valid) {
    const error = new Error(
      extracted.quality.dynamicShell
        ? "This page loads its document content dynamically and no readable source payload was available."
        : "This webpage did not contain enough high-quality document text to study.",
    );
    error.status = 422;
    error.failureCode = extracted.quality.dynamicShell
      ? "JAVASCRIPT_REQUIRED"
      : "HTML_EXTRACTION_FAILED";
    throw error;
  }
  return { ...extracted, chunks: chunkStructuredHtml(extracted) };
};

const findLinkedPdfUrl = (buffer, baseUrl) => {
  const $ = cheerio.load(buffer.toString("utf8"));
  for (const element of $("a[href], iframe[src], embed[src]").toArray()) {
    const raw = $(element).attr("href") || $(element).attr("src");
    if (!raw) continue;
    try {
      const candidate = new URL(raw, baseUrl);
      const nested = candidate.searchParams.get("file") || candidate.searchParams.get("url");
      if (nested) {
        const decoded = new URL(decodeURIComponent(nested), candidate);
        if (/\.pdf(?:$|[?#])/i.test(decoded.href)) return decoded.href;
      }
      if (/\.pdf(?:$|[?#])/i.test(candidate.href)) return candidate.href;
    } catch {
      // Ignore malformed page links and continue looking for a valid PDF.
    }
  }
  return null;
};

const extractPdf = async (buffer, url, fileName = null) => {
  let parsed;
  try {
    parsed = await pdfProcessor.parsePDFBuffer(buffer);
  } catch (error) {
    const wrapped = new Error(`This PDF could not be read: ${error.message}`);
    wrapped.status = 422;
    throw wrapped;
  }
  const nativePages = (parsed.pages?.length ? parsed.pages : String(parsed.fullText || "").split(/\f/u));
  const pageExtraction = [];
  const validPages = [];
  for (let index = 0; index < nativePages.length; index += 1) {
    const nativeText = String(nativePages[index] || "");
    const nativeQuality = pdfProcessor.pageExtractionQuality(nativeText, { method: "native" });
    let selectedText = pdfProcessor.cleanText(nativeText, pdfProcessor.detectLanguage(nativeText).languageCode);
    let selectedQuality = pdfProcessor.pageExtractionQuality(selectedText, { method: "normalized_native" });
    let method = selectedText !== nativeText ? "normalized_native" : "native";
    let ocrAttempts = 0;
    if (!selectedQuality.usable) {
      try {
        const pageBuffer = await pdfProcessor.extractSinglePageBuffer(buffer, index);
        const recovered = await pdfProcessor.recoverPageWithOcr(pageBuffer, selectedQuality);
        ocrAttempts = Number(recovered?.attempt || 0);
        if (recovered?.quality?.usable) {
          selectedText = pdfProcessor.cleanText(
            recovered.text,
            pdfProcessor.detectLanguage(recovered.text).languageCode,
          );
          selectedQuality = recovered.quality;
          method = "ocr";
        }
      } catch (error) {
        // A failed page must not invalidate an otherwise readable document.
        console.warn("[research-source] selective OCR page failed", {
          page: index + 1,
          error: error.message,
        });
      }
    }
    const usable = selectedQuality.usable && selectedText.trim().length >= 20;
    pageExtraction.push({
      page: index + 1,
      method,
      usable,
      nativeQuality: nativeQuality.quality,
      quality: selectedQuality.quality,
      score: selectedQuality.score,
      ocrAttempts,
    });
    if (usable) validPages.push({ page: index + 1, text: selectedText, method, quality: selectedQuality.quality });
  }
  if (!validPages.length) {
    const error = new Error("No readable pages could be recovered from this PDF. Try a clearer or unlocked copy.");
    error.status = 422;
    error.failureCode = "LOW_QUALITY_TEXT";
    throw error;
  }
  const text = validPages.map(({ text: pageText }) => pageText).join("\f");
  const ocrUsed = validPages.some((page) => page.method === "ocr");
  const partialValid = validPages.length < Math.max(Number(parsed.numPages || nativePages.length), 1);
  const extractionMethod = ocrUsed ? "selective_ocr" : "pdf_text";
  const title = String(parsed.info?.Title || fileName || new URL(url).pathname.split("/").pop() || "Uploaded PDF").trim();
  const language = pdfProcessor.detectLanguage(text);
  const chunks = validPages.flatMap((page) =>
    pdfProcessor.chunkText(page.text, 1_800, 240, pdfProcessor.detectLanguage(page.text).languageCode)
      .map((content, index) => ({
        content,
        metadata: {
          chunkIndex: index,
          pageStart: page.page,
          pageEnd: page.page,
          pageEstimate: false,
          extractionMethod: page.method,
          extractionQuality: page.quality,
        },
      })),
  );
  return {
    title,
    text: cleanSourceText(text),
    mimeType: "application/pdf",
    pageCount: Number(parsed.numPages || 0),
    language,
    extractionMethod,
    ocrUsed,
    partialValid,
    validPageCount: validPages.length,
    invalidPageCount: Math.max(Number(parsed.numPages || nativePages.length) - validPages.length, 0),
    pageExtraction,
    chunks,
  };
};

const fetchPublicSource = async (initialUrl) => {
  let currentUrl = initialUrl;
  for (let redirect = 0; redirect <= 3; redirect += 1) {
    let response;
    try {
      response = await axios.get(currentUrl.href, {
      responseType: "arraybuffer",
      timeout: 45_000,
      maxContentLength: MAX_SOURCE_BYTES,
      maxBodyLength: MAX_SOURCE_BYTES,
      maxRedirects: 0,
      httpsAgent: httpsAgentForUrl(currentUrl),
      lookup: (hostname, options, callback) => {
        const addresses = currentUrl.resolvedAddresses || [];
        const selected = addresses.find((entry) => entry.family === 4) || addresses[0];
        if (!selected) return dns.lookup(hostname, options).then(
          (address) => callback(null, address.address || address, address.family || 4),
          callback,
        );
        return callback(null, selected.address, selected.family);
      },
      validateStatus: (status) => status >= 200 && status < 400,
      headers: {
        Accept: "text/html, application/pdf;q=0.9, */*;q=0.1",
        "User-Agent": "RashtramAI-ResearchSource/1.0",
      },
      });
    } catch (cause) {
      const status = Number(cause.response?.status || 0);
      const error = new Error(
        status === 401 ? "This source requires sign-in. Upload a public PDF instead." :
        status === 403 ? "This public page blocks automated access. Try uploading the official PDF." :
        status === 429 ? "The source is temporarily rate-limiting access. Please retry shortly." :
        cause.code === "ECONNABORTED" ? "The source took too long to respond. Please retry or upload the PDF." :
        "The source could not be fetched reliably. Check the link or upload the official PDF.",
      );
      error.status = status === 429 ? 429 : 422;
      error.failureCode = status === 401 ? "AUTH_REQUIRED" :
        status === 403 ? "UPSTREAM_BLOCKED" :
        status === 429 ? "UPSTREAM_RATE_LIMITED" :
        cause.code === "ECONNABORTED" ? "TIMEOUT" : "UPSTREAM_UNAVAILABLE";
      throw error;
    }
    if (response.status < 300) return { response, url: currentUrl.href };
    if (redirect === 3) {
      const error = new Error("The source link redirected too many times.");
      error.status = 422;
      throw error;
    }
    const location = response.headers.location;
    if (!location) {
      const error = new Error("The source link returned an invalid redirect.");
      error.status = 422;
      throw error;
    }
    currentUrl = await assertPublicUrl(new URL(location, currentUrl.href).href);
  }
  throw new Error("The source link could not be fetched.");
};

const chunkText = (text) => {
  const chunks = pdfProcessor.chunkText(text, 1_800, 240, pdfProcessor.detectLanguage(text).languageCode);
  return chunks.map((content, index) => ({
    content: cleanSourceText(content),
    metadata: { chunkIndex: index, source: "user_source" },
  })).filter((chunk) => chunk.content.length >= 20);
};

const storeOriginal = async ({
  buffer,
  kind,
  extension,
  contentType,
  metadata,
  userId,
  requireDurable = false,
  storage: suppliedStorage = null,
}) => {
  if (!objectStorageConfig().configured && !suppliedStorage) {
    if (requireDurable) throw storageUnavailableError();
    return { objectKey: null, warning: "Object storage is not configured; extracted text was retained." };
  }
  try {
    const storage = suppliedStorage || createObjectStorage();
    const uploaded = await storage.putUserSourceArtifact({
      userId,
      uploadId: crypto.randomUUID(),
      body: buffer,
      extension,
      contentType,
      metadata: { ...metadata, kind },
    });
    return { objectKey: uploaded.key, warning: null, storage };
  } catch (error) {
    if (requireDurable) throw storageUnavailableError(error);
    return { objectKey: null, warning: "Original file storage was unavailable; extracted text was retained." };
  }
};

const publicSourceMetadata = (value) => {
  const metadata = value && typeof value === "object" && !Array.isArray(value)
    ? { ...value }
    : {};
  for (const field of [
    "cleanupClaimId",
    "durableObjectKeyPlanned",
    "processingAttemptId",
    "temporaryObjectKeyToDelete",
    "uploadId",
  ]) delete metadata[field];
  return metadata;
};

const toPublicSource = (row) => ({
  id: String(row.id),
  title: row.title,
  sourceType: row.source_type,
  sourceUrl: row.source_url,
  fileName: row.file_name,
  mimeType: row.mime_type,
  languageCode: row.language_code,
  status: row.status,
  errorMessage: row.error_message,
  sizeBytes: row.size_bytes == null ? null : Number(row.size_bytes),
  metadata: publicSourceMetadata(row.metadata_json),
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const persistSourceRows = async ({
  pool = getPool(),
  sourceValues,
  chunks,
  afterChunkInsert,
}) => {
  const client = await pool.connect();
  let transactionOpen = false;
  try {
    await client.query("BEGIN");
    transactionOpen = true;
    const result = await client.query(
      `INSERT INTO research_sources (
         user_id, title, source_type, source_url, file_name, mime_type,
         object_key, checksum_sha256, size_bytes, language_code, status,
         content_text, metadata_json
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'ready', $11, $12::jsonb)
       RETURNING *`,
      sourceValues,
    );
    const source = result.rows[0];
    for (const [index, chunk] of chunks.entries()) {
      await client.query(
        `INSERT INTO research_source_chunks (source_id, chunk_index, content, metadata_json)
         VALUES ($1, $2, $3, $4::jsonb)`,
        [source.id, index, chunk.content, JSON.stringify(chunk.metadata)],
      );
      if (afterChunkInsert) await afterChunkInsert({ client, index, source });
    }
    await client.query("COMMIT");
    transactionOpen = false;
    return source;
  } catch (error) {
    if (transactionOpen) await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
};

const persistSource = async ({
  userId,
  title,
  sourceType,
  sourceUrl,
  fileName,
  mimeType,
  buffer,
  extracted,
  metadata = {},
  requireDurableOriginal = false,
  pool = getPool(),
  storage: suppliedStorage = null,
}) => {
  const text = cleanSourceText(extracted.text);
  if (text.length < 40) {
    const error = new Error("This source does not contain enough readable text to study.");
    error.status = 422;
    throw error;
  }
  const checksumSha256 = sha256(buffer);
  const pdfOriginal = String(mimeType || extracted.mimeType || "").toLowerCase().includes("application/pdf") ||
    buffer.subarray(0, 4).toString("latin1") === "%PDF";
  const storage = await storeOriginal({
    buffer,
    kind: pdfOriginal ? "pdf" : "source-html",
    extension: pdfOriginal ? "pdf" : "html",
    contentType: pdfOriginal ? "application/pdf" : mimeType,
    metadata: { userId, sourceType },
    userId,
    requireDurable: requireDurableOriginal,
    storage: suppliedStorage,
  });
  const language = extracted.language || pdfProcessor.detectLanguage(text);
  const chunks = Array.isArray(extracted.chunks) && extracted.chunks.length
    ? extracted.chunks.map((chunk) => ({
        content: cleanSourceText(chunk.content),
        metadata: { ...chunk.metadata, source: "user_source" },
      }))
    : chunkText(text);
  if (!chunks.length) {
    if (storage.objectKey && storage.storage) {
      await storage.storage.deleteArtifact(storage.objectKey).catch(() => undefined);
    }
    const error = new Error("This source did not produce any citation-ready passages.");
    error.status = 422;
    error.failureCode = "LOW_QUALITY_TEXT";
    throw error;
  }
  let source;
  try {
    source = await persistSourceRows({
      pool,
      sourceValues: [
      userId, title.slice(0, 300), sourceType, sourceUrl || null,
      fileName || null, mimeType || extracted.mimeType || null,
      storage.objectKey, checksumSha256, buffer.length, language.languageCode,
      text,
      JSON.stringify({
        ...metadata,
        ...(storage.warning ? { storageWarning: storage.warning } : {}),
        pageCount: extracted.pageCount || null,
        extractionMethod: extracted.extractionMethod || null,
        ocrUsed: Boolean(extracted.ocrUsed),
        partialValid: Boolean(extracted.partialValid),
        validPageCount: extracted.validPageCount || null,
        invalidPageCount: extracted.invalidPageCount || 0,
        pageExtraction: extracted.pageExtraction || null,
        rawHtmlHash: extracted.rawHtmlHash || null,
        cleanContentHash: extracted.cleanContentHash || null,
        extractionQuality: extracted.quality || null,
        publicationDate: extracted.publicationDate || null,
        sourceAuthority: extracted.sourceAuthority || null,
        canonicalUrl: extracted.canonicalUrl || sourceUrl || null,
      }),
      ],
      chunks,
    });
  } catch (error) {
    if (storage.objectKey && storage.storage) {
      await storage.storage.deleteArtifact(storage.objectKey).catch(() => undefined);
    }
    throw error;
  }
  return toPublicSource(source);
};

const listSources = async (userId) => {
  const result = await query(
    `SELECT id, title, source_type, source_url, file_name, mime_type,
            language_code, status, error_message, size_bytes, metadata_json,
            created_at, updated_at
       FROM research_sources
       WHERE user_id = $1
         AND COALESCE((metadata_json->>'deletionPending')::boolean, FALSE) = FALSE
       ORDER BY updated_at DESC, id DESC`,
    [userId],
  );
  return result.rows.map(toPublicSource);
};

const addUrlSource = async (userId, url) => {
  const parsed = await assertPublicUrl(url);
  console.log("[research-source] fetch started", {
    userId: String(userId),
    hostname: parsed.hostname,
  });
  const { response, url: finalUrl } = await fetchPublicSource(parsed);
  const buffer = Buffer.from(response.data);
  const contentType = String(response.headers["content-type"] || "").toLowerCase();
  const isPdf = contentType.includes("application/pdf") || buffer.subarray(0, 4).toString("latin1") === "%PDF";
  const isHtml = contentType.includes("text/html")
    || /^\s*<(?:!doctype\s+html|html)\b/i.test(buffer.subarray(0, 512).toString("utf8"));
  if (!isPdf && !isHtml) {
    const error = new Error("This link did not return a readable HTML page or PDF.");
    error.status = 422;
    throw error;
  }
  let sourceBuffer = buffer;
  let resolvedUrl = finalUrl;
  let extracted = isPdf
    ? await extractPdf(buffer, finalUrl)
    : extractHtml(buffer, finalUrl);
  if (!isPdf && extracted.text.length < 1_200) {
    const linkedPdf = findLinkedPdfUrl(buffer, finalUrl);
    if (linkedPdf) {
      try {
        const linked = await fetchPublicSource(await assertPublicUrl(linkedPdf));
        const linkedBuffer = Buffer.from(linked.response.data);
        const linkedType = String(linked.response.headers["content-type"] || "").toLowerCase();
        if (linkedType.includes("application/pdf") || linkedBuffer.subarray(0, 4).toString("latin1") === "%PDF") {
          sourceBuffer = linkedBuffer;
          resolvedUrl = linked.url;
          extracted = await extractPdf(linkedBuffer, linked.url, extracted.title);
        }
      } catch (error) {
        console.warn("[research-source] linked PDF fallback unavailable", {
          hostname: parsed.hostname,
          code: error.failureCode || error.code || null,
        });
      }
    }
  }
  const source = await persistSource({
    userId,
    title: extracted.title,
    sourceType: "external_url",
    sourceUrl: resolvedUrl,
    mimeType: extracted.mimeType,
    buffer: sourceBuffer,
    extracted,
    metadata: {
      fetchedFrom: parsed.href,
      ...(resolvedUrl !== finalUrl ? { publicationPageUrl: finalUrl, linkedPdfResolved: true } : {}),
    },
  });
  console.log("[research-source] fetch completed", {
    userId: String(userId),
    hostname: new URL(resolvedUrl).hostname,
    sourceId: source.id,
    mimeType: extracted.mimeType,
    extractionMethod: extracted.extractionMethod || null,
    textLength: extracted.text.length,
  });
  return source;
};

const addPdfSourceUnlocked = async (userId, { fileName, mimeType, buffer }) => {
  if (!Buffer.isBuffer(buffer) || buffer.length === 0 || buffer.length > MAX_SOURCE_BYTES) {
    const error = new Error(
      Buffer.isBuffer(buffer) && buffer.length > MAX_SOURCE_BYTES
        ? "This file exceeds the 50 MB upload limit."
        : "The selected PDF is empty or has an invalid size.",
    );
    error.status = Buffer.isBuffer(buffer) && buffer.length > MAX_SOURCE_BYTES ? 413 : 422;
    error.failureCode = error.status === 413 ? "FILE_TOO_LARGE" : "INVALID_DOCUMENT";
    throw error;
  }
  if (buffer.subarray(0, 4).toString("latin1") !== "%PDF") {
    const error = new Error("The uploaded file is not a valid PDF.");
    error.status = 422;
    error.failureCode = "INVALID_DOCUMENT";
    throw error;
  }
  // Compatibility uploads are private originals, not text-only imports. Fail
  // before extraction when durable private storage is unavailable.
  assertPdfUploadStorageAvailable();
  const storage = createObjectStorage();
  const uploadId = crypto.randomUUID();
  const safeFileName = String(fileName || "document.pdf").slice(0, 255);
  const checksumSha256 = sha256(buffer);
  let durable;
  try {
    durable = await storage.putUserSourceArtifact({
      userId,
      uploadId,
      body: buffer,
      extension: "pdf",
      contentType: "application/pdf",
      metadata: { compatibilityUpload: true, durable: true },
    });
    const head = await storage.headArtifact(durable.key);
    const verified = await storage.getArtifact({
      key: durable.key,
      expectedHash: checksumSha256,
    });
    if (Number(head.bytes) !== buffer.length || !verified.body.equals(buffer)) {
      throw new Error("Compatibility upload verification failed.");
    }
  } catch (cause) {
    if (durable?.key) await storage.deleteArtifact(durable.key).catch(() => undefined);
    throw storageUnavailableError(cause);
  }
  let inserted;
  try {
    inserted = await query(
      `INSERT INTO research_sources (
         user_id, title, source_type, file_name, mime_type, object_key,
         checksum_sha256, size_bytes, status, metadata_json
       ) VALUES ($1, $2, 'pdf_upload', $3, 'application/pdf', $4, $5, $6, 'failed', $7::jsonb)
       RETURNING *`,
      [
        userId,
        safeFileName.replace(/\.pdf$/i, "") || "Uploaded PDF",
        safeFileName,
        durable.key,
        checksumSha256,
        buffer.length,
        JSON.stringify({
          uploaded: true,
          compatibilityUpload: true,
          durableOriginal: true,
          uploadStage: "failed_retryable",
          uploadId,
        }),
      ],
    );
  } catch (error) {
    await storage.deleteArtifact(durable.key).catch(() => undefined);
    throw error;
  }
  // completePdfUpload persists a safe retryable failure state while retaining
  // the verified private original.
  return completePdfUploadUnlocked(userId, inserted.rows[0].id);
};

const createPdfUploadIntentUnlocked = async (userId, { fileName, mimeType, sizeBytes, checksumSha256 }) => {
  const validated = validatePdfUploadIntent({ mimeType, sizeBytes, checksumSha256 });
  assertPdfUploadStorageAvailable();
  const storage = createObjectStorage();
  const uploadId = crypto.randomUUID();
  const objectKey = userSourceIntentObjectKey({ userId, uploadId, extension: "pdf" });
  const safeFileName = String(fileName || "document.pdf").trim().slice(0, 255);
  const inserted = await reservePdfUploadIntentRecord({
    storage,
    userId,
    uploadId,
    objectKey,
    fileName: safeFileName,
    validated,
    lockUser: false,
  });
  try {
    const signed = await storage.createPresignedUpload({
      key: objectKey,
      contentType: validated.mimeType,
      contentLength: validated.size,
      checksumSha256: validated.checksum,
      expiresIn: DIRECT_UPLOAD_EXPIRES_SECONDS,
    });
    return {
      source: toPublicSource(inserted),
      uploadUrl: signed.uploadUrl,
      expiresIn: signed.expiresIn,
      requiredHeaders: signed.requiredHeaders || {},
      maxBytes: MAX_SOURCE_BYTES,
      integrityVerification: "signed-checksum-and-post-upload-verification",
    };
  } catch (error) {
    await query(
      "DELETE FROM research_sources WHERE id = $1 AND user_id = $2",
      [inserted.id, userId],
    ).catch(() => undefined);
    error.status = 503;
    error.publicMessage = "Private document storage is temporarily unavailable. Please retry later.";
    error.failureCode = "STORAGE_UNAVAILABLE";
    error.publicCode = error.failureCode;
    throw error;
  }
};

const createPdfUploadIntent = async (userId, payload) =>
  withUserSourceLifecycleLock(
    userId,
    () => createPdfUploadIntentUnlocked(userId, payload),
  );

const quarantineFailedUploadObject = async ({
  userId,
  row,
  failure,
  storage,
  queryFn = query,
  processingAttemptId = null,
}) => {
  let currentRow = row;
  if (processingAttemptId) {
    const ownership = await queryFn(
      `SELECT * FROM research_sources
        WHERE id = $1 AND user_id = $2
          AND metadata_json->>'processingAttemptId' = $3
        LIMIT 1`,
      [row.id, userId, processingAttemptId],
    );
    if (!ownership.rows[0]) {
      return { objectDeleted: false, cleanupPending: false, skipped: true };
    }
    currentRow = ownership.rows[0];
  }
  const plannedDurableKey = currentRow.metadata_json?.durableObjectKeyPlanned || null;
  const temporaryKey = currentRow.metadata_json?.temporaryObjectKeyToDelete || null;
  const hasDurableOriginal = currentRow.metadata_json?.durableOriginal === true &&
    String(currentRow.object_key || "").startsWith(
      `rashtram/user-sources/${String(userId)}/`,
    );
  const cleanupKeys = [...new Set([
    ...(hasDurableOriginal ? [] : [currentRow.object_key]),
    plannedDurableKey,
    temporaryKey,
  ].filter(Boolean))];
  let objectDeleted = cleanupKeys.length === 0;
  let cleanupPending = false;
  if (cleanupKeys.length) {
    if (cleanupKeys.some((key) => !isOwnedUserSourceObjectKey(key, userId)) || !storage) {
      cleanupPending = true;
    } else {
      try {
        for (const key of cleanupKeys) await storage.deleteArtifact(key);
        objectDeleted = true;
      } catch {
        cleanupPending = true;
      }
    }
  }
  const safeFailure = safeProcessingFailure(failure);
  const failureCode = cleanupPending
    ? "UPLOAD_OBJECT_CLEANUP_PENDING"
    : safeFailure.code;
  await queryFn(
    `UPDATE research_sources
        SET status = 'failed', error_message = $1,
            object_key = CASE WHEN $2 AND NOT $3 THEN NULL ELSE object_key END,
            metadata_json = metadata_json || $4::jsonb, updated_at = NOW()
      WHERE id = $5 AND user_id = $6
        ${processingAttemptId ? "AND metadata_json->>'processingAttemptId' = $7" : ""}`,
    [
      safeFailure.message,
      objectDeleted,
      hasDurableOriginal,
      JSON.stringify({
        uploadStage: cleanupPending
          ? "cleanup_pending"
          : hasDurableOriginal
            ? "failed_retryable"
            : "failed",
        failureCode,
        originalObjectDeleted: objectDeleted && !hasDurableOriginal,
        durableOriginal: hasDurableOriginal,
        durableObjectKeyPlanned: objectDeleted ? null : plannedDurableKey,
        temporaryObjectKeyToDelete: objectDeleted ? null : temporaryKey,
      }),
      currentRow.id,
      userId,
      ...(processingAttemptId ? [processingAttemptId] : []),
    ],
  );
  return { objectDeleted, cleanupPending };
};

const planDurablePdfOriginal = async ({
  userId,
  row,
  attemptId,
  queryFn = query,
}) => {
  const uploadId = String(row.metadata_json?.uploadId || "");
  const plannedKey = userSourceObjectKey({ userId, uploadId, extension: "pdf" });
  const result = await queryFn(
    `UPDATE research_sources
        SET metadata_json = metadata_json || $1::jsonb, updated_at = NOW()
      WHERE id = $2 AND user_id = $3
        AND metadata_json->>'processingAttemptId' = $4
      RETURNING *`,
    [
      JSON.stringify({ durableObjectKeyPlanned: plannedKey }),
      row.id,
      userId,
      attemptId,
    ],
  );
  if (!result.rows[0]) {
    const error = new Error("This PDF processing attempt was superseded. Please reload the source.");
    error.status = 409;
    error.failureCode = "UPLOAD_PROCESSING_SUPERSEDED";
    throw error;
  }
  return { row: result.rows[0], plannedKey };
};

const persistDurablePdfOriginal = async ({
  userId,
  row,
  attemptId,
  durableObjectKey,
  temporaryObjectKey,
  queryFn = query,
}) => {
  const result = await queryFn(
    `UPDATE research_sources
        SET object_key = $1,
            metadata_json = metadata_json || $2::jsonb,
            updated_at = NOW()
      WHERE id = $3 AND user_id = $4
        AND metadata_json->>'processingAttemptId' = $5
        AND metadata_json->>'durableObjectKeyPlanned' = $1
      RETURNING *`,
    [
      durableObjectKey,
      JSON.stringify({
        durableOriginal: true,
        durableObjectKeyPlanned: null,
        temporaryObjectKeyToDelete: temporaryObjectKey || null,
        uploadStage: "extracting",
      }),
      row.id,
      userId,
      attemptId,
    ],
  );
  if (!result.rows[0]) {
    const error = new Error("This PDF processing attempt was superseded. Please reload the source.");
    error.status = 409;
    error.failureCode = "UPLOAD_PROCESSING_SUPERSEDED";
    throw error;
  }
  return result.rows[0];
};

const claimPdfUploadForProcessing = async ({
  userId,
  sourceId,
  queryFn = query,
  attemptId = crypto.randomUUID(),
}) => {
  const claimed = await queryFn(
    `UPDATE research_sources
        SET status = 'processing', error_message = NULL,
            metadata_json = metadata_json || $1::jsonb, updated_at = NOW()
      WHERE id = $2 AND user_id = $3 AND source_type = 'pdf_upload'
        AND (
          (status = 'processing'
            AND COALESCE(metadata_json->>'uploadStage', 'awaiting_upload') = 'awaiting_upload')
          OR (
            status = 'failed'
            AND metadata_json->>'durableOriginal' = 'true'
            AND metadata_json->>'uploadStage' = 'failed_retryable'
            AND COALESCE((metadata_json->>'deletionPending')::boolean, FALSE) = FALSE
            AND object_key LIKE ('rashtram/user-sources/' || $3::text || '/%')
          )
        )
      RETURNING *`,
    [JSON.stringify({ uploadStage: "extracting", processingAttemptId: attemptId }), Number(sourceId), userId],
  );
  if (claimed.rows[0]) return { row: claimed.rows[0], attemptId, alreadyReady: false };
  const selected = await queryFn(
    `SELECT * FROM research_sources
      WHERE id = $1 AND user_id = $2 AND source_type = 'pdf_upload'
      LIMIT 1`,
    [Number(sourceId), userId],
  );
  const row = selected.rows[0];
  if (!row) {
    const error = new Error("Uploaded source was not found.");
    error.status = 404;
    throw error;
  }
  if (row.status === "ready") return { row, attemptId: null, alreadyReady: true };
  const error = new Error("This PDF is already being processed. Please wait a moment.");
  error.status = 409;
  error.failureCode = "UPLOAD_PROCESSING_IN_PROGRESS";
  throw error;
};

const promoteVerifiedPdfOriginal = async ({ storage, userId, row, body, plannedKey = null }) => {
  let durableKey = null;
  try {
    const uploadId = String(row.metadata_json?.uploadId || crypto.randomUUID());
    const uploaded = await storage.putUserSourceArtifact({
      userId,
      uploadId,
      body,
      extension: "pdf",
      contentType: "application/pdf",
      metadata: {
        sourceId: row.id,
        originalIntentKey: row.object_key,
        durable: true,
      },
    });
    durableKey = uploaded.key;
    if (plannedKey && durableKey !== plannedKey) {
      throw new Error("Durable private object key did not match the tracked promotion plan.");
    }
    if (!isOwnedUserSourceObjectKey(durableKey, userId) ||
        !String(durableKey).startsWith(`rashtram/user-sources/${String(userId)}/`)) {
      throw new Error("Durable private object ownership verification failed.");
    }
    const head = await storage.headArtifact(durableKey);
    if (Number(head.bytes) !== Number(row.size_bytes) || Number(head.bytes) !== body.length) {
      throw new Error("Durable private object size verification failed.");
    }
    const verified = await storage.getArtifact({
      key: durableKey,
      expectedHash: row.checksum_sha256,
    });
    if (verified.body.length !== body.length || verified.hash !== row.checksum_sha256) {
      throw new Error("Durable private object checksum verification failed.");
    }
    return { key: durableKey, bytes: verified.body.length, hash: verified.hash };
  } catch (cause) {
    if (durableKey) await storage.deleteArtifact(durableKey).catch(() => undefined);
    throw storageUnavailableError(cause);
  }
};

const persistProcessedPdfReady = async ({
  pool = getPool(),
  row,
  userId,
  attemptId,
  extracted,
  text,
  language,
  chunks,
  durableObjectKey,
  afterChunkInsert,
}) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("DELETE FROM research_source_chunks WHERE source_id = $1", [row.id]);
    for (const [index, chunk] of chunks.entries()) {
      await client.query(
        `INSERT INTO research_source_chunks (source_id, chunk_index, content, metadata_json)
         VALUES ($1, $2, $3, $4::jsonb)`,
        [row.id, index, chunk.content, JSON.stringify(chunk.metadata)],
      );
      if (afterChunkInsert) await afterChunkInsert({ client, index, row });
    }
    const updated = await client.query(
      `UPDATE research_sources SET title = $1, language_code = $2, status = 'ready',
         error_message = NULL, content_text = $3, metadata_json = metadata_json || $4::jsonb,
         object_key = $5, updated_at = NOW()
       WHERE id = $6 AND user_id = $7
         AND metadata_json->>'processingAttemptId' = $8 RETURNING *`,
      [
        extracted.title.slice(0, 300), language.languageCode, text,
        JSON.stringify({
          uploadStage: "ready",
          durableOriginal: true,
          durableObjectKeyPlanned: null,
          pageCount: extracted.pageCount,
          extractionMethod: extracted.extractionMethod,
          ocrUsed: extracted.ocrUsed,
          partialValid: extracted.partialValid,
          validPageCount: extracted.validPageCount,
          invalidPageCount: extracted.invalidPageCount,
          pageExtraction: extracted.pageExtraction,
        }),
        durableObjectKey,
        row.id,
        userId,
        attemptId,
      ],
    );
    if (!updated.rows[0]) {
      const conflict = new Error("This PDF processing attempt was superseded. Please reload the source.");
      conflict.status = 409;
      conflict.failureCode = "UPLOAD_PROCESSING_SUPERSEDED";
      throw conflict;
    }
    await client.query("COMMIT");
    return updated.rows[0];
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
};

const promoteAndPersistProcessedPdf = async ({
  storage,
  pool = getPool(),
  userId,
  row,
  attemptId,
  body,
  extracted,
  text,
  language,
  chunks,
  afterChunkInsert,
  plannedKey = null,
}) => {
  const durable = await promoteVerifiedPdfOriginal({ storage, userId, row, body, plannedKey });
  try {
    const ready = await persistProcessedPdfReady({
      pool,
      row,
      userId,
      attemptId,
      extracted,
      text,
      language,
      chunks,
      durableObjectKey: durable.key,
      afterChunkInsert,
    });
    return { ready, durable };
  } catch (error) {
    await storage.deleteArtifact(durable.key).catch(() => undefined);
    throw error;
  }
};

const completePdfUploadUnlocked = async (userId, sourceId) => {
  const claim = await claimPdfUploadForProcessing({ userId, sourceId });
  let { row } = claim;
  const { attemptId } = claim;
  if (claim.alreadyReady) return toPublicSource(row);
  let storage;
  try {
    try {
      storage = createObjectStorage();
    } catch (cause) {
      throw storageUnavailableError(cause);
    }
    let head;
    try {
      head = await storage.headArtifact(row.object_key);
    } catch (cause) {
      throw storageUnavailableError(cause);
    }
    if (Number(head.bytes) !== Number(row.size_bytes) || Number(head.bytes) > MAX_SOURCE_BYTES) {
      const error = new Error("The uploaded file size did not match the selected PDF.");
      error.status = 422;
      error.failureCode = "PDF_SIZE_MISMATCH";
      throw error;
    }
    if (head.contentType && !String(head.contentType).toLowerCase().includes("application/pdf")) {
      const error = new Error("The uploaded file is not a valid PDF.");
      error.status = 422;
      error.failureCode = "INVALID_DOCUMENT";
      throw error;
    }
    let downloaded;
    try {
      downloaded = await storage.getArtifact({
        key: row.object_key,
        expectedHash: row.checksum_sha256,
      });
    } catch (cause) {
      if (cause?.code === "OBJECT_STORAGE_CHECKSUM_MISMATCH") {
        const error = new Error("The uploaded PDF did not match the selected file.");
        error.status = 422;
        error.failureCode = "PDF_CHECKSUM_MISMATCH";
        throw error;
      }
      throw storageUnavailableError(cause);
    }
    if (downloaded.body.subarray(0, 4).toString("latin1") !== "%PDF") {
      const error = new Error("The uploaded file is not a valid PDF.");
      error.status = 422;
      error.failureCode = "INVALID_DOCUMENT";
      throw error;
    }

    if (row.metadata_json?.durableOriginal !== true) {
      const temporaryObjectKey = row.object_key;
      const promotionPlan = await planDurablePdfOriginal({
        userId,
        row,
        attemptId,
      });
      row = promotionPlan.row;
      const durable = await promoteVerifiedPdfOriginal({
        storage,
        userId,
        row,
        body: downloaded.body,
        plannedKey: promotionPlan.plannedKey,
      });
      try {
        row = await persistDurablePdfOriginal({
          userId,
          row,
          attemptId,
          durableObjectKey: durable.key,
          temporaryObjectKey,
        });
      } catch (error) {
        await storage.deleteArtifact(durable.key).catch(() => undefined);
        throw error;
      }
      try {
        await storage.deleteArtifact(temporaryObjectKey);
      } catch (cause) {
        throw storageUnavailableError(cause);
      }
    }

    const extracted = await extractPdf(
      downloaded.body,
      `https://upload.local/${encodeURIComponent(row.file_name || "document.pdf")}`,
      row.file_name,
    );
    const text = cleanSourceText(extracted.text);
    const language = extracted.language || pdfProcessor.detectLanguage(text);
    const chunks = extracted.chunks.map((chunk) => ({
      content: cleanSourceText(chunk.content),
      metadata: { ...chunk.metadata, source: "user_source" },
    })).filter((chunk) => chunk.content.length >= 20);
    if (!chunks.length) {
      const error = new Error("No citation-ready passages could be extracted from this PDF.");
      error.status = 422;
      error.failureCode = "LOW_QUALITY_TEXT";
      throw error;
    }
    const ready = await persistProcessedPdfReady({
      userId,
      row,
      attemptId,
      extracted,
      text,
      language,
      chunks,
      durableObjectKey: row.object_key,
    });
    return toPublicSource(ready);
  } catch (error) {
    await quarantineFailedUploadObject({
      userId,
      row,
      failure: error,
      storage,
      processingAttemptId: attemptId,
    }).catch(() => undefined);
    throw error;
  }
};

const completePdfUpload = async (userId, sourceId) =>
  withUserSourceLifecycleLock(
    userId,
    () => completePdfUploadUnlocked(userId, sourceId),
  );

const addPdfSource = async (userId, payload) =>
  withUserSourceLifecycleLock(
    userId,
    () => addPdfSourceUnlocked(userId, payload),
  );

const getSourceContext = async (userId, sourceIds = [], search = "") => {
  const ids = [...new Set((Array.isArray(sourceIds) ? sourceIds : []).map((id) => Number(id)).filter((id) => Number.isSafeInteger(id) && id > 0))].slice(0, 20);
  if (!ids.length) return { context: "", sources: [], evidence: [], chunks: 0 };
  const result = await query(
    `SELECT s.id, s.title, s.source_url, s.file_name, s.source_type,
            c.chunk_index, c.content, c.metadata_json
      FROM research_sources s
      JOIN research_source_chunks c ON c.source_id = s.id
      WHERE s.user_id = $1 AND s.id = ANY($2::BIGINT[]) AND s.status = 'ready'
      ORDER BY CASE
                 WHEN $3 = '' THEN 0
                 WHEN c.search_vector @@ websearch_to_tsquery('simple', $3)
                   OR c.content ILIKE $4 THEN 0
                 ELSE 1
               END,
               CASE WHEN $3 = '' THEN 0 ELSE ts_rank_cd(c.search_vector, websearch_to_tsquery('simple', $3)) END DESC,
               s.id, c.chunk_index
      LIMIT 12`,
    [userId, ids, String(search || "").slice(0, 500), `%${String(search || "").replace(/[%_]/g, " ").slice(0, 120)}%`],
  );
  let remaining = MAX_CONTEXT_CHARS;
  const selected = [];
  const sources = [];
  const evidence = [];
  for (const row of result.rows) {
    if (remaining <= 0) break;
    const content = cleanSourceText(row.content).slice(0, remaining);
    if (!content) continue;
    remaining -= content.length;
    selected.push(`[User source: ${row.title} | Passage ${Number(row.chunk_index) + 1}]\n${content}`);
    evidence.push({
      sourceId: String(row.id),
      documentId: `user-source-${row.id}`,
      documentTitle: row.title,
      sourceUrl: row.source_url,
      fileName: row.file_name,
      sourceType: row.source_type,
      chunkIndex: Number(row.chunk_index),
      content,
      passage: Number(row.chunk_index) + 1,
      userSource: true,
      authorityClass: "USER_SOURCE",
      resourceType: row.metadata_json?.resourceType || null,
      heading: row.metadata_json?.heading || row.metadata_json?.sectionTitle || null,
      sectionPath: row.metadata_json?.sectionPath || [],
      anchor: row.metadata_json?.sourceAnchor || null,
      pageStart: row.metadata_json?.pageStart || null,
      pageEnd: row.metadata_json?.pageEnd || null,
    });
    if (!sources.some((source) => source.sourceId === String(row.id))) {
      sources.push({
        sourceId: String(row.id),
        documentTitle: row.title,
        sourceUrl: row.source_url,
        fileName: row.file_name,
        sourceType: row.source_type,
        content: content.slice(0, 360),
        passage: Number(row.chunk_index) + 1,
        userSource: true,
        authorityClass: "USER_SOURCE",
        resourceType: row.metadata_json?.resourceType || null,
        heading: row.metadata_json?.heading || row.metadata_json?.sectionTitle || null,
        sectionPath: row.metadata_json?.sectionPath || [],
        anchor: row.metadata_json?.sourceAnchor || null,
        pageStart: row.metadata_json?.pageStart || null,
        pageEnd: row.metadata_json?.pageEnd || null,
      });
    }
  }
  return { context: selected.join("\n\n"), sources, evidence, chunks: selected.length };
};

const deleteSourceUnlocked = async (
  userId,
  sourceId,
  { queryFn = query, storage = null } = {},
) => {
  const selected = await queryFn(
    `SELECT id, source_type, object_key, status, created_at, metadata_json
       FROM research_sources
      WHERE id = $1 AND user_id = $2
      LIMIT 1`,
    [Number(sourceId), userId],
  );
  const row = selected.rows[0];
  if (!row) return false;
  const uploadStage = String(row.metadata_json?.uploadStage || "");
  if (row.source_type === "pdf_upload") {
    if (row.status === "processing" && uploadStage !== "awaiting_upload") {
      const error = new Error("This PDF is currently being processed. Please wait before removing it.");
      error.status = 409;
      error.failureCode = "UPLOAD_PROCESSING_IN_PROGRESS";
      throw error;
    }
    const expiresAt = Date.parse(row.metadata_json?.uploadExpiresAt || "");
    const safeDeleteAfter = Number.isFinite(expiresAt)
      ? expiresAt + 60_000
      : Number.NaN;
    if (Number.isFinite(safeDeleteAfter) && safeDeleteAfter > Date.now()) {
      const cancelled = await queryFn(
          `UPDATE research_sources
              SET status = 'failed', error_message = $1,
                  metadata_json = metadata_json || $2::jsonb,
                  updated_at = NOW()
            WHERE id = $3 AND user_id = $4
            RETURNING id`,
          [
            "Upload cancelled. The private upload slot will be cleaned up shortly.",
            JSON.stringify({
              uploadStage: "cancel_pending",
              failureCode: "UPLOAD_CANCELLED",
              deletionPending: true,
            }),
            row.id,
            userId,
          ],
        );
      return Boolean(cancelled.rows[0]);
    }
  }
  const keys = [...new Set([
    row.object_key,
    row.metadata_json?.durableObjectKeyPlanned,
    row.metadata_json?.temporaryObjectKeyToDelete,
  ].filter(Boolean))];
  if (keys.some((key) => !isOwnedUserSourceObjectKey(key, userId))) {
    const error = new Error("The private source could not be safely removed.");
    error.status = 409;
    error.failureCode = "UPLOAD_OBJECT_OWNERSHIP_INVALID";
    throw error;
  }
  if (keys.length) {
    try {
      const objectStorage = storage || createObjectStorage();
      for (const key of keys) await objectStorage.deleteArtifact(key);
    } catch (cause) {
      const error = new Error("Private document storage is temporarily unavailable. Please retry later.");
      error.status = 503;
      error.publicMessage = error.message;
      error.failureCode = "STORAGE_UNAVAILABLE";
      error.publicCode = error.failureCode;
      error.cause = cause;
      throw error;
    }
  }
  const deleted = await queryFn(
    "DELETE FROM research_sources WHERE id = $1 AND user_id = $2 RETURNING id",
    [Number(sourceId), userId],
  );
  return Boolean(deleted.rows[0]);
};

const deleteSource = async (userId, sourceId, options = {}) => {
  if (options.queryFn && options.queryFn !== query) {
    return deleteSourceUnlocked(userId, sourceId, options);
  }
  return withUserSourceLifecycleLock(
    userId,
    () => deleteSourceUnlocked(userId, sourceId, options),
    options.pool ? { pool: options.pool } : undefined,
  );
};

module.exports = {
  MAX_SOURCE_BYTES,
  MAX_LEGACY_UPLOAD_BYTES,
  MAX_ACTIVE_UPLOAD_INTENTS_PER_USER,
  MAX_GLOBAL_STALE_UPLOAD_SWEEP,
  UPLOAD_INTENT_STALE_MINUTES,
  UPLOAD_PROCESSING_STALE_MINUTES,
  addPdfSource,
  addUrlSource,
  assertPublicUrl,
  deleteSource,
  getSourceContext,
  extractHtml,
  extractPdf,
  findLinkedPdfUrl,
  fetchPublicSource,
  listSources,
  validatePdfUploadIntent,
  assertPdfUploadStorageAvailable,
  isOwnedUserSourceObjectKey,
  storageUnavailableError,
  safeProcessingFailure,
  withUserSourceLifecycleLock,
  storeOriginal,
  persistSource,
  persistSourceRows,
  reservePdfUploadIntentRecord,
  quarantineFailedUploadObject,
  planDurablePdfOriginal,
  persistDurablePdfOriginal,
  claimPdfUploadForProcessing,
  promoteVerifiedPdfOriginal,
  persistProcessedPdfReady,
  promoteAndPersistProcessedPdf,
  sweepStalePdfUploadIntents,
  createPdfUploadIntent,
  completePdfUpload,
};
