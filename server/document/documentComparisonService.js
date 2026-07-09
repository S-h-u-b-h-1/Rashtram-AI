const { query } = require("../db");
const DocumentRepository = require("./DocumentRepository");
const {
  retrieveDocumentContext,
} = require("./documentResearchService");
const { getDocumentReadiness } = require("./readinessContract");
const {
  getDocumentRecommendations,
} = require("./recommendationService");
const {
  getComparisonGraphOverlap,
} = require("../graph/knowledgeGraphService");
const { generateDocumentComparison } = require("../lib/vectordb");

const MODES = new Set([
  "summary",
  "clause",
  "impact",
  "timeline",
  "compliance",
  "full",
]);
const MODE_ALIASES = {
  comprehensive: "full",
  legal: "clause",
  policy: "impact",
  stakeholder: "impact",
};
const LANGUAGES = new Set(["auto", "english", "hindi"]);

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
  const suppliedMode = String(
    payload.comparisonMode || payload.mode || "full",
  ).toLowerCase();
  const mode = MODE_ALIASES[suppliedMode] || suppliedMode;
  if (!MODES.has(mode)) {
    throw validationError("Unsupported comparison mode.");
  }
  const language = String(payload.language || "auto").toLowerCase();
  if (!LANGUAGES.has(language)) {
    throw validationError("Unsupported comparison language.");
  }
  const userQuestion = String(payload.userQuestion || "")
    .normalize("NFKC")
    .trim();
  if (userQuestion.length > 1_500) {
    throw validationError("The focused comparison question is too long.");
  }
  return { documentIds, mode, language, userQuestion };
};

const readinessReason = (document) => {
  if (!document) return "Document not found";
  if (document.visibilityStatus === "hidden_invalid") {
    return "Invalid or quarantined catalogue record";
  }
  if (
    document.processingStatus === "failed" ||
    document.extractionStatus === "failed" ||
    document.embeddingStatus === "failed"
  ) {
    return document.failureReason || document.readinessReason || "Processing failed";
  }
  if (!document.title || !document.id) return "Research workspace unavailable";
  if (!document.hasAccessibleResource && !document.pdfUrl) {
    return "No accessible PDF or extractable source is available";
  }
  if (document.processingStatus && document.processingStatus !== "ready") {
    return document.readinessReason || "Document processing is not complete";
  }
  if (document.extractionStatus && document.extractionStatus !== "ready") {
    return "Text extraction pending";
  }
  if (
    document.extractionStatus === "ready" &&
    Number(document.chunksCount || 0) <= 0
  ) {
    return "No extractable text found";
  }
  if (
    document.embeddingStatus &&
    !["ready", "fallback", "success"].includes(document.embeddingStatus)
  ) {
    return "Research workspace unavailable";
  }
  if (
    document.embeddingStatus === "ready" &&
    Number(document.embeddingsCount || 0) < Number(document.chunksCount || 0)
  ) {
    return "Embeddings are incomplete";
  }
  if (!document.researchReady) return "Research workspace unavailable";
  if (!document.comparisonReady) {
    return document.readinessReason || "Comparison retrieval is unavailable";
  }
  return null;
};

const ensureResearchReady = async (document) => {
  const readiness = await getDocumentReadiness(document.id);
  const reason = readiness?.comparisonReady ? null : readiness?.reason || readinessReason(document);
  if (reason) {
    const error = validationError(
      `${document?.title || "Document"}: ${reason}.`,
      422,
    );
    error.details = {
      documentId: document?.id,
      needsPreparation: Boolean(readiness?.canPrepare),
      readiness,
    };
    throw error;
  }
  return { document, readiness };
};

const comparisonQuery = (mode) =>
  ({
    clause:
      "operative provisions, legal duties, powers, definitions, penalties, exceptions, jurisdiction and authority",
    impact:
      "policy objectives, implementation, beneficiaries, institutions, funding, outcomes and trade-offs",
    timeline:
      "dates, commencement, deadlines, stages, transitions and implementation sequence",
    compliance:
      "regulated entities, duties, approvals, reporting, penalties, exceptions, deadlines and compliance impact",
    summary:
      "purpose, scope, principal provisions, authorities, affected groups and key dates",
    full:
      "purpose, provisions, similarities, differences, authorities, stakeholders, dates and practical impact",
  })[mode];

