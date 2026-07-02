const crypto = require("node:crypto");
const { query } = require("../db");
const DocumentRepository = require("./DocumentRepository");
const {
  searchAcrossIndexedDocuments,
} = require("./documentResearchService");

const TYPE_GROUPS = {
  policy: [
    "policy",
    "scheme",
    "guideline",
    "strategy_paper",
    "white_paper",
    "discussion_paper",
    "consultation_paper",
    "government_resolution",
  ],
  act: ["act"],
  bill: ["bill", "ordinance"],
  gazette: ["gazette", "notification", "rule", "regulation", "circular", "order"],
  report: ["report", "committee_report", "recommendation"],
};

const clampInteger = (value, fallback, minimum, maximum) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed)
    ? Math.min(Math.max(parsed, minimum), maximum)
    : fallback;
};

const normalizeList = (value, maximum = 10) => [
  ...new Set(
    (Array.isArray(value) ? value : String(value || "").split(","))
      .map((item) => String(item || "").normalize("NFKC").trim())
      .filter(Boolean),
  ),
].slice(0, maximum);

const normalizeTypes = (value) => {
  const requested = normalizeList(value || "all", 12)
    .map((type) => type.toLowerCase().replace(/-/g, "_"));
  if (requested.includes("all")) return [];
  return [
    ...new Set(
      requested.flatMap((type) => TYPE_GROUPS[type] || [type]),
    ),
  ].filter((type) => /^[a-z_]{2,40}$/.test(type));
};

const confidenceForScore = (score) => {
  if (score >= 0.5) return "high";
  if (score >= 0.3) return "medium";
  return "low";
};

const isRecommendationEligible = (
  document,
  { includeNonReady = false } = {},
) =>
  Boolean(
    document?.title &&
      document?.sourceUrl &&
      document.visibilityStatus !== "hidden_invalid" &&
      document.visibilityStatus !== "internal_only" &&
      Number(document.qualityScore || 0) >= 40 &&
      (includeNonReady || document.researchReady),
  );

const scoreRecommendation = (signals = {}) => {
  const points =
    (signals.relationship ? 22 : 0) +
    (signals.sameMinistry ? 14 : 0) +
    (signals.sameAuthority ? 10 : 0) +
    (signals.sameJurisdiction ? 8 : 0) +
    (signals.sameState ? 10 : 0) +
    (signals.sameCategory ? 8 : 0) +
    (signals.sameType ? 4 : 0) +
    (signals.titleMatch ? 8 : 0) +
    (signals.sharedLegalIdentifier ? 12 : 0) +
    (signals.semanticMatch ? 12 : 0) +
    (signals.profileMatch ? 5 : 0) +
    (signals.recent ? 4 : 0) +
    (signals.researchReady ? 8 : 0) +
    Math.min(Math.max(Number(signals.qualityScore || 0), 0), 100) / 10;
  return Math.min(Number((points / 135).toFixed(4)), 1);
};

const reasonFromSignals = (signals, candidate) => {
  const reasons = [];
  if (signals.relationship) reasons.push("a verified catalogue relationship");
  if (signals.sameMinistry) reasons.push("the same ministry");
  else if (signals.sameAuthority) reasons.push("the same issuing authority");
  if (signals.sameState) reasons.push(`the same state (${candidate.state})`);
  else if (signals.sameJurisdiction) reasons.push("the same jurisdiction");
  if (signals.sameCategory) reasons.push("the same policy category");
  if (signals.semanticMatch || signals.titleMatch) {
    reasons.push("closely matching subject matter");
  }
  if (signals.sharedLegalIdentifier) reasons.push("a shared legal identifier");
  if (signals.profileMatch) reasons.push("your research preferences");
  if (signals.recent) reasons.push("recent publication");
  if (!reasons.length) reasons.push("strong catalogue quality and provenance");
  return `Recommended because it has ${reasons.slice(0, 3).join(", ")}.`;
};

