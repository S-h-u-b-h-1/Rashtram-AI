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
      requested.flatMap((type) => {
        if (["state_bill", "state_bills"].includes(type)) return ["bill"];
        if (["state_act", "state_acts"].includes(type)) return ["act"];
        return TYPE_GROUPS[type] || [type];
      }),
    ),
  ].filter((type) => /^[a-z_]{2,40}$/.test(type));
};

const stateOnlyRequested = (value) =>
  normalizeList(value || "all", 12)
    .map((type) => type.toLowerCase().replace(/-/g, "_"))
    .some((type) =>
      ["state_bill", "state_bills", "state_act", "state_acts"].includes(type),
    );

const RELEVANCE_TIERS = Object.freeze({
  HIGH: "HIGH_RELEVANCE",
  MEDIUM: "MEDIUM_RELEVANCE",
  LOW: "LOW_RELEVANCE",
  REJECTED: "REJECTED",
});

const COMPLIANCE_COVERAGE_CLASSES = Object.freeze({
  RETRIEVAL_GAP: "A_RETRIEVAL_GAP",
  PREPARATION_REQUIRED: "B_PREPARATION_REQUIRED",
  SECONDARY_ONLY: "C_SECONDARY_ONLY",
  PRIMARY_SOURCE_MISSING: "D_PRIMARY_SOURCE_MISSING",
  TOO_BROAD: "E_TOO_BROAD_OR_UNSUPPORTED",
});

const INDIA_STATES = [
  "andhra pradesh", "arunachal pradesh", "assam", "bihar", "chhattisgarh",
  "goa", "gujarat", "haryana", "himachal pradesh", "jharkhand", "karnataka",
  "kerala", "madhya pradesh", "maharashtra", "manipur", "meghalaya", "mizoram",
  "nagaland", "odisha", "punjab", "rajasthan", "sikkim", "tamil nadu",
  "telangana", "tripura", "uttar pradesh", "uttarakhand", "west bengal",
  "delhi", "jammu and kashmir", "ladakh", "puducherry", "chandigarh",
];

const BUSINESS_DOMAINS = Object.freeze([
  {
    sector: "financial services",
    terms: ["nbfc", "digital lending", "loan", "fintech", "banking", "credit"],
    expansions: ["RBI", "digital lending", "NBFC registration", "fair practices", "KYC"],
    regulators: ["Reserve Bank of India", "RBI"],
    themes: ["licensing", "consumer protection", "reporting"],
    anchors: ["nbfc", "digital lending", "loan", "fintech"],
    anchorClauses: [["nbfc", "digital lending", "fintech"]],
    regulatoryAnchors: ["rbi", "registration", "kyc", "fair practices", "consumer protection", "direction", "guideline", "regulation"],
  },
  {
    sector: "environment and recycling",
    terms: ["battery recycling", "battery waste", "recycling", "hazardous waste", "epr"],
    expansions: ["battery waste", "EPR", "pollution control", "CPCB", "state pollution control board"],
    regulators: ["CPCB", "Pollution Control Board"],
    themes: ["environmental permission", "waste management", "extended producer responsibility"],
    anchors: ["battery", "recycling", "battery waste", "epr"],
    anchorClauses: [["battery", "battery waste"], ["recycling", "epr"]],
    regulatoryAnchors: ["epr", "waste", "pollution", "cpcb", "rule", "registration", "environment"],
  },
  {
    sector: "food manufacturing",
    terms: ["food manufacturing", "food processing", "food business", "fssai"],
    expansions: ["FSSAI", "food business licence", "food safety", "factory", "labour"],
    regulators: ["FSSAI", "Food Safety and Standards Authority of India"],
    themes: ["food licence", "safety", "labour", "factory permissions"],
    anchors: ["food", "fssai", "food safety"],
    anchorClauses: [["food", "fssai"], ["manufacturing", "licence", "license", "factory", "fssai"]],
    regulatoryAnchors: ["fssai", "food safety", "licence", "license", "factory", "labour", "regulation"],
  },
  {
    sector: "insurance",
    terms: ["insurance intermediary", "insurance brokerage", "insurance broker", "insurer"],
    expansions: ["IRDAI", "insurance intermediary", "broker registration", "conduct requirements"],
    regulators: ["IRDAI", "Insurance Regulatory and Development Authority of India"],
    themes: ["registration", "conduct", "reporting"],
    anchors: ["insurance", "irdai", "broker"],
    anchorClauses: [["insurance", "irdai"], ["broker", "brokerage", "intermediary", "irdai"]],
    regulatoryAnchors: ["irdai", "registration", "regulation", "conduct", "reporting", "licence", "license"],
  },
  {
    sector: "digital services and data",
    terms: ["saas", "digital platform", "personal data", "data protection", "customer data"],
    expansions: ["Digital Personal Data Protection", "data fiduciary", "consent", "data breach"],
    regulators: ["Data Protection Board"],
    themes: ["data protection", "consent", "security", "breach response"],
    anchors: ["saas", "personal data", "data protection", "data fiduciary"],
    anchorClauses: [["personal data", "data protection", "data fiduciary", "digital personal data"]],
    regulatoryAnchors: ["digital personal data protection", "consent", "breach", "data fiduciary", "rule", "act"],
  },
  {
    sector: "manufacturing",
    terms: ["manufacturing", "factory", "industrial unit", "plant"],
    expansions: ["Factories Act", "factory licence", "pollution consent", "labour compliance"],
    regulators: ["Factory Inspectorate", "Pollution Control Board"],
    themes: ["factory permissions", "worker safety", "environmental permission"],
    anchors: ["manufacturing", "factory", "industrial unit"],
  },
  {
    sector: "logistics and transport",
    terms: ["logistics", "transport", "warehouse", "trucking", "goods carriage"],
    expansions: ["motor vehicles", "goods carriage permit", "warehouse registration", "transport licence"],
    regulators: ["Transport Department", "Regional Transport Office"],
    themes: ["transport permits", "vehicle compliance", "warehousing"],
    anchors: ["logistics", "transport", "warehouse", "goods carriage"],
  },
  {
    sector: "professional and tax services",
    terms: ["chartered accountant", "accounting firm", "tax practice", "professional services"],
    expansions: ["GST", "income tax", "professional tax", "tax practitioner"],
    regulators: ["Central Board of Direct Taxes", "Central Board of Indirect Taxes and Customs"],
    themes: ["taxation", "registration", "filing and reporting"],
    anchors: ["chartered accountant", "tax practice", "gst", "income tax"],
  },
]);

