const crypto = require("node:crypto");
const { pdfProcessor } = require("../lib/pdfProcessor");
const { query } = require("../db");
const {
  checkActExists,
  checkBillExists,
  checkEGazetteExists,
  createProbeVector,
  generateActSummary,
  generateBillSummary,
  generateEGazetteSummary,
  generateDocumentSummary,
  generateEmbedding,
  generateSuggestedQuestions,
  getActIndex,
  getEGazetteIndex,
  getIndex,
  getPolicyIndex,
  checkPolicyExists,
  generatePolicySummary,
  providerConfig,
  searchSimilarContentForPolicy,
  storePolicyContentInChunks,
  searchSimilarContent,
  searchSimilarContentForAct,
  searchSimilarContentForEGazette,
  storeActContentInChunks,
  storeBillContentInChunks,
  storeEGazetteContentInChunks,
} = require("../lib/vectordb");
const { sanitizeProviderError } = require("../lib/providerErrorSanitizer");
const {
  normalizeDocumentType,
  retrievalFamilyForType,
} = require("./documentTypes");
const DocumentRepository = require("./DocumentRepository");
const {
  fetchArticle,
} = require("../lib/ingestion/connectors/policyedgeConnector");
const {
  createObjectStorage,
  objectStorageConfig,
} = require("../lib/storage/objectStorage");
const { planQuery } = require("../retrieval/queryPlanner");
const { candidateLimitsFor, retrievalConfig } = require("../retrieval/retrievalConfig");
const { legacyCandidateMerge, reciprocalRankFusion } = require("../retrieval/rankFusion");
const {
  applyResearchFlags,
  resolveResearchFlags,
} = require("../retrieval/featureFlags");
const {
  caches,
  retrievalCacheKey,
} = require("../retrieval/researchCache");
const {
  discoverKnowledgeCandidates,
} = require("../graph/knowledgeLayerService");
const { expandLargeDocumentMatches } = require("./largeDocumentService");
const { retrieveTemporalPassages } = require("./temporalLegalService");
const { retrieveTreePassages } = require("./documentStructureService");
const {
  chunkStructuredHtml,
  extractStructuredHtml,
  htmlFailure,
} = require("./htmlResourceService");
const { SOURCE_AUTHORITY } = require("../retrieval/sourceAuthority");
const { evidenceTextIsReliable, evaluateTextQuality } = require("../lib/pdfTextQuality");

const TYPE_CONFIG = {
  bill: {
    index: getIndex,
    check: checkBillExists,
    generateSummary: generateBillSummary,
    search: searchSimilarContent,
    store: storeBillContentInChunks,
    idField: "billId",
    titleField: "billTitle",
  },
  act: {
    index: getActIndex,
    check: checkActExists,
    generateSummary: generateActSummary,
    search: searchSimilarContentForAct,
    store: storeActContentInChunks,
    idField: "actId",
    titleField: "actTitle",
  },
  gazette: {
    index: getEGazetteIndex,
    check: checkEGazetteExists,
    generateSummary: generateEGazetteSummary,
    search: searchSimilarContentForEGazette,
    store: storeEGazetteContentInChunks,
    idField: "gazetteId",
    titleField: "gazetteTitle",
  },
  policy: {
    index: getPolicyIndex,
    check: checkPolicyExists,
    generateSummary: generatePolicySummary,
    search: searchSimilarContentForPolicy,
    store: storePolicyContentInChunks,
    idField: "policyId",
    titleField: "policyTitle",
  },
};

const contextCache = new Map();
const CONTEXT_CACHE_TTL_MS = 5 * 60 * 1_000;

const typeConfig = (documentType) => {
  const normalizedType = normalizeDocumentType(documentType);
  const config = TYPE_CONFIG[retrievalFamilyForType(normalizedType)];
  if (!config) {
    throw new Error(
      `Document processing is not available for ${documentType}.`,
    );
  }
  return config;
};

const isExtractableSourceDocument = (document) => {
  if (!document?.sourceUrl) return false;
  // Validate the public document type, but do not force PolicyEdge reports,
  // circulars, or other catalogue classes through a PDF-only branch.
  normalizeDocumentType(document?.type);
  return [
    document.source,
    document.sourceName,
    document.metadata?.source,
    document.metadata?.sourceClassification,
  ]
    .filter(Boolean)
    .some((value) => /policy[\s_-]*edge/i.test(String(value)) || /policyedge\.in/i.test(String(value)));
};

const sourceSlug = (document) => {
  const explicit = document?.metadata?.slug;
  if (explicit) return String(explicit).trim();
  const sourceUrl = String(document?.sourceUrl || "");
  if (sourceUrl.includes("/p/")) {
    return sourceUrl.split("/p/").pop()?.split(/[?#]/)[0] || "";
  }
  const canonical = String(document?.canonicalId || "").trim();
  return /^[a-z0-9]+(?:-[a-z0-9]+)+$/i.test(canonical) ? canonical : "";
};

const pineconeSafeHtmlMetadata = (metadata = {}, summary = "") => {
  const { tableContext, ...vectorMetadata } = metadata;
  return {
    ...vectorMetadata,
    tableCaption: tableContext?.caption || null,
    tableHeaders: Array.isArray(tableContext?.headers) ? tableContext.headers : [],
    tableRowIndex: tableContext?.rowIndex || null,
    summary,
  };
};

const getTextArtifact = async (documentId) => {
  const result = await query(
    `SELECT
       language_code,
       script,
       language_confidence,
       is_bilingual,
       english_summary,
       extraction_method,
       ocr_used,
       ocr_required,
       metadata_json,
       summary_json,
       pdf_quality_class,
       pdf_quality_json,
       extracted_text_sha256,
       updated_at
     FROM document_text_artifacts
     WHERE document_id = $1
     LIMIT 1`,
    [documentId],
  );
  const row = result.rows[0];
  if (!row) return null;
  return {
    languageCode: row.language_code,
    script: row.script,
    languageConfidence:
      row.language_confidence == null
        ? null
        : Number(row.language_confidence),
    isBilingual: row.is_bilingual,
    englishSummary: row.english_summary,
    extractionMethod: row.extraction_method,
    ocrUsed: row.ocr_used,
    ocrRequired: row.ocr_required,
    metadata: row.metadata_json || {},
    summarySections: row.summary_json || {},
    pdfQualityClass: row.pdf_quality_class || null,
    pdfQuality: row.pdf_quality_json || {},
    extractedTextSha256: row.extracted_text_sha256 || null,
    updatedAt: row.updated_at,
  };
};

const loadExternalizedOriginalText = async (documentId) => {
  const result = await query(
    `SELECT object_key, sha256
     FROM document_artifact_objects
     WHERE document_id = $1
       AND status = 'verified'
       AND source_locator = 'document_text_artifacts.original_text'
     ORDER BY verified_at DESC NULLS LAST, updated_at DESC
     LIMIT 1`,
    [documentId],
  );
  const object = result.rows[0];
  if (!object?.object_key || !objectStorageConfig().configured) return "";
  try {
    const storage = createObjectStorage();
    const artifact = await storage.getArtifact({
      key: object.object_key,
      expectedHash: object.sha256,
    });
    return artifact.body.toString("utf8");
  } catch (error) {
    console.warn("Externalized text artifact read failed:", {
      documentId,
      code: error.code || null,
      message: error.message,
    });
    return "";
  }
};

const saveTextArtifact = async (
  documentId,
  {
    language,
    originalText,
    englishSummary,
    extractionMethod,
    ocrUsed,
    ocrRequired,
    summaryJson = {},
    pdfQuality = null,
    metadata = {},
  },
) => {
  const extractedTextSha256 = computeChunkContentHash(originalText);
  await query(
    `INSERT INTO document_text_artifacts (
       document_id,
       language_code,
       script,
       language_confidence,
       original_text,
       is_bilingual,
       english_summary,
       extraction_method,
       ocr_used,
       ocr_required,
       metadata_json,
       summary_json,
       pdf_quality_class,
       pdf_quality_json, extracted_text_sha256
     )
     VALUES (
       $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::jsonb,
       $12::jsonb, $13, $14::jsonb, $15
     )
     ON CONFLICT (document_id)
     DO UPDATE SET
       language_code = EXCLUDED.language_code,
       script = EXCLUDED.script,
       language_confidence = EXCLUDED.language_confidence,
       original_text = EXCLUDED.original_text,
       is_bilingual = EXCLUDED.is_bilingual,
       english_summary = EXCLUDED.english_summary,
       extraction_method = EXCLUDED.extraction_method,
       ocr_used = EXCLUDED.ocr_used,
       ocr_required = EXCLUDED.ocr_required,
       metadata_json = EXCLUDED.metadata_json,
       summary_json = EXCLUDED.summary_json,
       pdf_quality_class = EXCLUDED.pdf_quality_class,
       pdf_quality_json = EXCLUDED.pdf_quality_json,
       extracted_text_sha256 = EXCLUDED.extracted_text_sha256,
       updated_at = NOW()`,
    [
      documentId,
      language.languageCode,
      language.script,
      language.confidence,
      originalText,
      Boolean(language.isBilingual),
      englishSummary || null,
      extractionMethod,
      Boolean(ocrUsed),
      Boolean(ocrRequired),
      JSON.stringify(metadata),
      JSON.stringify(summaryJson || {}),
      pdfQuality?.qualityClass || null,
      JSON.stringify(pdfQuality || {}),
      extractedTextSha256,
    ],
  );
  for (const key of contextCache.keys()) {
    if (key.endsWith(`:${documentId}`)) contextCache.delete(key);
  }
};

const parseSummarySections = (summary) => {
  const sections = {};
  const parts = String(summary || "").split(/^##\s+/m).slice(1);
  for (const part of parts) {
    const [heading, ...body] = part.split("\n");
    const key = String(heading || "")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_|_$/g, "");
    if (key) sections[key] = body.join("\n").trim();
  }
  return sections;
};

const questionsFromSummary = (summarySections) =>
  String(summarySections?.suggested_questions || "")
    .split("\n")
    .map((line) =>
      line
        .replace(/^\s*(?:[-*]|\d+[.)])\s*/, "")
        .trim(),
    )
    .filter(Boolean)
    .slice(0, 4);

const normalizeQuestion = (value) =>
  String(value || "")
    .normalize("NFKC")
    .replace(/\s+/g, " ")
    .trim();

const GENERIC_QUESTION_PATTERNS = [
  /main policy objectives/i,
  /which institutions are affected/i,
  /implementation risks/i,
  /main obligations or policy changes/i,
  /who is affected by this document/i,
  /dates or compliance steps/i,
  /source passages support/i,
];

const areGenericQuestions = (questions = []) => {
  const normalized = questions.map(normalizeQuestion).filter(Boolean);
  if (!normalized.length) return true;
  return normalized.every((question) =>
    GENERIC_QUESTION_PATTERNS.some((pattern) => pattern.test(question)),
  );
};

const cleanExcerptLine = (value, maxLength = 420) =>
  String(value || "")
    .normalize("NFKC")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);

