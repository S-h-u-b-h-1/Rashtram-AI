const { query } = require("../db");
const { pdfProcessor } = require("../lib/pdfProcessor");
const {
  checkActExists,
  checkBillExists,
  checkEGazetteExists,
  createProbeVector,
  generateActSummary,
  generateBillSummary,
  generateEGazetteSummary,
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

const GAZETTE_SCOPE = `(
  canonical_source IN ('egazette', 'state-gazette')
  OR source_name IN ('egazette', 'state-gazette')
  OR gazette_identifier IS NOT NULL
  OR document_type = 'gazette'
)`;

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
  const config = TYPE_CONFIG[documentType];
  if (!config) {
    throw new Error(
      `Document processing is not available for ${documentType}.`,
    );
  }
  return config;
};

const documentWhere = (documentType) =>
  documentType === "gazette"
    ? GAZETTE_SCOPE
    : "document_type = $2";

const mapDocument = (row) => ({
  id: String(row.id),
  documentId: String(row.id),
  documentType:
    row.document_type === "gazette" ||
    ["egazette", "state-gazette"].includes(
      row.canonical_source || row.source_name,
    ) ||
    row.gazette_identifier
      ? "gazette"
      : row.document_type,
  title: row.title,
  status: row.status || "Published",
  pdfUrl: row.pdf_url,
  sourceUrl: row.canonical_url || row.detail_url || row.source_url,
  sourceName: row.canonical_source || row.source_name,
  ministry: row.ministry,
  department: row.department,
  authority: row.authority,
  category: row.category,
  jurisdiction: row.jurisdiction,
  year: row.year,
  gazetteNumber: row.gazette_identifier || row.gazette_id,
  publicationDate: row.publication_date,
  effectiveDate: row.effective_date,
  metadata: {
    ...(row.source_metadata || {}),
    ...(row.metadata_json || {}),
  },
});

const getDocument = async (documentType, documentId) => {
  const parameters =
    documentType === "gazette"
      ? [documentId]
      : [documentId, documentType];
  const result = await query(
    `SELECT *
     FROM legislative_documents
     WHERE id = $1 AND ${documentWhere(documentType)}
     LIMIT 1`,
    parameters,
  );
  return result.rows[0] ? mapDocument(result.rows[0]) : null;
};

const getDocumentContext = async (documentType, documentId) => {
  const cacheKey = `${documentType}:${documentId}`;
  const cached = contextCache.get(cacheKey);
  if (cached && Date.now() - cached.cachedAt < CONTEXT_CACHE_TTL_MS) {
    return cached.value;
  }
  const document = await getDocument(documentType, documentId);
  if (!document) return null;
  const [resources, relationships, recommendations] = await Promise.all([
    query(
      `SELECT label, resource_type, category, url, metadata
       FROM legislative_document_resources
       WHERE document_id = $1
       ORDER BY resource_type, label`,
      [documentId],
    ),
    query(
      `SELECT
         r.relationship_type,
         r.confidence,
         r.source_name,
         r.source_url,
         related.id,
         related.title,
         related.document_type,
         related.status,
         related.pdf_url,
         COALESCE(
           related.canonical_url,
           related.detail_url,
           related.source_url
         ) AS related_source_url
       FROM document_relationships r
       JOIN legislative_documents related
         ON related.id = CASE
           WHEN r.from_document_id = $1 THEN r.to_document_id
           ELSE r.from_document_id
         END
       WHERE r.from_document_id = $1 OR r.to_document_id = $1
       ORDER BY r.confidence DESC NULLS LAST, related.updated_at DESC
       LIMIT 20`,
      [documentId],
    ),
    query(
      `SELECT id, title, document_type, status, pdf_url,
         COALESCE(canonical_url, detail_url, source_url) AS source_url,
         ministry, category, jurisdiction
       FROM legislative_documents
       WHERE id <> $1
         AND (
           ($2::TEXT IS NOT NULL AND ministry = $2)
           OR ($3::TEXT IS NOT NULL AND category = $3)
           OR ($4::TEXT IS NOT NULL AND authority = $4)
         )
       ORDER BY source_priority ASC,
         publication_date DESC NULLS LAST,
         updated_at DESC
       LIMIT 8`,
      [
        documentId,
        document.ministry || null,
        document.category || null,
        document.authority || null,
      ],
    ),
  ]);
  const value = {
    ...document,
    resources: resources.rows,
    relationships: relationships.rows.map((row) => ({
      relationshipType: row.relationship_type,
      confidence:
        row.confidence == null ? null : Number(row.confidence),
      sourceName: row.source_name,
      sourceUrl: row.source_url,
      document: {
        id: String(row.id),
        title: row.title,
        documentType: row.document_type,
        status: row.status,
        pdfUrl: row.pdf_url,
        sourceUrl: row.related_source_url,
      },
    })),
    recommendations: recommendations.rows.map((row) => ({
      id: String(row.id),
      title: row.title,
      documentType: row.document_type,
      status: row.status,
      pdfUrl: row.pdf_url,
      sourceUrl: row.source_url,
      ministry: row.ministry,
      category: row.category,
      jurisdiction: row.jurisdiction,
    })),
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
  const existence = await config.check(documentId);
  if (existence.exists && existence.summary) {
    return {
      alreadyProcessed: true,
      summary: existence.summary,
      chunksStored: existence.chunksCount || 0,
      document,
    };
  }

  if (existence.exists) {
    const matches = await loadIndexedChunks(config, documentId);
    const context = matches
      .map((match) => match.metadata?.content || "")
      .filter(Boolean)
      .join("\n\n");
    if (context) {
      const summary = await config.generateSummary(context);
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
  const summary = await config.generateSummary(summaryContext);
  const chunks = processed.chunks.map((chunk, index) => ({
    ...chunk,
    id: `${documentType}-${documentId}-chunk-${index}`,
    [config.idField]: String(documentId),
    metadata: {
      ...chunk.metadata,
      documentType,
      sourceUrl: document.sourceUrl,
      summary,
    },
  }));
  const stored = await config.store(chunks);
  return {
    alreadyProcessed: false,
    summary,
    chunksStored: stored.chunksStored,
    totalChunks: processed.totalChunks,
    document,
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
  }));
};

module.exports = {
  TYPE_CONFIG,
  getDocument,
  getDocumentContext,
  processDocument,
  retrievePassages,
};
