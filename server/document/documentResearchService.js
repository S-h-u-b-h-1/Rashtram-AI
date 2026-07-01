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
  searchSimilarContent,
  searchSimilarContentForAct,
  searchSimilarContentForEGazette,
  storeActContentInChunks,
  storeBillContentInChunks,
  storeEGazetteContentInChunks,
} = require("../lib/vectordb");
const {
  normalizeDocumentType,
  retrievalFamilyForType,
} = require("./documentTypes");
const DocumentRepository = require("./DocumentRepository");

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
    updatedAt: row.updated_at,
  };
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
    metadata = {},
  },
) => {
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
       metadata_json
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::jsonb)
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
    ],
  );
  for (const key of contextCache.keys()) {
    if (key.endsWith(`:${documentId}`)) contextCache.delete(key);
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
  const cached = contextCache.get(cacheKey);
  if (cached && Date.now() - cached.cachedAt < CONTEXT_CACHE_TTL_MS) {
    return cached.value;
  }
  const document = await getDocument(documentType, documentId);
  if (!document) return null;
  const [resources, relationships, recommendations, textArtifact] =
    await Promise.all([
      DocumentRepository.getResources(documentId),
      DocumentRepository.getRelated(documentId),
      DocumentRepository.getRecommendations(documentId),
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
  contextCache.set(cacheKey, { cachedAt: Date.now(), value });
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

const processDocument = async (documentType, documentId) => {
  const document = await getDocument(documentType, documentId);
  if (!document) {
    const error = new Error("Document not found.");
    error.status = 404;
    throw error;
  }
  const config = typeConfig(documentType);
  const storedArtifact = await getTextArtifact(documentId);
  const existence = await config.check(documentId);
  if (existence.exists && existence.summary) {
    return {
      alreadyProcessed: true,
      summary: existence.summary,
      chunksStored: existence.chunksCount || 0,
      document,
      textArtifact: storedArtifact,
    };
  }

  if (existence.exists) {
    const matches = await loadIndexedChunks(config, documentId);
    const context = matches
      .map((match) => match.metadata?.content || "")
      .filter(Boolean)
      .join("\n\n");
    if (context) {
      const language = pdfProcessor.detectLanguage(context);
      const summary = await generateDocumentSummary(documentType, context, {
        sourceLanguage: language.languageCode,
      });
      const suggestedQuestions = await generateSuggestedQuestions(
        documentType,
        summary,
      );
      await saveTextArtifact(documentId, {
        language,
        originalText: context,
        englishSummary: summary,
        extractionMethod:
          matches[0]?.metadata?.extractionMethod || "pdf_text",
        ocrUsed: Boolean(matches[0]?.metadata?.ocrUsed),
        ocrRequired: Boolean(matches[0]?.metadata?.ocrRequired),
        metadata: {
          reconstructedFromIndexedChunks: true,
          chunks: matches.length,
          suggestedQuestions,
        },
      });
      await Promise.all(
        matches.map((match) =>
          config.index().update({
            id: match.id,
            metadata: { ...match.metadata, summary },
          }),
        ),
      );
      return {
        alreadyProcessed: true,
        summary,
        chunksStored: matches.length,
        document,
        textArtifact: await getTextArtifact(documentId),
      };
    }
  }

  if (!document.pdfUrl) {
    const error = new Error(
      "This document does not have a verified official PDF.",
    );
    error.status = 422;
    throw error;
  }

  const processed = await pdfProcessor.processPDFAndCreateChunks(
    document.pdfUrl,
    documentId,
    document.title,
  );
  const summaryContext = processed.chunks
    .slice(0, 6)
    .map((chunk) => chunk.content)
    .join("\n\n");
  const summary = await generateDocumentSummary(
    documentType,
    summaryContext,
    { sourceLanguage: processed.language.languageCode },
  );
  const suggestedQuestions = await generateSuggestedQuestions(
    documentType,
    summary,
  );
  await saveTextArtifact(documentId, {
    language: processed.language,
    originalText: processed.originalText,
    englishSummary: summary,
    extractionMethod: processed.extractionMethod,
    ocrUsed: processed.ocrUsed,
    ocrRequired: processed.ocrRequired,
    metadata: {
      ...processed.pdfMetadata,
      suggestedQuestions,
    },
  });
  const chunks = processed.chunks.map((chunk, index) => ({
    ...chunk,
    id: `${documentType}-${documentId}-chunk-${index}`,
    [config.idField]: String(documentId),
    embeddingText: processed.language.languageCode.startsWith("hi")
      ? `${chunk.content}\n\nEnglish document summary: ${summary}`
      : chunk.content,
    metadata: {
      ...chunk.metadata,
      documentType,
      sourceUrl: document.sourceUrl,
      summary,
      languageCode: processed.language.languageCode,
      script: processed.language.script,
      originalLanguage: processed.language.languageCode,
    },
  }));
  const stored = await config.store(chunks);
  return {
    alreadyProcessed: false,
    summary,
    chunksStored: stored.chunksStored,
    totalChunks: processed.totalChunks,
    document,
    textArtifact: await getTextArtifact(documentId),
  };
};

const retrievePassages = async (
  documentType,
  documentId,
  message,
  topK = 6,
) => {
  const config = typeConfig(documentType);
  const matches = await config.search(message, documentId, topK);
  return matches.map((match, index) => ({
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
  }));
};

const searchAcrossIndexedDocuments = async (searchQuery, topK = 40) => {
  const text = String(searchQuery || "").trim();
  if (!text) return [];
  const vector = await generateEmbedding(text);
  const matches = await Promise.all(
    Object.entries(TYPE_CONFIG).map(async ([family, config]) => {
      const result = await config.index().query({
        vector,
        topK,
        includeMetadata: true,
      });
      return (result.matches || []).map((match) => ({
        id: match.metadata?.[config.idField],
        family,
        score: Number(match.score || 0),
      }));
    }),
  );
  return [
    ...new Set(
      matches
        .flat()
        .sort((left, right) => right.score - left.score)
        .map((match) => match.id)
        .filter(Boolean)
        .map(String),
    ),
  ].slice(0, topK);
};

module.exports = {
  TYPE_CONFIG,
  getDocument,
  getDocumentContext,
  processDocument,
  getTextArtifact,
  retrievePassages,
  saveTextArtifact,
  searchAcrossIndexedDocuments,
};