const buildExtractiveSummary = (
  documentType,
  sourceText,
  {
    sourceLanguage = "und",
    generationError = null,
  } = {},
) => {
  const excerpts = String(sourceText || "")
    .split(/\n{2,}|(?<=[।.!?])\s+/u)
    .map((line) => cleanExcerptLine(line))
    .filter((line) => line.length >= 80)
    .slice(0, 6);
  const fallbackReason = cleanExcerptLine(
    sanitizeProviderError(generationError),
    220,
  );
  const excerptLines = excerpts.length
    ? excerpts.map((excerpt) => `- ${excerpt}`).join("\n")
    : "- The document text was extracted, but no concise passage could be selected for summary.";
  return [
    "## Executive Summary",
    `Rashtram AI prepared this ${documentType} with an extractive fallback because AI summary generation was unavailable. The research workspace remains grounded in extracted source text.`,
    "",
    "## Key Source Excerpts",
    excerptLines,
    "",
    "## Processing Note",
    `Fallback mode: extractive. Source language: ${sourceLanguage || "und"}. Provider error: ${fallbackReason}.`,
    "",
    "## Suggested Questions",
    "- What are the main obligations or policy changes in this document?",
    "- Which authorities, institutions, or stakeholders are affected?",
    "- What dates, deadlines, penalties, or compliance steps are stated?",
    "- Which source passages support the answer?",
  ].join("\n");
};

const safeGenerateSummary = async (documentType, sourceText, options = {}) => {
  try {
    const summary = await generateDocumentSummary(documentType, sourceText, options);
    const usedBuiltInFallback =
      /\bwas processed from source text\b/i.test(summary) ||
      /Review the original source snippets/i.test(summary);
    return {
      summary,
      fallback: usedBuiltInFallback,
      error: usedBuiltInFallback
        ? new Error("AI summary unavailable; built-in extractive fallback used")
        : null,
    };
  } catch (error) {
    const providerError = sanitizeProviderError(error);
    console.warn(
      `AI summary unavailable for ${documentType}; using extractive fallback: ${providerError}`,
    );
    return {
      summary: buildExtractiveSummary(documentType, sourceText, {
        sourceLanguage: options.sourceLanguage,
        generationError: error,
      }),
      fallback: true,
      error: new Error(providerError),
    };
  }
};

const safeSuggestedQuestions = async (
  documentType,
  summary,
  summarySections,
) => {
  const fromSummary = questionsFromSummary(summarySections);
  if (fromSummary.length > 0) return fromSummary;
  try {
    return await generateSuggestedQuestions(documentType, summary);
  } catch (error) {
    const providerError = sanitizeProviderError(error);
    console.warn(
      `Suggested question generation unavailable for ${documentType}; using defaults: ${providerError}`,
    );
    return [
      "What are the main obligations or policy changes?",
      "Who is affected by this document?",
      "What dates or compliance steps matter?",
      "Which source passages support this answer?",
    ];
  }
};

const getDocument = async (documentType, documentId) => {
  const requestedType = normalizeDocumentType(documentType);
  const document = await DocumentRepository.getById(documentId);
  if (!document) return null;
  if (
    requestedType !== document.type &&
    !(requestedType === "gazette" &&
      [
        "gazette",
        "notification",
        "rule",
        "regulation",
        "order",
        "circular",
        "ordinance",
      ].includes(document.type))
  ) {
    return null;
  }
  return document;
};

const getDocumentContext = async (documentType, documentId) => {
  const cacheKey = `${documentType}:${documentId}`;
  const document = await getDocument(documentType, documentId);
  if (!document) return null;
  const documentVersion = document.fileHash || document.updatedAt || document.processedAt;
  const cached = contextCache.get(cacheKey);
  if (cached && cached.documentVersion === documentVersion &&
      Date.now() - cached.cachedAt < CONTEXT_CACHE_TTL_MS) {
    return cached.value;
  }
  const [resources, relationships, recommendations, textArtifact] =
    await Promise.all([
      DocumentRepository.getResources(documentId),
      DocumentRepository.getRelated(documentId),
      DocumentRepository.getRecommendations(
        documentId,
        null,
        8,
        document.type === "bill" ? { type: "bill" } : {},
      ),
      getTextArtifact(documentId),
    ]);
  const [timeline, graph] = await Promise.all([
    DocumentRepository.getTimeline(documentId, document, relationships),
    DocumentRepository.getGraph(documentId, document, relationships),
  ]);
  const value = {
    ...document,
    resources,
    relationships,
    recommendations,
    timeline,
    graph,
    textArtifact,
  };
  contextCache.set(cacheKey, { cachedAt: Date.now(), documentVersion, value });
  if (contextCache.size > 500) {
    const oldest = [...contextCache.entries()].sort(
      (left, right) => left[1].cachedAt - right[1].cachedAt,
    )[0]?.[0];
    if (oldest) contextCache.delete(oldest);
  }
  return value;
};

const loadIndexedChunks = async (config, documentId, topK = 100) => {
  const result = await config.index().query({
    vector: createProbeVector(),
    topK,
    filter: { [config.idField]: { $eq: String(documentId) } },
    includeMetadata: true,
  });
  return result.matches || [];
};

const computeChunkContentHash = (content) =>
  crypto.createHash("sha256").update(String(content || "")).digest("hex");

const postgresChunkMetadata = (metadata = {}) => {
  const { content, summary, ...citationMetadata } = metadata || {};
  return citationMetadata;
};

// Reads the previous hash/namespace for each chunk index before the
// delete-then-insert replace below wipes them, so unchanged content can be
// recognized after the fact. A chunk only counts as reusable when BOTH the
// content hash AND the embedding namespace (provider+model+dimension+
// version) match — content hashing alone would be unsafe across a provider
// migration, since the old vector wouldn't exist in a new namespace at all.
const saveNormalizedChunks = async (documentId, chunks, languageCode) => {
  const currentNamespace = providerConfig().vectorNamespace;
  const previous = await query(
    `SELECT chunk_index, content_hash, embedding_namespace
     FROM document_text_chunks WHERE document_id = $1`,
    [documentId],
  );
  const previousByIndex = new Map(
    previous.rows.map((row) => [Number(row.chunk_index), row]),
  );

  await query(`DELETE FROM document_text_chunks WHERE document_id = $1`, [
    documentId,
  ]);

  const unchangedChunkIds = new Set();
  let cacheHits = 0;
  let cacheMisses = 0;

  for (let index = 0; index < chunks.length; index += 1) {
    const chunk = chunks[index];
    const content = String(
      chunk.content || chunk.metadata?.content || "",
    ).trim();
    if (!content) continue;
    const chunkIndex = chunk.metadata?.chunkIndex ?? chunk.chunkIndex ?? index;
    const contentHash = computeChunkContentHash(content);
    const previousRow = previousByIndex.get(Number(chunkIndex));
    const reusable =
      previousRow?.content_hash === contentHash &&
      previousRow?.embedding_namespace === currentNamespace;
    if (reusable) {
      cacheHits += 1;
      if (chunk.id) unchangedChunkIds.add(chunk.id);
    } else {
      cacheMisses += 1;
    }

    await query(
      `INSERT INTO document_text_chunks (
         document_id, chunk_index, original_text, translated_text,
         language, token_count, vector_reference, metadata_json,
         content_hash, embedding_namespace, chunk_sha256,
         embedding_input_sha256
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9, $10, $9, $11)
       ON CONFLICT (document_id, chunk_index)
       DO UPDATE SET
         original_text = EXCLUDED.original_text,
         translated_text = EXCLUDED.translated_text,
         language = EXCLUDED.language,
         token_count = EXCLUDED.token_count,
         vector_reference = EXCLUDED.vector_reference,
         metadata_json = EXCLUDED.metadata_json,
         content_hash = EXCLUDED.content_hash,
         embedding_namespace = EXCLUDED.embedding_namespace,
         chunk_sha256 = EXCLUDED.chunk_sha256,
         embedding_input_sha256 = EXCLUDED.embedding_input_sha256,
         updated_at = NOW()`,
      [
        documentId,
        chunkIndex,
        content,
        chunk.translatedText || null,
        chunk.metadata?.languageCode || languageCode || "und",
        Math.ceil(content.length / 4),
        chunk.id || `${documentId}-chunk-${index}`,
        JSON.stringify(postgresChunkMetadata(chunk.metadata)),
        contentHash,
        currentNamespace,
        computeChunkContentHash(chunk.embeddingText || content),
      ],
    );
  }

  return { unchangedChunkIds, cacheHits, cacheMisses };
};

