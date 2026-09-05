const { getPool, query } = require("../db");
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
const { generateDocumentComparison, providerConfig } = require("../lib/vectordb");
const { sanitizeProviderError } = require("../lib/providerErrorSanitizer");
const { planQuery } = require("../retrieval/queryPlanner");
const { retrievalConfig } = require("../retrieval/retrievalConfig");
const { selectContextPassages } = require("../retrieval/contextBuilder");
const {
  SUFFICIENCY_LEVELS,
  assessEvidenceSufficiency,
  buildAbstentionResponse,
  verifyStructuredComparison,
} = require("../retrieval/evidenceSafetyService");
const { applyResearchFlags, resolveResearchFlags } = require("../retrieval/featureFlags");
const { analysisCacheKey, caches, stableHash } = require("../retrieval/researchCache");
const { recordResearchTelemetry } = require("../retrieval/researchTelemetry");

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
const EMPTY_FIELD_PATTERN =
  /^(not identified|none identified|not available|no evidence|not found|not specified|n\/a)/i;
const REGENERATION_CLAIM_TIMEOUT_MINUTES = 5;

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

const sameDocumentScope = (left = [], right = []) =>
  left.length === right.length && left.every((id, index) =>
    String(id) === String(right[index]));

const resolveRegenerationRequest = (comparison, payload = {}) => {
  if (!comparison) throw validationError("Comparison not found.", 404);
  const requestedIds = Array.isArray(payload.documentIds)
    ? payload.documentIds.map((id) => String(id || "").trim()).filter(Boolean)
    : comparison.documentIds.map(String);
  if (!sameDocumentScope(requestedIds, comparison.documentIds.map(String))) {
    throw validationError(
      "Regeneration must use the documents already saved in this comparison.",
      409,
    );
  }
  return normalizeRequest({
    documentIds: comparison.documentIds,
    comparisonMode: payload.comparisonMode ?? payload.mode ?? comparison.mode,
    language: payload.language ?? comparison.language,
    userQuestion: Object.prototype.hasOwnProperty.call(payload, "userQuestion")
      ? payload.userQuestion
      : comparison.userQuestion,
  });
};

const assertCitationDocumentScope = (result, documentIds) => {
  const selected = new Set(documentIds.map(String));
  const outside = (result?.citations || []).filter((citation) =>
    !selected.has(String(citation.documentId)));
  if (outside.length) {
    const error = new Error("Comparison verification produced an out-of-scope citation.");
    error.status = 500;
    error.failureStage = "citation_scope";
    throw error;
  }
  return true;
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

const buildComparisonCitation = ({ label, document, passage }) => ({
  id: label,
  documentId: document.id,
  documentType: document.type,
  documentTitle: document.title,
  chunkIndex: passage.chunkIndex,
  page: passage.pageStart || null,
  pageEnd: passage.pageEnd || null,
  pageEstimate: passage.pageEstimate,
  section: passage.sectionTitle || passage.sectionId || null,
  heading: passage.heading || passage.sectionTitle || null,
  sectionPath: passage.sectionPath || [],
  clause: passage.clauseId || null,
  score: passage.score,
  languageCode: passage.languageCode,
  sourceUrl: passage.sourceUrl || document.sourceUrl,
  canonicalSourceUrl: passage.canonicalSourceUrl || document.sourceUrl,
  resourceType: passage.resourceType || (passage.pdfUrl ? "pdf" : null),
  mimeType: passage.mimeType || null,
  anchor: passage.sourceAnchor || null,
  pdfUrl: passage.resourceType === "html" ? null : passage.pdfUrl || document.pdfUrl,
  snippet: passage.content.slice(0, 700),
});

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

const comparisonRetrievalLimit = (mode, documentCount) => {
  const normalizedMode =
    MODE_ALIASES[String(mode || "full").toLowerCase()] || "full";
  const baseLimit = {
    summary: 6,
    timeline: 6,
    clause: 9,
    impact: 8,
    compliance: 8,
    full: 10,
  }[normalizedMode] || 7;
  const countAdjustedLimit = Math.floor(
    36 / Math.max(1, Number(documentCount) || 1),
  );
  return Math.max(4, Math.min(10, baseLimit, countAdjustedLimit || baseLimit));
};

const comparisonPassageCharLimit = () => {
  const configured = Number(process.env.COMPARISON_PASSAGE_CHAR_LIMIT || 1_200);
  if (!Number.isFinite(configured)) return 1_200;
  return Math.max(700, Math.min(1_600, Math.floor(configured)));
};

const allowExtractiveComparisonFallback = () =>
  !["0", "false", "no", "off"].includes(
    String(process.env.COMPARISON_ALLOW_EXTRACTIVE_FALLBACK || "true")
      .trim()
      .toLowerCase(),
  );

const words = (value, max = 80) => {
  const tokens = String(value || "")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean);
  return tokens.slice(0, max).join(" ");
};

const itemTextValue = (item) => {
  if (typeof item === "string") return item;
  if (!item || typeof item !== "object") return "";
  return [
    item.topic,
    item.date,
    item.name,
    item.clause,
    item.point,
    item.event,
    item.analysis,
    item.impact,
  ]
    .filter(Boolean)
    .join(" ");
};

const hasUsefulItems = (items) =>
  Array.isArray(items) &&
  items.some((item) => {
    const value = itemTextValue(item).trim();
    return value && !EMPTY_FIELD_PATTERN.test(value);
  });

