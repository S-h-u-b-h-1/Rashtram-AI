const DOCUMENT_TYPES = new Set([
  "bill",
  "act",
  "gazette",
  "notification",
  "rule",
  "regulation",
  "circular",
  "order",
  "office_memorandum",
  "policy",
  "consultation_paper",
  "committee_report",
  "question",
  "debate",
  "proceeding",
  "guideline",
  "scheme",
  "strategy_paper",
  "white_paper",
  "manual",
  "report",
  "cabinet_decision",
  "press_release",
  "government_resolution",
  "resolution",
  "recommendation",
  "discussion_paper",
  "ordinance",
  "other",
]);

const TYPE_ALIASES = {
  bills: "bill",
  acts: "act",
  "gazette-notification": "gazette",
  "gazette-notifications": "gazette",
  "office-memorandum": "office_memorandum",
  "office-memoranda": "office_memorandum",
  "consultation-paper": "consultation_paper",
  "consultation-papers": "consultation_paper",
  "committee-report": "committee_report",
  "committee-reports": "committee_report",
  questions: "question",
  debates: "debate",
  proceedings: "proceeding",
  guidelines: "guideline",
  schemes: "scheme",
  "strategy-paper": "strategy_paper",
  "strategy-papers": "strategy_paper",
  "white-paper": "white_paper",
  "white-papers": "white_paper",
  manuals: "manual",
  reports: "report",
  "cabinet-decision": "cabinet_decision",
  "cabinet-decisions": "cabinet_decision",
  "press-release": "press_release",
  "press-releases": "press_release",
  "government-resolution": "government_resolution",
  "government-resolutions": "government_resolution",
  recommendations: "recommendation",
  "discussion-paper": "discussion_paper",
  "discussion-papers": "discussion_paper",
  rules: "rule",
  regulations: "regulation",
  circulars: "circular",
  orders: "order",
  policies: "policy",
  ordinances: "ordinance",
  "state-bill": "bill",
  "state-bills": "bill",
  "state-act": "act",
  "state-acts": "act",
};

const normalizeDocumentType = (value, { optional = false } = {}) => {
  const raw = String(value || "").trim().toLowerCase();
  if (!raw && optional) return null;
  const normalized = TYPE_ALIASES[raw] || raw.replace(/[\s-]+/g, "_");
  if (!DOCUMENT_TYPES.has(normalized)) {
    const error = new Error(
      `Unsupported document type: ${normalized || "missing"}`,
    );
    error.status = 400;
    throw error;
  }
  return normalized;
};

const normalizeTypeList = (value) => {
  if (!value) return [];
  const values = Array.isArray(value) ? value : String(value).split(",");
  return [...new Set(values.filter(Boolean).map((type) =>
    normalizeDocumentType(type),
  ))];
};

const retrievalFamilyForType = (value) => {
  const type = normalizeDocumentType(value);
  if (type === "bill") return "bill";
  if (type === "act") return "act";
  if (type === "policy") return "policy";
  return "gazette";
};

const isGazetteScope = (row) =>
  row.document_type === "gazette" ||
  ["egazette", "state-gazette"].includes(
    row.canonical_source || row.source_name,
  ) ||
  Boolean(row.gazette_identifier);

module.exports = {
  DOCUMENT_TYPES,
  TYPE_ALIASES,
  isGazetteScope,
  normalizeDocumentType,
  normalizeTypeList,
  retrievalFamilyForType,
};