const hashChunkSet = (chunks) => computeChunkContentHash(
  chunks.map((chunk) => computeChunkContentHash(chunk.content)).join(":"),
);

const loadLocalChunks = async (documentId, limit = 500) => {
  const result = await query(
    `SELECT
       chunk_index, original_text, translated_text, language,
       vector_reference, metadata_json
     FROM document_text_chunks
     WHERE document_id = $1
     ORDER BY chunk_index ASC
     LIMIT $2`,
    [documentId, Math.max(1, Number(limit) || 500)],
  );
  return result.rows
    .map((row, index) => {
      const metadata = row.metadata_json || {};
      const content = String(row.original_text || row.translated_text || "")
        .trim();
      if (!content) return null;
      return {
        id: row.vector_reference || `${documentId}-chunk-${index}`,
        content,
        translatedText: row.translated_text || null,
        chunkIndex: Number(row.chunk_index ?? index),
        totalChunks: result.rows.length,
        metadata: {
          ...metadata,
          chunkIndex: Number(row.chunk_index ?? index),
          totalChunks: metadata.totalChunks || result.rows.length,
          languageCode: metadata.languageCode || row.language || "und",
        },
      };
    })
    .filter(Boolean);
};

const processExtractableSourceDocument = async (
  document,
  config,
  {
    totalStartedAt,
    indexCheckMs,
  } = {},
) => {
  const slug = sourceSlug(document);
  if (!slug) {
    const error = new Error(
      "This source-only policy does not expose an extractable article slug.",
    );
    error.status = 422;
    throw error;
  }

  const downloadStartedAt = Date.now();
  const article = await fetchArticle(slug, { title: document.title });
  const downloadMs = Date.now() - downloadStartedAt;
  const escaped = (value) => String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
  const sourceHtml = article.rawHtml || [
    "<article>",
    `<h1>${escaped(article.title || document.title)}</h1>`,
    article.description ? `<p>${escaped(article.description)}</p>` : "",
    ...String(article.bodyText || "").split(/\n{2,}/).map((paragraph) =>
      `<p>${escaped(paragraph)}</p>`),
    "</article>",
  ].join("\n");
  const extracted = extractStructuredHtml({
    html: sourceHtml,
    url: article.url || document.sourceUrl,
    preferredTitle: article.title || document.title,
    description: article.description || "",
  });
  if (!extracted.quality.valid) {
    const dynamic = extracted.quality.dynamicShell;
    throw htmlFailure(
      dynamic ? "HTML_DYNAMIC_CONTENT_UNAVAILABLE" : "HTML_EXTRACTION_LOW_QUALITY",
      dynamic
        ? "PolicyEdge returned a dynamic page shell without readable document content."
        : "PolicyEdge HTML extraction did not meet the deterministic research quality threshold.",
      { retryable: dynamic, reviewRequired: !dynamic },
    );
  }
  let sourceHtmlObjectKey = null;
  if (objectStorageConfig().configured) {
    try {
      const storage = createObjectStorage();
      const body = Buffer.from(sourceHtml, "utf8");
      const uploaded = await storage.putArtifact({
        kind: "source-html",
        body,
        contentType: "text/html; charset=utf-8",
        extension: "html",
        metadata: {
          documentId: document.id,
          source: "policyedge",
          cleanContentHash: extracted.cleanContentHash,
        },
      });
      const verified = await storage.getArtifact({
        key: uploaded.key,
        expectedHash: extracted.rawHtmlHash,
      });
      if (!verified.body.equals(body)) {
        throw new Error("PolicyEdge source HTML failed byte verification after upload.");
      }
      sourceHtmlObjectKey = uploaded.key;
      await query(
        `INSERT INTO document_artifact_objects (
           document_id, artifact_kind, source_locator, object_key, sha256,
           mime_type, byte_size, processing_version, status,
           original_retained, verified_at
         ) VALUES ($1, 'source-html', $2, $3, $4, 'text/html; charset=utf-8',
                   $5, 'policyedge-structured-html-v1', 'verified', TRUE, NOW())
         ON CONFLICT (document_id, artifact_kind, sha256) DO UPDATE SET
           object_key = EXCLUDED.object_key,
           source_locator = EXCLUDED.source_locator,
           byte_size = EXCLUDED.byte_size,
           processing_version = EXCLUDED.processing_version,
           status = 'verified', original_retained = TRUE,
           verified_at = NOW(), updated_at = NOW()`,
        [
          document.id,
          article.url || document.sourceUrl,
          uploaded.key,
          extracted.rawHtmlHash,
          body.length,
        ],
      );
    } catch (error) {
      console.warn(
        `PolicyEdge source HTML archival failed for document ${document.id}; continuing with verified hashes: ${error.message}`,
      );
    }
  }
  await query(
    `INSERT INTO legislative_document_resources (
       document_id, label, resource_type, category, url, metadata
     )
     VALUES ($1, $2, 'html', $3, $4, $5::jsonb)
     ON CONFLICT (document_id, url)
     DO UPDATE SET
       label = EXCLUDED.label,
       resource_type = EXCLUDED.resource_type,
       category = COALESCE(EXCLUDED.category, legislative_document_resources.category),
       metadata = legislative_document_resources.metadata || EXCLUDED.metadata,
       last_seen_at = NOW(),
       updated_at = NOW()`,
    [
      document.id,
      "PolicyEdge article",
      article.category || document.category || "Reports/Data Releases",
      article.url || document.sourceUrl,
      JSON.stringify({
        source: "policyedge",
        slug,
        mimeType: "text/html",
        extractable: true,
        extractionSource: article.extractionSource,
        rawHtmlHash: extracted.rawHtmlHash,
        cleanContentHash: extracted.cleanContentHash,
        extractionQuality: extracted.quality,
        sourceHtmlObjectKey,
      }),
    ],
  );
  const rawText = extracted.text;
  const detectedLanguage = pdfProcessor.detectLanguage(rawText);
  const originalText = pdfProcessor.cleanText(
    rawText,
    detectedLanguage.languageCode,
  );
  if (!pdfProcessor.hasUsableText(originalText, 1)) {
    const error = new Error("No usable text was extracted from this source page.");
    error.status = 422;
    throw error;
  }

  const htmlChunks = chunkStructuredHtml(extracted, {
    chunkSize: pdfProcessor.chunkSize,
  });
  const sourceChunks = htmlChunks.map((chunk, index) => {
    const content = chunk.content;
    return {
      id: `policy-${document.id}-chunk-${index}`,
      [config.idField]: String(document.id),
      title: article.title || document.title,
      content,
      embeddingText: content,
      chunkIndex: index,
      totalChunks: htmlChunks.length,
      metadata: {
        ...chunk.metadata,
        documentType: normalizeDocumentType(document.type),
        source: "PolicyEdge",
        sourceUrl: chunk.metadata.sourceUrl || article.url || document.sourceUrl,
        canonicalSourceUrl: article.url || document.sourceUrl,
        category: article.category || document.category,
        extractionMethod: "source_html",
        extractionSource: article.extractionSource,
        resourceType: "html",
        mimeType: "text/html",
        pageStart: null,
        pageEnd: null,
        pageEstimate: false,
        authorityClass: SOURCE_AUTHORITY.RESEARCH,
        languageCode: detectedLanguage.languageCode,
        script: detectedLanguage.script,
        originalLanguage: detectedLanguage.languageCode,
      },
    };
  });

  const summaryContext = sourceChunks
    .slice(0, 6)
    .map((chunk) => chunk.content)
    .join("\n\n");
  const previousArtifact = await getTextArtifact(document.id);
  const unchangedCleanContent = previousArtifact?.metadata?.cleanContentHash === extracted.cleanContentHash;
  const summaryStartedAt = Date.now();
  const summaryResult = unchangedCleanContent && previousArtifact?.englishSummary
    ? { summary: previousArtifact.englishSummary, fallback: false, error: null, reused: true }
    : await safeGenerateSummary("policy", summaryContext, {
        sourceLanguage: detectedLanguage.languageCode,
      });
  const { summary } = summaryResult;
  const summarySections = parseSummarySections(summary);
  const suggestedQuestions = await safeSuggestedQuestions(
    "policy",
    summary,
    summarySections,
  );
  const summaryMs = Date.now() - summaryStartedAt;

  await saveTextArtifact(document.id, {
    language: detectedLanguage,
    originalText,
    englishSummary: summary,
    extractionMethod: "source_html",
    ocrUsed: false,
    ocrRequired: false,
    summaryJson: {
      ...summarySections,
      suggestedQuestions,
    },
    pdfQuality: {
      qualityClass: "source_html",
      sourceUrl: article.url || document.sourceUrl,
      rawHtmlHash: extracted.rawHtmlHash,
      cleanContentHash: extracted.cleanContentHash,
      extractionQuality: extracted.quality,
      sourceHtmlObjectKey,
    },
    metadata: {
      source: "policyedge",
      slug,
      chunks: sourceChunks.length,
      suggestedQuestions,
      summaryFallback: summaryResult.fallback,
      summaryFallbackReason: summaryResult.error?.message || null,
      summaryReused: Boolean(summaryResult.reused),
      contentUnchanged: unchangedCleanContent,
      sourceHtmlArchived: Boolean(sourceHtmlObjectKey),
      resourceType: "html",
      authorityClass: SOURCE_AUTHORITY.RESEARCH,
      rawHtmlHash: extracted.rawHtmlHash,
      cleanContentHash: extracted.cleanContentHash,
      extractionQuality: extracted.quality,
    },
  });

  const chunkPersistenceStartedAt = Date.now();
  const chunkCacheResult = await saveNormalizedChunks(
    document.id,
    sourceChunks,
    detectedLanguage.languageCode,
  );
  const chunkPersistenceMs = Date.now() - chunkPersistenceStartedAt;
  let stored = {
    chunksStored: sourceChunks.length,
    success: false,
    metrics: { embeddingsMs: 0, pineconeMs: 0 },
    fallbackRetrieval: true,
  };
  let vectorStorageError = null;
  try {
    stored = await config.store(
      sourceChunks.map((chunk) => ({
        ...chunk,
        metadata: pineconeSafeHtmlMetadata(chunk.metadata, summary),
      })),
      { unchangedChunkIds: chunkCacheResult.unchangedChunkIds },
    );
  } catch (error) {
    vectorStorageError = error;
    console.warn(
      `Vector storage unavailable for source document ${document.id}; using local text retrieval fallback: ${error.message}`,
    );
  }
  const embeddingInputTokens = sourceChunks.reduce(
    (sum, chunk) => sum + Math.ceil(String(chunk.content || "").length / 4),
    0,
  );
  const chunkSetSha256 = hashChunkSet(sourceChunks);
  const embeddingInputSha256 = computeChunkContentHash(
    sourceChunks.map((chunk) => chunk.embeddingText || chunk.content).join("\n\f\n"),
  );

  return {
    alreadyProcessed: false,
    summary,
    chunksStored: stored.chunksStored,
    totalChunks: sourceChunks.length,
    document,
    textArtifact: await getTextArtifact(document.id),
    textLength: originalText.length,
    language: detectedLanguage,
    ocrUsed: false,
    ocrRequired: false,
    pdfQuality: {
      qualityClass: "source_html",
      fileSizeBytes: Buffer.byteLength(sourceHtml),
    },
    extractionMethod: "source_html",
    extractedTextSha256: extracted.cleanContentHash,
    chunkSetSha256,
    embeddingInputSha256,
    stageMetrics: {
      indexCheckMs: Number(indexCheckMs || 0),
      downloadMs,
      summaryMs,
      embeddingsMs: Number(stored.metrics?.embeddingsMs || 0),
      pineconeMs: Number(stored.metrics?.pineconeMs || 0),
      ocrPages: 0,
      totalPages: 0,
      chunksStored: Number(stored.chunksStored || 0),
      embeddingsStored: vectorStorageError ? 0 : Number(stored.chunksStored || 0),
      chunkPersistenceMs,
      downloadChecksumSha256: extracted.rawHtmlHash,
      downloadFinalUrl: article.url || document.sourceUrl,
      downloadBytes: Buffer.byteLength(sourceHtml),
      rawHtmlHash: extracted.rawHtmlHash,
      cleanContentHash: extracted.cleanContentHash,
      tableRowsExtracted: extracted.quality.tableRowCount,
      contentUnchanged: unchangedCleanContent,
      totalMs: Date.now() - Number(totalStartedAt || Date.now()),
      vectorStorageFailed: Boolean(vectorStorageError),
    },
    usage: {
      estimated: true,
      generationInputTokens: Math.ceil(summaryContext.length / 4),
      generationOutputTokens: Math.ceil(summary.length / 4),
      embeddingInputTokens,
      ocrUsed: false,
      retrievalMode: vectorStorageError ? "local_text" : "hybrid",
      summaryFallback: summaryResult.fallback,
      contentUnchanged: unchangedCleanContent,
    },
  };
};