const sanitizeCitationIds = (ids, validCitationIds) =>
  [...new Set((Array.isArray(ids) ? ids : []).map(String))]
    .filter((id) => validCitationIds.has(id))
    .slice(0, 5);

const normalizeComparisonArray = (items, validCitationIds) =>
  Array.isArray(items)
    ? items
        .filter((item) => item && itemTextValue(item).trim())
        .filter((item) => !EMPTY_FIELD_PATTERN.test(itemTextValue(item).trim()))
        .map((item) =>
          typeof item === "string"
            ? item
            : {
                ...item,
                citations: sanitizeCitationIds(item.citations, validCitationIds),
              },
        )
    : [];

const mergeComparisonItems = (primary, fallback, limit) => {
  const seen = new Set();
  return [...(Array.isArray(primary) ? primary : []), ...(Array.isArray(fallback) ? fallback : [])]
    .filter((item) => item && itemTextValue(item).trim())
    .filter((item) => {
      const key = itemTextValue(item)
        .toLowerCase()
        .replace(/\s+/g, " ")
        .slice(0, 180);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, limit);
};

const citationIdFor = (documentIndex, passageIndex) =>
  `D${documentIndex + 1}-C${passageIndex + 1}`;

const passageIncludes = (passage, keywords) => {
  const content = String(passage?.content || "").toLowerCase();
  return keywords.some((keyword) => content.includes(keyword));
};

const firstPassages = (group, keywords, limit = 2) => {
  const matched = group.passages
    .map((passage, passageIndex) => ({
      passage,
      passageIndex,
      citation: citationIdFor(group.documentIndex, passageIndex),
    }))
    .filter(({ passage }) => passageIncludes(passage, keywords));
  const source = matched.length
    ? matched
    : group.passages.slice(0, limit).map((passage, passageIndex) => ({
        passage,
        passageIndex,
        citation: citationIdFor(group.documentIndex, passageIndex),
      }));
  return source.slice(0, limit);
};

const matchingPassages = (group, keywords, limit = 2) =>
  group.passages
    .map((passage, passageIndex) => ({
      passage,
      passageIndex,
      citation: citationIdFor(group.documentIndex, passageIndex),
    }))
    .filter(({ passage }) => passageIncludes(passage, keywords))
    .slice(0, limit);

const documentLabel = (documentIndex) => `D${documentIndex + 1}`;

const documentShortTitle = (document) =>
  String(document?.title || "Selected document")
    .replace(/^The\s+/i, "")
    .replace(/\s+/g, " ")
    .trim();

const buildDocumentFocus = (group) => {
  const document = group.document;
  const text = group.passages.map((passage) => passage.content).join(" ").toLowerCase();
  const themes = [];
  if (/track and trace|unique identification|marking|electronic storage/.test(text)) {
    themes.push("track-and-trace compliance");
  }
  if (/input tax credit|blocked credit|section 17/.test(text)) {
    themes.push("input tax credit");
  }
  if (/appeal|appellate|tribunal|pre-deposit/.test(text)) {
    themes.push("appeals and dispute process");
  }
  if (/central public information officer|\bcpio\b|right to information|first appellate authorit/.test(text)) {
    themes.push("RTI administration and designated officers");
  }
  if (/ayurved|traditional medicine|ayush|global market|internationali[sz]/.test(text)) {
    themes.push("Ayurveda standards and international reach");
  }
  if (/penalty|interest|proceedings|notice|proper officer|section 74/.test(text)) {
    themes.push("tax demands and settlement");
  }
  if (/extra neutral alcohol|rectified spirit|alcoholic liquor|human consumption/.test(text)) {
    themes.push("alcohol-related GST treatment");
  }
  if (/return|statement|furnish|registered person/.test(text)) {
    themes.push("returns and reporting");
  }
  if (/rule-making|official gazette|\brules\b|prescribed|notif(?:y|ication)/.test(text)) {
    themes.push("government rule-making powers");
  }
  return {
    label: documentLabel(group.documentIndex),
    title: documentShortTitle(document),
    themes: [...new Set(themes)].slice(0, 4),
  };
};

const comparisonSectionBackfill = ({ documents, groups, citations, generated }) => {
  const validCitationIds = new Set(citations.map((citation) => citation.id));
  const normalized = { ...(generated || {}) };
  const normalizedFields = [
    "similarities",
    "differences",
    "keyClauses",
    "stakeholders",
    "complianceImpact",
    "timeline",
    "authorityDifferences",
    "impactAssessment",
    "keyFindings",
  ];

  normalizedFields.forEach((field) => {
    normalized[field] = normalizeComparisonArray(normalized[field], validCitationIds);
  });

  const focus = groups.map(buildDocumentFocus);
  const allCitationIds = citations.slice(0, 10).map((citation) => citation.id);
  const metadataSimilarities = [];
  const sharedValue = (selector) => {
    const values = documents.map(selector).map((value) => String(value || "").trim());
    if (values.some((value) => !value)) return null;
    const unique = [...new Set(values)];
    return unique.length === 1 ? unique[0] : null;
  };
  const sharedMinistry = sharedValue((document) => document.ministry);
  if (sharedMinistry) {
    metadataSimilarities.push({
      point: `All selected records identify ${sharedMinistry} as their ministry.`,
      citations: allCitationIds.slice(0, Math.min(4, allCitationIds.length)),
    });
  }
  if (!hasUsefulItems(normalized.similarities)) {
    normalized.similarities = metadataSimilarities.slice(0, 5);
  } else {
    normalized.similarities = mergeComparisonItems(
      normalized.similarities,
      metadataSimilarities,
      6,
    );
  }

  const differenceItems = groups.map((group) => {
    const selected = firstPassages(group, [
      "seeks to",
      "salient features",
      "amend",
      "insert",
      "substitute",
      "track and trace",
      "input tax credit",
      "penalty",
      "appeal",
      "government",
    ], 3);
    const focusItem = focus[group.documentIndex];
    return {
      topic: `${focusItem.label}: ${focusItem.title}`,
      analysis: `${focusItem.label} mainly concerns ${
        focusItem.themes.length ? focusItem.themes.join(", ") : "the provisions shown in the retrieved passages"
	      }. ${words(selected.map(({ passage }) => passage.content).join(" "), 95)}`,
      citations: selected.map(({ citation }) => citation),
    };
  });
  if (!hasUsefulItems(normalized.differences)) {
    normalized.differences = differenceItems;
  } else {
    normalized.differences = mergeComparisonItems(
      normalized.differences,
      differenceItems,
      10,
    );
  }

  const keyClauseItems = groups.flatMap((group) =>
    firstPassages(group, [
      "section",
      "clause",
      "shall",
      "insert",
      "substitute",
      "amendment",
      "financial memorandum",
      "memorandum regarding delegated legislation",
    ], 3).map(({ passage, citation }, index) => ({
      documentId: String(group.document.id),
      clause: `${documentLabel(group.documentIndex)} key provision ${index + 1}`,
      analysis: words(passage.content, 85),
      citations: [citation],
    })),
  );
  if (!hasUsefulItems(normalized.keyClauses)) {
    normalized.keyClauses = keyClauseItems.slice(0, 12);
  } else {
    normalized.keyClauses = mergeComparisonItems(
      normalized.keyClauses,
      keyClauseItems,
      12,
    );
  }

  const stakeholderItems = [];
  groups.forEach((group) => {
    const doc = group.document;
    const government = matchingPassages(group, ["government", "council", "official gazette", "rules", "prescribed", "notify"], 2);
    if (government.length) {
      stakeholderItems.push({
        name: doc.authority || doc.ministry || "Government / tax administration",
        impact: `${documentLabel(group.documentIndex)} affects rule-making, notification, administration or enforcement powers described in the retrieved passage.`,
        citations: government.map(({ citation }) => citation),
      });
    }
    const taxpayers = matchingPassages(group, ["taxable person", "registered person", "input tax credit", "return", "appeal", "penalty", "interest"], 2);
    if (taxpayers.length) {
      stakeholderItems.push({
        name: "Registered taxpayers and affected businesses",
        impact: `${documentLabel(group.documentIndex)} affects taxpayer compliance, credits, appeals, payments, penalties or reporting obligations.`,
        citations: taxpayers.map(({ citation }) => citation),
      });
    }
    const sector = matchingPassages(group, ["alcohol", "rectified spirit", "unique identification", "track and trace", "goods or packages", "co-insurance", "insurer"], 2);
    if (sector.length) {
      stakeholderItems.push({
        name: "Sector-specific businesses covered by the amendment",
        impact: `${documentLabel(group.documentIndex)} contains sector-specific provisions that may affect the businesses or goods named in the cited passage.`,
        citations: sector.map(({ citation }) => citation),
      });
    }
  });
  if (!hasUsefulItems(normalized.stakeholders)) {
    normalized.stakeholders = stakeholderItems.slice(0, 12);
  } else {
    normalized.stakeholders = mergeComparisonItems(
      normalized.stakeholders,
      stakeholderItems,
      12,
    );
  }

  const complianceItems = groups.flatMap((group) =>
    matchingPassages(group, [
      "shall",
      "furnish",
      "maintain",
      "affix",
      "return",
      "penalty",
      "interest",
      "input tax credit",
      "appeal",
      "payment",
      "registered persons",
    ], 3).map(({ passage, citation }) => ({
      point: `${documentLabel(group.documentIndex)} creates or clarifies compliance consequences around ${words(passage.content, 58)}.`,
      citations: [citation],
    })),
  );
  if (!hasUsefulItems(normalized.complianceImpact)) {
    normalized.complianceImpact = complianceItems.slice(0, 12);
  } else {
    normalized.complianceImpact = mergeComparisonItems(
      normalized.complianceImpact,
      complianceItems,
      12,
    );
  }

  const timelineItems = [];
  documents.forEach((document, index) => {
    if (document.publicationDate) {
      timelineItems.push({
        date: String(document.publicationDate).slice(0, 10),
        event: `${documentLabel(index)} publication or catalogue date for ${documentShortTitle(document)}.`,
        documentId: String(document.id),
        citations: citations.filter((citation) => citation.documentId === document.id).slice(0, 1).map((citation) => citation.id),
      });
    } else if (document.year) {
      timelineItems.push({
        date: String(document.year),
        event: `${documentLabel(index)} belongs to the ${document.year} legislative cycle.`,
        documentId: String(document.id),
        citations: citations.filter((citation) => citation.documentId === document.id).slice(0, 1).map((citation) => citation.id),
      });
    }
  });
  groups.forEach((group) => {
    const datedPassages = matchingPassages(group, [
      "commence",
      "notification",
      "official gazette",
      "ordinance",
      "promulgated",
      "introduced",
      "date",
      "november",
      "june",
      "july",
      "october",
    ], 3);
    datedPassages.forEach(({ passage, citation }) => {
      timelineItems.push({
        date: "From retrieved text",
        event: words(passage.content, 60),
        documentId: String(group.document.id),
        citations: [citation],
      });
    });
  });
  if (!hasUsefulItems(normalized.timeline)) {
    normalized.timeline = timelineItems.slice(0, 12);
  } else {
    normalized.timeline = mergeComparisonItems(
      normalized.timeline,
      timelineItems,
      12,
    );
  }

  const authorityItems = groups.map((group) => {
    const selected = matchingPassages(group, ["government", "council", "authority", "tribunal", "proper officer", "state government", "rules", "prescribed"], 3);
    return {
      point: `${documentLabel(group.documentIndex)} authority focus: ${group.document.authority || group.document.ministry || "not specified in metadata"}. ${words(selected.map(({ passage }) => passage.content).join(" "), 70)}`,
      citations: selected.map(({ citation }) => citation),
    };
  });
  if (!hasUsefulItems(normalized.authorityDifferences)) {
    normalized.authorityDifferences = authorityItems.filter((item) => item.citations.length).slice(0, 10);
  } else {
    normalized.authorityDifferences = mergeComparisonItems(
      normalized.authorityDifferences,
      authorityItems.filter((item) => item.citations.length),
      10,
    );
  }

  const impactItems = focus.map((item, index) => {
    const group = groups[index];
    const selected = firstPassages(group, ["tax", "credit", "penalty", "compliance", "government", "track", "appeal", "return", "goods"], 3);
    return {
      point: `${item.label} practical effect: ${item.themes.length ? item.themes.join(", ") : "changes identified in the retrieved passages"}. This matters for ${group.document.ministry || group.document.authority || "the relevant public authority"} and affected taxpayers or regulated entities.`,
      citations: selected.map(({ citation }) => citation),
    };
  });
  if (!hasUsefulItems(normalized.impactAssessment)) {
    normalized.impactAssessment = impactItems.filter((item) => item.citations.length).slice(0, 10);
  } else {
    normalized.impactAssessment = mergeComparisonItems(
      normalized.impactAssessment,
      impactItems.filter((item) => item.citations.length),
      10,
    );
  }

  const keyFindingItems = [
    {
      point: `${focus.map((item) => `${item.label} focuses on ${item.themes.length ? item.themes.join(", ") : "different retrieved provisions"}`).join("; ")}.`,
      citations: allCitationIds.slice(0, 8),
    },
    {
      point: "The comparison should be read as evidence-limited: each finding is grounded in retrieved passages and should be checked against the original source for final legal use.",
      citations: allCitationIds.slice(0, 8),
    },
  ].filter((item) => item.citations.length);
  if (!hasUsefulItems(normalized.keyFindings)) {
    normalized.keyFindings = keyFindingItems;
  } else {
    normalized.keyFindings = mergeComparisonItems(
      normalized.keyFindings,
      keyFindingItems,
      8,
    );
  }

  if (!normalized.executiveSummary || EMPTY_FIELD_PATTERN.test(String(normalized.executiveSummary).trim())) {
    normalized.executiveSummary = `${documents.map((document, index) => `${documentLabel(index)} (${documentShortTitle(document)})`).join(" and ")} are compared from retrieved source passages. ${focus.map((item) => `${item.label} mainly covers ${item.themes.length ? item.themes.join(", ") : "the cited provisions"}`).join("; ")}.`;
  }

  if (!Array.isArray(normalized.suggestedQuestions) || !normalized.suggestedQuestions.length) {
    normalized.suggestedQuestions = [
      "Which provisions create the biggest compliance burden?",
      "Which institutions or authorities receive new powers?",
      "What changed between these documents in practical terms?",
      "Which findings are strongest based on the cited passages?",
    ];
  }

  normalized.quality = {
    ...(normalized.quality || {}),
    backfilled: true,
    backfilledSections: normalizedFields.filter((field) => hasUsefulItems(normalized[field])),
  };
  return normalized;
};

const validateComparisonOutput = (generated = {}, citations = []) => {
  const summary = String(generated.executiveSummary || "").trim();
  const citationIds = new Set((citations || []).map((citation) => String(citation.id)));
  const analyticalSections = [
    "similarities", "differences", "keyClauses", "stakeholders",
    "complianceImpact", "timeline", "authorityDifferences",
    "impactAssessment", "keyFindings",
  ];
  const substantiveSections = analyticalSections.filter((section) =>
    hasUsefulItems(generated[section]),
  );
  const citedItems = analyticalSections.flatMap((section) =>
    (Array.isArray(generated[section]) ? generated[section] : [])
      .filter((item) => Array.isArray(item?.citations) && item.citations.some((id) => citationIds.has(String(id)))),
  ).length;
  if (!summary) return { valid: false, status: "GENERATION_FAILED", reason: "EMPTY_SUMMARY" };
  if (generated.generationMode === "evidence_abstention") {
    return { valid: true, status: "INSUFFICIENT_EVIDENCE", reason: null };
  }
  if (!substantiveSections.length || !citedItems) {
    return { valid: false, status: "INSUFFICIENT_EVIDENCE", reason: "ANALYTICALLY_EMPTY" };
  }
  return {
    valid: true,
    status: generated.generationMode === "extractive_fallback" ? "PARTIAL_EVIDENCE" : "SUCCESS",
    reason: null,
    substantiveSections,
    citedItems,
  };
};

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
  currentVersion: Number(row.current_version || 1),
  regenerationStatus: row.regeneration_status || "idle",
  lastRegeneratedAt: row.last_regenerated_at || null,
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
    point: `${document.title}: ${words(
      passages
        .slice(0, 3)
        .map((passage) => passage.content)
        .join(" "),
      95,
    ) || "No passage available."}`,
    citations: passages
      .slice(0, 3)
      .map((_, passageIndex) => `D${index + 1}-C${passageIndex + 1}`),
  }));
  const similarities = [];
  const differences = groups.flatMap(({ document, passages }, index) =>
    passages.slice(0, 4).map((passage, passageIndex) => ({
      topic: `${document.title} — evidence point ${passageIndex + 1}`,
      analysis: words(passage.content, 95),
      citations: [`D${index + 1}-C${passageIndex + 1}`],
    })),
  );
  const keyClauses = groups.flatMap(({ document, passages }, index) =>
    passages.slice(0, 4).map((passage, passageIndex) => ({
      documentId: String(document.id),
      clause: `${documentLabel(index)} retrieved provision ${passageIndex + 1}`,
      analysis: words(passage.content, 90),
      citations: [`D${index + 1}-C${passageIndex + 1}`],
    })),
  );
  const impactAssessment = groups.flatMap(({ document, passages }, index) =>
    passages.slice(0, 3).map((passage, passageIndex) => ({
      point: `${documentLabel(index)} practical implication from ${document.title}: ${words(
        passage.content,
        80,
      )}`,
      citations: [`D${index + 1}-C${passageIndex + 1}`],
    })),
  );
  return {
    generationMode: "extractive_fallback",
    generationError: sanitizeProviderError(generationError),
    language,
    executiveSummary,
    similarities,
    differences,
    keyClauses,
    stakeholders: [],
    complianceImpact: [],
    timeline: [],
    authorityDifferences: [],
    impactAssessment,
    keyFindings: [
      ...keyFindings,
      {
        point:
          "The fallback comparison is evidence-grounded but not interpretive; regenerate to replace this with the full AI-written comparative analysis.",
        citations: citations.slice(0, 6).map((citation) => citation.id),
      },
    ],
    suggestedQuestions: [
      "What are the main implementation differences?",
      "Which authorities or institutions are affected?",
      "What evidence supports each difference?",
    ],
  };
};