const getProfileSignals = async (userId, enabled = true) => {
  if (!userId || !enabled) return {};
  const result = await query(
    `SELECT preferred_ministries, preferred_policy_areas,
       preferred_jurisdictions, preferred_document_types
     FROM user_profiles
     WHERE user_id = $1`,
    [userId],
  );
  const row = result.rows[0] || {};
  return {
    ministries: normalizeList(row.preferred_ministries),
    categories: normalizeList(row.preferred_policy_areas),
    jurisdictions: normalizeList(row.preferred_jurisdictions),
    documentTypes: normalizeList(row.preferred_document_types),
  };
};

const mapCandidateSignals = (row, semanticIds, profile) => {
  const profileMatch =
    profile.ministries?.includes(row.ministry) ||
    profile.categories?.includes(row.category) ||
    profile.jurisdictions?.includes(row.jurisdiction) ||
    profile.documentTypes?.includes(row.document_type);
  const publicationTime = row.publication_date
    ? new Date(row.publication_date).getTime()
    : 0;
  const recent =
    publicationTime > 0 &&
    publicationTime >= Date.now() - 366 * 24 * 60 * 60 * 1_000;
  return {
    relationship: Boolean(row.relationship_match),
    sameMinistry: Boolean(row.same_ministry),
    sameAuthority: Boolean(row.same_authority),
    sameJurisdiction: Boolean(row.same_jurisdiction),
    sameState: Boolean(row.same_state),
    sameCategory: Boolean(row.same_category),
    sameType: Boolean(row.same_type),
    titleMatch: Boolean(row.title_match),
    sharedLegalIdentifier: Boolean(row.shared_legal_identifier),
    semanticMatch: semanticIds.has(String(row.id)),
    profileMatch: Boolean(profileMatch),
    recent,
    researchReady: Boolean(row.research_ready),
    qualityScore: Number(row.quality_score || 0),
  };
};

const recommendationType = (type) => {
  if (TYPE_GROUPS.policy.includes(type)) return "related_policy";
  if (TYPE_GROUPS.gazette.includes(type)) return "related_gazette";
  if (TYPE_GROUPS.report.includes(type)) return "related_report";
  return `related_${type || "document"}`;
};

const shapeRecommendation = (row, signals) => {
  const score = scoreRecommendation(signals);
  const candidate = {
    id: String(row.id),
    title: row.title,
    documentType: row.document_type,
    type: row.document_type,
    ministry: row.ministry,
    authority: row.authority,
    state: row.schema_state || row.metadata_json?.state || null,
    jurisdiction: row.jurisdiction,
    category: row.category,
    year: row.year,
    publicationDate: row.publication_date,
    sourceUrl: row.canonical_url || row.detail_url || row.source_url,
    pdfUrl: row.pdf_url,
    researchReady: Boolean(row.research_ready),
    readiness: row.research_ready ? "research_ready" : "pdf_available",
    qualityScore: Number(row.quality_score || 0),
    score,
    confidence: confidenceForScore(score),
    signals: Object.entries(signals)
      .filter(([, enabled]) => enabled === true)
      .map(([name]) => name),
  };
  return {
    ...candidate,
    reason: reasonFromSignals(signals, candidate),
    recommendationType: recommendationType(row.document_type),
  };
};

const persistRecommendations = async (
  userId,
  recommendations,
  context,
) => {
  if (!userId || !recommendations.length) return;
  const contextKey = context.sourceDocumentId
    ? `document:${context.sourceDocumentId}`
    : `problem:${context.problemHash}`;
  await query(
    `DELETE FROM recommendations
     WHERE user_id = $1
       AND reason_json->>'contextKey' = $2`,
    [userId, contextKey],
  );
  await Promise.all(
    recommendations.slice(0, 20).map((recommendation) =>
      query(
        `INSERT INTO recommendations (
           user_id, document_id, recommendation_type, score,
           reason_json, expires_at
         )
         VALUES ($1, $2, $3, $4, $5::jsonb, NOW() + INTERVAL '30 days')`,
        [
          userId,
          recommendation.id,
          recommendation.recommendationType,
          recommendation.score,
          JSON.stringify({
            contextKey,
            reason: recommendation.reason,
            confidence: recommendation.confidence,
            signals: recommendation.signals,
            ...context,
          }),
        ],
      ),
    ),
  );
};

