const { QUERY_TYPES } = require("./queryPlanner");
const { evidenceTextIsReliable } = require("../lib/pdfTextQuality");
const {
  CLAIM_CLASSES,
  classifyMaterialClaim,
} = require("./adaptiveIntelligenceService");

const SUFFICIENCY_LEVELS = Object.freeze({
  HIGH: "HIGH",
  MEDIUM: "MEDIUM",
  LOW: "LOW",
  INSUFFICIENT: "INSUFFICIENT",
  CONFLICTING: "CONFLICTING",
});

const CLAIM_TYPES = Object.freeze({
  SOURCE_FACT: "SOURCE_FACT",
  EXTERNAL_FACT: "EXTERNAL_FACT",
  INFERENCE: "INFERENCE",
  PERSPECTIVE: "PERSPECTIVE",
  HYPOTHETICAL: "HYPOTHETICAL",
  // Kept as an alias for stored telemetry and callers from Evidence Safety V1.
  ANALYTICAL_INFERENCE: "INFERENCE",
  RECOMMENDATION: "RECOMMENDATION",
  UNCERTAINTY: "UNCERTAINTY",
});

const CLAIM_STATES = Object.freeze({
  SUPPORTED: "SUPPORTED",
  PARTIALLY_SUPPORTED: "PARTIALLY_SUPPORTED",
  UNSUPPORTED: "UNSUPPORTED",
  CONFLICTING: "CONFLICTING",
});

const STOP_WORDS = new Set([
  "the", "and", "for", "that", "this", "with", "from", "into", "are",
  "was", "were", "will", "would", "could", "should", "has", "have", "had",
  "its", "their", "they", "them", "which", "what", "when", "where", "who",
  "why", "how", "document", "source", "page", "section", "chunk", "passage",
]);

const numberEnv = (name, fallback, minimum = 0, maximum = 1) => {
  const value = Number(process.env[name]);
  if (!Number.isFinite(value)) return fallback;
  return Math.min(maximum, Math.max(minimum, value));
};

const safetyConfig = () => ({
  highThreshold: numberEnv("EVIDENCE_HIGH_THRESHOLD", 0.72),
  mediumThreshold: numberEnv("EVIDENCE_MEDIUM_THRESHOLD", 0.5),
  lowThreshold: numberEnv("EVIDENCE_LOW_THRESHOLD", 0.3),
  supportOverlapThreshold: numberEnv("EVIDENCE_SUPPORT_OVERLAP", 0.12),
  partialOverlapThreshold: numberEnv("EVIDENCE_PARTIAL_OVERLAP", 0.06),
  maximumRepairAttempts: Math.min(1, Math.max(0,
    Number.parseInt(process.env.EVIDENCE_MAX_REPAIR_ATTEMPTS || "1", 10) || 0,
  )),
  version: "evidence-safety-v1.2-text-quality",
  claimVerifierVersion: "deterministic-citation-verifier-v1.2-text-quality",
});

const normalize = (value) => String(value || "")
  .normalize("NFKC")
  .toLowerCase()
  .replace(/\[[^\]]+\]/g, " ")
  .replace(/[^\p{L}\p{N}\s.%₹$-]+/gu, " ")
  .replace(/\s+/g, " ")
  .trim();

const tokens = (value) => [...new Set(
  normalize(value).split(" ").filter((token) => token.length >= 3 && !STOP_WORDS.has(token)),
)];

const lexicalAlignment = (left, right) => {
  const leftTokens = tokens(left);
  const rightTokens = new Set(tokens(right));
  if (!leftTokens.length || !rightTokens.size) return 0;
  const matches = leftTokens.filter((token) => rightTokens.has(token)).length;
  return matches / Math.min(leftTokens.length, rightTokens.size);
};

const canonicalCitationLabel = (value) => {
  const label = String(value || "").trim().replace(/^\[|\]$/g, "");
  const source = label.match(/^(Source|Passage)\s+(\d+)/i);
  if (source) return `${source[1].toLowerCase() === "passage" ? "Passage" : "Source"} ${source[2]}`;
  const graph = label.match(/^(GRAPH-\d+)/i);
  if (graph) return graph[1].toUpperCase();
  const comparison = label.match(/^(D\d+-C\d+)/i);
  if (comparison) return comparison[1].toUpperCase();
  const userSource = label.match(/^(User source:[^\]]+)/i);
  if (userSource) return normalize(userSource[1]);
  return label;
};