const persistInitialComparison = async ({
  userId, title, documentIds, mode, language, userQuestion, result,
  recommendedDocuments,
}) => {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    const inserted = await client.query(
      `INSERT INTO document_comparisons (
         user_id, title, document_ids_json, mode, language, user_question,
         result_json, recommended_documents_json, current_version
       )
       VALUES ($1, $2, $3::jsonb, $4, $5, $6, $7::jsonb, $8::jsonb, 1)
       RETURNING *`,
      [
        userId, title, JSON.stringify(documentIds), mode, language,
        userQuestion || null, JSON.stringify(result),
        JSON.stringify(recommendedDocuments),
      ],
    );
    const row = inserted.rows[0];
    await client.query(
      `INSERT INTO document_comparison_versions (
         comparison_id, version_number, document_ids_json, mode, language,
         user_question, result_json, generation_mode, timings_json
       ) VALUES ($1, 1, $2::jsonb, $3, $4, $5, $6::jsonb, $7, $8::jsonb)
       ON CONFLICT (comparison_id, version_number) DO NOTHING`,
      [
        row.id, JSON.stringify(documentIds), mode, language,
        userQuestion || null, JSON.stringify(result), result.generationMode || null,
        JSON.stringify(result.telemetry || {}),
      ],
    );
    await client.query("COMMIT");
    return mapComparison(row);
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
};