const processDocument = async (documentType, documentId, options = {}) => {
  const forcePdfReextract = Boolean(options.forcePdfReextract);
  const totalStartedAt = Date.now();
  const document = await getDocument(documentType, documentId);
  if (!document) {
    const error = new Error("Document not found.");
    error.status = 404;
    throw error;
  }
  const config = typeConfig(documentType);
  if (isExtractableSourceDocument(document)) {
    return processExtractableSourceDocument(document, config, {
      totalStartedAt,
      indexCheckMs: 0,
    });
  }
  const indexCheckStartedAt = Date.now();
  let existence = { exists: false };
  let indexCheckError = null;
  try {
    existence = await config.check(documentId);
  } catch (error) {
    indexCheckError = error;
    console.warn(
      `Vector existence check unavailable for document ${documentId}; continuing with local/PDF processing: ${sanitizeProviderError(error)}`,
    );
  }
  const indexCheckMs = Date.now() - indexCheckStartedAt;
  if (existence.exists && !forcePdfReextract) {
    const storedArtifact = await getTextArtifact(documentId);
    const indexedLoadStartedAt = Date.now();
    const matches = await loadIndexedChunks(config, documentId);
    const pineconeReadMs = Date.now() - indexedLoadStartedAt;
    const context = matches
      .map((match) => match.metadata?.content || "")
      .filter(Boolean)
      .join("\n\n");
    if (context) {
      const language = pdfProcessor.detectLanguage(context);
      // Lazy-load: reuse any existing cached summary but do NOT call
      // safeGenerateSummary / safeSuggestedQuestions eagerly.
      const cachedSummary =
        storedArtifact?.englishSummary || existence.summary || null;
      const cachedSections = cachedSummary
        ? parseSummarySections(cachedSummary)
        : {};
      const cachedQuestions = cachedSummary
        ? await safeSuggestedQuestions(
            documentType,
            cachedSummary,
            cachedSections,
          )
        : [];
      
      const summaryResult = { summary: cachedSummary, fallback: false, error: null };
      const summary = cachedSummary;
      const summarySections = cachedSections;
      const suggestedQuestions = cachedQuestions;
      await saveTextArtifact(documentId, {
        language,
        originalText: context,
        englishSummary: summary,
        extractionMethod:
          matches[0]?.metadata?.extractionMethod || "pdf_text",
        ocrUsed: Boolean(matches[0]?.metadata?.ocrUsed),
        ocrRequired: Boolean(matches[0]?.metadata?.ocrRequired),
        summaryJson: {
          ...summarySections,
          suggestedQuestions,
        },
        pdfQuality: matches[0]?.metadata?.pdfQualityClass
          ? { qualityClass: matches[0].metadata.pdfQualityClass }
          : null,
        metadata: {
          reconstructedFromIndexedChunks: true,
          chunks: matches.length,
          suggestedQuestions,
          summaryFallback: summaryResult.fallback,
          summaryFallbackReason: summaryResult.error?.message || null,
        },
      });
      try {
        await Promise.all(
          matches.map((match) =>
            config.index().update({
              id: match.id,
              metadata: summary
                ? { ...match.metadata, summary }
                : { ...match.metadata },
            }),
          ),
        );
      } catch (error) {
        console.warn(
          `Vector metadata update unavailable for document ${documentId}; preserving local text artifact: ${error.message}`,
        );
      }
      await saveNormalizedChunks(
        documentId,
        matches.map((match) => ({
          id: match.id,
          content: match.metadata?.content || "",
          metadata: match.metadata || {},
        })),
        language.languageCode,
      );
      return {
        alreadyProcessed: true,
        summary,
        chunksStored: matches.length,
        document,
        textArtifact: await getTextArtifact(documentId),
        textLength: context.length,
        language,
        stageMetrics: {
          indexCheckMs,
          pineconeReadMs,
          totalMs: Date.now() - totalStartedAt,
        },
        usage: {
          estimated: true,
          generationInputTokens: Math.ceil(context.length / 4),
          generationOutputTokens: summary ? Math.ceil(summary.length / 4) : 0,
          embeddingInputTokens: 0,
          ocrUsed: Boolean(matches[0]?.metadata?.ocrUsed),
          summaryFallback: summaryResult.fallback,
        },
      };
    }
  }

  const localChunks = forcePdfReextract ? [] : await loadLocalChunks(documentId);
  if (localChunks.length > 0) {
    const storedArtifact = await getTextArtifact(documentId);
    const context = localChunks.map((chunk) => chunk.content).join("\n\n");
    const language = pdfProcessor.detectLanguage(context);
    // Lazy-load: reuse any existing cached summary but do NOT call
    // safeGenerateSummary / safeSuggestedQuestions eagerly.
    const cachedSummary = storedArtifact?.englishSummary || null;
    const cachedSections = cachedSummary
      ? parseSummarySections(cachedSummary)
      : {};
    const cachedQuestions = cachedSummary
      ? await safeSuggestedQuestions(
          documentType,
          cachedSummary,
          cachedSections,
        )
      : [];

    const summaryResult = { summary: cachedSummary, fallback: false, error: null };
    const summarySections = cachedSections;
    const suggestedQuestions = cachedQuestions;
    if (!storedArtifact) {
      await saveTextArtifact(documentId, {
        language,
        originalText: context,
        englishSummary: summaryResult.summary,
        extractionMethod: "local_text_chunks",
        ocrUsed: false,
        ocrRequired: false,
        summaryJson: {
          ...summarySections,
          suggestedQuestions,
        },
        metadata: {
          reconstructedFromLocalChunks: true,
          chunks: localChunks.length,
          suggestedQuestions,
          summaryFallback: summaryResult.fallback,
          summaryFallbackReason: summaryResult.error?.message || null,
        },
      });
    }
    let vectorStorageError = null;
    let vectorMetrics = { embeddingsMs: 0, pineconeMs: 0 };
    try {
      const retryChunks = localChunks.map((chunk, index) => ({
        ...chunk,
        id: chunk.id || `${documentType}-${documentId}-chunk-${index}`,
        [config.idField]: String(documentId),
        billId: String(documentId),
        policyId: String(documentId),
        actId: String(documentId),
        gazetteId: String(documentId),
        title: document.title,
        embeddingText: chunk.content,
      }));
      const stored = await config.store(retryChunks, {
        unchangedChunkIds: new Set(),
      });
      vectorMetrics = stored.metrics || vectorMetrics;
    } catch (error) {
      vectorStorageError = error;
      console.warn(
        `Semantic retry unavailable for document ${documentId}; keeping PostgreSQL lexical readiness: ${error.message}`,
      );
    }
    const chunkSetSha256 = hashChunkSet(localChunks);
    const embeddingInputSha256 = computeChunkContentHash(
      localChunks.map((chunk) => chunk.content).join("\n\f\n"),
    );
    return {
      alreadyProcessed: true,
      summary: summaryResult.summary,
      chunksStored: localChunks.length,
      totalChunks: localChunks.length,
      document,
      textArtifact: await getTextArtifact(documentId),
      textLength: context.length,
      language,
      ocrUsed: Boolean(storedArtifact?.ocrUsed),
      ocrRequired: Boolean(storedArtifact?.ocrRequired),
      stageMetrics: {
        indexCheckMs,
        vectorCheckFailed: Boolean(indexCheckError),
        localChunkCount: localChunks.length,
        embeddingsMs: Number(vectorMetrics.embeddingsMs || 0),
        pineconeMs: Number(vectorMetrics.pineconeMs || 0),
        vectorStorageFailed: Boolean(vectorStorageError),
        totalMs: Date.now() - totalStartedAt,
      },
      chunkSetSha256,
      embeddingInputSha256,
      usage: {
        estimated: true,
        generationInputTokens: Math.ceil(context.length / 4),
        generationOutputTokens: summaryResult.summary
          ? Math.ceil(summaryResult.summary.length / 4)
          : 0,
        embeddingInputTokens: 0,
        ocrUsed: Boolean(storedArtifact?.ocrUsed),
        retrievalMode: vectorStorageError ? "local_text" : "hybrid",
        summaryFallback: summaryResult.fallback,
      },
    };
  }

  if (!document.pdfUrl) {
    const error = new Error(
      "This document does not have a verified official PDF.",
    );
    error.status = 422;
    throw error;
  }

  const resources = await DocumentRepository.getResources(documentId);
  const pdfCandidates = [
    document.pdfUrl,
    ...resources
      .filter((resource) => resource.resourceType === "pdf")
      .map((resource) => resource.url),
  ].filter((value, index, values) => value && values.indexOf(value) === index);
  let processed;
  let processingError;
  for (const pdfUrl of pdfCandidates) {
    try {
      processed = await pdfProcessor.processPDFAndCreateChunks(
        pdfUrl,
        documentId,
        document.title,
      );
      processed.processedPdfUrl = pdfUrl;
      break;
    } catch (error) {
      processingError = error;
      const status = Number(error?.response?.status || error?.status || 0);
      if (![401, 403, 404, 410].includes(status)) throw error;
    }
  }
  if (!processed) throw processingError;
  const summaryContext = processed.chunks
    .slice(0, 6)
    .map((chunk) => chunk.content)
    .join("\n\n");
  if (!summaryContext.trim()) {
    const error = new Error(
      "PDF extraction completed but no usable chunks were produced.",
    );
    error.status = 422;
    throw error;
  }
  // Lazy-load: skip summary & suggested-questions generation during
  // processing. They will be generated on-demand via ensureSummary().
  const summaryStartedAt = Date.now();
  const summaryResult = { summary: null, fallback: false, error: null };
  const summary = null;
  const summarySections = {};
  const suggestedQuestions = [];
  const summaryMs = Date.now() - summaryStartedAt;
  await saveTextArtifact(documentId, {
    language: processed.language,
    originalText: processed.originalText,
    englishSummary: summary,
    extractionMethod: processed.extractionMethod,
    ocrUsed: processed.ocrUsed,
    ocrRequired: processed.ocrRequired,
    summaryJson: {
      ...summarySections,
      suggestedQuestions,
    },
    pdfQuality: processed.pdfQuality,
    metadata: {
      ...processed.pdfMetadata,
      suggestedQuestions,
      summaryFallback: summaryResult.fallback,
      summaryFallbackReason: summaryResult.error?.message || null,
    },
  });
  const chunks = processed.chunks.map((chunk, index) => ({
    ...chunk,
    id: `${documentType}-${documentId}-chunk-${index}`,
    [config.idField]: String(documentId),
    // text-embedding-3-large is multilingual. Preserve and embed each source
    // chunk directly instead of duplicating a generated English summary into
    // every Hindi vector request.
    embeddingText: chunk.content,
    metadata: {
      ...chunk.metadata,
      documentType,
      sourceUrl: document.sourceUrl,
      pdfUrl: processed.processedPdfUrl,
      languageCode: processed.language.languageCode,
      script: processed.language.script,
      originalLanguage: processed.language.languageCode,
    },
  }));
  const chunkPersistenceStartedAt = Date.now();
  const chunkCacheResult = await saveNormalizedChunks(
    documentId,
    chunks,
    processed.language.languageCode,
  );
  const chunkPersistenceMs = Date.now() - chunkPersistenceStartedAt;
  let stored = {
    chunksStored: chunks.length,
    success: false,
    metrics: { embeddingsMs: 0, pineconeMs: 0 },
    fallbackRetrieval: true,
  };
  let vectorStorageError = null;
  try {
    stored = await config.store(chunks, {
      unchangedChunkIds: chunkCacheResult.unchangedChunkIds,
    });
  } catch (error) {
    vectorStorageError = error;
    console.warn(
      `Vector storage unavailable for document ${documentId}; using local text retrieval fallback: ${error.message}`,
    );
  }
  const embeddingInputTokens = chunks.reduce(
    (sum, chunk) =>
      sum + Math.ceil(String(chunk.embeddingText || chunk.content).length / 4),
    0,
  );
  const chunkSetSha256 = hashChunkSet(chunks);
  const embeddingInputSha256 = computeChunkContentHash(
    chunks.map((chunk) => chunk.embeddingText || chunk.content).join("\n\f\n"),
  );
  return {
    alreadyProcessed: false,
    summary,
    chunksStored: stored.chunksStored,
    totalChunks: processed.totalChunks,
    document,
    textArtifact: await getTextArtifact(documentId),
    textLength: processed.originalText.length,
    language: processed.language,
    ocrUsed: processed.ocrUsed,
    ocrRequired: processed.ocrRequired,
    pdfQuality: processed.pdfQuality,
    processedPdfUrl: processed.processedPdfUrl,
    extractedTextSha256: computeChunkContentHash(processed.originalText),
    chunkSetSha256,
    embeddingInputSha256,
    stageMetrics: {
      indexCheckMs,
      ...(processed.stageMetrics || {}),
      summaryMs,
      embeddingsMs: Number(stored.metrics?.embeddingsMs || 0),
      pineconeMs: Number(stored.metrics?.pineconeMs || 0),
      chunkPersistenceMs,
      chunksInvalidated: Number(chunkCacheResult.cacheMisses || 0),
      embeddingsReused: Number(stored.embeddingCacheHits ?? chunkCacheResult.cacheHits ?? 0),
      embeddingsRegenerated: Number(stored.embeddingCacheMisses ?? chunkCacheResult.cacheMisses ?? 0),
      staleVectorsRemoved: Number(stored.staleVectorsRemoved || 0),
      totalMs: Date.now() - totalStartedAt,
      vectorStorageFailed: Boolean(vectorStorageError),
    },
    usage: {
      estimated: true,
      generationInputTokens: Math.ceil(summaryContext.length / 4),
      generationOutputTokens: summary ? Math.ceil(summary.length / 4) : 0,
      embeddingInputTokens,
      ocrUsed: processed.ocrUsed,
      retrievalMode: vectorStorageError ? "local_text" : "hybrid",
      summaryFallback: summaryResult.fallback,
    },
  };
};

