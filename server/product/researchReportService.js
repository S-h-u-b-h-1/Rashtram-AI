const { query } = require("../db");
const DocumentRepository = require("../document/DocumentRepository");
const { retrieveDocumentContext } = require("../document/documentResearchService");
const { assessEvidenceSufficiency, SUFFICIENCY_LEVELS } = require("../retrieval/evidenceSafetyService");

const INSUFFICIENT = "Insufficient verified evidence.";
const normalize = (value, maximum = 1200) => String(value || "")
  .normalize("NFKC").replace(/\s+/g, " ").trim().slice(0, maximum);

const validateReportInput = (payload = {}) => {
  const researchQuestion = normalize(payload.researchQuestion, 1600);
  const documentIds = [...new Set((Array.isArray(payload.documentIds) ? payload.documentIds : [])
    .map((id) => String(id || "").trim()).filter((id) => /^\d+$/.test(id)))].slice(0, 10);
  const title = normalize(payload.title || `Research report: ${researchQuestion}`, 240);
  if (researchQuestion.length < 8) {
    const error = new Error("Enter a clear research question."); error.status = 400; throw error;
  }
  if (!documentIds.length) {
    const error = new Error("Select at least one document."); error.status = 400; throw error;
  }
  return { title, researchQuestion, documentIds };
};

const unique = (items, key) => [...new Map(items.map((item) => [key(item), item])).values()];
const evidenceFor = (evidence, expression, limit = 12) => evidence
  .filter((item) => expression.test(item.text)).slice(0, limit)
  .map((item) => ({ text: item.text, citations: [item.id] }));

const assembleResearchReport = ({ input, runs }) => {
  const usableRuns = runs.filter((run) => ![
    SUFFICIENCY_LEVELS.INSUFFICIENT, SUFFICIENCY_LEVELS.CONFLICTING,
  ].includes(run.sufficiency.level));
  const evidence = usableRuns.flatMap((run, documentIndex) =>
    run.passages.slice(0, 12).map((passage, chunkIndex) => ({
      id: `R-D${documentIndex + 1}-C${chunkIndex + 1}`,
      documentId: String(run.document.id), documentTitle: run.document.title,
      documentType: run.document.documentType || run.document.type,
      text: normalize(passage.content), sourceUrl: passage.sourceUrl || run.document.sourceUrl || null,
      pageStart: passage.pageStart || null, pageEnd: passage.pageEnd || null,
      sectionId: passage.sectionId || null, sectionTitle: passage.sectionTitle || null,
      authorityClass: passage.authorityClass || "UNKNOWN",
    }))).filter((item) => item.text && item.sourceUrl);
  const instruments = usableRuns.map((run) => ({
    documentId: String(run.document.id), title: run.document.title,
    documentType: run.document.documentType || run.document.type,
    jurisdiction: run.document.jurisdiction || run.document.state || null,
    authority: run.document.authority || run.document.ministry || null,
    sourceUrl: run.document.sourceUrl || null,
  }));
  const authorities = unique(instruments.filter((item) => item.authority).map((item) => ({
    name: item.authority, documentId: item.documentId, sourceUrl: item.sourceUrl,
  })), (item) => item.name.toLowerCase());
  const keyProvisions = evidenceFor(evidence,
    /\b(shall|must|required|provide[sd]?|establish|authori[sz]e|prohibit|entitled|may)\b/i, 15);
  const implications = evidenceFor(evidence,
    /\b(affect|impact|implementation|beneficiar|stakeholder|enterprise|business|institution|authority)\b/i, 10);
  const timeline = usableRuns.flatMap((run) => [
    ["publication", run.document.publicationDate || run.document.publication_date],
    ["notification", run.document.notifiedDate || run.document.notified_date],
    ["effective", run.document.effectiveDate || run.document.effective_date],
    ["commencement", run.document.commencementDate || run.document.commencement_date],
  ].filter(([, date]) => date).map(([kind, date]) => ({
    kind, date: String(date).slice(0, 10), documentId: String(run.document.id),
    sourceUrl: run.document.sourceUrl || null,
  })));
  const unavailable = (value) => value.length ? value : INSUFFICIENT;
  const sections = {
    executiveSummary: evidence.length ? [{
      text: `This report addresses “${input.researchQuestion}” using ${evidence.length} cited passage${evidence.length === 1 ? "" : "s"} from ${usableRuns.length} selected instrument${usableRuns.length === 1 ? "" : "s"}.`,
      citations: evidence.slice(0, 3).map((item) => item.id),
    }] : INSUFFICIENT,
    researchQuestion: input.researchQuestion,
    relevantAuthorities: unavailable(authorities),
    relevantLegalInstruments: unavailable(instruments),
    keyProvisions: unavailable(keyProvisions),
    timeline: unavailable(timeline),
    comparison: usableRuns.length > 1
      ? { status: "evidence_by_document", note: "No difference is inferred; compare the cited passages by preserved document identity.",
          documents: instruments }
      : INSUFFICIENT,
    potentialImplications: unavailable(implications),
    openQuestions: [
      timeline.length ? null : "Which effective or commencement dates can be verified from official sources?",
      usableRuns.length < runs.length ? "Can additional verified passages resolve the documents with insufficient or conflicting evidence?" : null,
      "Do later amendments, exemptions, judicial decisions, or local instruments affect this research question?",
    ].filter(Boolean),
    evidenceLimitations: [
      !evidence.length ? INSUFFICIENT : null,
      ...runs.filter((run) => !usableRuns.includes(run)).map((run) =>
        `${run.document.title}: ${run.sufficiency.level.toLowerCase().replaceAll("_", " ")} evidence.`),
      "This report is research assistance, not legal advice. Verify material conclusions against the cited sources.",
    ].filter(Boolean),
    sources: evidence,
  };
  const verificationStatus = !evidence.length ? "insufficient_evidence"
    : usableRuns.length < runs.length ? "limited_evidence" : "verified_evidence";
  return { sections, evidence, verificationStatus };
};

