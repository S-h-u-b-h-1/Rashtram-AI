const crypto = require("node:crypto");
const { query } = require("../db");
const DocumentRepository = require("../document/DocumentRepository");
const { retrieveDocumentContext } = require("../document/documentResearchService");
const { getProblemRecommendations, validateProblemRequest } = require("../document/recommendationService");
const { discoverKnowledgeCandidates } = require("../graph/knowledgeLayerService");
const { assessEvidenceSufficiency, SUFFICIENCY_LEVELS } = require("../retrieval/evidenceSafetyService");

const normalizeSpace = (value, maximum = 600) => String(value || "")
  .normalize("NFKC").replace(/\s+/g, " ").trim().slice(0, maximum);

const uniqueBy = (items, key) => [...new Map(items.map((item) => [key(item), item])).values()];

const evidenceMatches = (evidence, expression, limit = 8) => evidence
  .filter((item) => expression.test(item.snippet))
  .slice(0, limit)
  .map((item) => ({
    finding: item.snippet,
    documentId: item.documentId,
    citations: [item.id],
    sourceUrl: item.sourceUrl,
  }));

const shapeComplianceResult = ({ input, recommendations, knowledge, documentRuns }) => {
  const usableRuns = documentRuns.filter((run) => ![
    SUFFICIENCY_LEVELS.INSUFFICIENT, SUFFICIENCY_LEVELS.CONFLICTING,
  ].includes(run.sufficiency.level));
  const evidence = usableRuns.flatMap((run, documentIndex) =>
    run.passages.slice(0, 8).map((passage, chunkIndex) => ({
      id: `D${documentIndex + 1}-C${chunkIndex + 1}`,
      documentId: String(run.document.id),
      documentTitle: run.document.title,
      snippet: normalizeSpace(passage.content, 700),
      sourceUrl: passage.sourceUrl || run.document.sourceUrl || null,
      pageStart: passage.pageStart || null,
      pageEnd: passage.pageEnd || null,
      sectionId: passage.sectionId || null,
      authorityClass: passage.authorityClass || "UNKNOWN",
    }))).filter((item) => item.snippet);
  const candidateDocuments = recommendations.slice(0, 8).map((item) => ({
    documentId: String(item.id),
    title: item.title,
    documentType: item.documentType || item.type,
    jurisdiction: item.jurisdiction || item.state || null,
    authority: item.authority || item.ministry || null,
    sourceUrl: item.sourceUrl || null,
    basis: "Potentially relevant catalogue record; applicability requires verification.",
  }));
  const primaryDocumentIds = new Set(usableRuns
    .filter((run) => run.passages.some((passage) => passage.authorityClass === "PRIMARY_OFFICIAL"))
    .map((run) => String(run.document.id)));
  const primaryDocuments = candidateDocuments.filter((item) => primaryDocumentIds.has(item.documentId));
  const obligations = evidenceMatches(evidence, /\b(shall|must|required|obligation|duty|comply|maintain|submit|report)\b/i, 10);
  const permissions = evidenceMatches(evidence, /\b(registration|register|licen[cs]e|permission|permit|approval|authori[sz]ation)\b/i, 8);
  const penalties = evidenceMatches(evidence, /\b(penalt|fine|imprison|offence|liable|punish)\b/i, 6);
  const result = {
    businessProfile: input,
    knowledgeConcepts: (knowledge.concepts || []).slice(0, 12),
    potentiallyApplicableAreas: uniqueBy(candidateDocuments.map((item) => ({
      area: item.documentType || "legal or policy instrument",
      jurisdiction: item.jurisdiction,
      documentId: item.documentId,
      basis: item.basis,
    })), (item) => `${item.area}:${item.jurisdiction || ""}`),
    relevantRegulators: uniqueBy(candidateDocuments
      .filter((item) => item.authority)
      .map((item) => ({ name: item.authority, documentId: item.documentId,
        basis: "Named authority or ministry in a potentially relevant catalogue record." })),
    (item) => item.name.toLowerCase()),
    relevantPrimaryDocuments: primaryDocuments,
    candidateDocuments,
    evidenceBackedObligations: obligations,
    evidenceBackedRegistrationsPermissions: permissions,
    potentialPenalties: penalties,
    stateSpecificConsiderations: candidateDocuments.filter((item) =>
      item.jurisdiction && !/^india$/i.test(item.jurisdiction)),
    questionsRequiringProfessionalVerification: [
      "Does the cited instrument apply to the precise legal entity, activity, scale, and location?",
      "Are later amendments, exemptions, judicial decisions, or local orders relevant?",
      "Have the effective and commencement dates been verified from official sources?",
    ],
    missingEvidence: [
      !candidateDocuments.length ? "No sufficiently relevant research-ready catalogue record was found." : null,
      !primaryDocuments.length ? "No primary-official source was verified among the retrieved candidates." : null,
      !obligations.length ? "No explicit obligation passage was retrieved." : null,
      !permissions.length ? "No explicit registration, licence, permission, or approval passage was retrieved." : null,
      !penalties.length ? "No explicit penalty passage was retrieved; this is not evidence that no penalty exists." : null,
      usableRuns.length !== documentRuns.length ? "One or more candidate documents had insufficient or conflicting evidence." : null,
    ].filter(Boolean),
    evidence,
    evidenceSufficiency: documentRuns.map((run) => ({
      documentId: String(run.document.id), level: run.sufficiency.level,
      decision: run.sufficiency.decision, reasons: run.sufficiency.reasons,
    })),
    disclaimer: "Research assistance only, not legal advice. Applicability requires professional verification.",
  };
  return result;
};