const getDocumentRecommendations = async (
  documentId,
  userId,
  options = {},
) => {
  const current = await DocumentRepository.getById(documentId);
  if (!current) {
    const error = new Error("Document not found.");
    error.status = 404;
    throw error;
  }
  const limit = clampInteger(options.limit, 10, 1, 20);
  const includeNonReady =
    String(options.includeNonReady || "false").toLowerCase() === "true";
  const useUserProfile =
    String(options.useUserProfile ?? "true").toLowerCase() !== "false";
  const types = normalizeTypes(options.type);
  const profile = await getProfileSignals(userId, useUserProfile);
  let semanticIds = [];
  if (current.researchReady) {
    try {
      semanticIds = await searchAcrossIndexedDocuments(
        [current.title, current.category, current.ministry]
          .filter(Boolean)
          .join(" "),
        40,
      );
    } catch (error) {
      console.warn("Semantic recommendation signal unavailable:", error.message);
    }
  }

  const result = await query(
    `WITH current_document AS (
       SELECT *
       FROM documents
       WHERE id = $1
     )
     SELECT legacy.*, candidate.state AS schema_state,
       candidate.research_ready, candidate.quality_score,
       candidate.visibility_status, candidate.metadata_json,
       (candidate.ministry IS NOT NULL
         AND candidate.ministry = current.ministry) AS same_ministry,
       (candidate.authority IS NOT NULL
         AND candidate.authority = current.authority) AS same_authority,
       (candidate.jurisdiction IS NOT NULL
         AND candidate.jurisdiction = current.jurisdiction) AS same_jurisdiction,
       (candidate.state IS NOT NULL
         AND candidate.state = current.state) AS same_state,
       (candidate.category IS NOT NULL
         AND candidate.category = current.category) AS same_category,
       (candidate.document_type = current.document_type) AS same_type,
       (
         TO_TSVECTOR('simple', COALESCE(candidate.title, '')) @@
         PLAINTO_TSQUERY('simple', current.title)
       ) AS title_match,
       (candidate.legal_identifier IS NOT NULL
         AND candidate.legal_identifier = current.legal_identifier)
         AS shared_legal_identifier,
       EXISTS (
         SELECT 1 FROM document_relationships relationship
         WHERE (
           relationship.from_document_id = current.id
           AND relationship.to_document_id = candidate.id
         ) OR (
           relationship.to_document_id = current.id
           AND relationship.from_document_id = candidate.id
         )
       ) AS relationship_match
     FROM documents candidate
     JOIN legislative_documents legacy ON legacy.id = candidate.id
     CROSS JOIN current_document current
     WHERE candidate.id <> current.id
       AND candidate.visibility_status = 'public'
       AND candidate.quality_score >= 40
       AND candidate.title IS NOT NULL
       AND candidate.canonical_url IS NOT NULL
       AND ($2::BOOLEAN OR candidate.research_ready)
       AND (CARDINALITY($3::TEXT[]) = 0
         OR candidate.document_type = ANY($3::TEXT[]))
       AND NOT (
         candidate.normalized_title = current.normalized_title
         AND candidate.document_type = current.document_type
         AND COALESCE(candidate.year, 0) = COALESCE(current.year, 0)
         AND COALESCE(candidate.jurisdiction, '') =
           COALESCE(current.jurisdiction, '')
       )
     ORDER BY candidate.quality_score DESC,
       candidate.research_ready DESC,
       candidate.publication_date DESC NULLS LAST
     LIMIT $4`,
    [current.id, includeNonReady, types, Math.max(limit * 5, 30)],
  );
  const semanticSet = new Set(semanticIds);
  const recommendations = result.rows
    .map((row) => {
      const signals = mapCandidateSignals(row, semanticSet, profile);
      return shapeRecommendation(row, signals);
    })
    .filter(
      (item) =>
        item.score >= 0.18 &&
        isRecommendationEligible(item, { includeNonReady }),
    )
    .sort((left, right) => right.score - left.score)
    .slice(0, limit);
  await persistRecommendations(userId, recommendations, {
    sourceDocumentId: String(current.id),
  });
  return recommendations;
};

