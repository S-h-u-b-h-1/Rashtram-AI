const { query } = require("../db");
const DocumentRepository = require("./DocumentRepository");
const {
  processDocument,
  retrievePassages,
} = require("./documentResearchService");
const { generateDocumentComparison } = require("../lib/vectordb");

const MODES = new Set([
  "comprehensive",
  "legal",
  "policy",
  "timeline",
  "stakeholder",
]);
const LANGUAGES = new Set(["English", "Hindi"]);

const validationError = (message, status = 400) => {
  const error = new Error(message);
  error.status = status;
  return error;
};

const normalizeRequest = (payload = {}) => {
  const supplied = Array.isArray(payload.documentIds)
    ? payload.documentIds.map((id) => String(id || "").trim()).filter(Boolean)
    : [];
  const documentIds = [...new Set(supplied)];
  if (supplied.length !== documentIds.length) {
    throw validationError("Duplicate documents cannot be compared.");
  }
  if (documentIds.length < 2 || documentIds.length > 5) {
    throw validationError("Select between two and five documents.");
  }
  const mode = String(payload.mode || "comprehensive").toLowerCase();
  if (!MODES.has(mode)) {
    throw validationError("Unsupported comparison mode.");
  }
  const language = String(payload.language || "English");
  if (!LANGUAGES.has(language)) {
    throw validationError("Unsupported comparison language.");
  }
  return { documentIds, mode, language };
};

const readinessReason = (document) => {
  if (!document) return "Document not found";
  if (document.processingStatus === "failed") return "Processing failed";
  if (!document.pdfUrl) return "PDF unavailable";
  if (!document.title || !document.id) return "Research workspace unavailable";
  if (!document.researchReady) return "Document not indexed yet";
  return null;
};

const ensureResearchReady = async (document) => {
  let reason = readinessReason(document);
  if (reason !== "Document not indexed yet") {
    if (reason) throw validationError(`${document?.title || "Document"}: ${reason}.`, 422);
    return document;
  }

  await DocumentRepository.updateProcessingStatus(document.id, "processing");
  try {
    await processDocument(document.type, document.id);
    await DocumentRepository.updateProcessingStatus(document.id, "ready");
  } catch (error) {
    await DocumentRepository.updateProcessingStatus(
      document.id,
      "failed",
      error.message,
    );
    const message = /extract|text|scan|ocr/i.test(error.message)
      ? "No extractable text"
      : "Research workspace unavailable";
    throw validationError(`${document.title}: ${message}.`, 422);
  }

  const refreshed = await DocumentRepository.getById(document.id);
  reason = readinessReason(refreshed);
  if (reason) throw validationError(`${document.title}: ${reason}.`, 422);
  return refreshed;
};

const comparisonQuery = (mode) =>
  ({
    legal:
      "operative provisions, legal duties, powers, definitions, penalties, exceptions, jurisdiction and authority",
    policy:
      "policy objectives, implementation, beneficiaries, institutions, funding, outcomes and trade-offs",
    timeline:
      "dates, commencement, deadlines, stages, transitions and implementation sequence",
    stakeholder:
      "affected people, institutions, regulators, duties, rights, benefits and compliance impact",
    comprehensive:
      "purpose, provisions, similarities, differences, authorities, stakeholders, dates and practical impact",
  })[mode];

const mapComparison = (row) => row && ({
  id: String(row.id),
  title: row.title,
  documentIds: row.document_ids_json || [],
  mode: row.mode,
  language: row.language,
  result: row.result_json || {},
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const createComparison = async (userId, payload) => {
  const { documentIds, mode, language } = normalizeRequest(payload);
  const loaded = await Promise.all(
    documentIds.map((id) => DocumentRepository.getById(id)),
  );
  if (loaded.some((document) => !document)) {
    throw validationError("One or more selected documents were not found.", 404);
  }
  const documents = await Promise.all(loaded.map(ensureResearchReady));
  const topK = Math.max(4, Math.floor(20 / documents.length));
  const groups = await Promise.all(
    documents.map(async (document, documentIndex) => {
      const passages = await retrievePassages(
        document.type,
        document.id,
        comparisonQuery(mode),
        topK,
      );
      if (!passages.some((passage) => passage.content.trim())) {
        throw validationError(`${document.title}: No extractable text.`, 422);
      }
      return {
        document,
        passages: passages.filter((passage) => passage.content.trim()),
        documentIndex,
      };
    }),
  );

  const citations = [];
  const context = groups
    .map(({ document, passages, documentIndex }) => {
      const documentLabel = `D${documentIndex + 1}`;
      return [
        `=== ${documentLabel}: ${document.title} (${document.type}) ===`,
        ...passages.map((passage, passageIndex) => {
          const label = `${documentLabel}-C${passageIndex + 1}`;
          citations.push({
            id: label,
            documentId: document.id,
            documentType: document.type,
            documentTitle: document.title,
            chunkIndex: passage.chunkIndex,
            page: passage.page || passage.metadata?.page || null,
            score: passage.score,
            languageCode: passage.languageCode,
            sourceUrl: document.sourceUrl,
            pdfUrl: document.pdfUrl,
            snippet: passage.content.slice(0, 700),
          });
          return `[${label}] ${passage.content.slice(0, 2_000)}`;
        }),
      ].join("\n\n");
    })
    .join("\n\n");

  const generated = await generateDocumentComparison({
    mode,
    language,
    documents: documents.map(({ id, type, title, authority, status }) => ({
      id,
      type,
      title,
      authority,
      status,
    })),
    context,
  });
  const result = {
    ...generated,
    documents: documents.map(
      ({ id, type, title, authority, status, sourceUrl, pdfUrl }) => ({
        id,
        type,
        title,
        authority,
        status,
        sourceUrl,
        pdfUrl,
      }),
    ),
    citations,
  };
  const title = `Comparison: ${documents
    .map((document) => document.title)
    .join(" vs ")
    .slice(0, 450)}`;
  const inserted = await query(
    `INSERT INTO document_comparisons (
       user_id, title, document_ids_json, mode, language, result_json
     )
     VALUES ($1, $2, $3::jsonb, $4, $5, $6::jsonb)
     RETURNING *`,
    [
      userId,
      title,
      JSON.stringify(documentIds),
      mode,
      language,
      JSON.stringify(result),
    ],
  );
  return mapComparison(inserted.rows[0]);
};

const getComparison = async (userId, comparisonId) => {
  const result = await query(
    `SELECT * FROM document_comparisons
     WHERE id::TEXT = $1 AND user_id = $2
     LIMIT 1`,
    [String(comparisonId), userId],
  );
  return mapComparison(result.rows[0]);
};

const getComparisons = async (userId, limit = 30) => {
  const safeLimit = Math.min(Math.max(Number.parseInt(limit, 10) || 30, 1), 100);
  const result = await query(
    `SELECT * FROM document_comparisons
     WHERE user_id = $1
     ORDER BY updated_at DESC
     LIMIT $2`,
    [userId, safeLimit],
  );
  return result.rows.map(mapComparison);
};

module.exports = {
  LANGUAGES,
  MODES,
  createComparison,
  ensureResearchReady,
  getComparison,
  getComparisons,
  normalizeRequest,
  readinessReason,
};
