const crypto = require("node:crypto");
const dns = require("node:dns").promises;
const net = require("node:net");
const axios = require("axios");
const cheerio = require("cheerio");
const { query } = require("../db");
const { pdfProcessor } = require("../lib/pdfProcessor");
const { createObjectStorage, objectStorageConfig } = require("../lib/storage/objectStorage");

const MAX_SOURCE_BYTES = 20 * 1024 * 1024;
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
    throw error;
  }
  if (!['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password) {
    const error = new Error("Only public http or https links are supported.");
    error.status = 422;
    throw error;
  }
  const hostname = parsed.hostname.toLowerCase();
  if (hostname === "localhost" || hostname.endsWith(".localhost") ||
      hostname.endsWith(".local") || hostname.endsWith(".internal") ||
      isPrivateAddress(hostname)) {
    const error = new Error("Private and internal network links are not allowed.");
    error.status = 422;
    throw error;
  }
  try {
    const addresses = await dns.lookup(hostname, { all: true });
    if (addresses.some(({ address }) => isPrivateAddress(address))) {
      const error = new Error("Private and internal network links are not allowed.");
      error.status = 422;
      throw error;
    }
  } catch (error) {
    if (error.status) throw error;
    error.status = 422;
    error.message = "The source link could not be resolved.";
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
  const html = buffer.toString("utf8");
  const $ = cheerio.load(html);
  $("script, style, noscript, template, svg, nav, footer, header").remove();
  const title = $("title").first().text().trim() || new URL(url).hostname;
  const main = $("main, article, [role='main']").first();
  const text = cleanSourceText((main.length ? main : $("body")).text());
  return { title, text, mimeType: "text/html", pageCount: null };
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
  let text = parsed.fullText || "";
  let extractionMethod = "pdf_text";
  let ocrUsed = false;
  if (!pdfProcessor.hasUsableText(text, parsed.numPages)) {
    text = await pdfProcessor.extractTextWithOcr(buffer);
    extractionMethod =
      String(process.env.AI_PROVIDER || "gemini").toLowerCase() === "openai"
        ? "openai_ocr"
        : "gemini_ocr";
    ocrUsed = true;
  }
  text = pdfProcessor.cleanText(text, pdfProcessor.detectLanguage(text).languageCode);
  const title = String(parsed.info?.Title || fileName || new URL(url).pathname.split("/").pop() || "Uploaded PDF").trim();
  const language = pdfProcessor.detectLanguage(text);
  return {
    title,
    text: cleanSourceText(text),
    mimeType: "application/pdf",
    pageCount: Number(parsed.numPages || 0),
    language,
    extractionMethod,
    ocrUsed,
  };
};

const fetchPublicSource = async (initialUrl) => {
  let currentUrl = initialUrl;
  for (let redirect = 0; redirect <= 3; redirect += 1) {
    const response = await axios.get(currentUrl.href, {
      responseType: "arraybuffer",
      timeout: 45_000,
      maxContentLength: MAX_SOURCE_BYTES,
      maxBodyLength: MAX_SOURCE_BYTES,
      maxRedirects: 0,
      validateStatus: (status) => status >= 200 && status < 400,
      headers: {
        Accept: "text/html, application/pdf;q=0.9, */*;q=0.1",
        "User-Agent": "RashtramAI-ResearchSource/1.0",
      },
    });
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
  const storage = await storeOriginal({
    buffer,
    kind: sourceType === "pdf_upload" ? "pdf" : "source-html",
    extension: sourceType === "pdf_upload" ? "pdf" : "html",
    contentType: mimeType,
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
      }),
    ],
  );
  const source = result.rows[0];
  const chunks = chunkText(text);
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
  const { response, url: finalUrl } = await fetchPublicSource(parsed);
  const buffer = Buffer.from(response.data);
  const contentType = String(response.headers["content-type"] || "").toLowerCase();
  const isPdf = contentType.includes("application/pdf") || buffer.subarray(0, 4).toString("latin1") === "%PDF";
  const extracted = isPdf
    ? await extractPdf(buffer, finalUrl)
    : extractHtml(buffer, finalUrl);
  return persistSource({
    userId,
    title: extracted.title,
    sourceType: "external_url",
    sourceUrl: finalUrl,
    mimeType: extracted.mimeType,
    buffer,
    extracted,
    metadata: { fetchedFrom: parsed.href },
  });
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

const getSourceContext = async (userId, sourceIds = [], search = "") => {
  const ids = [...new Set((Array.isArray(sourceIds) ? sourceIds : []).map((id) => Number(id)).filter((id) => Number.isSafeInteger(id) && id > 0))].slice(0, 20);
  if (!ids.length) return { context: "", sources: [], chunks: 0 };
  const result = await query(
    `SELECT s.id, s.title, s.source_url, s.file_name, s.source_type,
            c.chunk_index, c.content
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
  for (const row of result.rows) {
    if (remaining <= 0) break;
    const content = cleanSourceText(row.content).slice(0, remaining);
    if (!content) continue;
    remaining -= content.length;
    selected.push(`[User source: ${row.title} | Passage ${Number(row.chunk_index) + 1}]\n${content}`);
    if (!sources.some((source) => source.sourceId === String(row.id))) {
      sources.push({ sourceId: String(row.id), documentTitle: row.title, sourceUrl: row.source_url, fileName: row.file_name, sourceType: row.source_type, content: content.slice(0, 360), passage: Number(row.chunk_index) + 1 });
    }
  }
  return { context: selected.join("\n\n"), sources, chunks: selected.length };
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
  addPdfSource,
  addUrlSource,
  assertPublicUrl,
  deleteSource,
  getSourceContext,
  listSources,
};
