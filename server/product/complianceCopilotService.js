const crypto = require("node:crypto");
const { query } = require("../db");
const DocumentRepository = require("../document/DocumentRepository");
const { retrieveDocumentContext } = require("../document/documentResearchService");
const {
  RELEVANCE_TIERS,
  getProblemRecommendations,
  inferBusinessSignals,
  validateProblemRequest,
} = require("../document/recommendationService");
const { discoverKnowledgeCandidates } = require("../graph/knowledgeLayerService");
const { assessEvidenceSufficiency, SUFFICIENCY_LEVELS } = require("../retrieval/evidenceSafetyService");
const {
  assessCurrentVerification,
  loadDocumentSourceFreshness,
} = require("../document/temporalLegalService");

const normalizeSpace = (value, maximum = 600) => String(value || "")
  .normalize("NFKC").replace(/\s+/g, " ").trim().slice(0, maximum);

const uniqueBy = (items, key) => [...new Map(items.map((item) => [key(item), item])).values()];

const NORMATIVE_PATTERNS = Object.freeze({
  obligation: /\b(shall|must|required to|is required|duty to|has to|must file|must maintain|must submit|must report|comply with|subject to)\b/i,
  permission: /\b(registration required|register(?:ed)? with|licen[cs]e required|obtain(?:ed)? (?:a )?(?:registration|licen[cs]e|permission|permit|approval|authori[sz]ation)|prior approval|permission required)\b/i,
  prohibition: /\b(no person shall|must not|shall not|prohibited|may not)\b/i,
  deadline: /\b(within \d+ (?:day|days|month|months)|not later than|by \d{1,2}\s+\w+|before the expiry|due date)\b/i,
  penalty: /\b(penalt(?:y|ies)|fine|imprison(?:ment)?|offence|liable to|punishable)\b/i,
  exemption: /\b(exempt(?:ion|ed)?|does not apply|shall not apply)\b/i,
});

const metadataOnlyPassage = (value) => {
  const text = normalizeSpace(value, 900);
  if (!text) return true;
  const labels = (text.match(/\b(title|document type|status|source|jurisdiction|category|ministry|published|year)\s*:/gi) || []).length;
  return labels >= 3 && !Object.values(NORMATIVE_PATTERNS).some((pattern) => pattern.test(text));
};

const normativeKinds = (value) => Object.entries(NORMATIVE_PATTERNS)
  .filter(([, pattern]) => pattern.test(String(value || "")))
  .map(([kind]) => kind);

const normalizedTokens = (value) => [...new Set(String(value || "")
  .normalize("NFKC").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ")
  .split(/\s+/).filter((token) => token.length >= 4 && ![
    "business", "company", "india", "relevant", "requirement", "requirements",
  ].includes(token)))];

const evaluateCompliancePassage = (passage = {}, input = {}, recommendation = {}) => {
  const snippet = normalizeSpace(passage.content, 900);
  const kinds = normativeKinds(snippet);
  const inferred = inferBusinessSignals(input);
  const problemTokens = normalizedTokens([
    input.problem,
    ...inferred.sectors,
    ...inferred.activities,
    ...inferred.regulators,
    ...inferred.themes,
  ].join(" "));
  const passageText = snippet.toLowerCase();
  const tokenMatches = problemTokens.filter((token) => passageText.includes(token));
  const recommendationRelevant = [
    RELEVANCE_TIERS.HIGH,
    RELEVANCE_TIERS.MEDIUM,
  ].includes(recommendation.relevanceTier);
  const relevant = Boolean(
    recommendationRelevant &&
    !metadataOnlyPassage(snippet) &&
    (tokenMatches.length >= 2 ||
      (tokenMatches.length >= 1 && recommendation.relevanceTier === RELEVANCE_TIERS.HIGH)),
  );
  return {
    relevant,
    normative: relevant && kinds.length > 0,
    kinds,
    tokenMatches,
    metadataOnly: metadataOnlyPassage(snippet),
  };
};