const normalizeProblemText = (value) => String(value || "")
  .normalize("NFKC")
  .toLowerCase()
  .replace(/[^\p{L}\p{N}]+/gu, " ")
  .replace(/\s+/g, " ")
  .trim();

const includesNormalizedTerm = (text, term) => {
  const haystack = ` ${normalizeProblemText(text)} `;
  const needle = normalizeProblemText(term);
  return Boolean(needle && haystack.includes(` ${needle} `));
};

const meaningfulTokens = (value) => {
  const ignored = new Set([
    "about", "across", "business", "company", "india", "need", "policy",
    "relevant", "requirement", "requirements", "research", "run", "starting",
    "understand", "what", "which", "with", "would",
  ]);
  return [...new Set(normalizeProblemText(value).split(" "))]
    .filter((token) => token.length >= 3 && !ignored.has(token));
};

const inferBusinessSignals = (input = {}) => {
  const combined = [input.problem, input.industry, input.topic, ...(input.states || [])]
    .filter(Boolean)
    .join(" ");
  const normalized = normalizeProblemText(combined);
  let domains = BUSINESS_DOMAINS.filter((domain) =>
    domain.terms.some((term) => normalized.includes(normalizeProblemText(term))),
  );
  if (domains.some((domain) => domain.sector === "food manufacturing")) {
    domains = domains.filter((domain) => domain.sector !== "manufacturing");
  }
  const jurisdictions = [
    ...new Set([
      ...(input.states || []),
      ...INDIA_STATES.filter((state) => normalized.includes(state)).map((state) =>
        state.replace(/\b\w/g, (letter) => letter.toUpperCase())),
    ]),
  ];
  return {
    sectors: [...new Set(domains.map((domain) => domain.sector))],
    activities: [...new Set(domains.flatMap((domain) => domain.terms)
      .filter((term) => normalized.includes(normalizeProblemText(term))))],
    jurisdictions,
    regulators: [...new Set(domains.flatMap((domain) => domain.regulators))],
    themes: [...new Set(domains.flatMap((domain) => domain.themes))],
    expansions: [...new Set(domains.flatMap((domain) => domain.expansions))],
    anchorGroups: domains.map((domain) => domain.anchors || domain.terms),
    anchorClauseGroups: domains.map((domain) => domain.anchorClauses || [domain.anchors || domain.terms]),
    regulatoryAnchorGroups: domains.map((domain) => domain.regulatoryAnchors || domain.themes),
    tokens: meaningfulTokens(combined),
    needsSpecificity:
      domains.length === 0 && meaningfulTokens(combined).length < 3,
  };
};

const authorityWeight = (row = {}) => {
  const tier = String(row.source_authority_tier || "").toUpperCase();
  const source = normalizeProblemText(
    [row.canonical_source, row.canonical_url, row.source_url, row.detail_url,
      row.source_name, row.authority, row.ministry].join(" "),
  );
  if (/policyedge|policy edge/.test(source)) {
    return { score: 0.35, class: "SECONDARY_RESEARCH" };
  }
  if (/adb|world bank|worldbank|who|oecd|imf|university|institute/.test(source)) {
    return { score: 0.65, class: "INSTITUTIONAL" };
  }
  if (tier === "A" || tier === "PRIMARY_OFFICIAL" || /india code|gazette|rbi|sebi|irdai|gov in|ministry/.test(source)) {
    return { score: 1, class: "PRIMARY_OFFICIAL" };
  }
  if (tier === "B" || tier === "OFFICIAL_SECONDARY") {
    return { score: 0.85, class: "OFFICIAL_SECONDARY" };
  }
  if (tier === "C" || tier === "INSTITUTIONAL") {
    return { score: 0.65, class: "INSTITUTIONAL" };
  }
  if (tier === "D" || tier === "RESEARCH") {
    return { score: 0.35, class: "SECONDARY_RESEARCH" };
  }
  return { score: 0.55, class: tier || "UNKNOWN" };
};

const complianceDocumentTypeWeight = (type) => {
  const normalized = String(type || "").toLowerCase();
  if (["act", "rule", "regulation", "notification", "circular", "order"].includes(normalized)) return 1;
  if (["policy", "guideline", "government_resolution"].includes(normalized)) return 0.75;
  if (["scheme", "gazette"].includes(normalized)) return 0.65;
  if (["report", "committee_report", "recommendation"].includes(normalized)) return 0.35;
  return 0.45;
};