const runComplianceCopilot = async (userId, payload = {}, adapters = {}) => {
  const input = validateProblemRequest({ ...payload, limit: Math.min(Number(payload.limit) || 8, 8) });
  const recommend = adapters.recommend || getProblemRecommendations;
  const discover = adapters.discover || discoverKnowledgeCandidates;
  const loadDocument = adapters.loadDocument || DocumentRepository.getById;
  const retrieve = adapters.retrieve || retrieveDocumentContext;
  const persist = adapters.persist || query;
  const [recommendationResult, knowledge] = await Promise.all([
    recommend(userId, input),
    discover([input.problem, input.industry, input.topic, ...input.states].filter(Boolean).join(" "), {
      userId, limit: 12,
    }).catch(() => ({ concepts: [], documentIds: [], evidence: [] })),
  ]);
  const recommendations = (recommendationResult.recommendations || []).slice(0, 5);
  const documentRuns = (await Promise.all(recommendations.map(async (recommendation) => {
    const document = await loadDocument(recommendation.id);
    if (!document) return null;
    const retrieval = await retrieve(
      document.documentType || document.type,
      document.id,
      `What obligations, permissions, regulators, deadlines, and penalties are relevant to this business problem: ${input.problem}`,
      { document, accountId: userId, topK: 8 },
    );
    const passages = retrieval.passages || [];
    return {
      document,
      passages,
      sufficiency: assessEvidenceSufficiency(input.problem, passages, {
        retrievalVerified: retrieval.retrievalVerified,
      }),
    };
  }))).filter(Boolean);
  const result = shapeComplianceResult({ input, recommendations, knowledge, documentRuns });
  const problemFingerprint = crypto.createHash("sha256").update(input.problem.toLowerCase()).digest("hex");
  const status = result.evidence.length ? "completed" : "insufficient_evidence";
  const inserted = await persist(
    `INSERT INTO compliance_research_runs (
       user_id, problem_fingerprint, business_profile_json, result_json,
       evidence_refs_json, status
     ) VALUES ($1, $2, $3::jsonb, $4::jsonb, $5::jsonb, $6)
     RETURNING id, created_at`,
    [userId, problemFingerprint, JSON.stringify(input), JSON.stringify({ ...result, evidence: undefined }),
      JSON.stringify(result.evidence), status],
  );
  return {
    id: String(inserted.rows?.[0]?.id || ""),
    status,
    createdAt: inserted.rows?.[0]?.created_at || new Date().toISOString(),
    recommendations,
    ...result,
  };
};

module.exports = { evidenceMatches, runComplianceCopilot, shapeComplianceResult };
