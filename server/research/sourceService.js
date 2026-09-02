const crypto = require("node:crypto");
const dns = require("node:dns").promises;
const net = require("node:net");
const axios = require("axios");
const cheerio = require("cheerio");
const { query } = require("../db");
const { pdfProcessor } = require("../lib/pdfProcessor");
const {
  createObjectStorage,
  objectStorageConfig,
  userSourceObjectKey,
} = require("../lib/storage/objectStorage");
const { httpsAgentForUrl } = require("../lib/ingestion/core/tlsTrust");
const {
  chunkStructuredHtml,
  extractStructuredHtml,
} = require("../document/htmlResourceService");

const MAX_SOURCE_BYTES = 50 * 1024 * 1024;
const MAX_LEGACY_UPLOAD_BYTES = 3 * 1024 * 1024;
const MAX_SOURCE_TEXT = 500_000;
const MAX_CONTEXT_CHARS = 9_000;

const sha256 = (buffer) => crypto.createHash("sha256").update(buffer).digest("hex");

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

const storeOriginal = async ({ buffer, kind, extension, contentType, metadata }) => {
  if (!objectStorageConfig().configured) return { objectKey: null, warning: "Object storage is not configured; extracted text was retained." };
  try {
    const storage = createObjectStorage();
    const uploaded = await storage.putArtifact({ kind, body: buffer, extension, contentType, metadata });
    return { objectKey: uploaded.key, warning: null };
  } catch (error) {
    return { objectKey: null, warning: "Original file storage was unavailable; extracted text was retained." };
  }
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
  metadata: row.metadata_json || {},
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const persistSource = async ({ userId, title, sourceType, sourceUrl, fileName, mimeType, buffer, extracted, metadata = {} }) => {
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
  });
  const language = extracted.language || pdfProcessor.detectLanguage(text);
  const result = await query(
    `INSERT INTO research_sources (
       user_id, title, source_type, source_url, file_name, mime_type,
       object_key, checksum_sha256, size_bytes, language_code, status,
       content_text, metadata_json
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'ready', $11, $12::jsonb)
     RETURNING *`,
    [
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
  );
  const source = result.rows[0];
  const chunks = Array.isArray(extracted.chunks) && extracted.chunks.length
    ? extracted.chunks.map((chunk) => ({
        content: cleanSourceText(chunk.content),
        metadata: { ...chunk.metadata, source: "user_source" },
      }))
    : chunkText(text);
  for (const [index, chunk] of chunks.entries()) {
    await query(
      `INSERT INTO research_source_chunks (source_id, chunk_index, content, metadata_json)
       VALUES ($1, $2, $3, $4::jsonb)`,
      [source.id, index, chunk.content, JSON.stringify(chunk.metadata)],
    );
  }
  return toPublicSource(source);
};