const persistRegeneratedComparison = async ({
  userId, comparisonId, title, documentIds, mode, language, userQuestion,
  result, recommendedDocuments,
}) => {
  assertCitationDocumentScope(result, documentIds);
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    const locked = await client.query(
      `SELECT * FROM document_comparisons
        WHERE id::TEXT = $1 AND user_id = $2
        FOR UPDATE`,
      [comparisonId, userId],
    );
    const current = locked.rows[0];
    if (!current) throw validationError("Comparison not found.", 404);
    if (!sameDocumentScope(
      (current.document_ids_json || []).map(String),
      documentIds.map(String),
    )) {
      throw validationError("The saved comparison document scope changed during regeneration.", 409);
    }
    const version = Number(current.current_version || 1) + 1;
    await client.query(
      `INSERT INTO document_comparison_versions (
         comparison_id, version_number, document_ids_json, mode, language,
         user_question, result_json, generation_mode, timings_json
       ) VALUES ($1, $2, $3::jsonb, $4, $5, $6, $7::jsonb, $8, $9::jsonb)`,
      [
        current.id, version, JSON.stringify(documentIds), mode, language,
        userQuestion || null, JSON.stringify(result), result.generationMode || null,
        JSON.stringify(result.telemetry || {}),
      ],
    );
    const updated = await client.query(
      `UPDATE document_comparisons
          SET title = $3, mode = $4, language = $5, user_question = $6,
              result_json = $7::jsonb,
              recommended_documents_json = $8::jsonb,
              current_version = $9,
              regeneration_status = 'idle',
              regeneration_started_at = NULL,
              regeneration_failure_stage = NULL,
              last_regenerated_at = NOW(),
              updated_at = NOW()
        WHERE id::TEXT = $1 AND user_id = $2
        RETURNING *`,
      [
        comparisonId, userId, title, mode, language, userQuestion || null,
        JSON.stringify(result), JSON.stringify(recommendedDocuments), version,
      ],
    );
    await client.query("COMMIT");
    return mapComparison(updated.rows[0]);
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
};