const citationLabelsForEvidence = (evidence, index) => {
  const labels = new Set();
  const values = [evidence.citationId, evidence.id, evidence.label];
  values.filter(Boolean).forEach((value) => labels.add(canonicalCitationLabel(value)));
  if (typeof evidence.passage === "number") {
    labels.add(`Source ${evidence.passage}`);
    labels.add(`Passage ${evidence.passage}`);
  } else if (/^GRAPH-\d+$/i.test(String(evidence.passage || ""))) {
    labels.add(String(evidence.passage).toUpperCase());
  }
  if (evidence.userSource && evidence.documentTitle) {
    labels.add(normalize(
      `User source:${evidence.documentTitle}${evidence.passage ? ` | Passage ${evidence.passage}` : ""}`,
    ));
  }
  if (!labels.size) labels.add(`Source ${index + 1}`);
  return [...labels];
};

const authorityValue = (authorityClass) => ({
  PRIMARY_OFFICIAL: 1,
  OFFICIAL_SECONDARY: 0.9,
  INSTITUTIONAL: 0.8,
  RESEARCH: 0.72,
  USER_SOURCE: 0.75,
  UNKNOWN: 0.5,
})[authorityClass] || 0.5;

const numericFacts = (value) => normalize(value).match(/\b\d+(?:\.\d+)?%?\b/g) || [];

const sufficiencyDecision = (level) => ({
  [SUFFICIENCY_LEVELS.HIGH]: "SUFFICIENT",
  [SUFFICIENCY_LEVELS.MEDIUM]: "SUFFICIENT",
  [SUFFICIENCY_LEVELS.LOW]: "LIMITED",
  [SUFFICIENCY_LEVELS.INSUFFICIENT]: "ABSTAIN",
  [SUFFICIENCY_LEVELS.CONFLICTING]: "CONFLICT",
})[level] || "ABSTAIN";

const band = (value, high, medium) => (
  value >= high ? "HIGH" : value >= medium ? "MEDIUM" : "LOW"
);

const explainableSignals = ({
  bestRelevance = 0,
  bestAlignment = 0,
  authorityClass = "UNKNOWN",
  evidenceBreadth = 0,
  independentSources = 0,
  exactReference = false,
  retrievalVerified = false,
  conflicts = [],
} = {}) => ({
  retrievalStrength: band(Math.max(bestRelevance, bestAlignment), 0.65, 0.3),
  queryEvidenceAlignment: band(bestAlignment, 0.5, 0.18),
  exactReferenceMatch: Boolean(exactReference),
  sourceAuthority: authorityClass || "UNKNOWN",
  sourceDiversity: independentSources >= 2 ? "MULTIPLE" : independentSources === 1 ? "SINGLE" : "NONE",
  evidenceCoverage: band(evidenceBreadth, 0.8, 0.4),
  sourceConsistency: conflicts.length ? "CONFLICTING" : "CONSISTENT",
  documentCapabilities: {
    retrievalVerified: Boolean(retrievalVerified),
    searchReady: Boolean(retrievalVerified),
  },
});

const detectEvidenceConflicts = (evidence = []) => {
  const conflictTerms = /\b(rate|amount|deadline|effective|commence|date|limit|threshold|penalty|fine|period)\b/i;
  const candidates = evidence.filter((item) =>
    conflictTerms.test(String(item.content || "")) && numericFacts(item.content).length,
  );
  const conflicts = [];
  for (let leftIndex = 0; leftIndex < candidates.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < candidates.length; rightIndex += 1) {
      const left = candidates[leftIndex];
      const right = candidates[rightIndex];
      if (String(left.documentId || "") === String(right.documentId || "") &&
          Number(left.chunkIndex) === Number(right.chunkIndex)) continue;
      if (lexicalAlignment(left.content, right.content) < 0.28) continue;
      const leftNumbers = numericFacts(left.content);
      const rightNumbers = numericFacts(right.content);
      if (leftNumbers.some((number) => rightNumbers.includes(number))) continue;
      conflicts.push({
        left: { label: citationLabelsForEvidence(left, leftIndex)[0], content: String(left.content || "").slice(0, 360) },
        right: { label: citationLabelsForEvidence(right, rightIndex)[0], content: String(right.content || "").slice(0, 360) },
        reason: "Authoritative evidence contains different values for a closely related fact.",
      });
    }
  }
  return conflicts.slice(0, 3);
};