const mapComparison = (row) => row && ({
  id: String(row.id),
  title: row.title,
  documentIds: row.document_ids_json || [],
  mode: MODE_ALIASES[row.mode] || row.mode,
  comparisonMode: MODE_ALIASES[row.mode] || row.mode,
  language: String(row.language || "auto").toLowerCase(),
  userQuestion: row.user_question || "",
  result: row.result_json || {},
  recommendedDocuments:
    row.recommended_documents_json ||
    row.result_json?.recommendedDocuments ||
    [],
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const extractiveComparisonFallback = ({
  mode,
  language,
  userQuestion,
  documents,
  groups,
  citations,
  generationError,
}) => {
  const executiveSummary = [
    "Rashtram AI generated this comparison from retrieved document passages because the AI generation provider was unavailable.",
    `Mode: ${mode}.`,
    userQuestion ? `Focused question: ${userQuestion}` : null,
  ].filter(Boolean).join(" ");
  const keyFindings = groups.map(({ document, passages }, index) => ({
    point: `${document.title}: ${passages[0]?.content?.slice(0, 280) || "No passage available."}`,
    citations: passages.slice(0, 2).map((_, passageIndex) => `D${index + 1}-C${passageIndex + 1}`),
  }));
  const similarities = [
    {
      point: "All compared documents were processed through Rashtram AI's grounded retrieval pipeline and include source passages.",
      citations: citations.slice(0, Math.min(4, citations.length)).map((citation) => citation.id),
    },
  ];
  const differences = groups.map(({ document, passages }, index) => ({
    topic: document.title,
    analysis: passages
      .slice(0, 2)
      .map((passage) => passage.content.slice(0, 360))
      .join(" "),
    citations: passages.slice(0, 2).map((_, passageIndex) => `D${index + 1}-C${passageIndex + 1}`),
  }));
  return {
    generationMode: "extractive_fallback",
    generationError: String(generationError?.message || generationError || "")
      .slice(0, 500),
    language,
    executiveSummary,
    similarities,
    differences,
    keyClauses: differences.map((item) => ({
      documentId: documents.find((document) => document.title === item.topic)?.id,
      clause: "Retrieved passage",
      analysis: item.analysis,
      citations: item.citations,
    })),
    stakeholders: [],
    complianceImpact: [],
    timeline: [],
    authorityDifferences: [],
    impactAssessment: differences.map((item) => ({
      point: item.analysis,
      citations: item.citations,
    })),
    keyFindings,
    suggestedQuestions: [
      "What are the main implementation differences?",
      "Which authorities or institutions are affected?",
      "What evidence supports each difference?",
    ],
  };
};

const createComparison = async (userId, payload) => {
  const { documentIds, mode, language, userQuestion } =
    normalizeRequest(payload);
  const loaded = await Promise.all(
    documentIds.map((id) => DocumentRepository.getById(id)),
  );
  if (loaded.some((document) => !document)) {
    throw validationError("One or more selected documents were not found.", 404);
  }
  const readyPayloads = await Promise.all(loaded.map(ensureResearchReady));
  const documents = readyPayloads.map((payload) => payload.document);
  const topK = Math.max(4, Math.floor(20 / documents.length));
  const groups = await Promise.all(
    documents.map(async (document, documentIndex) => {
      const retrieval = await retrieveDocumentContext(
        document.type,
        document.id,
        userQuestion || comparisonQuery(mode),
        { topK },
      );
      const passages = retrieval.passages || [];
      if (!passages.some((passage) => passage.content.trim())) {
        throw validationError(`${document.title}: No extractable text.`, 422);
      }
      return {
        document,
        passages: passages.filter((passage) => passage.content.trim()),
        documentIndex,
        retrievalMode: retrieval.retrievalMode,
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
            page: passage.pageStart || null,
            pageEnd: passage.pageEnd || null,
            pageEstimate: passage.pageEstimate,
            section: passage.sectionTitle || passage.sectionId || null,
            clause: passage.clauseId || null,
            score: passage.score,
            languageCode: passage.languageCode,
            sourceUrl: passage.sourceUrl || document.sourceUrl,
            pdfUrl: document.pdfUrl,
            snippet: passage.content.slice(0, 700),
          });
          return `[${label}] ${passage.content.slice(0, 2_000)}`;
        }),
      ].join("\n\n");
    })
    .join("\n\n");

  const graphIntelligence = await getComparisonGraphOverlap(documentIds);
  const graphContext = graphIntelligence.relationships.length
    ? [
        "=== VERIFIED KNOWLEDGE GRAPH RELATIONSHIPS ===",
        ...graphIntelligence.relationships.map((relationship) =>
          [
            `${relationship.sourceTitle} --${relationship.type}--> ${relationship.targetTitle}`,
            `Confidence: ${relationship.confidence ?? "not scored"}`,
            relationship.explanation || "",
          ].filter(Boolean).join("\n"),
        ),
      ].join("\n\n")
    : "";
  const comparisonDocuments = documents.map(({
    id,
    type,
    title,
    authority,
    status,
    ministry,
    state,
    jurisdiction,
    year,
    publicationDate,
  }) => ({
    id,
    type,
    title,
    authority,
    status,
    ministry,
    state,
    jurisdiction,
    year,
    publicationDate,
  }));
  let generated;
  try {
    generated = await generateDocumentComparison({
      mode,
      language,
      userQuestion,
      documents: comparisonDocuments,
      context: [context, graphContext].filter(Boolean).join("\n\n"),
    });
    generated.generationMode = generated.generationMode || "ai";
  } catch (error) {
    generated = extractiveComparisonFallback({
      mode,
      language,
      userQuestion,
      documents: comparisonDocuments,
      groups,
      citations,
      generationError: error,
    });
  }
  const recommendedDocuments = [
    ...new Map(
      (
        await Promise.all(
          documents.map((document) =>
            getDocumentRecommendations(document.id, userId, {
              limit: 6,
              includeNonReady: false,
              useUserProfile: true,
            }),
          ),
        )
      )
        .flat()
        .filter(
          (recommendation) =>
            !documentIds.includes(String(recommendation.id)),
        )
        .sort((left, right) => right.score - left.score)
        .map((recommendation) => [String(recommendation.id), recommendation]),
    ).values(),
  ].slice(0, 8);
  const result = {
    ...generated,
    documents: documents.map(
      ({
        id,
        type,
        title,
        authority,
        status,
        ministry,
        state,
        jurisdiction,
        year,
        publicationDate,
        sourceUrl,
        pdfUrl,
      }) => ({
        id,
        type,
        title,
        authority,
        status,
        ministry,
        state,
        jurisdiction,
        year,
        publicationDate,
        sourceUrl,
        pdfUrl,
      }),
    ),
    citations,
    retrieval: groups.map(({ document, retrievalMode, passages }) => ({
      documentId: document.id,
      retrievalMode,
      passages: passages.length,
    })),
    relationshipIntelligence: graphIntelligence,
    recommendedDocuments,
  };
  const title = `Comparison: ${documents
    .map((document) => document.title)
    .join(" vs ")
    .slice(0, 450)}`;
  const inserted = await query(
    `INSERT INTO document_comparisons (
       user_id, title, document_ids_json, mode, language, user_question,
       result_json, recommended_documents_json
     )
     VALUES ($1, $2, $3::jsonb, $4, $5, $6, $7::jsonb, $8::jsonb)
     RETURNING *`,
    [
      userId,
      title,
      JSON.stringify(documentIds),
      mode,
      language,
      userQuestion || null,
      JSON.stringify(result),
      JSON.stringify(recommendedDocuments),
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

const deleteComparison = async (userId, comparisonId) => {
  const result = await query(
    `DELETE FROM document_comparisons
     WHERE id::TEXT = $1 AND user_id = $2
     RETURNING id`,
    [String(comparisonId), userId],
  );
  return Boolean(result.rows[0]);
};

module.exports = {
  LANGUAGES,
  MODES,
  createComparison,
  deleteComparison,
  ensureResearchReady,
  getComparison,
  getComparisons,
  normalizeRequest,
  readinessReason,
};
