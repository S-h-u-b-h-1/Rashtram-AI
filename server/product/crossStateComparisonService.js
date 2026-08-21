const crypto = require("node:crypto");
const { query } = require("../db");
const DocumentRepository = require("../document/DocumentRepository");
const { retrieveDocumentContext } = require("../document/documentResearchService");
const { getProblemRecommendations } = require("../document/recommendationService");
const { assessEvidenceSufficiency, SUFFICIENCY_LEVELS } = require("../retrieval/evidenceSafetyService");

const NOT_FOUND = "not found in current corpus";
const FIELD_PATTERNS = Object.freeze({
  registration: /\b(registration|register(?:ed)?|enrolment)\b/i,
  licensing: /\b(licen[cs]e|permit|permission|approval|authori[sz]ation)\b/i,
  obligations: /\b(shall|must|required|obligation|duty|comply|maintain|submit|report)\b/i,
  prohibitions: /\b(prohibit|shall not|must not|no person|restriction|barred)\b/i,
  penalties: /\b(penalt|fine|imprison|offence|liable|punish)\b/i,
});

const normalize = (value, maximum = 800) => String(value || "")
  .normalize("NFKC").replace(/\s+/g, " ").trim().slice(0, maximum);
const unique = (values, limit = 5) => [...new Set(values.map((item) => normalize(item, 120)).filter(Boolean))].slice(0, limit);

const validateCrossStateInput = (payload = {}) => {
  const problem = normalize(payload.problem || payload.activity || payload.topic, 1200);
  const states = unique(Array.isArray(payload.states) ? payload.states : [], 5);
  if (problem.length < 8) {
    const error = new Error("Describe the business, activity, or policy topic."); error.status = 400; throw error;
  }
  if (states.length < 2) {
    const error = new Error("Choose at least two states."); error.status = 400; throw error;
  }
  return { problem, states };
};

const candidateBelongsToState = (candidate, state) => [candidate.state, candidate.jurisdiction]
  .some((value) => normalize(value, 120).toLowerCase() === state.toLowerCase());

const extractStateEvidence = (state, runs) => {
  const usable = runs.filter((run) => ![
    SUFFICIENCY_LEVELS.INSUFFICIENT, SUFFICIENCY_LEVELS.CONFLICTING,
  ].includes(run.sufficiency.level));
  const evidence = usable.flatMap((run, documentIndex) => run.passages.slice(0, 10).map((passage, chunkIndex) => ({
    id: `${state.replace(/\W/g, "").toUpperCase()}-D${documentIndex + 1}-C${chunkIndex + 1}`,
    state, documentId: String(run.document.id), documentTitle: run.document.title,
    documentType: run.document.documentType || run.document.type,
    sourceUrl: passage.sourceUrl || run.document.sourceUrl || null,
    pageStart: passage.pageStart || null, sectionId: passage.sectionId || null,
    text: normalize(passage.content),
  }))).filter((item) => item.text && item.sourceUrl);
  const field = (pattern) => {
    const matches = evidence.filter((item) => pattern.test(item.text)).slice(0, 8);
    return matches.length ? { status: "found", findings: matches } : { status: NOT_FOUND, findings: [] };
  };
  const authorities = unique(usable.map((run) => run.document.authority || run.document.ministry));
  const dates = usable.flatMap((run) => [
    ["effective", run.document.effectiveDate || run.document.effective_date],
    ["commencement", run.document.commencementDate || run.document.commencement_date],
  ].filter(([, date]) => date).map(([kind, date]) => ({
    kind, date: String(date).slice(0, 10), documentId: String(run.document.id),
    sourceUrl: run.document.sourceUrl || null,
  })));
  return {
    state,
    sourceDocuments: usable.map((run) => ({
      documentId: String(run.document.id), title: run.document.title,
      documentType: run.document.documentType || run.document.type,
      authority: run.document.authority || run.document.ministry || null,
      sourceUrl: run.document.sourceUrl || null,
    })),
    authority: authorities.length ? { status: "found", values: authorities } : { status: NOT_FOUND, values: [] },
    registration: field(FIELD_PATTERNS.registration),
    licensing: field(FIELD_PATTERNS.licensing),
    obligations: field(FIELD_PATTERNS.obligations),
    prohibitions: field(FIELD_PATTERNS.prohibitions),
    penalties: field(FIELD_PATTERNS.penalties),
    effectiveDates: dates.length ? { status: "found", values: dates } : { status: NOT_FOUND, values: [] },
    evidence,
    evidenceSufficiency: runs.map((run) => ({ documentId: String(run.document.id),
      level: run.sufficiency.level, reasons: run.sufficiency.reasons })),
  };
};

const runCrossStateComparison = async (userId, payload = {}, adapters = {}) => {
  const input = validateCrossStateInput(payload);
  const recommend = adapters.recommend || getProblemRecommendations;
  const loadDocument = adapters.loadDocument || DocumentRepository.getById;
  const retrieve = adapters.retrieve || retrieveDocumentContext;
  const persist = adapters.persist || query;
  const states = await Promise.all(input.states.map(async (state) => {
    const recommendationResult = await recommend(userId, {
      problem: input.problem, states: [state], limit: 12, profileSignals: false,
    });
    const candidates = (recommendationResult.recommendations || [])
      .filter((candidate) => candidateBelongsToState(candidate, state)).slice(0, 4);
    const runs = (await Promise.all(candidates.map(async (candidate) => {
      const document = await loadDocument(candidate.id);
      if (!document) return null;
      const retrieval = await retrieve(document.documentType || document.type, document.id,
        `${input.problem}. Identify authority, registration, licensing, obligations, prohibitions, penalties, and effective dates for ${state}.`,
        { document, accountId: userId, topK: 10 });
      const passages = retrieval.passages || [];
      return { document, passages, sufficiency: assessEvidenceSufficiency(input.problem, passages,
        { retrievalVerified: retrieval.retrievalVerified }) };
    }))).filter(Boolean);
    return extractStateEvidence(state, runs);
  }));
  const evidence = states.flatMap((state) => state.evidence);
  const result = {
    researchQuestion: input.problem, states,
    comparisonNote: "Each state was retrieved independently. A missing finding means only ‘not found in current corpus’; it does not mean the requirement does not apply.",
    differenceStatus: "No difference is asserted unless the cited state-specific passages establish it.",
    evidenceLimitations: states.filter((state) => !state.evidence.length)
      .map((state) => `${state.state}: no sufficient verified state-specific passage was retrieved.`),
  };
  const fingerprint = crypto.createHash("sha256")
    .update(`${input.problem.toLowerCase()}|${input.states.map((state) => state.toLowerCase()).sort().join("|")}`).digest("hex");
  const inserted = await persist(
    `INSERT INTO cross_state_comparisons
       (user_id, query_fingerprint, input_json, result_json, evidence_refs_json)
     VALUES ($1, $2, $3::jsonb, $4::jsonb, $5::jsonb) RETURNING id, created_at`,
    [userId, fingerprint, JSON.stringify(input), JSON.stringify({ ...result,
      states: states.map((state) => ({ ...state, evidence: undefined })) }), JSON.stringify(evidence)],
  );
  return { id: String(inserted.rows[0]?.id || ""), createdAt: inserted.rows[0]?.created_at,
    ...result };
};

module.exports = {
  FIELD_PATTERNS, NOT_FOUND, candidateBelongsToState, extractStateEvidence,
  runCrossStateComparison, validateCrossStateInput,
};