const passageFromVectorMatch = (match, index) => ({
  passage: index + 1,
  score: Number(match.score || match.relevanceScore || 0),
  chunkIndex: match.metadata?.chunkIndex ?? match.chunkInfo?.index ?? index,
  totalChunks:
    match.metadata?.totalChunks ?? match.chunkInfo?.total ?? null,
  content: String(match.metadata?.content || match.content || ""),
  source: match.metadata?.source || "Official document PDF",
  pdfUrl: match.metadata?.pdfUrl || null,
  languageCode:
    match.metadata?.languageCode ||
    match.metadata?.originalLanguage ||
    "und",
  pageStart: match.metadata?.pageStart || null,
  pageEnd: match.metadata?.pageEnd || null,
  pageEstimate: Boolean(match.metadata?.pageEstimate),
  sectionId: match.metadata?.sectionId || null,
  sectionTitle: match.metadata?.sectionTitle || null,
  clauseId: match.metadata?.clauseId || null,
  structuralType: match.metadata?.structuralType || "passage",
  sourceUrl: match.metadata?.sourceUrl || null,
  canonicalSourceUrl: match.metadata?.canonicalSourceUrl || null,
  resourceType: match.metadata?.resourceType || null,
  mimeType: match.metadata?.mimeType || null,
  heading: match.metadata?.heading || match.metadata?.sectionTitle || null,
  sectionPath: match.metadata?.sectionPath || [],
  sourceAnchor: match.metadata?.sourceAnchor || null,
  authorityClass: match.metadata?.authorityClass || null,
  extractionQuality: match.metadata?.extractionQuality || null,
  extractionQualityScore: match.metadata?.extractionQualityScore ?? null,
  extractionMethod: match.metadata?.extractionMethod || null,
  textQualityVersion: match.metadata?.textQualityVersion || null,
  unreliablePages: match.metadata?.unreliablePages || [],
  retrievalMode: "vector",
});