const evaluateBusinessCandidate = (row = {}, input = {}, inferred = inferBusinessSignals(input)) => {
  const candidateText = normalizeProblemText([
    row.title, row.category, row.ministry, row.authority, row.jurisdiction,
    row.schema_state, row.document_type,
  ].filter(Boolean).join(" "));
  const titleText = normalizeProblemText(row.title);
  const tokenMatches = inferred.tokens.filter((token) => candidateText.includes(token));
  const titleMatches = inferred.tokens.filter((token) => titleText.includes(token));
  const domainTokens = [...new Set([...inferred.activities, ...inferred.expansions]
    .flatMap(meaningfulTokens))];
  const domainTokenMatches = domainTokens.filter((token) => candidateText.includes(token));
  const sectorMatch = inferred.sectors.some((sector) =>
    meaningfulTokens(sector).some((token) => candidateText.includes(token)),
  );
  const activityMatch = inferred.activities.some((activity) =>
    meaningfulTokens(activity).every((token) => candidateText.includes(token)),
  );
  const themeMatch = inferred.themes.some((theme) =>
    meaningfulTokens(theme).some((token) => candidateText.includes(token)),
  );
  const regulatorMatch = inferred.regulators.some((regulator) => {
    const regulatorTokens = meaningfulTokens(regulator)
      .filter((token) => !["authority", "board", "department"].includes(token));
    const required = regulatorTokens.length <= 1 ? 1 : 2;
    return regulatorTokens.filter((token) => candidateText.includes(token)).length >= required;
  });
  const candidateState = normalizeProblemText(row.schema_state || row.jurisdiction);
  const requestedStates = inferred.jurisdictions.map(normalizeProblemText);
  const explicitState = requestedStates.length > 0;
  const isNational = !candidateState || /india|national|central|union/.test(candidateState);
  const jurisdictionMatch = !explicitState || isNational || requestedStates.some((state) =>
    candidateState.includes(state) || state.includes(candidateState),
  );
  const jurisdictionMismatch = explicitState && !jurisdictionMatch;
  const lexicalMatch = Number(row.problem_rank || 0) > 0;
  const semanticMatch = Boolean(row.semantic_match);
  const domainAnchorMatch = inferred.sectors.length === 0 ||
    (inferred.anchorClauseGroups || []).some((clauses) => clauses.every((alternatives) =>
      alternatives.some((anchor) => {
        const anchorText = normalizeProblemText(anchor);
        return anchorText && includesNormalizedTerm(candidateText, anchorText);
      })));
  const titleAnchorMatch = inferred.sectors.length === 0 ||
    (inferred.anchorClauseGroups || []).some((clauses) => clauses.every((alternatives) =>
      alternatives.some((anchor) => includesNormalizedTerm(titleText, anchor))));
  const regulatoryAnchorMatch = inferred.sectors.length === 0 ||
    (inferred.regulatoryAnchorGroups || []).some((group) => group.some((anchor) => {
      const anchorText = normalizeProblemText(anchor);
      return anchorText && includesNormalizedTerm(candidateText, anchorText);
    }));
  const authority = authorityWeight(row);
  const strongDomainAnchor = domainAnchorMatch &&
    (authority.class === "PRIMARY_OFFICIAL" || titleAnchorMatch);
  const typeWeight = complianceDocumentTypeWeight(row.document_type);
  const dimensions = [
    sectorMatch, activityMatch, themeMatch, regulatorMatch,
    tokenMatches.length >= 2, titleMatches.length >= 1,
    lexicalMatch, semanticMatch,
  ].filter(Boolean).length;
  const score = Math.max(0, Math.min(1,
    (Math.min(tokenMatches.length, 5) / 5) * 0.2 +
    (Math.min(titleMatches.length, 3) / 3) * 0.2 +
    (sectorMatch ? 0.1 : 0) +
    (activityMatch ? 0.12 : 0) +
    (themeMatch ? 0.08 : 0) +
    (regulatorMatch ? 0.1 : 0) +
    (lexicalMatch ? 0.08 : 0) +
    (semanticMatch ? 0.08 : 0) +
    (jurisdictionMatch ? 0.08 : -0.35) +
    authority.score * 0.03 + typeWeight * 0.03
  ));
  let tier = RELEVANCE_TIERS.REJECTED;
  if (!jurisdictionMismatch && strongDomainAnchor && regulatoryAnchorMatch && dimensions >= 3 && score >= 0.58) tier = RELEVANCE_TIERS.HIGH;
  else if (!jurisdictionMismatch && strongDomainAnchor && regulatoryAnchorMatch && dimensions >= 2 && score >= 0.38) tier = RELEVANCE_TIERS.MEDIUM;
  else if (!jurisdictionMismatch && dimensions >= 1 && score >= 0.2) tier = RELEVANCE_TIERS.LOW;
  const matchReasons = [
    sectorMatch ? `sector: ${inferred.sectors.join(", ")}` : null,
    activityMatch ? `activity: ${inferred.activities.join(", ")}` : null,
    regulatorMatch ? `regulator: ${inferred.regulators.join(", ")}` : null,
    themeMatch ? `theme: ${inferred.themes.join(", ")}` : null,
    explicitState && jurisdictionMatch ? `jurisdiction: ${inferred.jurisdictions.join(", ")}` : null,
    lexicalMatch || semanticMatch ? "indexed evidence matches the problem" : null,
  ].filter(Boolean);
  return {
    tier,
    score: Number(score.toFixed(4)),
    dimensions,
    jurisdictionMatch,
    jurisdictionMismatch,
    sectorMatch,
    activityMatch,
    themeMatch,
    regulatorMatch,
    lexicalMatch,
    semanticMatch,
    domainAnchorMatch,
    titleAnchorMatch,
    strongDomainAnchor,
    regulatoryAnchorMatch,
    domainTokenMatches,
    authorityClass: authority.class,
    authorityScore: authority.score,
    documentTypeScore: typeWeight,
    matchReasons,
  };
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
    (signals.sameDepartment ? 8 : 0) +
    (signals.sameJurisdiction ? 8 : 0) +
    (signals.sameState ? 10 : 0) +
    (signals.sameCategory ? 8 : 0) +
    (signals.sameType ? 4 : 0) +
    (signals.sameYear ? 5 : 0) +
    (signals.titleMatch ? 8 : 0) +
    (signals.sharedLegalIdentifier ? 12 : 0) +
    (signals.semanticMatch ? 12 : 0) +
    (signals.summaryMatch ? 12 : 0) +
    (signals.profileMatch ? 5 : 0) +
    (signals.recent ? 4 : 0) +
    (signals.researchReady ? 8 : 0) +
    (signals.comparisonReady ? 4 : 0) +
    Math.min(Math.max(Number(signals.popularity || 0), 0), 20) / 4 +
    Math.min(Math.max(Number(signals.qualityScore || 0), 0), 100) / 10;
  return Math.min(Number((points / 145).toFixed(4)), 1);
};