const assessEvidenceSufficiency = (query, evidence = [], options = {}) => {
  const config = safetyConfig();
  const usable = evidence.filter((item) =>
    String(item.content || "").trim() && evidenceTextIsReliable(item),
  );
  const conflicts = detectEvidenceConflicts(usable);
  if (conflicts.length) {
    const level = SUFFICIENCY_LEVELS.CONFLICTING;
    return {
      level,
      decision: sufficiencyDecision(level),
      score: 0,
      signals: explainableSignals({ conflicts, retrievalVerified: options.retrievalVerified }),
      reasons: ["Retrieved sources contain materially inconsistent evidence."],
      missing: [],
      conflicts,
      version: config.version,
    };
  }
  if (!usable.length) {
    const rejectedForQuality = evidence.some((item) =>
      String(item.content || "").trim() && !evidenceTextIsReliable(item),
    );
    const level = SUFFICIENCY_LEVELS.INSUFFICIENT;
    return {
      level,
      decision: sufficiencyDecision(level),
      score: 0,
      signals: explainableSignals({ retrievalVerified: options.retrievalVerified }),
      reasons: [rejectedForQuality
        ? "Retrieved passages failed deterministic text-quality checks."
        : "No usable source passage was retrieved."],
      missing: [rejectedForQuality
        ? "Reliably extracted source passages"
        : "Relevant source passages"],
      conflicts: [],
      version: config.version,
    };
  }
  const alignments = usable.map((item) => lexicalAlignment(query, item.content));
  const relevance = usable.map((item, index) => Math.max(
    Number(item.vectorScore || 0), Number(item.ftsScore || 0),
    Number(item.lexicalScore || 0), Number(item.finalScore || 0),
    alignments[index],
  ));
  const bestRelevance = Math.min(1, Math.max(...relevance, 0));
  const bestAlignment = Math.min(1, Math.max(...alignments, 0));
  const authority = Math.max(...usable.map((item) => authorityValue(item.authorityClass)), 0.5);
  const authorityClass = usable
    .slice()
    .sort((left, right) => authorityValue(right.authorityClass) - authorityValue(left.authorityClass))[0]
    ?.authorityClass || "UNKNOWN";
  const independentSources = new Set(usable.map((item) =>
    `${item.documentId || "document"}:${item.sourceUrl || item.source || item.userSource || "source"}`,
  )).size;
  const evidenceBreadth = Math.min(1, usable.length / Math.max(2, Number(options.minimumEvidence || 3)));
  const independence = Math.min(1, independentSources / 2);
  const readiness = options.retrievalVerified === false ? 0 : 1;
  const exactReference = options.queryType === QUERY_TYPES.EXACT_REFERENCE &&
    usable.some((item) => Number(item.identifierBoost || 0) > 0 ||
      lexicalAlignment(query, [item.sectionId, item.sectionTitle, item.clauseId].filter(Boolean).join(" ")) > 0);
  const score = Math.min(1,
    0.28 * bestRelevance + 0.24 * bestAlignment + 0.16 * authority +
    0.14 * evidenceBreadth + 0.08 * independence + 0.06 * readiness +
    (exactReference ? 0.12 : 0),
  );
  const level = score >= config.highThreshold
    ? SUFFICIENCY_LEVELS.HIGH
    : score >= config.mediumThreshold
      ? SUFFICIENCY_LEVELS.MEDIUM
      : score >= config.lowThreshold
        ? SUFFICIENCY_LEVELS.LOW
        : SUFFICIENCY_LEVELS.INSUFFICIENT;
  const reasons = [];
  if (exactReference) reasons.push("An exact structural reference was retrieved.");
  if (authority >= 0.9) reasons.push("Official source evidence was retrieved.");
  if (usable.length > 1) reasons.push("Multiple supporting passages were retrieved.");
  if (bestAlignment >= 0.35) reasons.push("The evidence closely matches the question.");
  if (!reasons.length) reasons.push("Only limited matching evidence was retrieved.");
  const missing = [];
  if (bestAlignment < 0.12) missing.push("Evidence directly aligned with the question");
  if (usable.length < Number(options.minimumEvidence || 2)) missing.push("Additional supporting passages");
  return {
    level,
    decision: sufficiencyDecision(level),
    score: Number(score.toFixed(4)),
    signals: explainableSignals({
      bestRelevance,
      bestAlignment,
      authorityClass,
      evidenceBreadth,
      independentSources,
      exactReference,
      retrievalVerified: options.retrievalVerified !== false,
    }),
    reasons,
    missing,
    conflicts: [],
    evidenceCount: usable.length,
    independentSourceCount: independentSources,
    version: config.version,
  };
};