const createComparison = async (userId, payload, options = {}) => {
  const startedAt = Date.now();
  const forceGeneration = options.forceGeneration === true;
  const comparisonId = options.comparisonId ? String(options.comparisonId) : null;
  const onStage = typeof options.onStage === "function" ? options.onStage : () => undefined;
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
  const topK = comparisonRetrievalLimit(mode, documents.length);
  const passageCharLimit = comparisonPassageCharLimit();
  const settings = retrievalConfig();
  const flags = resolveResearchFlags({ actorId: userId });
  const retrievalPlan = applyResearchFlags(
    planQuery(userQuestion || comparisonQuery(mode), {
      comparison: true,
      documentCount: documents.length,
    }),
    flags,
  );
  const groups = await Promise.all(
    documents.map(async (document, documentIndex) => {
      const retrieval = await retrieveDocumentContext(
        document.type,
        document.id,
        userQuestion || comparisonQuery(mode),
        { topK, plan: retrievalPlan, document, flags, accountId: userId },
      );
      const passages = selectContextPassages(retrieval.passages || [], {
        tokenBudget: Math.floor(settings.contextTokenBudget / documents.length),
        perPassageChars: passageCharLimit,
      });
      if (!passages.some((passage) => passage.content.trim())) {
        throw validationError(`${document.title}: No extractable text.`, 422);
      }
      return {
        document,
        passages: passages.filter((passage) => passage.content.trim()),
        documentIndex,
        retrievalMode: retrieval.retrievalMode,
        retrievalDiagnostics: retrieval.diagnostics,
      };
    }),
  );
  onStage("comparison_regenerate_retrieval_complete", {
    comparisonId,
    documentCount: documents.length,
    durationMs: Date.now() - startedAt,
  });

  const citations = [];
  const context = groups
    .map(({ document, passages, documentIndex }) => {
      const documentLabel = `D${documentIndex + 1}`;
      return [
        `=== ${documentLabel}: ${document.title} (${document.type}) ===`,
        ...passages.map((passage, passageIndex) => {
          const label = `${documentLabel}-C${passageIndex + 1}`;
          citations.push(buildComparisonCitation({ label, document, passage }));
          return `[${label}] ${passage.content.slice(0, passageCharLimit)}`;
        }),
      ].join("\n\n");
    })
    .join("\n\n");

  const graphStartedAt = Date.now();
  const graphIntelligence = await getComparisonGraphOverlap(documentIds);
  const graphLatencyMs = Date.now() - graphStartedAt;
  const sourceVerifiedGraphRelationships = graphIntelligence.relationships
    .filter((relationship) => relationship.isVerified);
  const graphContext = sourceVerifiedGraphRelationships.length
    ? [
        "=== VERIFIED KNOWLEDGE GRAPH RELATIONSHIPS ===",
        ...sourceVerifiedGraphRelationships.map((relationship) =>
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
  const comparisonEvidence = citations.map((citation) => {
    const passage = groups.find(({ document }) =>
      String(document.id) === String(citation.documentId))
      ?.passages.find((item) => item.chunkIndex === citation.chunkIndex);
    return {
      ...citation,
      citationId: citation.id,
      content: passage?.content || citation.snippet,
      authorityClass: passage?.authorityClass,
    };
  });
  const sufficiency = flags.evidenceSufficiency ? assessEvidenceSufficiency(
    userQuestion || comparisonQuery(mode),
    comparisonEvidence,
    {
      queryType: "COMPARISON",
      retrievalVerified: groups.every(({ passages }) => passages.length > 0),
      minimumEvidence: documents.length,
    },
  ) : {
    level: SUFFICIENCY_LEVELS.MEDIUM,
    decision: "SUFFICIENT",
    signals: {}, reasons: ["Evidence gate disabled by controlled rollout."],
    missing: [], conflicts: [], version: "legacy-pass-through-v1",
  };
  const model = providerConfig().chatModel;
  const evidenceHash = stableHash(comparisonEvidence.map((item) => ({
    id: item.citationId,
    documentId: item.documentId,
    chunkIndex: item.chunkIndex,
    content: item.content,
  })));
  const analysisKey = flags.caching ? analysisCacheKey({
    kind: "comparison", userId, documentIds, mode, language,
    question: userQuestion || comparisonQuery(mode), model,
    promptVersion: "document-comparison-v3", evidenceHash,
    versions: groups[0]?.retrievalDiagnostics?.versions || {
      ...settings.versions,
      embeddingVersion: providerConfig().embeddingModel,
    },
  }) : null;
  // Regeneration intentionally rebuilds the AI analysis from the currently
  // valid evidence. Extraction/chunk caches remain reusable, but the previous
  // generated comparison must never be returned as the regenerated version.
  const cachedAnalysis = !forceGeneration && analysisKey
    ? caches.analysis.get(analysisKey)
    : null;
  let generationLatencyMs = 0;
  let verificationLatencyMs = 0;
  let generated;
  if ([
    SUFFICIENCY_LEVELS.INSUFFICIENT,
    SUFFICIENCY_LEVELS.CONFLICTING,
  ].includes(sufficiency.level)) {
    generated = {
      generationMode: "evidence_abstention",
      executiveSummary: buildAbstentionResponse(sufficiency, {
        documentTitles: comparisonDocuments.map((document) => document.title),
      }),
      similarities: [], differences: [], keyClauses: [], stakeholders: [],
      complianceImpact: [], timeline: [], authorityDifferences: [],
      impactAssessment: [], keyFindings: [],
      suggestedQuestions: [
        "Which additional official sources should be prepared?",
        "Can the comparison be narrowed to a specific provision?",
      ],
    };
  } else if (cachedAnalysis) {
    generated = cachedAnalysis.generated;
  } else {
    const generationStartedAt = Date.now();
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
      if (!allowExtractiveComparisonFallback()) {
        const generationUnavailable = new Error("Comparison AI generation failed.");
        generationUnavailable.status = 503;
        generationUnavailable.publicMessage =
          "AI comparison generation is temporarily unavailable. Please retry in a moment.";
        generationUnavailable.details = {
          retryable: true,
          generationMode: "ai_required",
          providerError: sanitizeProviderError(error),
        };
        throw generationUnavailable;
      }
      console.warn(
        "Comparison AI generation failed; returning grounded extractive comparison:",
        sanitizeProviderError(error),
      );
      generated = extractiveComparisonFallback({
        mode,
        language,
        userQuestion,
        documents: comparisonDocuments,
        groups,
        citations,
        generationError: error,
      });
    } finally {
      generationLatencyMs = Date.now() - generationStartedAt;
      if (comparisonId) {
        onStage("comparison_regenerate_generation_complete", {
          comparisonId,
          documentCount: documents.length,
          durationMs: generationLatencyMs,
        });
      }
    }
  }
  let claimVerification = cachedAnalysis?.claimVerification || {
    removedUnsupportedItems: 0,
    verifiedCitationCount: citations.length,
  };
  if (generated.generationMode !== "evidence_abstention" && !cachedAnalysis) {
    generated = comparisonSectionBackfill({
      documents: comparisonDocuments,
      groups,
      citations,
      generated,
    });
    const verificationStartedAt = Date.now();
    const verified = flags.citationVerifier
      ? verifyStructuredComparison(generated, comparisonEvidence)
      : { generated, report: claimVerification };
    generated = verified.generated;
    claimVerification = verified.report;
    verificationLatencyMs = Date.now() - verificationStartedAt;
    if (analysisKey) caches.analysis.set(analysisKey, { generated, claimVerification });
  }
  if (comparisonId) {
    onStage("comparison_regenerate_verified", {
      comparisonId,
      documentCount: documents.length,
      durationMs: Date.now() - startedAt,
    });
  }
  const outputValidation = validateComparisonOutput(generated, citations);
  if (!outputValidation.valid) {
    generated = {
      ...generated,
      generationMode: "evidence_abstention",
      executiveSummary: buildAbstentionResponse(sufficiency, {
        documentTitles: comparisonDocuments.map((document) => document.title),
      }),
      quality: { ...(generated.quality || {}), outputValidation },
    };
  } else {
    generated.quality = { ...(generated.quality || {}), outputValidation };
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
    evidenceSufficiency: sufficiency,
    claimVerification,
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
    retrieval: groups.map(({ document, retrievalMode, passages, retrievalDiagnostics }) => ({
      documentId: document.id,
      retrievalMode,
      passages: passages.length,
      diagnostics: {
        ...retrievalDiagnostics,
        timings: {
          ...retrievalDiagnostics.timings,
          graphMs: graphLatencyMs,
        },
      },
    })),
    relationshipIntelligence: graphIntelligence,
    recommendedDocuments,
    cache: {
      status: cachedAnalysis ? "hit" : analysisKey ? "miss" : "bypass",
      version: "safe-repeat-analysis-v1",
      evidenceHash: evidenceHash.slice(0, 16),
      promptVersion: "document-comparison-v3",
      model,
    },
    telemetry: {
      retrievalLatencyMs: Math.max(
        ...groups.map((group) => group.retrievalDiagnostics?.timings?.totalMs || 0),
        0,
      ),
      graphLatencyMs,
      generationLatencyMs,
      verificationLatencyMs,
      totalLatencyMs: Date.now() - startedAt,
    },
  };
  const title = `Comparison: ${documents
    .map((document) => document.title)
    .join(" vs ")
    .slice(0, 450)}`;
  const retrievalDiagnostics = groups.map((group) => group.retrievalDiagnostics);
  await recordResearchTelemetry({
    userId,
    queryType: "COMPARISON",
    queryPlannerVersion: retrievalPlan.plannerVersion,
    ftsLatency: Math.max(...retrievalDiagnostics.map((item) => item.timings?.lexicalMs || 0), 0),
    vectorLatency: Math.max(...retrievalDiagnostics.map((item) => item.timings?.vectorMs || 0), 0),
    graphLatency: graphLatencyMs,
    fusionLatency: Math.max(...retrievalDiagnostics.map((item) => item.timings?.fusionMs || 0), 0),
    rerankLatency: Math.max(...retrievalDiagnostics.map((item) => item.timings?.rerankMs || 0), 0),
    generationLatency: generationLatencyMs,
    verificationLatency: verificationLatencyMs,
    lexicalCandidateCount: retrievalDiagnostics.reduce((sum, item) => sum + Number(item.candidateCounts?.lexical || 0), 0),
    vectorCandidateCount: retrievalDiagnostics.reduce((sum, item) => sum + Number(item.candidateCounts?.vector || 0), 0),
    fusedCandidateCount: retrievalDiagnostics.reduce((sum, item) => sum + Number(item.candidateCounts?.fused || 0), 0),
    finalEvidenceCount: comparisonEvidence.length,
    sourceAuthorityDistribution: retrievalDiagnostics.reduce((all, item) => {
      for (const [key, value] of Object.entries(item.authorityDistribution || {})) all[key] = (all[key] || 0) + value;
      return all;
    }, {}),
    topScores: retrievalDiagnostics.flatMap((item) => item.topScores || []).slice(0, 10),
    evidenceSufficiencyLevel: sufficiency.level,
    citationsGenerated: citations.length,
    citationsVerified: claimVerification.verifiedCitationCount,
    unsupportedClaimsRemoved: claimVerification.removedUnsupportedItems,
    abstained: generated.generationMode === "evidence_abstention",
    fallbackUsed: /fallback/.test(generated.generationMode || ""),
    tokensIn: Math.ceil((context.length + graphContext.length) / 4),
    tokensOut: Math.ceil(JSON.stringify(generated).length / 4),
    model,
    embeddingModel: providerConfig().embeddingModel,
    retrievalVersion: settings.versions.retrievalVersion,
    cacheStatus: cachedAnalysis ? "hit" : analysisKey ? "miss" : "bypass",
    flags: {
      ...flags,
      resourceTypes: [...new Set(comparisonEvidence.map((item) => item.resourceType).filter(Boolean))].slice(0, 5),
      htmlEvidenceCount: comparisonEvidence.filter((item) => item.resourceType === "html").length,
    },
  });
  return comparisonId
    ? persistRegeneratedComparison({
        userId, comparisonId, title, documentIds, mode, language,
        userQuestion, result, recommendedDocuments,
      })
    : persistInitialComparison({
        userId, title, documentIds, mode, language, userQuestion, result,
        recommendedDocuments,
      });
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

const claimComparisonRegeneration = async (userId, comparisonId) => {
  const result = await query(
    `UPDATE document_comparisons
        SET regeneration_status = 'processing',
            regeneration_started_at = NOW(),
            regeneration_failure_stage = NULL
      WHERE id::TEXT = $1 AND user_id = $2
        AND (
          regeneration_status <> 'processing'
          OR regeneration_started_at IS NULL
          OR regeneration_started_at < NOW() - ($3::TEXT || ' minutes')::INTERVAL
        )
      RETURNING *`,
    [comparisonId, userId, String(REGENERATION_CLAIM_TIMEOUT_MINUTES)],
  );
  if (result.rows[0]) return mapComparison(result.rows[0]);
  const existing = await getComparison(userId, comparisonId);
  if (!existing) throw validationError("Comparison not found.", 404);
  throw validationError(
    "This comparison is already being regenerated. Please wait for it to finish.",
    409,
  );
};

const releaseFailedRegeneration = async (
  userId,
  comparisonId,
  failureStage = "unknown",
) => {
  await query(
    `UPDATE document_comparisons
        SET regeneration_status = 'failed',
            regeneration_started_at = NULL,
            regeneration_failure_stage = $3,
            updated_at = NOW()
      WHERE id::TEXT = $1 AND user_id = $2`,
    [comparisonId, userId, String(failureStage || "unknown").slice(0, 80)],
  ).catch(() => undefined);
};

const regenerateComparison = async (userId, comparisonId, payload = {}, options = {}) => {
  const existing = await getComparison(userId, comparisonId);
  const request = resolveRegenerationRequest(existing, payload);
  await claimComparisonRegeneration(userId, comparisonId);
  try {
    return await createComparison(userId, request, {
      comparisonId,
      forceGeneration: true,
      onStage: options.onStage,
    });
  } catch (error) {
    await releaseFailedRegeneration(
      userId,
      comparisonId,
      error.failureStage || error.details?.failureStage ||
        (error.status === 422 ? "evidence" : error.status === 503 ? "generation" : "unknown"),
    );
    if (error.status === 503) {
      error.publicMessage =
        "There was a temporary AI-generation problem. Your previous comparison has been preserved.";
    } else if (error.status === 422 && error.details?.needsPreparation) {
      error.message =
        "The selected documents are being prepared. Try again shortly. Your previous comparison has been preserved.";
    } else if (error.status === 422) {
      error.message =
        "The available evidence was insufficient to regenerate this comparison. Your previous comparison has been preserved.";
    }
    throw error;
  }
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
  regenerateComparison,
  deleteComparison,
  allowExtractiveComparisonFallback,
  buildComparisonCitation,
  ensureResearchReady,
  comparisonSectionBackfill,
  validateComparisonOutput,
  getComparison,
  getComparisons,
  normalizeRequest,
  resolveRegenerationRequest,
  sameDocumentScope,
  assertCitationDocumentScope,
  readinessReason,
};