const DOCUMENT_TITLE_STOP_WORDS = new Set([
  "act", "amendment", "bill", "central", "draft", "india", "law", "laws",
  "ordinance", "regulation", "regulations", "rule", "rules", "second",
  "state", "the", "union", "territory",
]);

const DOCUMENT_SUMMARY_STOP_WORDS = new Set([
  ...DOCUMENT_TITLE_STOP_WORDS,
  "according", "affected", "authority", "chapter", "document", "government",
  "implementation", "including", "institution", "ministry", "persons",
  "provision", "provisions", "public", "section", "shall", "summary",
  "under", "using", "year",
]);

const hasDocumentTitleSubjectOverlap = (leftTitle, rightTitle) => {
  const subjectTokens = (title) => meaningfulTokens(title).filter(
    (token) => !DOCUMENT_TITLE_STOP_WORDS.has(token) && !/^\d{4}$/.test(token),
  );
  const left = new Set(subjectTokens(leftTitle));
  const right = new Set(subjectTokens(rightTitle));
  if (left.size < 2 || right.size < 2) return false;
  const shared = [...left].filter((token) => right.has(token)).length;
  return shared >= 2 && shared / Math.min(left.size, right.size) >= 0.5;
};

const hasDocumentSummarySubjectOverlap = (leftSummary, rightSummary) => {
  const subjectTokens = (summary) => meaningfulTokens(String(summary || "").slice(0, 4_000))
    .filter((token) =>
      !DOCUMENT_SUMMARY_STOP_WORDS.has(token) &&
      !/^\d+$/.test(token),
    );
  const left = new Set(subjectTokens(leftSummary));
  const right = new Set(subjectTokens(rightSummary));
  if (left.size < 8 || right.size < 8) return false;
  const shared = [...left].filter((token) => right.has(token)).length;
  return shared >= 6 && shared / Math.min(left.size, right.size) >= 0.12;
};

// Broad catalogue metadata is useful for ranking, but it must never be enough
// to establish that two documents discuss the same subject.
const hasSubstantiveRecommendationAffinity = (signals = {}) => {
  const sameIssuer = Boolean(
    signals.sameMinistry || signals.sameAuthority || signals.sameDepartment,
  );
  const sameSubject = Boolean(
    signals.sameCategory || signals.semanticMatch || signals.summaryMatch,
  );
  return Boolean(
    signals.sharedLegalIdentifier ||
      signals.titleMatch ||
      (signals.semanticMatch && (sameIssuer || sameSubject)) ||
      (signals.summaryMatch && (sameIssuer || signals.sameCategory || signals.sameType)),
  );
};