const buildAbstentionResponse = (assessment, options = {}) => {
  if (assessment.level === SUFFICIENCY_LEVELS.CONFLICTING) {
    const details = assessment.conflicts.flatMap((conflict, index) => [
      `${index + 1}. ${conflict.left.label} states: ${conflict.left.content}`,
      `   ${conflict.right.label} states: ${conflict.right.content}`,
    ]);
    return [
      "The available source material is inconsistent on this point, so I cannot present one version as established fact.",
      "",
      ...details,
      "",
      "Please check the effective dates and original official records before relying on either version.",
    ].join("\n");
  }
  const searched = Array.isArray(options.documentTitles) && options.documentTitles.length
    ? ` I searched: ${options.documentTitles.join(", ")}.`
    : "";
  const missing = assessment.missing?.length
    ? ` Missing evidence: ${assessment.missing.join("; ")}.`
    : "";
  if (assessment.missing?.includes("Reliably extracted source passages")) {
    const original = options.originalSourceUrl
      ? ` Open the original source: ${options.originalSourceUrl}`
      : " Open the original PDF to inspect the affected section.";
    return `This section could not be reliably extracted from the source document.${original}`;
  }
  return `The available sources do not contain sufficient evidence to answer this reliably.${searched}${missing} Try preparing more documents, selecting another source, or broadening the search.`;
};

const classifyClaim = (text) => {
  const value = String(text || "").trim();
  if (/\b(recommend|should consider|next step|could consider|it would be prudent)\b/i.test(value)) {
    return CLAIM_TYPES.RECOMMENDATION;
  }
  if (/\b(uncertain|unclear|not identified|not stated|insufficient|cannot determine|evidence gap|not available)\b/i.test(value)) {
    return CLAIM_TYPES.UNCERTAINTY;
  }
  return ({
    [CLAIM_CLASSES.EXTERNAL_FACT]: CLAIM_TYPES.EXTERNAL_FACT,
    [CLAIM_CLASSES.INFERENCE]: CLAIM_TYPES.INFERENCE,
    [CLAIM_CLASSES.PERSPECTIVE]: CLAIM_TYPES.PERSPECTIVE,
    [CLAIM_CLASSES.HYPOTHETICAL]: CLAIM_TYPES.HYPOTHETICAL,
  })[classifyMaterialClaim(value)] || CLAIM_TYPES.SOURCE_FACT;
};

const isMaterialFactualClaim = (text) => {
  const value = String(text || "").trim();
  if (!value) return false;
  return numericFacts(value).length > 0 ||
    /\b(?:act|bill|ordinance|rule|regulation|notification|order|policy|section|clause|article|schedule|authority|government|ministry|department|court|commission|board|institution|jurisdiction)\b/i.test(value) ||
    /\b(?:shall|must|required|prohibited|permitted|liable|penalty|fine|deadline|effective|commence|amend|repeal|exempt|obligation|entitlement|power|duty)\b/i.test(value);
};

const extractCitationLabels = (text) => {
  const labels = [];
  const pattern = /\[((?:Source|Passage)\s+\d+|GRAPH-\d+|D\d+-C\d+|User source:[^\]]+)(?:[^\]]*)\]/gi;
  let match;
  while ((match = pattern.exec(String(text || "")))) {
    labels.push(canonicalCitationLabel(match[1]));
  }
  return [...new Set(labels)];
};