const tokenizeForLocalRetrieval = (value) => [
  ...new Set(
    String(value || "")
      .toLowerCase()
      .normalize("NFKC")
      .replace(/[^\p{L}\p{N}\s]+/gu, " ")
      .split(/\s+/u)
      .map((token) => token.trim())
      .filter((token) => token.length >= 3)
      .filter(
        (token) =>
          !new Set([
            "the",
            "and",
            "for",
            "with",
            "this",
            "that",
            "from",
            "into",
            "are",
            "was",
            "were",
            "what",
            "which",
            "who",
            "when",
            "where",
            "why",
            "how",
            "does",
            "about",
            "say",
            "please",
            "document",
            "policy",
            "bill",
            "act",
            "gazette",
            "compare",
            "comparison",
          ]).has(token),
      ),
  ),
];

const tokenOverlapScore = (content, queryTokens) => {
  if (!queryTokens.length) return 0.1;
  const lower = String(content || "").toLowerCase();
  const hits = queryTokens.reduce(
    (count, token) => count + (lower.includes(token) ? 1 : 0),
    0,
  );
  return hits / queryTokens.length;
};

const localChunkScore = (chunk, queryTokens) =>
  tokenOverlapScore(chunk.original_text || chunk.translated_text, queryTokens);

// Cheap, deterministic, in-process signal: does the question name a specific
// section/article/rule/clause that this passage's own structural metadata
// matches? No extra API call, just a regex extraction over the question text.
const IDENTIFIER_PATTERNS = [
  /\b(?:section|sec\.?)\s*([0-9]+(?:\.[0-9]+)*(?:\([a-z0-9]+\))?[a-z]?)/gi,
  /\b(?:article|art\.?)\s*([0-9]+(?:\.[0-9]+)*(?:\([a-z0-9]+\))?[a-z]?)/gi,
  /\b(?:clause|sub-clause)\s*([0-9]+(?:\.[0-9]+)*(?:\([a-z0-9]+\))?[a-z]?)/gi,
  /\b(?:rule)\s*([0-9]+(?:\.[0-9]+)*(?:\([a-z0-9]+\))?[a-z]?)/gi,
  /\bधारा\s*([0-9]+[क-ह]?)\b/g,
];

const extractIdentifiers = (message) => {
  const identifiers = new Set();
  for (const pattern of IDENTIFIER_PATTERNS) {
    pattern.lastIndex = 0;
    let match;
    while ((match = pattern.exec(message))) {
      if (match[1]) identifiers.add(match[1].toLowerCase());
    }
  }
  return identifiers;
};

const identifierBoost = (passage, identifiers) => {
  if (!identifiers.size) return 0;
  const haystacks = [passage.sectionId, passage.sectionTitle, passage.clauseId]
    .filter(Boolean)
    .map((value) => String(value).toLowerCase());
  if (!haystacks.length) return 0;
  for (const identifier of identifiers) {
    if (haystacks.some((haystack) => haystack.includes(identifier))) return 1;
  }
  return 0;
};

// Bounded deterministic reranking over the fused candidate set. Relevance
// remains dominant; the source-authority contribution was already gated by
// relevance in reciprocalRankFusion and is intentionally small.
const rerankPassages = (passages, message, { topK = 6 } = {}) => {
  const queryTokens = tokenizeForLocalRetrieval(message);
  const identifiers = extractIdentifiers(String(message || ""));

  const scored = passages.map((passage) => {
    // Callers are expected to have normalized a `.vectorScore` field onto
    // every vector-origin passage before merging; this fallback only
    // covers passages that never went through that normalization.
    const vectorScore = Number(
      passage.vectorScore ?? (passage.retrievalMode === "vector" ? passage.score : 0) ?? 0,
    );
    const lexicalScore = tokenOverlapScore(passage.content, queryTokens);
    const ftsScore = Number(passage.ftsScore ?? 0);
    const boost = identifierBoost(passage, identifiers);
    const fusionScore = Math.min(1, Number(passage.rrfScore || 0) * 30);
    const authorityBoost = Number(passage.authorityBoost || 0);
    const quality = Number.isFinite(Number(passage.extractionQualityScore))
      ? Number(passage.extractionQualityScore)
      : evaluateTextQuality(passage.content).score;
    const reliable = evidenceTextIsReliable(passage);
    const finalScore = reliable ? (
      0.28 * vectorScore + 0.28 * lexicalScore + 0.15 * ftsScore +
      0.35 * boost + 0.1 * fusionScore + authorityBoost + 0.04 * quality
    ) : -1;
    const rankingReasons = [...new Set([
      ...(passage.rankingReasons || []),
      boost > 0 ? "exact_identifier" : null,
      authorityBoost > 0 ? `authority:${passage.authorityClass}` : null,
      reliable ? `text_quality:${quality.toFixed(2)}` : "text_quality:rejected",
    ].filter(Boolean))];
    return {
      ...passage,
      vectorScore,
      lexicalScore,
      ftsScore,
      identifierBoost: boost,
      fusionScore,
      finalScore,
      extractionQualityScore: quality,
      rankingReasons,
    };
  });

  return scored
    .sort((left, right) => {
      if (right.finalScore !== left.finalScore) return right.finalScore - left.finalScore;
      return left.chunkIndex - right.chunkIndex;
    })
    .slice(0, Math.max(1, Number(topK) || 6))
    .map((passage, index) => ({ ...passage, passage: index + 1 }));
};

// Reuses the migration-019 GIN index on document_text_chunks (already
// applied in production, no schema change needed here). Runs alongside
// vector search rather than only as a fallback, so exact legal phrasing
// contributes even when semantic search already found good matches.
const retrieveFtsPassages = async (documentId, message, limit = 25) => {
  const text = String(message || "").trim();
  if (!text) return [];
  const keywords = tokenizeForLocalRetrieval(text).slice(0, 12);
  const ftsQuery = keywords.length ? keywords.join(" OR ") : text;
  const identifiers = [...extractIdentifiers(text)];
  let result;
  try {
    result = await query(
      `WITH search AS (
         SELECT websearch_to_tsquery('simple', $1) AS ts_query
       )
       SELECT
         chunk.chunk_index, chunk.original_text, chunk.translated_text,
         chunk.language, chunk.metadata_json,
         ts_rank_cd(to_tsvector('simple', COALESCE(chunk.original_text, '')), search.ts_query) AS fts_score
       FROM document_text_chunks chunk
       CROSS JOIN search
       WHERE chunk.document_id = $2
         AND (
           to_tsvector('simple', COALESCE(chunk.original_text, '')) @@ search.ts_query
           OR EXISTS (
             SELECT 1 FROM unnest($4::TEXT[]) identifier
             WHERE LOWER(COALESCE(chunk.metadata_json->>'sectionId', '')) LIKE '%' || identifier || '%'
                OR LOWER(COALESCE(chunk.metadata_json->>'clauseId', '')) LIKE '%' || identifier || '%'
                OR LOWER(COALESCE(chunk.metadata_json->>'sectionTitle', '')) LIKE '%' || identifier || '%'
           )
         )
       ORDER BY fts_score DESC
       LIMIT $3`,
      [ftsQuery, documentId, limit, identifiers],
    );
  } catch (error) {
    console.warn(`Full-text retrieval failed for document ${documentId}: ${error.message}`);
    return [];
  }

  const maxScore = result.rows.reduce(
    (max, row) => Math.max(max, Number(row.fts_score) || 0),
    0,
  );

  return result.rows.map((row, index) => {
    const metadata = row.metadata_json || {};
    const content = String(row.original_text || row.translated_text || "").trim();
    return {
      passage: index + 1,
      score: 0,
      vectorScore: 0,
      ftsScore: maxScore > 0 ? Number(row.fts_score) / maxScore : 0,
      chunkIndex: Number(row.chunk_index ?? index),
      totalChunks: metadata.totalChunks || result.rows.length,
      content,
      source: metadata.source || "Indexed document text",
      pdfUrl: metadata.pdfUrl || null,
      languageCode:
        metadata.languageCode || metadata.originalLanguage || row.language || "und",
      pageStart: metadata.pageStart || null,
      pageEnd: metadata.pageEnd || null,
      pageEstimate: Boolean(metadata.pageEstimate),
      sectionId: metadata.sectionId || null,
      sectionTitle: metadata.sectionTitle || null,
      clauseId: metadata.clauseId || null,
      structuralType: metadata.structuralType || "passage",
      sourceUrl: metadata.sourceUrl || null,
      canonicalSourceUrl: metadata.canonicalSourceUrl || null,
      resourceType: metadata.resourceType || null,
      mimeType: metadata.mimeType || null,
      heading: metadata.heading || metadata.sectionTitle || null,
      sectionPath: metadata.sectionPath || [],
      sourceAnchor: metadata.sourceAnchor || null,
      authorityClass: metadata.authorityClass || null,
      extractionQuality: metadata.extractionQuality || null,
      extractionQualityScore: metadata.extractionQualityScore ?? null,
      extractionMethod: metadata.extractionMethod || null,
      textQualityVersion: metadata.textQualityVersion || null,
      unreliablePages: metadata.unreliablePages || [],
      retrievalMode: "fts",
    };
  }).filter((passage) => passage.content);
};

// Unions two passage sets by chunk identity, keeping the richer (first-seen)
// metadata but merging in whichever score fields the other set carries.
const mergePassagesByChunk = (primary, secondary) => {
  const byChunk = new Map();
  for (const passage of primary) {
    byChunk.set(String(passage.chunkIndex), { ...passage });
  }
  for (const passage of secondary) {
    const key = String(passage.chunkIndex);
    const existing = byChunk.get(key);
    if (existing) {
      byChunk.set(key, {
        ...existing,
        ftsScore: Math.max(Number(existing.ftsScore) || 0, Number(passage.ftsScore) || 0),
        vectorScore: Math.max(
          Number(existing.vectorScore) || 0,
          Number(passage.vectorScore) || 0,
        ),
      });
    } else {
      byChunk.set(key, { ...passage });
    }
  }
  return [...byChunk.values()];
};