const listSources = async (userId) => {
  const result = await query(
    `SELECT id, title, source_type, source_url, file_name, mime_type,
            language_code, status, error_message, size_bytes, metadata_json,
            created_at, updated_at
       FROM research_sources WHERE user_id = $1
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

const addPdfSource = async (userId, { fileName, mimeType, buffer }) => {
  if (!Buffer.isBuffer(buffer) || buffer.length === 0 || buffer.length > MAX_SOURCE_BYTES) {
    const error = new Error("PDF must be between 1 byte and 20 MB.");
    error.status = 422;
    throw error;
  }
  if (buffer.subarray(0, 4).toString("latin1") !== "%PDF") {
    const error = new Error("Only valid PDF files can be added for study.");
    error.status = 422;
    throw error;
  }
  const extracted = await extractPdf(buffer, `https://upload.local/${encodeURIComponent(fileName || "document.pdf")}`, fileName);
  return persistSource({
    userId,
    title: extracted.title,
    sourceType: "pdf_upload",
    fileName: String(fileName || "document.pdf").slice(0, 255),
    mimeType: mimeType || "application/pdf",
    buffer,
    extracted,
    metadata: { uploaded: true },
  });
};

const createPdfUploadIntent = async (userId, { fileName, mimeType, sizeBytes, checksumSha256 }) => {
  const size = Number(sizeBytes || 0);
  const checksum = String(checksumSha256 || "").toLowerCase();
  if (!Number.isSafeInteger(size) || size < 1 || size > MAX_SOURCE_BYTES) {
    const error = new Error("PDF must be between 1 byte and 50 MB.");
    error.status = 422;
    error.failureCode = "PDF_SIZE_INVALID";
    throw error;
  }
  if (!/^[a-f0-9]{64}$/.test(checksum)) {
    const error = new Error("The PDF checksum is missing or invalid.");
    error.status = 422;
    error.failureCode = "PDF_CHECKSUM_INVALID";
    throw error;
  }
  if (!objectStorageConfig().configured) {
    const error = new Error("Private document storage is temporarily unavailable. Please retry later.");
    error.status = 503;
    error.publicMessage = error.message;
    error.failureCode = "OBJECT_STORAGE_UNAVAILABLE";
    throw error;
  }
  const uploadId = crypto.randomUUID();
  const objectKey = userSourceObjectKey({ userId, uploadId, extension: "pdf" });
  const safeFileName = String(fileName || "document.pdf").trim().slice(0, 255);
  const inserted = await query(
    `INSERT INTO research_sources (
       user_id, title, source_type, file_name, mime_type, object_key,
       checksum_sha256, size_bytes, status, metadata_json
     ) VALUES ($1, $2, 'pdf_upload', $3, $4, $5, $6, $7, 'processing', $8::jsonb)
     RETURNING *`,
    [
      userId, safeFileName.replace(/\.pdf$/i, "") || "Uploaded PDF", safeFileName,
      mimeType || "application/pdf", objectKey, checksum, size,
      JSON.stringify({ uploaded: true, uploadStage: "awaiting_upload", uploadId }),
    ],
  );
  try {
    const signed = await createObjectStorage().createPresignedUpload({
      key: objectKey,
      contentType: mimeType || "application/pdf",
      expiresIn: 600,
    });
    return {
      source: toPublicSource(inserted.rows[0]),
      uploadUrl: signed.uploadUrl,
      expiresIn: signed.expiresIn,
      maxBytes: MAX_SOURCE_BYTES,
    };
  } catch (error) {
    await query("DELETE FROM research_sources WHERE id = $1 AND user_id = $2", [inserted.rows[0].id, userId]).catch(() => undefined);
    error.status = 503;
    error.publicMessage = "Private document storage is temporarily unavailable. Please retry later.";
    throw error;
  }
};

const completePdfUpload = async (userId, sourceId) => {
  const selected = await query(
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
  if (row.status === "ready") return toPublicSource(row);
  try {
    const storage = createObjectStorage();
    const head = await storage.headArtifact(row.object_key);
    if (Number(head.bytes) !== Number(row.size_bytes) || Number(head.bytes) > MAX_SOURCE_BYTES) {
      const error = new Error("The uploaded file size did not match the selected PDF.");
      error.status = 422;
      error.failureCode = "PDF_SIZE_MISMATCH";
      throw error;
    }
    const downloaded = await storage.getArtifact({
      key: row.object_key,
      expectedHash: row.checksum_sha256,
    });
    if (downloaded.body.subarray(0, 4).toString("latin1") !== "%PDF") {
      const error = new Error("The uploaded file is not a valid PDF.");
      error.status = 422;
      error.failureCode = "PDF_MAGIC_INVALID";
      throw error;
    }
    await query(
      `UPDATE research_sources SET metadata_json = metadata_json || $1::jsonb, updated_at = NOW()
        WHERE id = $2 AND user_id = $3`,
      [JSON.stringify({ uploadStage: "extracting" }), row.id, userId],
    );
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
    const pool = require("../db").getPool();
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
      }
      const updated = await client.query(
        `UPDATE research_sources SET title = $1, language_code = $2, status = 'ready',
           error_message = NULL, content_text = $3, metadata_json = metadata_json || $4::jsonb,
           updated_at = NOW() WHERE id = $5 AND user_id = $6 RETURNING *`,
        [
          extracted.title.slice(0, 300), language.languageCode, text,
          JSON.stringify({
            uploadStage: "ready",
            pageCount: extracted.pageCount,
            extractionMethod: extracted.extractionMethod,
            ocrUsed: extracted.ocrUsed,
            partialValid: extracted.partialValid,
            validPageCount: extracted.validPageCount,
            invalidPageCount: extracted.invalidPageCount,
            pageExtraction: extracted.pageExtraction,
          }),
          row.id, userId,
        ],
      );
      await client.query("COMMIT");
      return toPublicSource(updated.rows[0]);
    } catch (error) {
      await client.query("ROLLBACK").catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    await query(
      `UPDATE research_sources SET status = 'failed', error_message = $1,
         metadata_json = metadata_json || $2::jsonb, updated_at = NOW()
       WHERE id = $3 AND user_id = $4`,
      [String(error.message || "PDF processing failed").slice(0, 500), JSON.stringify({ uploadStage: "failed", failureCode: error.failureCode || error.code || "PDF_PROCESSING_FAILED" }), row.id, userId],
    ).catch(() => undefined);
    throw error;
  }
};

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

const deleteSource = async (userId, sourceId) => {
  const result = await query(
    "DELETE FROM research_sources WHERE id = $1 AND user_id = $2 RETURNING object_key",
    [Number(sourceId), userId],
  );
  const objectKey = result.rows[0]?.object_key;
  if (objectKey && objectStorageConfig().configured) {
    await createObjectStorage().deleteArtifact(objectKey).catch(() => undefined);
  }
  return Boolean(result.rows[0]);
};

module.exports = {
  MAX_SOURCE_BYTES,
  MAX_LEGACY_UPLOAD_BYTES,
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
  createPdfUploadIntent,
  completePdfUpload,
};
