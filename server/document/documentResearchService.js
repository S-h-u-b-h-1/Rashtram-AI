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
       summary_json,
       pdf_quality_class,
       pdf_quality_json,
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
    summaryJson = {},
    pdfQuality = null,
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
       metadata_json,
       summary_json,
       pdf_quality_class,
       pdf_quality_json
     )
     VALUES (
       $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::jsonb,
       $12::jsonb, $13, $14::jsonb
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

const saveNormalizedChunks = async (documentId, chunks, languageCode) => {
  await query(`DELETE FROM document_text_chunks WHERE document_id = $1`, [
    documentId,
  ]);
  for (let index = 0; index < chunks.length; index += 1) {
    const chunk = chunks[index];
    const content = String(
      chunk.content || chunk.metadata?.content || "",
    ).trim();
    if (!content) continue;
    await query(
      `INSERT INTO document_text_chunks (
         document_id, chunk_index, original_text, translated_text,
         language, token_count, vector_reference, metadata_json
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb)
       ON CONFLICT (document_id, chunk_index)
       DO UPDATE SET
         original_text = EXCLUDED.original_text,
         translated_text = EXCLUDED.translated_text,
         language = EXCLUDED.language,
         token_count = EXCLUDED.token_count,
         vector_reference = EXCLUDED.vector_reference,
         metadata_json = EXCLUDED.metadata_json,
         updated_at = NOW()`,
      [
        documentId,
        chunk.metadata?.chunkIndex ?? chunk.chunkIndex ?? index,
        content,
        chunk.translatedText || null,
        chunk.metadata?.languageCode || languageCode || "und",
        Math.ceil(content.length / 4),
        chunk.id || `${documentId}-chunk-${index}`,
        JSON.stringify(chunk.metadata || {}),
      ],
    );
  }
};

const processDocument = async (documentType, documentId) => {
  const totalStartedAt = Date.now();
  const document = await getDocument(documentType, documentId);
  if (!document) {
    const error = new Error("Document not found.");
    error.status = 404;
    throw error;
  }
  const config = typeConfig(documentType);
  const indexCheckStartedAt = Date.now();
  const existence = await config.check(documentId);
  const indexCheckMs = Date.now() - indexCheckStartedAt;
  if (existence.exists) {
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
      const summary =
        storedArtifact?.englishSummary ||
        existence.summary ||
        await generateDocumentSummary(documentType, context, {
          sourceLanguage: language.languageCode,
        });
      const summarySections = parseSummarySections(summary);
      const suggestedQuestions =
        questionsFromSummary(summarySections).length > 0
          ? questionsFromSummary(summarySections)
          : await generateSuggestedQuestions(documentType, summary);
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
          generationOutputTokens: Math.ceil(summary.length / 4),
          embeddingInputTokens: 0,
          ocrUsed: Boolean(matches[0]?.metadata?.ocrUsed),
        },
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
  const summaryStartedAt = Date.now();
  const summary = await generateDocumentSummary(
    documentType,
    summaryContext,
    { sourceLanguage: processed.language.languageCode },
  );
  const summarySections = parseSummarySections(summary);
  const suggestedQuestions =
    questionsFromSummary(summarySections).length > 0
      ? questionsFromSummary(summarySections)
      : await generateSuggestedQuestions(documentType, summary);
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
      languageCode: processed.language.languageCode,
      script: processed.language.script,
      originalLanguage: processed.language.languageCode,
    },
  }));
  const stored = await config.store(chunks);
  const chunkPersistenceStartedAt = Date.now();
  await saveNormalizedChunks(
    documentId,
    chunks,
    processed.language.languageCode,
  );
  const chunkPersistenceMs = Date.now() - chunkPersistenceStartedAt;
  const embeddingInputTokens = chunks.reduce(
    (sum, chunk) =>
      sum + Math.ceil(String(chunk.embeddingText || chunk.content).length / 4),
    0,
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
    stageMetrics: {
      indexCheckMs,
      ...(processed.stageMetrics || {}),
      summaryMs,
      embeddingsMs: Number(stored.metrics?.embeddingsMs || 0),
      pineconeMs: Number(stored.metrics?.pineconeMs || 0),
      chunkPersistenceMs,
      totalMs: Date.now() - totalStartedAt,
    },
    usage: {
      estimated: true,
      generationInputTokens: Math.ceil(summaryContext.length / 4),
      generationOutputTokens: Math.ceil(summary.length / 4),
      embeddingInputTokens,
      ocrUsed: processed.ocrUsed,
    },
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
    pageStart: match.metadata?.pageStart || null,
    pageEnd: match.metadata?.pageEnd || null,
    pageEstimate: Boolean(match.metadata?.pageEstimate),
    sectionId: match.metadata?.sectionId || null,
    sectionTitle: match.metadata?.sectionTitle || null,
    clauseId: match.metadata?.clauseId || null,
    structuralType: match.metadata?.structuralType || "passage",
    sourceUrl: match.metadata?.sourceUrl || null,
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
        .filter((match) => match.score >= 0.55)
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
  saveNormalizedChunks,
  parseSummarySections,
  searchAcrossIndexedDocuments,
};