const validateProblemRequest = (payload = {}) => {
  const problem = String(payload.problem || "").normalize("NFKC").trim();
  if (problem.length < 12 || problem.length > 2_000) {
    const error = new Error(
      "Describe the business or policy problem in 12 to 2,000 characters.",
    );
    error.status = 400;
    throw error;
  }
  return {
    problem,
    industry: String(payload.industry || "").normalize("NFKC").trim().slice(0, 120),
    states: normalizeList(payload.states, 10),
    companySize: String(payload.companySize || "").trim().slice(0, 80),
    topic: String(payload.topic || "").normalize("NFKC").trim().slice(0, 160),
    documentTypes: normalizeTypes(payload.documentTypes),
    limit: clampInteger(payload.limit, 20, 1, 20),
  };
};

const getProblemRecommendations = async (userId, payload) => {
  const input = validateProblemRequest(payload);
  const searchText = [
    input.problem,
    input.industry,
    input.topic,
    ...input.states,
  ].filter(Boolean).join(" ");
  const result = await query(
    `SELECT legacy.*, candidate.state AS schema_state,
       candidate.research_ready, candidate.quality_score,
       candidate.visibility_status, candidate.metadata_json,
       TS_RANK_CD(
         candidate.search_vector,
         WEBSEARCH_TO_TSQUERY('simple', $1)
       ) AS problem_rank,
       (candidate.state = ANY($2::TEXT[])
         OR candidate.jurisdiction = ANY($2::TEXT[])) AS state_match,
       (
         $3::TEXT <> '' AND (
           candidate.category ILIKE '%' || $3 || '%'
           OR candidate.title ILIKE '%' || $3 || '%'
           OR candidate.metadata_json::TEXT ILIKE '%' || $3 || '%'
         )
       ) AS industry_match
     FROM documents candidate
     JOIN legislative_documents legacy ON legacy.id = candidate.id
     WHERE candidate.visibility_status = 'public'
       AND candidate.research_ready
       AND candidate.quality_score >= 50
       AND candidate.title IS NOT NULL
       AND candidate.canonical_url IS NOT NULL
       AND (CARDINALITY($4::TEXT[]) = 0
         OR candidate.document_type = ANY($4::TEXT[]))
       AND (
         candidate.search_vector @@ WEBSEARCH_TO_TSQUERY('simple', $1)
         OR candidate.state = ANY($2::TEXT[])
         OR candidate.jurisdiction = ANY($2::TEXT[])
         OR ($3::TEXT <> '' AND (
           candidate.category ILIKE '%' || $3 || '%'
           OR candidate.title ILIKE '%' || $3 || '%'
         ))
       )
     ORDER BY problem_rank DESC,
       state_match DESC,
       industry_match DESC,
       candidate.quality_score DESC,
       candidate.publication_date DESC NULLS LAST
     LIMIT $5`,
    [
      searchText,
      input.states,
      input.industry,
      input.documentTypes,
      Math.max(input.limit * 3, 30),
    ],
  );
  const recommendations = result.rows
    .map((row) => {
      const signals = {
        sameJurisdiction: Boolean(row.state_match),
        sameState: Boolean(row.state_match),
        sameCategory: Boolean(row.industry_match),
        titleMatch: Number(row.problem_rank || 0) > 0,
        researchReady: true,
        qualityScore: Number(row.quality_score || 0),
        recent:
          row.publication_date &&
          new Date(row.publication_date).getTime() >=
            Date.now() - 366 * 24 * 60 * 60 * 1_000,
      };
      const recommendation = shapeRecommendation(row, signals);
      return {
        ...recommendation,
        reason: `Relevant to the described problem because ${[
          row.state_match ? "its jurisdiction matches the selected states" : "",
          row.industry_match ? "its subject matches the stated industry" : "",
          Number(row.problem_rank || 0) > 0
            ? "its indexed catalogue text matches the problem"
            : "",
        ].filter(Boolean).join(" and ")}.`,
      };
    })
    .sort((left, right) => right.score - left.score)
    .slice(0, input.limit);
  const problemHash = crypto
    .createHash("sha256")
    .update(JSON.stringify(input))
    .digest("hex")
    .slice(0, 24);
  await persistRecommendations(userId, recommendations, {
    problemHash,
    industry: input.industry || null,
    states: input.states,
  });
  const complianceThemes = [
    ...new Set(
      recommendations.flatMap((item) =>
        [item.category, item.ministry, item.documentType].filter(Boolean),
      ),
    ),
  ].slice(0, 8);
  return {
    query: input,
    recommendations,
    complianceThemes,
    suggestedQuestions: recommendations.slice(0, 4).map((document) =>
      `What obligations or implementation requirements in ${document.title} are relevant to this problem?`,
    ),
    disclaimer: "Rashtram AI provides research assistance, not legal advice.",
  };
};