const evidenceMatches = (evidence, expression, limit = 8) => evidence
  .filter((item) => item.passageGate?.normative && expression.test(item.snippet))
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
  ].includes(run.sufficiency.level) && [
    RELEVANCE_TIERS.HIGH,
    RELEVANCE_TIERS.MEDIUM,
  ].includes(run.recommendation?.relevanceTier));
  const evidence = usableRuns.flatMap((run, documentIndex) =>
    run.passages.slice(0, 8).map((passage, chunkIndex) => {
      const passageGate = evaluateCompliancePassage(passage, input, run.recommendation);
      return {
        id: `D${documentIndex + 1}-C${chunkIndex + 1}`,
        documentId: String(run.document.id),
        documentTitle: run.document.title,
        snippet: normalizeSpace(passage.content, 700),
        sourceUrl: passage.sourceUrl || run.document.sourceUrl || null,
        pageStart: passage.resourceType === "html" ? null : passage.pageStart || null,
        pageEnd: passage.resourceType === "html" ? null : passage.pageEnd || null,
        sectionId: passage.sectionId || passage.sourceAnchor || null,
        authorityClass: passage.authorityClass || run.recommendation.authorityClass || "UNKNOWN",
        resourceType: passage.resourceType || null,
        passageGate,
      };
    }))
    .filter((item) => item.snippet && item.passageGate.relevant);
  const candidateDocuments = recommendations.slice(0, 8).map((item) => ({
    documentId: String(item.id),
    title: item.title,
    documentType: item.documentType || item.type,
    jurisdiction: item.jurisdiction || item.state || null,
    authority: item.authority || item.ministry || null,
    sourceUrl: item.sourceUrl || null,
    relevanceTier: item.relevanceTier,
    authorityClass: item.authorityClass || "UNKNOWN",
    basis: item.reason || "Relevant catalogue record; applicability requires verification.",
  }));
  const primaryDocumentIds = new Set(usableRuns
    .filter((run) => run.passages.some((passage) =>
      (passage.authorityClass || run.recommendation?.authorityClass) === "PRIMARY_OFFICIAL"))
    .map((run) => String(run.document.id)));
  const primaryDocuments = candidateDocuments.filter((item) => primaryDocumentIds.has(item.documentId));
  const obligations = evidenceMatches(evidence, NORMATIVE_PATTERNS.obligation, 10);
  const permissions = evidenceMatches(evidence, NORMATIVE_PATTERNS.permission, 8);
  const penalties = evidenceMatches(evidence, NORMATIVE_PATTERNS.penalty, 6);
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
    operationalConsiderations: [
      obligations.length ? {
        analysis: "Possible operational impact: the cited obligations may require workflow, record-keeping, ownership, or reporting changes. The precise burden depends on verified applicability.",
        supportingCitations: obligations.slice(0, 4).flatMap((item) => item.citations),
      } : null,
      permissions.length ? {
        analysis: "Possible implementation consideration: verify registrations, permissions, and approval sequencing before changing operations.",
        supportingCitations: permissions.slice(0, 4).flatMap((item) => item.citations),
      } : null,
      penalties.length ? {
        analysis: "Risk consideration: prioritise controls around the cited penalty-triggering duties, while checking whether later amendments change the position.",
        supportingCitations: penalties.slice(0, 4).flatMap((item) => item.citations),
      } : null,
    ].filter(Boolean),
    currentApplicability: documentRuns.map((run) => ({
      documentId: String(run.document.id),
      title: run.document.title,
      ...run.currentVerification,
    })),
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
      evidence.length && !obligations.length
        ? "Relevant passages were found, but none stated an explicit obligation. Metadata and descriptive text were not converted into duties."
        : null,
    ].filter(Boolean),
    evidence,
    evidenceSufficiency: documentRuns.map((run) => ({
      documentId: String(run.document.id), level: run.sufficiency.level,
      decision: run.sufficiency.decision, reasons: run.sufficiency.reasons,
      relevanceTier: run.recommendation?.relevanceTier || RELEVANCE_TIERS.REJECTED,
    })),
    evidenceStatus: evidence.length ? "sufficient_relevant_evidence" : "insufficient_relevant_evidence",
    abstention: evidence.length
      ? null
      : "Insufficient relevant evidence. No compliance obligation has been generated.",
    primarySourceGap: candidateDocuments.length && !primaryDocuments.length
      ? "Relevant secondary material was found, but a primary official source has not yet been verified."
      : null,
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
  const recommendationResult = await recommend(userId, input);
  const hasSpecificSector = Boolean(recommendationResult.inferredSignals?.sectors?.length);
  const knowledge = adapters.discover || !hasSpecificSector
    ? await discover([input.problem, input.industry, input.topic, ...input.states].filter(Boolean).join(" "), {
      userId, limit: 12,
    }).catch(() => ({ concepts: [], documentIds: [], evidence: [] }))
    : { concepts: [], documentIds: [], evidence: [] };
  const recommendations = (recommendationResult.recommendations || [])
    .filter((item) => [RELEVANCE_TIERS.HIGH, RELEVANCE_TIERS.MEDIUM].includes(item.relevanceTier))
    .slice(0, 5);
  const documentRuns = (await Promise.all(recommendations.map(async (recommendation) => {
    const document = await loadDocument(recommendation.id);
    if (!document) return null;
    const [retrieval, sourceFreshness] = await Promise.all([
      retrieve(
      document.documentType || document.type,
      document.id,
      `What obligations, permissions, regulators, deadlines, and penalties are relevant to this business problem: ${input.problem}`,
      {
        document,
        accountId: userId,
        topK: 8,
        // Compliance pages need fast, passage-level evidence. PostgreSQL FTS
        // is attempted first and vectors are only used when lexical evidence
        // is genuinely insufficient.
        plan: {
          queryType: "COMPLIANCE",
          useMetadata: false,
          useLexical: true,
          useVector: "if_insufficient",
          useGraph: false,
          comparisonIsolation: false,
          plannerVersion: "compliance-copilot-lexical-first-v1",
        },
        freshnessRequired: true,
      },
      ),
      loadDocumentSourceFreshness(document).catch(() => ({ status: "error" })),
    ]);
    const passages = retrieval.passages || [];
    return {
      document,
      recommendation,
      passages,
      currentVerification: assessCurrentVerification({
        document,
        passages,
        freshness: sourceFreshness,
      }),
      sufficiency: assessEvidenceSufficiency(input.problem, passages, {
        retrievalVerified: retrieval.retrievalVerified,
      }),
    };
  }))).filter(Boolean);
  const result = shapeComplianceResult({
    input: recommendationResult.query || input,
    recommendations,
    knowledge,
    documentRuns,
  });
  const problemFingerprint = crypto.createHash("sha256").update(input.problem.toLowerCase()).digest("hex");
  const status = result.evidenceStatus === "sufficient_relevant_evidence"
    ? "completed"
    : "insufficient_evidence";
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
    preparationCandidates: recommendationResult.preparationCandidates || [],
    lowerConfidenceRecommendations:
      recommendationResult.lowerConfidenceRecommendations || [],
    inferredSignals: recommendationResult.inferredSignals || {},
    coverageClass: recommendationResult.coverageClass || null,
    coverageExplanation: recommendationResult.coverageExplanation || null,
    primarySourceGap:
      result.primarySourceGap || recommendationResult.primarySourceGap || null,
    abstention: recommendationResult.abstention || result.abstention || null,
  };
};

module.exports = {
  NORMATIVE_PATTERNS,
  evidenceMatches,
  evaluateCompliancePassage,
  metadataOnlyPassage,
  normativeKinds,
  runComplianceCopilot,
  shapeComplianceResult,
};