const retrieveLocalTextPassages = async (documentId, message, topK = 6) => {
  const result = await query(
    `SELECT
       chunk_index, original_text, translated_text, language,
       vector_reference, metadata_json
     FROM document_text_chunks
     WHERE document_id = $1
     ORDER BY chunk_index ASC
     LIMIT 200`,
    [documentId],
  );
  const queryTokens = tokenizeForLocalRetrieval(message);
  return result.rows
    .map((row, index) => {
      const metadata = row.metadata_json || {};
      const content = String(row.original_text || row.translated_text || "")
        .trim();
      return {
        passage: index + 1,
        score: localChunkScore(row, queryTokens),
        chunkIndex: Number(row.chunk_index ?? index),
        totalChunks: metadata.totalChunks || result.rows.length,
        content,
        source: metadata.source || "Indexed document text",
        pdfUrl: metadata.pdfUrl || null,
        languageCode:
          metadata.languageCode ||
          metadata.originalLanguage ||
          row.language ||
          "und",
        pageStart: metadata.pageStart || null,
        pageEnd: metadata.pageEnd || null,
        pageEstimate: Boolean(metadata.pageEstimate),
        sectionId: metadata.sectionId || null,
        sectionTitle: metadata.sectionTitle || null,
        clauseId: metadata.clauseId || null,
        structuralType: metadata.structuralType || "passage",
        sourceUrl: metadata.sourceUrl || null,
        canonicalSourceUrl: metadata.canonicalSourceUrl || null,
        resourceType: metadata.resourceType || null,
        mimeType: metadata.mimeType || null,
        heading: metadata.heading || metadata.sectionTitle || null,
        sectionPath: metadata.sectionPath || [],
        sourceAnchor: metadata.sourceAnchor || null,
        authorityClass: metadata.authorityClass || null,
        extractionQuality: metadata.extractionQuality || null,
        extractionQualityScore: metadata.extractionQualityScore ?? null,
        extractionMethod: metadata.extractionMethod || null,
        textQualityVersion: metadata.textQualityVersion || null,
        unreliablePages: metadata.unreliablePages || [],
        retrievalMode: queryTokens.length ? "local_text" : "representative",
      };
    })
    .filter((passage) => passage.content)
    .sort((left, right) => {
      if (right.score !== left.score) return right.score - left.score;
      return left.chunkIndex - right.chunkIndex;
    })
    .slice(0, Math.max(1, Number(topK) || 6))
    .map((passage, index) => ({ ...passage, passage: index + 1 }));
};

const retrieveMetadataPassages = async (documentId, documentValue = null) => {
  const document = documentValue || await DocumentRepository.getById(documentId);
  if (!document) return [];
  const fields = [
    ["Title", document.title],
    ["Document type", document.type],
    ["Status", document.status],
    ["Year", document.year],
    ["Publication date", document.publicationDate],
    ["Introduced date", document.introducedDate],
    ["Enacted date", document.enactedDate],
    ["Effective date", document.effectiveDate],
    ["Ministry", document.ministry],
    ["Department", document.department],
    ["Authority", document.authority],
    ["Jurisdiction", document.jurisdiction],
    ["Source", document.source || document.sourceName],
  ].filter(([, value]) => value != null && String(value).trim());
  if (!fields.length) return [];
  return [{
    passage: 1,
    score: 1,
    lexicalScore: 1,
    documentId: String(documentId),
    chunkIndex: "metadata",
    content: fields.map(([label, value]) => `${label}: ${value}`).join("\n"),
    source: document.source || document.sourceName || "Catalogue metadata",
    sourceUrl: document.sourceUrl || null,
    pdfUrl: document.pdfUrl || null,
    structuralType: "metadata",
    retrievalMode: "metadata",
    authority: document.authority || null,
  }];
};

const awaitWithinTimeBudget = async (promise, budgetMs) => {
  const safeBudget = Math.min(10_000, Math.max(10, Number(budgetMs) || 2_500));
  let timeout;
  const timeoutResult = new Promise((resolve) => {
    timeout = setTimeout(() => resolve({ timedOut: true, value: null }), safeBudget);
    timeout.unref?.();
  });
  try {
    return await Promise.race([
      Promise.resolve(promise).then((value) => ({ timedOut: false, value })),
      timeoutResult,
    ]);
  } finally {
    clearTimeout(timeout);
  }
};

const retrieveDocumentContext = async (
  documentType,
  documentId,
  message,
  options = {},
) => {
  const startedAt = Date.now();
  const settings = retrievalConfig();
  const flags = options.flags || resolveResearchFlags({
    actorId: options.accountId || `document:${documentId}`,
  });
  const plan = applyResearchFlags(
    options.plan || planQuery(message, options),
    flags,
  );
  const candidateLimits = candidateLimitsFor(plan.queryType, settings);
  const topK = Math.min(10, Math.max(1, Number(options.topK || settings.finalPassages)));
  const documentVersion = options.document?.fileHash ||
    options.document?.contentFingerprintSha256 || options.document?.updatedAt || null;
  const versions = {
    ...settings.versions,
    fusion: flags.rrf ? "rrf-v1" : "legacy-candidate-merge-v1",
    rerankerVersion: flags.reranker ? settings.versions.rerankerVersion : "legacy-rank-order-v1",
    authorityConfigVersion: flags.authorityWeighting
      ? settings.versions.authorityConfigVersion
      : "authority-disabled-v1",
    embeddingVersion: providerConfig().embeddingModel,
  };
  const cacheKey = flags.caching && !options.adapters
    ? retrievalCacheKey({
        query: message, documentId, documentType, documentVersion,
        resourceHash: options.document?.fileHash, topK, plan, versions,
        userId: options.accountId, privateSourceIds: options.privateSourceIds,
      })
    : null;
  const cached = cacheKey ? caches.retrieval.get(cacheKey) : null;
  if (cached) {
    return {
      ...cached,
      diagnostics: {
        ...cached.diagnostics,
        cache: { status: "hit", version: "versioned-retrieval-cache-v1" },
      },
    };
  }
  const adapters = options.adapters || {};
  const ftsSearch = adapters.ftsSearch || retrieveFtsPassages;
  const localSearch = adapters.localSearch || retrieveLocalTextPassages;
  const metadataSearch = adapters.metadataSearch || retrieveMetadataPassages;
  const temporalSearch = adapters.temporalSearch || retrieveTemporalPassages;
  const treeSearch = adapters.treeSearch || retrieveTreePassages;
  const vectorSearch = adapters.vectorSearch || (async (limit) => {
    const config = typeConfig(documentType);
    const matches = await config.search(message, documentId, limit);
    const expanded = await expandLargeDocumentMatches({
      matches, documentId, message,
    });
    if (expanded) {
      expanded.metrics = matches.metrics;
      return expanded;
    }
    const passages = matches.map(passageFromVectorMatch)
      .filter((passage) => passage.content.trim())
      .map((passage) => ({ ...passage, vectorScore: passage.score }));
    passages.metrics = matches.metrics;
    return passages;
  });

  const timings = {};
  const timed = async (name, operation) => {
    const at = Date.now();
    try { return await operation(); }
    finally { timings[`${name}Ms`] = Date.now() - at; }
  };
  const metadataPromise = plan.useMetadata
    ? timed("metadata", () => metadataSearch(documentId, options.document))
    : Promise.resolve([]);
  const temporalPromise = plan.queryType === "TIMELINE"
    ? timed("temporal", () => temporalSearch(documentId, message))
    : Promise.resolve([]);
  const lexicalLimit = plan.queryType === "EXACT_REFERENCE"
    ? settings.exactCandidates
    : candidateLimits.lexical;
  const lexicalPromise = plan.useLexical
    ? timed("lexical", () => ftsSearch(documentId, message, lexicalLimit))
    : Promise.resolve([]);
  const treePromise = !options.adapters && !["METADATA", "EXACT_REFERENCE"].includes(plan.queryType)
    ? timed("tree", () => treeSearch(documentId, message, candidateLimits.lexical))
      .catch(() => [])
    : Promise.resolve([]);
  const eagerVectorPromise = plan.useVector === true
    ? timed("vector", () => vectorSearch(candidateLimits.vector))
      .then((passages) => ({ passages, error: null }))
      .catch((error) => ({ passages: [], error }))
    : null;
  const [metadataPassages, temporalPassages, ftsPassages, treePassages] = await Promise.all([
    metadataPromise,
    temporalPromise,
    lexicalPromise,
    treePromise,
  ]);

  let localPassages = [];
  if (plan.useLexical && ftsPassages.length < settings.minimumLexicalEvidence) {
    localPassages = await timed("local", () => localSearch(documentId, message, candidateLimits.lexical));
  }
  const lexicalEvidence = reciprocalRankFusion(
    [ftsPassages, localPassages],
    { documentId, k: settings.rrfK, limit: candidateLimits.fused },
  );
  const shouldUseVector = plan.useVector === true ||
    (plan.useVector === "if_insufficient" && lexicalEvidence.length < settings.minimumLexicalEvidence);
  let eagerVectorOutcome = null;
  if (shouldUseVector && eagerVectorPromise) {
    if (lexicalEvidence.length >= settings.minimumLexicalEvidence) {
      const waitedAt = Date.now();
      const waited = await awaitWithinTimeBudget(
        eagerVectorPromise,
        options.vectorTimeBudgetMs ?? settings.vectorTimeBudgetMs,
      );
      timings.vectorWaitMs = Date.now() - waitedAt;
      if (waited.timedOut) {
        const error = new Error("Vector retrieval exceeded the safe wait budget");
        error.code = "VECTOR_TIME_BUDGET_EXCEEDED";
        eagerVectorOutcome = { passages: [], error };
      } else {
        eagerVectorOutcome = waited.value;
      }
    } else {
      eagerVectorOutcome = await eagerVectorPromise;
    }
  }
  let vectorPassages = eagerVectorOutcome?.passages || [];
  let vectorError = eagerVectorOutcome?.error || null;
  if (shouldUseVector && !eagerVectorPromise) {
    try {
      vectorPassages = await timed("vector", () => vectorSearch(candidateLimits.vector));
    } catch (error) {
      vectorError = error;
      timings.vectorMs = timings.vectorMs || 0;
    }
  }
  if (vectorPassages.metrics) {
    timings.queryEmbeddingMs = Number(vectorPassages.metrics.queryEmbeddingMs || 0);
    timings.queryEmbeddingCache = vectorPassages.metrics.queryEmbeddingCache || "unknown";
    timings.pineconeMs = Number(vectorPassages.metrics.pineconeMs || 0);
  }

  const fusionStartedAt = Date.now();
  const fusion = flags.rrf ? reciprocalRankFusion : legacyCandidateMerge;
  const fused = fusion(
    [metadataPassages, temporalPassages, treePassages, ftsPassages, localPassages, vectorPassages],
    {
      documentId,
      k: settings.rrfK,
      limit: candidateLimits.fused,
      useAuthority: flags.authorityWeighting,
    },
  );
  timings.fusionMs = Date.now() - fusionStartedAt;
  const rerankStartedAt = Date.now();
  const reranked = flags.reranker
    ? rerankPassages(fused, message, { topK })
    : fused.slice(0, topK).map((passage, index) => ({ ...passage, passage: index + 1 }));
  timings.rerankMs = Date.now() - rerankStartedAt;
  const hasLexical = ftsPassages.length > 0 || localPassages.length > 0;
  const retrievalMode = vectorPassages.length > 0 && (hasLexical || metadataPassages.length > 0)
    ? "hybrid"
    : vectorPassages.length > 0
      ? "vector"
      : hasLexical
        ? ftsPassages.length > 0 ? "fts" : "local_text"
        : temporalPassages.length > 0
          ? "temporal"
          : metadataPassages.length > 0
          ? "metadata"
          : "none";
  const diagnostics = {
    queryType: plan.queryType,
    strategy: {
      metadata: Boolean(plan.useMetadata),
      lexical: Boolean(plan.useLexical),
      vector: shouldUseVector,
      graph: Boolean(plan.useGraph),
    },
    candidateLimits,
    candidateCounts: {
      metadata: metadataPassages.length,
      temporal: temporalPassages.length,
      tree: treePassages.length,
      lexical: ftsPassages.length,
      local: localPassages.length,
      vector: vectorPassages.length,
      fused: fused.length,
      final: reranked.length,
    },
    authorityDistribution: reranked.reduce((counts, passage) => ({
      ...counts,
      [passage.authorityClass || "UNKNOWN"]: (counts[passage.authorityClass || "UNKNOWN"] || 0) + 1,
    }), {}),
    topScores: reranked.slice(0, 5).map((passage) => Number(
      Number(passage.finalScore || passage.score || 0).toFixed(4),
    )),
    timings: { ...timings, totalMs: Date.now() - startedAt },
    versions: {
      ...versions,
      embedding: providerConfig().embeddingModel,
      embeddingModel: providerConfig().embeddingModel,
      vectorNamespace: providerConfig().vectorNamespace,
      queryPlannerVersion: plan.plannerVersion,
    },
    plannerVersion: plan.plannerVersion,
    vectorDegraded: Boolean(vectorError),
    vectorTimedOut: vectorError?.code === "VECTOR_TIME_BUDGET_EXCEEDED",
    flags,
    cache: {
      status: cacheKey ? "miss" : "bypass",
      version: "versioned-retrieval-cache-v1",
    },
  };
  console.info("[retrieval-v3]", JSON.stringify({ documentId: String(documentId), ...diagnostics }));
  const response = {
    documentId: String(documentId),
    retrievalMode,
    retrievalVerified: reranked.length > 0,
    vectorError: vectorError?.message || null,
    passages: reranked,
    plan,
    diagnostics,
  };
  if (cacheKey && !vectorError) caches.retrieval.set(cacheKey, response);
  return response;
};