const getRecentRecommendations = async (userId, limit = 12) => {
  const safeLimit = clampInteger(limit, 12, 1, 30);
  const result = await query(
    `WITH ranked AS (
       SELECT
         recommendation.id AS recommendation_id,
         recommendation.document_id,
         recommendation.score,
         recommendation.recommendation_type,
         recommendation.reason_json,
         recommendation.created_at AS recommended_at,
         ROW_NUMBER() OVER (
           PARTITION BY recommendation.document_id
           ORDER BY recommendation.created_at DESC
         ) AS recommendation_rank
       FROM recommendations recommendation
       WHERE recommendation.user_id = $1
         AND (recommendation.expires_at IS NULL
           OR recommendation.expires_at > NOW())
     )
     SELECT ranked.recommendation_id, ranked.score,
       ranked.recommendation_type, ranked.reason_json,
       ranked.recommended_at, legacy.*, document.state AS schema_state,
       document.research_ready, document.quality_score,
       document.visibility_status, document.metadata_json
     FROM ranked
     JOIN documents document ON document.id = ranked.document_id
     JOIN legislative_documents legacy ON legacy.id = document.id
     WHERE ranked.recommendation_rank = 1
       AND document.visibility_status = 'public'
       AND document.research_ready
       AND document.quality_score >= 40
     ORDER BY ranked.recommended_at DESC
     LIMIT $2`,
    [userId, safeLimit],
  );
  return result.rows
    .map((row) => ({
      id: String(row.id),
      recommendationId: String(row.recommendation_id),
      title: row.title,
      documentType: row.document_type,
      type: row.document_type,
      ministry: row.ministry,
      authority: row.authority,
      state: row.schema_state || row.metadata_json?.state || null,
      jurisdiction: row.jurisdiction,
      year: row.year,
      publicationDate: row.publication_date,
      sourceUrl: row.canonical_url || row.detail_url || row.source_url,
      pdfUrl: row.pdf_url,
      researchReady: true,
      readiness: "research_ready",
      qualityScore: Number(row.quality_score || 0),
      score: Number(row.score || 0),
      confidence:
        row.reason_json?.confidence ||
        confidenceForScore(Number(row.score || 0)),
      reason:
        row.reason_json?.reason ||
        "Recommended from your recent research context.",
      signals: row.reason_json?.signals || [],
      recommendationType: row.recommendation_type,
      recommendedAt: row.recommended_at,
    }))
    .sort(
      (left, right) =>
        new Date(right.recommendedAt).getTime() -
        new Date(left.recommendedAt).getTime(),
    )
    .slice(0, safeLimit);
};

module.exports = {
  confidenceForScore,
  getDocumentRecommendations,
  getProblemRecommendations,
  getRecentRecommendations,
  isRecommendationEligible,
  normalizeTypes,
  scoreRecommendation,
  validateProblemRequest,
};