const reasonFromSignals = (signals, candidate) => {
  const reasons = [];
  if (signals.relationshipType) {
    reasons.push(
      `a catalogue ${signals.relationshipType.replaceAll("_", " ")} signal`,
    );
  } else if (signals.relationship) {
    reasons.push("a catalogue relationship signal");
  }
  if (signals.sameMinistry) reasons.push("the same ministry");
  if (signals.sameDepartment) reasons.push("the same department");
  else if (signals.sameAuthority) reasons.push("the same issuing authority");
  if (signals.sameState) reasons.push(`the same state (${candidate.state})`);
  else if (signals.sameJurisdiction) reasons.push("the same jurisdiction");
  if (signals.sameCategory) reasons.push("the same policy category");
  if (signals.semanticMatch || signals.titleMatch || signals.summaryMatch) {
    reasons.push("closely matching subject matter");
  }
  if (signals.sharedLegalIdentifier) reasons.push("a shared legal identifier");
  if (signals.sameYear) reasons.push("the same legislative year");
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

const mapCandidateSignals = (row, semanticIds, profile, current) => {
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
    relationshipType: row.relationship_type || null,
    relationshipExplanation: row.relationship_explanation || null,
    sameMinistry: Boolean(row.same_ministry),
    sameAuthority: Boolean(row.same_authority),
    sameDepartment: Boolean(row.same_department),
    sameJurisdiction: Boolean(row.same_jurisdiction),
    sameState: Boolean(row.same_state),
    sameCategory: Boolean(row.same_category),
    sameType: Boolean(row.same_type),
    sameYear: Boolean(row.same_year),
    titleMatch:
      Boolean(row.title_match) ||
      hasDocumentTitleSubjectOverlap(current?.title, row.title),
    sharedLegalIdentifier: Boolean(row.shared_legal_identifier),
    semanticMatch: semanticIds.has(String(row.id)),
    summaryMatch: hasDocumentSummarySubjectOverlap(
      row.current_summary,
      row.candidate_summary,
    ),
    profileMatch: Boolean(profileMatch),
    recent,
    researchReady: Boolean(row.research_ready),
    comparisonReady: Boolean(row.comparison_ready),
    popularity: Number(row.popularity || 0),
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
    status: row.status || null,
    publicationDate: row.publication_date,
    sourceUrl: row.canonical_url || row.detail_url || row.source_url,
    pdfUrl: row.pdf_url,
    researchReady: Boolean(row.research_ready),
    comparisonReady: Boolean(row.comparison_ready),
    hasAccessibleResource: Boolean(row.has_accessible_resource),
    processingStatus: row.processing_status || null,
    extractionStatus: row.extraction_status || null,
    embeddingStatus: row.embedding_status || null,
    chunksCount: Number(row.chunks_count || 0),
    embeddingsCount: Number(row.embeddings_count || 0),
    readinessClass: row.readiness_class || null,
    readinessReason: row.readiness_reason || null,
    readiness: row.research_ready ? "research_ready" : "pdf_available",
    qualityScore: Number(row.quality_score || 0),
    score,
    confidence: confidenceForScore(score),
    signals: Object.entries(signals)
      .filter(([, enabled]) => enabled === true)
      .map(([name]) => name),
    graphRelationship: signals.relationshipType
      ? {
          type: signals.relationshipType,
          explanation: signals.relationshipExplanation,
        }
      : null,
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
    : context.comparisonSelection
      ? `comparison:${context.comparisonSelection.join(":")}`
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
  const stateOnly = stateOnlyRequested(options.type);
  const profile = await getProfileSignals(userId, useUserProfile);
  let semanticIds = [];
  if (current.researchReady) {
    try {
      semanticIds = await searchAcrossIndexedDocuments(
        [options.query, current.title, current.category, current.ministry]
          .filter(Boolean)
          .join(" "),
        40,
        { userId },
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
       candidate.comparison_ready,
       candidate.visibility_status, candidate.metadata_json,
       state.processing_status, state.extraction_status,
       state.embedding_status, state.chunks_count, state.embeddings_count,
       state.readiness_class, state.readiness_reason,
       COALESCE(
         current_artifact.english_summary,
         current_legacy.source_metadata ->> 'summary',
         current_legacy.source_metadata ->> 'description',
         current_legacy.source_metadata ->> 'abstract'
       ) AS current_summary,
       COALESCE(
         candidate_artifact.english_summary,
         legacy.source_metadata ->> 'summary',
         legacy.source_metadata ->> 'description',
         legacy.source_metadata ->> 'abstract'
       ) AS candidate_summary,
       EXISTS (
         SELECT 1 FROM document_resources resource
         WHERE resource.document_id = candidate.id
           AND resource.resource_type IN ('pdf', 'text', 'html')
           AND resource.is_accessible
       ) AS has_accessible_resource,
       (candidate.ministry IS NOT NULL
         AND candidate.ministry = current.ministry) AS same_ministry,
       (candidate.authority IS NOT NULL
         AND candidate.authority = current.authority) AS same_authority,
       (candidate.department IS NOT NULL
         AND candidate.department = current.department) AS same_department,
       (candidate.jurisdiction IS NOT NULL
         AND candidate.jurisdiction = current.jurisdiction) AS same_jurisdiction,
       (candidate.state IS NOT NULL
         AND candidate.state = current.state) AS same_state,
       (candidate.category IS NOT NULL
         AND candidate.category = current.category
         AND LOWER(candidate.category) NOT IN (
           'other', 'general', 'uncategorized', 'miscellaneous'
         )) AS same_category,
       (candidate.document_type = current.document_type) AS same_type,
       (candidate.year IS NOT NULL
         AND candidate.year = current.year) AS same_year,
       (
         SELECT COALESCE(SUM(interaction.count), 0)::INTEGER
         FROM user_document_interactions interaction
         WHERE interaction.document_id = candidate.id
       ) AS popularity,
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
       ) AS relationship_match,
       (
         SELECT relationship.relationship_type
         FROM document_relationships relationship
         WHERE (
           relationship.from_document_id = current.id
           AND relationship.to_document_id = candidate.id
         ) OR (
           relationship.to_document_id = current.id
           AND relationship.from_document_id = candidate.id
         )
         ORDER BY COALESCE(
           relationship.relationship_strength,
           relationship.confidence,
           0
         ) DESC
         LIMIT 1
       ) AS relationship_type,
       (
         SELECT relationship.explanation
         FROM document_relationships relationship
         WHERE (
           relationship.from_document_id = current.id
           AND relationship.to_document_id = candidate.id
         ) OR (
           relationship.to_document_id = current.id
           AND relationship.from_document_id = candidate.id
         )
         ORDER BY COALESCE(
           relationship.relationship_strength,
           relationship.confidence,
           0
         ) DESC
         LIMIT 1
       ) AS relationship_explanation
     FROM documents candidate
     JOIN legislative_documents legacy ON legacy.id = candidate.id
     CROSS JOIN current_document current
     JOIN legislative_documents current_legacy ON current_legacy.id = current.id
     LEFT JOIN document_processing_state state ON state.document_id = candidate.id
     LEFT JOIN document_text_artifacts candidate_artifact
       ON candidate_artifact.document_id = candidate.id
     LEFT JOIN document_text_artifacts current_artifact
       ON current_artifact.document_id = current.id
     WHERE candidate.id <> current.id
       AND candidate.visibility_status = 'public'
       AND candidate.quality_score >= 40
       AND candidate.title IS NOT NULL
       AND candidate.canonical_url IS NOT NULL
       AND ($2::BOOLEAN OR candidate.research_ready)
       AND (CARDINALITY($3::TEXT[]) = 0
         OR candidate.document_type = ANY($3::TEXT[]))
       AND (NOT $4::BOOLEAN OR candidate.jurisdiction_level = 'state')
       AND NOT (
         candidate.normalized_title = current.normalized_title
         AND candidate.document_type = current.document_type
         AND COALESCE(candidate.year, 0) = COALESCE(current.year, 0)
         AND COALESCE(candidate.jurisdiction, '') =
           COALESCE(current.jurisdiction, '')
       )
     ORDER BY relationship_match DESC,
       candidate.quality_score DESC,
       candidate.research_ready DESC,
       candidate.publication_date DESC NULLS LAST
     LIMIT $5`,
    [
      current.id,
      includeNonReady,
      types,
      stateOnly,
      Math.max(limit * 5, 30),
    ],
  );
  const semanticSet = new Set(semanticIds);
  const recommendations = result.rows
    .map((row) => {
      const signals = mapCandidateSignals(row, semanticSet, profile, current);
      return { recommendation: shapeRecommendation(row, signals), signals };
    })
    .filter(
      ({ recommendation, signals }) =>
        recommendation.score >= 0.24 &&
        hasSubstantiveRecommendationAffinity(signals) &&
        isRecommendationEligible(recommendation, { includeNonReady }),
    )
    .sort(
      (left, right) =>
        right.recommendation.score - left.recommendation.score,
    )
    .slice(0, limit)
    .map(({ recommendation }) => recommendation);
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
  const inferred = inferBusinessSignals(input);
  if (!input.states.length && inferred.jurisdictions.length) {
    input.states = inferred.jurisdictions;
  }
  const searchText = [
    input.problem,
    input.industry,
    input.topic,
    ...input.states,
    ...inferred.expansions,
    ...inferred.regulators,
    ...inferred.themes,
  ].filter(Boolean).join(" ");
  // Candidate retrieval should maximize recall; the explainable relevance gate
  // below is responsible for precision. WEBSEARCH_TO_TSQUERY treats plain
  // whitespace as AND, which made sector-specific expansions impossible to
  // satisfy together (for example, a document rarely says RBI, KYC, NBFC
  // registration, fair practices, and digital lending in one search vector).
  const lexicalSearchText = [...new Set([
    ...inferred.activities,
    ...inferred.expansions,
    ...inferred.regulators,
    ...inferred.themes,
    ...inferred.tokens,
  ].map((term) => String(term || "").trim()).filter(Boolean))]
    .map((term) => term.includes(" ") ? `"${term.replaceAll('"', "")}"` : term)
    .join(" OR ") || input.problem;
  let semanticIds = [];
  // Sector-specific compliance intent already has precise lexical expansion.
  // Avoid a paid query embedding on that hot path; semantic retrieval remains
  // available for unclassified natural-language problems.
  if (!inferred.sectors.length) {
    try {
      semanticIds = (await searchAcrossIndexedDocuments(
        searchText,
        Math.max(input.limit * 3, 30),
        { userId },
      ))
        .map((id) => Number(id))
        .filter((id) => Number.isSafeInteger(id) && id > 0);
    } catch (error) {
      console.warn("Semantic problem recommendation signal unavailable:", error.message);
    }
  }
  const result = await query(
    `SELECT legacy.*, candidate.state AS schema_state,
       candidate.research_ready, candidate.quality_score,
       candidate.source_authority_tier,
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
       ,candidate.id = ANY($6::BIGINT[]) AS semantic_match
     FROM documents candidate
     JOIN legislative_documents legacy ON legacy.id = candidate.id
     WHERE candidate.visibility_status = 'public'
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
         OR candidate.id = ANY($6::BIGINT[])
       )
     ORDER BY semantic_match DESC,
       problem_rank DESC,
       state_match DESC,
       industry_match DESC,
       candidate.quality_score DESC,
       candidate.publication_date DESC NULLS LAST
     LIMIT $5`,
    [
      lexicalSearchText,
      input.states,
      input.industry,
      input.documentTypes,
      Math.max(input.limit * 3, 30),
      semanticIds,
    ],
  );
  const candidates = result.rows
    .map((row) => {
      const relevance = evaluateBusinessCandidate(row, input, inferred);
      const signals = {
        sameJurisdiction: Boolean(row.state_match),
        sameState: Boolean(row.state_match),
        sameCategory: Boolean(row.industry_match),
        titleMatch: Number(row.problem_rank || 0) > 0,
        semanticMatch: Boolean(row.semantic_match),
        researchReady: Boolean(row.research_ready),
        qualityScore: Number(row.quality_score || 0),
        recent:
          row.publication_date &&
          new Date(row.publication_date).getTime() >=
            Date.now() - 366 * 24 * 60 * 60 * 1_000,
      };
      const recommendation = shapeRecommendation(row, signals);
      return {
        ...recommendation,
        score: relevance.score,
        confidence:
          relevance.tier === RELEVANCE_TIERS.HIGH
            ? "high"
            : relevance.tier === RELEVANCE_TIERS.MEDIUM
              ? "medium"
              : "low",
        relevanceTier: relevance.tier,
        relevance,
        authorityClass: relevance.authorityClass,
        reason: relevance.matchReasons.length
          ? `Matches ${relevance.matchReasons.slice(0, 4).join("; ")}.`
          : "A lower-confidence discovery result; applicability is not established.",
      };
    })
    .sort((left, right) =>
      right.score - left.score ||
      right.relevance.authorityScore - left.relevance.authorityScore ||
      right.relevance.documentTypeScore - left.relevance.documentTypeScore,
    );
  const recommendations = candidates
    .filter((item) => item.researchReady && [RELEVANCE_TIERS.HIGH, RELEVANCE_TIERS.MEDIUM].includes(item.relevanceTier))
    .slice(0, input.limit);
  const lowerConfidenceRecommendations = candidates
    .filter((item) => item.researchReady && item.relevanceTier === RELEVANCE_TIERS.LOW)
    .slice(0, Math.min(8, input.limit));
  const preparationCandidates = candidates
    .filter((item) => !item.researchReady && [RELEVANCE_TIERS.HIGH, RELEVANCE_TIERS.MEDIUM].includes(item.relevanceTier))
    .slice(0, Math.min(5, input.limit));
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
      [...inferred.themes, ...recommendations.flatMap((item) => item.category ? [item.category] : [])],
    ),
  ].slice(0, 8);
  const primarySources = recommendations.filter((item) =>
    item.authorityClass === "PRIMARY_OFFICIAL",
  );
  const secondarySources = recommendations.filter((item) =>
    item.authorityClass !== "PRIMARY_OFFICIAL",
  );
  let coverageClass = null;
  if (!recommendations.length && inferred.needsSpecificity) {
    coverageClass = COMPLIANCE_COVERAGE_CLASSES.TOO_BROAD;
  } else if (!recommendations.length && preparationCandidates.length) {
    coverageClass = COMPLIANCE_COVERAGE_CLASSES.PREPARATION_REQUIRED;
  } else if (recommendations.length && secondarySources.length === recommendations.length) {
    coverageClass = COMPLIANCE_COVERAGE_CLASSES.SECONDARY_ONLY;
  } else if (!recommendations.length && inferred.sectors.length) {
    coverageClass = COMPLIANCE_COVERAGE_CLASSES.PRIMARY_SOURCE_MISSING;
  }
  const sourceSupportedThemes = complianceThemes.filter((theme) =>
    recommendations.some((item) =>
      normalizeProblemText([item.title, item.category, item.reason].join(" "))
        .includes(normalizeProblemText(theme)),
    ),
  );
  const suggestedQuestions = [
    "Which licences, registrations, or permissions may apply?",
    inferred.regulators.length
      ? `What requirements are issued by ${inferred.regulators.slice(0, 2).join(" or ")}?`
      : "Which regulator or authority oversees this activity?",
    inferred.jurisdictions.length
      ? `Which requirements are specific to ${inferred.jurisdictions.join(" and ")}?`
      : "Are there state-specific requirements?",
    "What recurring filings, deadlines, or record-keeping duties are explicitly stated?",
    "What penalties or exemptions are explicitly stated in primary sources?",
  ];
  return {
    query: input,
    inferredSignals: {
      sectors: inferred.sectors,
      activities: inferred.activities,
      jurisdictions: inferred.jurisdictions,
      regulators: inferred.regulators,
      themes: inferred.themes,
    },
    recommendations,
    lowerConfidenceRecommendations,
    preparationCandidates,
    coverageClass,
    coverageExplanation: {
      [COMPLIANCE_COVERAGE_CLASSES.PREPARATION_REQUIRED]:
        "Relevant catalogue records exist, but they must be processed before they can support evidence-grounded research.",
      [COMPLIANCE_COVERAGE_CLASSES.SECONDARY_ONLY]:
        "Relevant research material was found, but no equally relevant primary official source is ready.",
      [COMPLIANCE_COVERAGE_CLASSES.PRIMARY_SOURCE_MISSING]:
        "The catalogue does not currently contain a sufficiently relevant, research-ready primary source for this problem.",
      [COMPLIANCE_COVERAGE_CLASSES.TOO_BROAD]:
        "The problem is too broad to support a reliable recommendation. Add the regulated activity, location, or authority involved.",
    }[coverageClass] || null,
    hasSufficientRecommendations: recommendations.length > 0,
    needsSpecificity: inferred.needsSpecificity,
    complianceThemes,
    inferredThemes: complianceThemes.filter((theme) => !sourceSupportedThemes.includes(theme)),
    sourceSupportedThemes,
    suggestedQuestions,
    primarySourceGap:
      recommendations.length > 0 && primarySources.length === 0
        ? "Relevant secondary material was found, but a primary official source has not yet been verified."
        : null,
    abstention:
      recommendations.length === 0
        ? preparationCandidates.length
          ? "Relevant records were found, but they are not yet ready to support evidence-grounded obligations. Open a record below to prepare it for research."
          : inferred.needsSpecificity
            ? "The problem is too broad for a reliable recommendation. Add the regulated activity, location, or authority involved."
            : "No sufficiently relevant verified documents were found. This is a catalogue coverage gap; Rashtram AI will not invent requirements."
        : null,
    disclaimer: "Rashtram AI provides research assistance, not legal advice.",
  };
};

const validateComparisonRecommendationRequest = (payload = {}) => {
  const supplied = Array.isArray(payload.selectedDocumentIds)
    ? payload.selectedDocumentIds.map((id) => String(id || "").trim())
    : [];
  const selectedDocumentIds = [...new Set(supplied.filter(Boolean))];
  if (selectedDocumentIds.length < 1 || selectedDocumentIds.length > 5) {
    const error = new Error("Select between one and five documents.");
    error.status = 400;
    throw error;
  }
  if (selectedDocumentIds.length !== supplied.length) {
    const error = new Error("Duplicate selected documents are not allowed.");
    error.status = 400;
    throw error;
  }
  return {
    selectedDocumentIds,
    limit: clampInteger(payload.limit, 10, 1, 20),
    preferredTypes: payload.preferredTypes || "all",
    query: String(payload.query || "").normalize("NFKC").trim().slice(0, 500),
  };
};

const getComparisonRecommendations = async (userId, payload = {}) => {
  const {
    selectedDocumentIds,
    limit,
    preferredTypes,
    query,
  } = validateComparisonRecommendationRequest(payload);
  const selected = await Promise.all(
    selectedDocumentIds.map((id) => DocumentRepository.getById(id)),
  );
  if (selected.some((document) => !document)) {
    const error = new Error("One or more selected documents were not found.");
    error.status = 404;
    throw error;
  }
  const groups = await Promise.all(
    selected.map((document) =>
      getDocumentRecommendations(document.id, userId, {
        type: preferredTypes,
        limit: 20,
        includeNonReady: false,
        useUserProfile: true,
        query,
      }),
    ),
  );
  const candidates = new Map();
  groups.forEach((recommendations, selectedIndex) => {
    for (const recommendation of recommendations) {
      if (selectedDocumentIds.includes(String(recommendation.id))) continue;
      const current = candidates.get(String(recommendation.id)) || {
        recommendation,
        selectedMatches: new Set(),
        graphMatches: 0,
        scoreTotal: 0,
      };
      current.selectedMatches.add(String(selected[selectedIndex].id));
      current.scoreTotal += Number(recommendation.score || 0);
      if (recommendation.graphRelationship) current.graphMatches += 1;
      if (
        Number(recommendation.score || 0) >
        Number(current.recommendation.score || 0)
      ) {
        current.recommendation = recommendation;
      }
      candidates.set(String(recommendation.id), current);
    }
  });
  const recommendations = [...candidates.values()]
    .map((candidate) => {
      const bridgeCount = candidate.selectedMatches.size;
      const baseScore = candidate.scoreTotal / bridgeCount;
      const bridgeBoost =
        selected.length > 1 ? Math.min(0.2, (bridgeCount - 1) * 0.1) : 0;
      const graphBoost = Math.min(0.1, candidate.graphMatches * 0.05);
      const score = Math.min(
        1,
        Number((baseScore + bridgeBoost + graphBoost).toFixed(4)),
      );
      const reasonParts = [];
      if (bridgeCount > 1) {
        reasonParts.push(
          `it is relevant to ${bridgeCount} selected documents`,
        );
      }
      if (candidate.graphMatches) {
        reasonParts.push("verified knowledge-graph connections");
      }
      if (!reasonParts.length) {
        reasonParts.push(
          candidate.recommendation.reason
            .replace(/^Recommended because it has /, "")
            .replace(/\.$/, ""),
        );
      }
      return {
        ...candidate.recommendation,
        score,
        confidence: confidenceForScore(score),
        comparisonReady: Boolean(
          candidate.recommendation.comparisonReady &&
          candidate.recommendation.researchReady,
        ),
        reason: `Recommended for comparison because ${reasonParts.join(
          " and ",
        )}.`,
        signals: [
          ...new Set([
            ...(candidate.recommendation.signals || []),
            ...(bridgeCount > 1 ? ["bridgesSelectedDocuments"] : []),
            ...(candidate.graphMatches ? ["graphBridge"] : []),
          ]),
        ],
        matchedSelectedDocumentIds: [...candidate.selectedMatches],
      };
    })
    .filter((recommendation) => recommendation.comparisonReady)
    .sort((left, right) => right.score - left.score)
    .slice(0, limit);
  await persistRecommendations(userId, recommendations, {
    comparisonSelection: selectedDocumentIds,
  });
  return {
    selectedDocuments: selected.map((document) => ({
      id: document.id,
      title: document.title,
      documentType: document.type,
    })),
    recommendations,
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
       document.comparison_ready,
       document.visibility_status, document.metadata_json,
       state.processing_status, state.extraction_status,
       state.embedding_status, state.chunks_count, state.embeddings_count,
       state.readiness_class, state.readiness_reason,
       EXISTS (
         SELECT 1 FROM document_resources resource
         WHERE resource.document_id = document.id
           AND resource.resource_type IN ('pdf', 'text', 'html')
           AND resource.is_accessible
       ) AS has_accessible_resource
     FROM ranked
     JOIN documents document ON document.id = ranked.document_id
     JOIN legislative_documents legacy ON legacy.id = document.id
     LEFT JOIN document_processing_state state ON state.document_id = document.id
     WHERE ranked.recommendation_rank = 1
       AND document.visibility_status = 'public'
       AND document.quality_score >= 40
       AND (
         document.research_ready
         OR EXISTS (
           SELECT 1 FROM document_resources resource
           WHERE resource.document_id = document.id
             AND resource.resource_type IN ('pdf', 'text', 'html')
             AND resource.is_accessible
         )
       )
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
      status: row.status || null,
      publicationDate: row.publication_date,
      sourceUrl: row.canonical_url || row.detail_url || row.source_url,
      pdfUrl: row.pdf_url,
      researchReady: Boolean(row.research_ready),
      comparisonReady: Boolean(row.comparison_ready),
      hasAccessibleResource: Boolean(row.has_accessible_resource),
      processingStatus: row.processing_status || null,
      extractionStatus: row.extraction_status || null,
      embeddingStatus: row.embedding_status || null,
      chunksCount: Number(row.chunks_count || 0),
      embeddingsCount: Number(row.embeddings_count || 0),
      readinessClass: row.readiness_class || null,
      readinessReason: row.readiness_reason || null,
      readiness: row.research_ready ? "research_ready" : "pdf_available",
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
  COMPLIANCE_COVERAGE_CLASSES,
  RELEVANCE_TIERS,
  authorityWeight,
  complianceDocumentTypeWeight,
  confidenceForScore,
  evaluateBusinessCandidate,
  hasDocumentTitleSubjectOverlap,
  hasDocumentSummarySubjectOverlap,
  hasSubstantiveRecommendationAffinity,
  getDocumentRecommendations,
  getComparisonRecommendations,
  getProblemRecommendations,
  getRecentRecommendations,
  isRecommendationEligible,
  inferBusinessSignals,
  normalizeTypes,
  stateOnlyRequested,
  scoreRecommendation,
  validateComparisonRecommendationRequest,
  validateProblemRequest,
};