const extractClaims = (answer) => String(answer || "")
  .split(/\n+/)
  .map((line, index) => ({ raw: line, index, text: line.replace(/^\s*(?:[-*]|\d+[.)])\s*/, "").trim() }))
  .filter((item) => item.text && !/^#{1,6}\s/.test(item.raw))
  .map((item) => {
    const type = classifyClaim(item.text);
    return {
      ...item,
      type,
      material: [CLAIM_TYPES.SOURCE_FACT, CLAIM_TYPES.EXTERNAL_FACT].includes(type) &&
        isMaterialFactualClaim(item.text),
      citations: extractCitationLabels(item.text),
    };
  });

const evidenceMap = (evidence = []) => {
  const map = new Map();
  evidence.forEach((item, index) => {
    citationLabelsForEvidence(item, index).forEach((label) => map.set(label, item));
  });
  return map;
};

const evidenceText = (evidence = {}) => [
  evidence.content,
  evidence.documentTitle,
  evidence.title,
  evidence.authority,
  evidence.sourceAuthority,
  evidence.pageLabel,
  evidence.pageStart == null ? "" : `Page ${evidence.pageStart}`,
  evidence.pageEnd == null ? "" : `Page ${evidence.pageEnd}`,
  evidence.sectionId == null ? "" : `Section ${evidence.sectionId}`,
  evidence.sectionTitle,
  evidence.clauseId == null ? "" : `Clause ${evidence.clauseId}`,
  evidence.sourceUrl,
].filter(Boolean).join("\n");

const boundedEvidenceForCitation = (source, evidence = []) => {
  if (!source) return [];
  const sourceChunk = Number(source.chunkIndex);
  const sourceDocument = String(source.documentId || "");
  return [source, ...evidence.filter((candidate) => {
    if (candidate === source || !sourceDocument || String(candidate.documentId || "") !== sourceDocument) {
      return false;
    }
    const candidateChunk = Number(candidate.chunkIndex);
    return Number.isFinite(sourceChunk) && Number.isFinite(candidateChunk) &&
      Math.abs(candidateChunk - sourceChunk) === 1;
  })].slice(0, 3);
};

const citationSupportsClaim = (claimText, evidence, config = safetyConfig()) => {
  if (!evidenceTextIsReliable(evidence)) {
    return { alignment: 0, supported: false, partial: false, unreliable: true };
  }
  const sourceText = evidenceText(evidence);
  const alignment = lexicalAlignment(claimText, sourceText);
  const claimNumbers = numericFacts(claimText);
  const evidenceNumbers = new Set(numericFacts(sourceText));
  const numbersSupported = claimNumbers.every((number) => evidenceNumbers.has(number));
  return {
    alignment,
    supported: alignment >= config.supportOverlapThreshold && numbersSupported,
    partial: alignment >= config.partialOverlapThreshold && numbersSupported,
  };
};

const validateClaims = (claims, evidence = [], options = {}) => {
  const config = safetyConfig();
  const byCitation = evidenceMap(evidence);
  return claims.map((claim) => {
    if (![CLAIM_TYPES.SOURCE_FACT, CLAIM_TYPES.EXTERNAL_FACT].includes(claim.type)) {
      return { ...claim, state: CLAIM_STATES.SUPPORTED, support: [] };
    }
    if (claim.material === false) {
      return {
        ...claim,
        state: CLAIM_STATES.SUPPORTED,
        support: [],
        verificationScope: "non_material",
      };
    }
    if (claim.type === CLAIM_TYPES.EXTERNAL_FACT && options.allowStableGeneralKnowledge &&
        !/\b(currently|today|latest|presently|as of \d{4}|now in force|current regulator)\b/i.test(claim.text)) {
      return {
        ...claim,
        state: CLAIM_STATES.SUPPORTED,
        support: [],
        verificationScope: "stable_general_knowledge",
      };
    }
    if (!claim.citations.length) {
      return { ...claim, state: CLAIM_STATES.UNSUPPORTED, support: [], reason: "No retrieved citation was attached." };
    }
    const support = claim.citations.map((citation) => {
      const source = byCitation.get(citation);
      if (!source) return { citation, found: false, alignment: 0 };
      const bounded = boundedEvidenceForCitation(source, evidence)
        .map((candidate) => citationSupportsClaim(claim.text, candidate, config))
        .sort((left, right) => right.alignment - left.alignment)[0];
      return { citation, found: true, ...bounded };
    });
    const state = support.some((item) => item.supported)
      ? CLAIM_STATES.SUPPORTED
      : support.some((item) => item.partial)
        ? CLAIM_STATES.PARTIALLY_SUPPORTED
        : CLAIM_STATES.UNSUPPORTED;
    return { ...claim, state, support };
  });
};

const deterministicRepair = (answer, validatedClaims) => {
  const unsafeLines = new Set(validatedClaims
    .filter((claim) => [CLAIM_TYPES.SOURCE_FACT, CLAIM_TYPES.EXTERNAL_FACT].includes(claim.type) &&
      claim.state === CLAIM_STATES.UNSUPPORTED)
    .map((claim) => claim.index));
  return String(answer || "").split(/\n+/)
    .filter((_, index) => !unsafeLines.has(index))
    .join("\n\n")
    .trim();
};

const verifyAndRepairAnswer = async (answer, evidence = [], options = {}) => {
  const config = safetyConfig();
  let verifierFallback = false;
  let claims;
  try {
    claims = options.verifier
      ? await options.verifier(answer, evidence)
      : extractClaims(answer);
  } catch {
    verifierFallback = true;
    claims = extractClaims(answer);
  }
  let validated = validateClaims(claims, evidence, options);
  let repairedAnswer = String(answer || "").trim();
  let repairAttempts = 0;
  const unsupportedBeforeRepair = validated.filter((claim) => claim.state === CLAIM_STATES.UNSUPPORTED).length;
  if (unsupportedBeforeRepair > 0 && config.maximumRepairAttempts > 0) {
    repairAttempts = 1;
    repairedAnswer = options.repair
      ? await Promise.resolve()
        .then(() => options.repair(repairedAnswer, validated))
        .catch(() => "")
      : deterministicRepair(repairedAnswer, validated);
    validated = validateClaims(extractClaims(repairedAnswer), evidence, options);
  }
  const unsupportedAfterRepair = validated.filter((claim) => claim.state === CLAIM_STATES.UNSUPPORTED).length;
  const supportedFacts = validated.filter((claim) =>
    [CLAIM_TYPES.SOURCE_FACT, CLAIM_TYPES.EXTERNAL_FACT].includes(claim.type) &&
      claim.state === CLAIM_STATES.SUPPORTED,
  ).length;
  const analyticalTrace = validated
    .filter((claim) => [
      CLAIM_TYPES.INFERENCE,
      CLAIM_TYPES.PERSPECTIVE,
      CLAIM_TYPES.HYPOTHETICAL,
      CLAIM_TYPES.RECOMMENDATION,
    ].includes(claim.type))
    .map((claim) => {
      const priorFacts = validated
        .filter((candidate) => candidate.index <= claim.index &&
          [CLAIM_TYPES.SOURCE_FACT, CLAIM_TYPES.EXTERNAL_FACT].includes(candidate.type) &&
          candidate.state === CLAIM_STATES.SUPPORTED)
        .slice(-2);
      return {
        statement: claim.text,
        claimType: claim.type,
        supportingCitations: [
          ...new Set([
            ...claim.citations,
            ...priorFacts.flatMap((candidate) => candidate.citations),
          ]),
        ],
      };
    });
  const needsAbstention = !repairedAnswer || unsupportedAfterRepair > 0 ||
    (unsupportedBeforeRepair > 0 && supportedFacts === 0);
  return {
    answer: needsAbstention
      ? buildAbstentionResponse(options.sufficiency || {
          level: SUFFICIENCY_LEVELS.INSUFFICIENT,
          missing: ["Citations supporting the generated factual claims"],
        }, options)
      : repairedAnswer,
    claims: validated,
    unsupportedBeforeRepair,
    unsupportedAfterRepair,
    supportedFacts,
    analyticalTrace,
    repairAttempts,
    abstained: needsAbstention,
    verifierFallback,
    version: config.claimVerifierVersion,
  };
};

const summarizeVerification = (verification = {}) => ({
  unsupportedBeforeRepair: Number(verification.unsupportedBeforeRepair || 0),
  unsupportedAfterRepair: Number(verification.unsupportedAfterRepair || 0),
  supportedFacts: Number(verification.supportedFacts || 0),
  analyticalTraceCount: Array.isArray(verification.analyticalTrace)
    ? verification.analyticalTrace.length
    : 0,
  repairAttempts: Number(verification.repairAttempts || 0),
  abstained: Boolean(verification.abstained),
  verifierFallback: Boolean(verification.verifierFallback),
  version: verification.version || safetyConfig().claimVerifierVersion,
});

const buildGroundedExtractiveAnswer = (query, evidence = []) => {
  const usable = evidence.filter((item) =>
    String(item.content || "").trim() && evidenceTextIsReliable(item),
  ).slice(0, 4);
  if (!usable.length) {
    return buildAbstentionResponse({
      level: SUFFICIENCY_LEVELS.INSUFFICIENT,
      missing: ["A relevant source passage"],
    });
  }
  return [
    "AI generation is temporarily unavailable. The following retrieved passages are provided without additional interpretation:",
    "",
    ...usable.map((item, index) => {
      const label = citationLabelsForEvidence(item, index)[0];
      return `- ${String(item.content).replace(/\s+/g, " ").trim().slice(0, 520)} [${label}]`;
    }),
    "",
    `Research question: ${String(query || "").trim()}`,
  ].join("\n");
};

const verifyStructuredComparison = (generated, citations = []) => {
  const evidence = citations.map((citation) => ({
    ...citation,
    citationId: citation.id,
    content: citation.snippet || citation.content || "",
  }));
  const byCitation = evidenceMap(evidence);
  const sections = [
    "similarities", "differences", "keyClauses", "stakeholders",
    "complianceImpact", "timeline", "authorityDifferences",
    "impactAssessment", "keyFindings",
  ];
  let removed = 0;
  const value = { ...generated };
  for (const section of sections) {
    const items = Array.isArray(value[section]) ? value[section] : [];
    value[section] = items.filter((item) => {
      const text = item.point || item.analysis || item.impact || item.event || item.clause || "";
      const labels = Array.isArray(item.citations) ? item.citations.map(canonicalCitationLabel) : [];
      const claimType = classifyClaim(text);
      const analytical = [
        CLAIM_TYPES.INFERENCE,
        CLAIM_TYPES.PERSPECTIVE,
        CLAIM_TYPES.HYPOTHETICAL,
        CLAIM_TYPES.RECOMMENDATION,
      ].includes(claimType);
      const citedEvidence = labels.map((label) => byCitation.get(label)).filter(Boolean);
      const citedNumbers = new Set(citedEvidence.flatMap((source) => numericFacts(evidenceText(source))));
      const analyticalPremisesAvailable = analytical && citedEvidence.some(evidenceTextIsReliable) &&
        numericFacts(text).every((number) => citedNumbers.has(number));
      const supported = labels.some((label) => {
        const source = byCitation.get(label);
        return source && citationSupportsClaim(text, source).partial;
      }) || analyticalPremisesAvailable;
      if (!supported) removed += 1;
      return supported;
    });
  }
  const summaryClaims = validateClaims(extractClaims(value.executiveSummary || ""), evidence);
  const summaryIsGrounded = summaryClaims.length > 0 && summaryClaims.every((claim) =>
    ![CLAIM_TYPES.SOURCE_FACT, CLAIM_TYPES.EXTERNAL_FACT].includes(claim.type) ||
      claim.state !== CLAIM_STATES.UNSUPPORTED,
  );
  if (!summaryIsGrounded) {
    value.executiveSummary = removed > 0
      ? "The comparison below includes only findings that could be traced to the retrieved source passages; unsupported generated points were removed."
      : "The comparison below presents the findings that could be traced to the retrieved source passages.";
  }
  return {
    generated: value,
    report: {
      removedUnsupportedItems: removed,
      executiveSummaryRepaired: !summaryIsGrounded,
      verifiedCitationCount: citations.length,
      version: safetyConfig().claimVerifierVersion,
    },
  };
};

module.exports = {
  CLAIM_STATES,
  CLAIM_TYPES,
  SUFFICIENCY_LEVELS,
  assessEvidenceSufficiency,
  buildAbstentionResponse,
  buildGroundedExtractiveAnswer,
  canonicalCitationLabel,
  citationSupportsClaim,
  classifyClaim,
  detectEvidenceConflicts,
  extractCitationLabels,
  extractClaims,
  explainableSignals,
  isMaterialFactualClaim,
  safetyConfig,
  sufficiencyDecision,
  summarizeVerification,
  validateClaims,
  verifyAndRepairAnswer,
  verifyStructuredComparison,
};