const retrievePassages = async (
  documentType,
  documentId,
  message,
  topK = 6,
) => {
  const result = await retrieveDocumentContext(documentType, documentId, message, {
    topK,
  });
  return result.passages;
};

const searchAcrossIndexedDocuments = async (searchQuery, topK = 40, options = {}) => {
  const text = String(searchQuery || "").trim();
  if (!text) return [];
  const [knowledge, vectorOutcome] = await Promise.all([
    discoverKnowledgeCandidates(text, {
      userId: options.userId,
      limit: Math.min(30, topK),
    }).catch(() => ({ documentIds: [] })),
    generateEmbedding(text).then(async (vector) => Promise.all(
      Object.entries(TYPE_CONFIG).map(async ([family, config]) => {
        const result = await config.index().query({ vector, topK, includeMetadata: true });
        return (result.matches || []).map((match) => ({
          id: match.metadata?.[config.idField],
          family,
          score: Number(match.score || 0),
        }));
      }),
    )).catch(() => []),
  ]);
  return [
    ...new Set(
      [
        ...(knowledge.documentIds || []),
        ...vectorOutcome
        .flat()
        .filter((match) => match.score >= 0.55)
        .sort((left, right) => right.score - left.score)
        .map((match) => match.id)
        .filter(Boolean),
      ].map(String),
    ),
  ].slice(0, topK);
};

/**
 * Lazy-load a document's summary and suggested questions.
 * Returns the cached summary if it exists; otherwise generates it via the
 * LLM, persists it to document_text_artifacts, and returns it.
 */
const ensureSummary = async (documentType, documentId) => {
  const artifact = await getTextArtifact(documentId);
  if (artifact?.englishSummary) {
    const sections = artifact.summarySections || parseSummarySections(artifact.englishSummary);
    const cachedQuestions = await safeSuggestedQuestions(documentType, artifact.englishSummary, sections);
    const metadataQuestions = Array.isArray(artifact.metadata?.suggestedQuestions)
      ? artifact.metadata.suggestedQuestions.map(normalizeQuestion).filter(Boolean)
      : [];
    return {
      summary: artifact.englishSummary,
      summarySections: sections,
      suggestedQuestions:
        !areGenericQuestions(metadataQuestions) && metadataQuestions.length
          ? metadataQuestions.slice(0, 4)
          : cachedQuestions || [],
      cached: true,
    };
  }

  // No cached summary — generate one now.
  const config = typeConfig(documentType);
  const matches = await loadIndexedChunks(config, documentId);
  let context = matches
    .map((match) => match.metadata?.content || "")
    .filter(Boolean)
    .join("\n\n");

  // Fall back to stored original text if Pinecone has no chunks.
  if (!context && artifact?.metadata?.originalText) {
    context = artifact.metadata.originalText;
  }
  if (!context) {
    // Try the raw original_text column.
    const rawResult = await query(
      `SELECT original_text FROM document_text_artifacts
       WHERE document_id = $1 LIMIT 1`,
      [documentId],
    );
    context = rawResult.rows[0]?.original_text || "";
  }
  if (!context) {
    context = await loadExternalizedOriginalText(documentId);
  }
  if (!context) {
    return {
      summary: "",
      summarySections: {},
      suggestedQuestions: [],
      cached: false,
    };
  }

  // Truncate to first ~6 chunks worth of text for the summary prompt.
  const truncated = context.slice(0, 24_000);
  const language = pdfProcessor.detectLanguage(truncated);
  const summaryResult = await safeGenerateSummary(documentType, truncated, {
    sourceLanguage: language.languageCode,
  });
  const summary = summaryResult.summary;
  const summarySections = parseSummarySections(summary);
  const suggestedQuestions = await safeSuggestedQuestions(
    documentType,
    summary,
    summarySections,
  );

  // Persist so subsequent requests get a cache hit.
  await query(
    `UPDATE document_text_artifacts
     SET english_summary = $2,
         summary_json = $3::jsonb,
         metadata_json = metadata_json || $4::jsonb,
         updated_at = NOW()
     WHERE document_id = $1`,
    [
      documentId,
      summary,
      JSON.stringify({ ...summarySections, suggestedQuestions }),
      JSON.stringify({ suggestedQuestions, summaryFallback: summaryResult.fallback, summaryFallbackReason: summaryResult.error?.message || null }),
    ],
  );

  // Also propagate the summary into the Pinecone metadata.
  if (matches.length > 0) {
    await Promise.all(
      matches.map((match) =>
        config.index().update({
          id: match.id,
          metadata: { ...match.metadata, summary },
        }),
      ),
    ).catch((error) =>
      console.warn("[ensureSummary] Pinecone metadata update failed:", error.message),
    );
  }

  return {
    summary,
    summarySections: { ...summarySections, suggestedQuestions },
    suggestedQuestions,
    cached: false,
  };
};

module.exports = {
  TYPE_CONFIG,
  awaitWithinTimeBudget,
  getDocument,
  getDocumentContext,
  isExtractableSourceDocument,
  processDocument,
  getTextArtifact,
  retrieveDocumentContext,
  retrieveFtsPassages,
  retrieveLocalTextPassages,
  retrieveMetadataPassages,
  retrievePassages,
  rerankPassages,
  mergePassagesByChunk,
  saveTextArtifact,
  saveNormalizedChunks,
  postgresChunkMetadata,
  buildExtractiveSummary,
  parseSummarySections,
  pineconeSafeHtmlMetadata,
  searchAcrossIndexedDocuments,
  ensureSummary,
};