const generateResearchReport = async (userId, payload = {}, adapters = {}) => {
  const input = validateReportInput(payload);
  const loadDocument = adapters.loadDocument || DocumentRepository.getById;
  const retrieve = adapters.retrieve || retrieveDocumentContext;
  const persist = adapters.persist || query;
  const runs = (await Promise.all(input.documentIds.map(async (documentId) => {
    const document = await loadDocument(documentId);
    if (!document) return null;
    const retrieval = await retrieve(document.documentType || document.type, document.id,
      input.researchQuestion, { document, accountId: userId, topK: 12 });
    const passages = retrieval.passages || [];
    return { document, passages, sufficiency: assessEvidenceSufficiency(input.researchQuestion,
      passages, { retrievalVerified: retrieval.retrievalVerified, minimumEvidence: 3 }) };
  }))).filter(Boolean);
  if (!runs.length) {
    const error = new Error("None of the selected documents is available."); error.status = 404; throw error;
  }
  const assembled = assembleResearchReport({ input, runs });
  const inserted = await persist(
    `INSERT INTO research_reports
       (user_id, title, research_question, selected_document_ids, report_json,
        evidence_refs_json, verification_status)
     VALUES ($1, $2, $3, $4::BIGINT[], $5::jsonb, $6::jsonb, $7)
     RETURNING id, created_at`,
    [userId, input.title, input.researchQuestion, input.documentIds,
      JSON.stringify(assembled.sections), JSON.stringify(assembled.evidence), assembled.verificationStatus],
  );
  return { id: String(inserted.rows[0]?.id || ""), title: input.title,
    researchQuestion: input.researchQuestion, selectedDocumentIds: input.documentIds,
    createdAt: inserted.rows[0]?.created_at, ...assembled };
};

const getResearchReport = async (userId, reportId, adapter = query) => {
  const result = await adapter(
    `SELECT * FROM research_reports WHERE id::TEXT = $1 AND user_id = $2 LIMIT 1`,
    [String(reportId), userId],
  );
  const row = result.rows[0];
  if (!row) { const error = new Error("Research report not found."); error.status = 404; throw error; }
  return { id: String(row.id), title: row.title, researchQuestion: row.research_question,
    selectedDocumentIds: (row.selected_document_ids || []).map(String), sections: row.report_json,
    evidence: row.evidence_refs_json || [], verificationStatus: row.verification_status,
    createdAt: row.created_at };
};

const reportAsMarkdown = (report) => {
  const label = (key) => key.replace(/([A-Z])/g, " $1").replace(/^./, (char) => char.toUpperCase());
  const render = (value) => {
    if (typeof value === "string") return value;
    if (Array.isArray(value)) return value.map((item) => `- ${typeof item === "string" ? item : item.text || item.name || item.title || JSON.stringify(item)}`).join("\n");
    return value?.note || JSON.stringify(value, null, 2);
  };
  return Object.entries(report.sections || {}).filter(([key]) => key !== "sources")
    .map(([key, value]) => `## ${label(key)}\n\n${render(value)}`).join("\n\n");
};

module.exports = { INSUFFICIENT, assembleResearchReport, generateResearchReport,
  getResearchReport, reportAsMarkdown, validateReportInput };
