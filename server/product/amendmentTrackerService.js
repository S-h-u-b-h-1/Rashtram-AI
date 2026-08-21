const DocumentRepository = require("../document/DocumentRepository");
const { retrieveDocumentContext } = require("../document/documentResearchService");
const {
  loadRelatedTemporalEvidence, loadTemporalContext,
} = require("../document/temporalLegalService");

const HISTORY_UNAVAILABLE = "Historical text unavailable from currently verified sources.";
const normalize = (value, maximum = 900) => String(value || "")
  .normalize("NFKC").replace(/\s+/g, " ").trim().slice(0, maximum);

const timelineDate = (event) => event.date || null;

const assembleAmendmentTracker = ({ document, context, historicalPassages, currentPassages }) => {
  const relationships = context?.relationships || [];
  const timeline = [
    ...(context?.events || []).map((event) => ({
      ...event, title: document.title, relationshipType: "SELECTED_DOCUMENT",
    })),
    ...relationships.flatMap((relationship) => relationship.events.map((event) => ({
      ...event, title: relationship.title, documentId: relationship.documentId,
      relationshipType: relationship.type, sourceUrl: relationship.sourceUrl || event.sourceUrl,
    }))),
  ].sort((a, b) => String(timelineDate(a) || "9999").localeCompare(String(timelineDate(b) || "9999")));
  const before = historicalPassages.filter((passage) => passage.temporalRole === "previous_version");
  const later = historicalPassages.filter((passage) => passage.temporalRole === "later_version");
  const after = later.length ? later : currentPassages;
  const affectedSections = [...new Set([...before, ...after]
    .map((passage) => normalize(passage.sectionTitle || passage.sectionId, 180)).filter(Boolean))];
  const hasBeforeAfter = before.length > 0 && after.length > 0;
  return {
    document: {
      id: String(document.id), title: document.title,
      documentType: document.documentType || document.type,
      sourceUrl: document.sourceUrl || document.canonical_url || null,
    },
    verificationStatus: hasBeforeAfter ? "source_text_verified" : relationships.length
      ? "relationship_verified_text_incomplete" : "no_verified_amendment_chain",
    timeline,
    affectedSections,
    beforeText: before.map((passage) => ({
      text: normalize(passage.content), documentId: passage.documentId,
      sectionId: passage.sectionId || null, sectionTitle: passage.sectionTitle || null,
      pageStart: passage.pageStart || null, sourceUrl: passage.sourceUrl || null,
    })),
    afterText: after.map((passage) => ({
      text: normalize(passage.content), documentId: passage.documentId || String(document.id),
      sectionId: passage.sectionId || null, sectionTitle: passage.sectionTitle || null,
      pageStart: passage.pageStart || null, sourceUrl: passage.sourceUrl || document.sourceUrl || null,
    })),
    sourceDocuments: relationships.map((relationship) => ({
      documentId: relationship.documentId, title: relationship.title,
      relationshipType: relationship.type, verificationStatus: relationship.verificationStatus,
      sourceUrl: relationship.sourceUrl,
    })),
    limitation: hasBeforeAfter ? null : HISTORY_UNAVAILABLE,
  };
};

const getAmendmentTracker = async (documentId, adapters = {}) => {
  const loadDocument = adapters.loadDocument || DocumentRepository.getById;
  const loadContext = adapters.loadContext || loadTemporalContext;
  const loadHistory = adapters.loadHistory || loadRelatedTemporalEvidence;
  const retrieve = adapters.retrieve || retrieveDocumentContext;
  const [document, context] = await Promise.all([
    loadDocument(documentId), loadContext(documentId),
  ]);
  if (!document || !context) {
    const error = new Error("Document not found.");
    error.status = 404;
    throw error;
  }
  const question = "Which sections or provisions were amended, substituted, inserted, omitted, repealed, or superseded?";
  const [historicalPassages, current] = await Promise.all([
    loadHistory(context, question),
    retrieve(document.documentType || document.type, document.id, question, {
      document, topK: 10,
    }).catch(() => ({ passages: [] })),
  ]);
  const currentPassages = (current.passages || []).filter((passage) =>
    passage.content && !String(passage.structuralType || "").startsWith("temporal_"));
  return assembleAmendmentTracker({ document, context, historicalPassages, currentPassages });
};

module.exports = { HISTORY_UNAVAILABLE, assembleAmendmentTracker, getAmendmentTracker };
