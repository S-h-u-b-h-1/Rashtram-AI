const { textFingerprint } = require("./hashing");

const DOCUMENT_TYPES = new Set([
  "bill",
  "act",
  "rule",
  "regulation",
  "notification",
  "gazette",
  "policy",
  "scheme",
  "circular",
  "committee_report",
  "debate",
  "question",
  "proceeding",
  "office_memorandum",
  "guideline",
  "ordinance",
  "order",
  "resolution",
  "report",
  "other",
]);

const SOURCE_PRIORITIES = {
  egazette: 10,
  "india-code": 20,
  "digital-sansad": 30,
  "lok-sabha": 30,
  "rajya-sabha": 30,
  "state-legislature": 30,
  ministry: 40,
  regulator: 40,
  "prs-india": 50,
  other: 100,
};

const cleanText = (value) => {
  const cleaned = String(value || "")
    .normalize("NFKC")
    .replace(/\s+/g, " ")
    .trim();
  return cleaned || null;
};

const normalizeTitle = (value) =>
  String(value || "")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/\b(the|a|an)\b/g, " ")
    .replace(/\b(bill|act|rules?|regulations?|ordinance|notification)\b/g, " ")
    .replace(/\b(19|20)\d{2}\b/g, " ")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();

const normalizeDate = (value) => {
  if (!value) return null;
  const numericMatch = String(value).match(
    /^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/,
  );
  if (numericMatch) {
    return `${numericMatch[3]}-${numericMatch[2].padStart(
      2,
      "0",
    )}-${numericMatch[1].padStart(2, "0")}`;
  }
  const namedMonthMatch = String(value).match(
    /^(\d{1,2})[-\s]([A-Za-z]{3,9})[-\s](\d{4})$/,
  );
  if (namedMonthMatch) {
    const date = new Date(
      `${namedMonthMatch[2]} ${namedMonthMatch[1]}, ${namedMonthMatch[3]} UTC`,
    );
    if (!Number.isNaN(date.getTime())) return date.toISOString().slice(0, 10);
  }
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 10);
};

const normalizeYear = (value, ...dateCandidates) => {
  const year = Number.parseInt(value, 10);
  if (year >= 1800 && year <= 2200) return year;
  for (const candidate of dateCandidates) {
    const date = normalizeDate(candidate);
    if (date) return Number(date.slice(0, 4));
  }
  return null;
};

const sourcePriorityFor = (sourceName) => {
  const normalized = String(sourceName || "").toLowerCase();
  const match = Object.entries(SOURCE_PRIORITIES).find(([key]) =>
    normalized.includes(key),
  );
  return match ? match[1] : SOURCE_PRIORITIES.other;
};

const inferDocumentType = (record) => {
  const explicit = String(record.documentType || "")
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
  if (DOCUMENT_TYPES.has(explicit)) return explicit;

  const value = `${record.title || ""} ${record.category || ""}`.toLowerCase();
  const matches = [
    ["office memorandum", "office_memorandum"],
    ["committee report", "committee_report"],
    ["regulation", "regulation"],
    ["notification", "notification"],
    ["ordinance", "ordinance"],
    ["circular", "circular"],
    ["guideline", "guideline"],
    ["scheme", "scheme"],
    ["policy", "policy"],
    ["rules", "rule"],
    ["rule", "rule"],
    ["bill", "bill"],
    ["act", "act"],
    ["debate", "debate"],
    ["question", "question"],
    ["gazette", "gazette"],
  ];
  return matches.find(([term]) => value.includes(term))?.[1] || "other";
};

const normalizeRecord = (record) => {
  const title = cleanText(record.title || record.sourceTitle);
  const sourceName = cleanText(record.sourceName);
  const sourceRecordId = cleanText(
    record.sourceRecordId || record.sourceDocumentId,
  );
  const sourceUrl = cleanText(
    record.sourceUrl || record.detailUrl || record.pdfUrl,
  );

  if (!title || !sourceName || !sourceRecordId || !sourceUrl) {
    throw new Error(
      "Every source record requires title, sourceName, sourceRecordId, and sourceUrl",
    );
  }

  const publicationDate = normalizeDate(record.publicationDate);
  const enactedDate = normalizeDate(record.enactedDate);
  const introducedDate = normalizeDate(record.introducedDate);
  const effectiveDate = normalizeDate(record.effectiveDate);
  const year = normalizeYear(
    record.year,
    publicationDate,
    enactedDate,
    introducedDate,
  );
  const normalizedTitle = normalizeTitle(title);
  const documentType = inferDocumentType(record);
  const legalIdentifier = cleanText(
    record.legalIdentifier || record.gazetteIdentifier,
  );

  return {
    ...record,
    sourceName,
    sourceRecordId,
    sourceDocumentId: sourceRecordId,
    sourceUrl,
    detailUrl: cleanText(record.detailUrl),
    pdfUrl: cleanText(record.pdfUrl),
    title,
    normalizedTitle,
    documentType,
    jurisdictionLevel: cleanText(record.jurisdictionLevel) || "union",
    jurisdiction: cleanText(record.jurisdiction) || "India",
    authority: cleanText(record.authority),
    ministry: cleanText(record.ministry),
    department: cleanText(record.department),
    category: cleanText(record.category),
    status: cleanText(record.status),
    legalIdentifier,
    billNumber: cleanText(record.billNumber),
    actNumber: cleanText(record.actNumber),
    gazetteIdentifier: cleanText(record.gazetteIdentifier),
    introducedDate,
    passedDate: normalizeDate(record.passedDate),
    enactedDate,
    publicationDate,
    effectiveDate,
    year,
    sourcePriority:
      Number.isFinite(record.sourcePriority) && record.sourcePriority > 0
        ? record.sourcePriority
        : sourcePriorityFor(sourceName),
    contentHash: cleanText(record.contentHash || record.pdfHash),
    textFingerprint:
      cleanText(record.textFingerprint) ||
      textFingerprint(record.fullText || record.summary),
    sourceMetadata: record.sourceMetadata || record.metadata || {},
    metadata: record.metadata || record.sourceMetadata || {},
    resources: Array.isArray(record.resources) ? record.resources : [],
    relationships: Array.isArray(record.relationships)
      ? record.relationships
      : [],
  };
};

module.exports = {
  DOCUMENT_TYPES,
  SOURCE_PRIORITIES,
  cleanText,
  inferDocumentType,
  normalizeDate,
  normalizeRecord,
  normalizeTitle,
  normalizeYear,
  sourcePriorityFor,
};
