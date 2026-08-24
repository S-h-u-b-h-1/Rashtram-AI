const { query } = require("../db");
const { sourceNameGroup } = require("../lib/ingestion/core/sourceIdentity");
const {
  SOURCE_AUTHORITY,
  classifySourceAuthority,
} = require("../retrieval/sourceAuthority");

const DATE_KINDS = Object.freeze([
  ["published", "publication_date"],
  ["introduced", "introduced_date"],
  ["passed", "passed_date"],
  ["assented", "assent_date"],
  ["notified", "notified_date"],
  ["effective_from", "effective_date"],
  ["commenced", "commencement_date"],
  ["amended", "amended_date"],
  ["repealed", "repealed_date"],
  ["superseded", "superseded_date"],
  ["effective_to", "expiry_date"],
]);
const VERIFIED_RELATIONSHIP_SOURCES = new Set(["official_source", "source_explicit"]);
const BEFORE_RELATIONSHIPS = new Set(["AMENDS", "REPEALS", "SUPERSEDES", "REPLACES"]);
const AFTER_RELATIONSHIPS = new Set(["AMENDED_BY", "REPEALED_BY", "SUPERSEDED_BY", "REPLACED_BY"]);

const isoDate = (value) => {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString().slice(0, 10);
};

const isoCalendarDate = (year, month, day) => {
  const value = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
  if (Number.isNaN(value.getTime()) || value.getUTCFullYear() !== Number(year) ||
      value.getUTCMonth() !== Number(month) - 1 || value.getUTCDate() !== Number(day)) {
    return null;
  }
  return value.toISOString().slice(0, 10);
};

const parseTemporalIntent = (question) => {
  const text = String(question || "").trim();
  const iso = text.match(/\b(20\d{2}|19\d{2})-(0[1-9]|1[0-2])-([0-2]\d|3[01])\b/);
  const named = text.match(/\b([0-3]?\d)\s+(January|February|March|April|May|June|July|August|September|October|November|December)\s+(20\d{2}|19\d{2})\b/i);
  const fy = text.match(/\bFY\s*(20\d{2})\s*[-–]\s*(\d{2,4})\b/i);
  let targetDate = null;
  let range = null;
  if (iso) targetDate = isoCalendarDate(iso[1], iso[2], iso[3]);
  if (named) {
    const month = ["january", "february", "march", "april", "may", "june", "july",
      "august", "september", "october", "november", "december"].indexOf(named[2].toLowerCase()) + 1;
    targetDate = isoCalendarDate(named[3], month, named[1]);
  }
  if (fy) {
    const startYear = Number(fy[1]);
    const rawEnd = String(fy[2]);
    const endYear = rawEnd.length === 2 ? Number(`${String(startYear).slice(0, 2)}${rawEnd}`) : Number(rawEnd);
    range = { from: `${startYear}-04-01`, to: `${endYear}-03-31` };
  }
  return {
    targetDate,
    range,
    asksApplicability: /\b(applied|applicable|in force|which version|as of)\b/i.test(text),
    asksCurrentStatus: /\b(current(?:ly)?|present status|latest|still (?:valid|active|applicable|operative|pending|in force)|now (?:an? )?(?:act|law|rule)|has .* (?:passed|lapsed|expired|been amended|been repealed|been superseded)|is .* (?:pending|operative|active))\b/i.test(text),
    asksChange: /\b(changed?|before|after|amend|repeal|supersed|current(?:ly)?|present status|latest|still (?:valid|active|applicable|operative|pending|in force))\b/i.test(text),
  };
};

const temporalEventsFromDocument = (document = {}) => DATE_KINDS
  .map(([kind, field]) => ({
    kind,
    date: isoDate(document[field]),
    dateBasis: field,
    verificationStatus: document.temporal_metadata_json?.[kind]?.verificationStatus ||
      (document[field] ? "catalogue_recorded" : "unknown"),
    sourceUrl: document.canonical_url || null,
    documentId: document.id == null ? null : String(document.id),
  }))
  .filter((event) => event.date);

const verifiedRelationship = (row) => row.relationship_evidence?.sourceVerified === true ||
  VERIFIED_RELATIONSHIP_SOURCES.has(String(row.relationship_source || ""));

const applicabilityAt = (document, targetDate) => {
  const target = isoDate(targetDate);
  if (!target) return { status: "unknown", reason: "target_date_missing" };
  const effective = isoDate(document.effective_date);
  const commenced = isoDate(document.commencement_date);
  const start = effective || commenced;
  if (!start) return {
    status: "unknown",
    reason: "effective_or_commencement_date_unverified",
    publicationDate: isoDate(document.publication_date),
  };
  const ends = [document.expiry_date, document.repealed_date, document.superseded_date]
    .map(isoDate).filter(Boolean).sort();
  const end = ends[0] || null;
  if (target < start) return { status: "not_yet_effective", effectiveFrom: start, effectiveTo: end };
  if (end && target >= end) return { status: "no_longer_effective", effectiveFrom: start, effectiveTo: end };
  return { status: "potentially_effective", effectiveFrom: start, effectiveTo: end,
    caveat: "Based only on recorded temporal metadata and verified relationships." };
};

const loadTemporalContext = async (documentId, queryFn = query) => {
  const documentResult = await queryFn(`SELECT current.id, current.title,
       current.document_type, current.jurisdiction, current.canonical_url,
       COALESCE(registry.source_name, legacy.canonical_source, legacy.source_name)
         AS canonical_source,
       COALESCE(legacy.source_name, registry.source_name) AS source_name,
       current.updated_at,
       current.publication_date, current.introduced_date, current.passed_date,
       current.assent_date,
       COALESCE(current.notified_date, legacy.notified_date) AS notified_date,
       COALESCE(current.effective_date, legacy.effective_date) AS effective_date,
       COALESCE(current.commencement_date, legacy.commencement_date) AS commencement_date,
       COALESCE(current.amended_date, legacy.amended_date) AS amended_date,
       COALESCE(current.repealed_date, legacy.repealed_date) AS repealed_date,
       COALESCE(current.superseded_date, legacy.superseded_date) AS superseded_date,
       current.expiry_date,
       COALESCE(current.temporal_metadata_json, legacy.temporal_metadata_json, '{}'::jsonb)
         AS temporal_metadata_json
     FROM documents current
     LEFT JOIN legislative_documents legacy ON legacy.id = current.id
     LEFT JOIN source_registry registry ON registry.id = current.canonical_source_id
     WHERE current.id = $1 AND current.visibility_status = 'public'`, [documentId]);
  const document = documentResult.rows[0] || null;
  if (!document) return null;
  const relationshipResult = await queryFn(`SELECT relationship.relationship_type,
       relationship.relationship_source, relationship.relationship_evidence,
       relationship.source_url, related.id AS related_id, related.title AS related_title,
       related.canonical_url AS related_url, related.publication_date,
       COALESCE(related.notified_date, related_legacy.notified_date) AS notified_date,
       COALESCE(related.effective_date, related_legacy.effective_date) AS effective_date,
       COALESCE(related.commencement_date, related_legacy.commencement_date) AS commencement_date,
       COALESCE(related.repealed_date, related_legacy.repealed_date) AS repealed_date,
       COALESCE(related.superseded_date, related_legacy.superseded_date) AS superseded_date,
       related.expiry_date,
       COALESCE(related.temporal_metadata_json, related_legacy.temporal_metadata_json, '{}'::jsonb)
         AS temporal_metadata_json
     FROM document_relationships relationship
     JOIN documents related ON related.id = relationship.to_document_id
     LEFT JOIN legislative_documents related_legacy ON related_legacy.id = related.id
     WHERE relationship.from_document_id = $1
       AND relationship.relationship_type = ANY($2::TEXT[])
       AND related.visibility_status = 'public'
     ORDER BY COALESCE(related.effective_date, related.commencement_date,
       related.notified_date, related.publication_date) ASC NULLS LAST
     LIMIT 50`, [documentId, ["AMENDS", "AMENDED_BY", "REPEALS", "REPEALED_BY",
    "SUPERSEDES", "SUPERSEDED_BY", "COMMENCES", "COMMENCED_BY", "IMPLEMENTS", "IMPLEMENTED_BY"]]);
  return {
    document,
    events: temporalEventsFromDocument(document),
    relationships: relationshipResult.rows.filter(verifiedRelationship).map((row) => ({
      type: row.relationship_type,
      verificationStatus: "source_verified",
      sourceUrl: row.source_url || row.related_url || null,
      documentId: String(row.related_id),
      title: row.related_title,
      events: temporalEventsFromDocument({ ...row, id: row.related_id, canonical_url: row.related_url }),
    })),
  };
};

const loadRelatedTemporalEvidence = async (context, question, queryFn = query) => {
  const relatedIds = [...new Set(context.relationships.map((item) => item.documentId))];
  const text = String(question || "").trim();
  if (!relatedIds.length || !text) return [];
  const result = await queryFn(`WITH search AS (
       SELECT websearch_to_tsquery('simple', $1) AS ts_query
     )
     SELECT chunk.document_id, document.title, document.canonical_url,
       chunk.chunk_index, chunk.original_text, chunk.translated_text,
       chunk.language, chunk.metadata_json,
       ts_rank_cd(to_tsvector('simple', COALESCE(chunk.original_text, '')),
         search.ts_query) AS fts_score
     FROM document_text_chunks chunk
     JOIN documents document ON document.id = chunk.document_id
     CROSS JOIN search
     WHERE chunk.document_id = ANY($2::BIGINT[])
       AND document.visibility_status = 'public'
       AND to_tsvector('simple', COALESCE(chunk.original_text, '')) @@ search.ts_query
     ORDER BY fts_score DESC, chunk.document_id, chunk.chunk_index
     LIMIT 12`, [text, relatedIds]);
  const relationshipByDocument = new Map(
    context.relationships.map((item) => [item.documentId, item]),
  );
  return result.rows.map((row, index) => {
    const metadata = row.metadata_json || {};
    const relationship = relationshipByDocument.get(String(row.document_id));
    const role = BEFORE_RELATIONSHIPS.has(relationship?.type)
      ? "previous_version"
      : AFTER_RELATIONSHIPS.has(relationship?.type) ? "later_version" : "related_temporal_source";
    return {
      passage: index + 1,
      documentId: String(row.document_id),
      score: Number(row.fts_score || 0),
      ftsScore: Number(row.fts_score || 0),
      chunkIndex: Number(row.chunk_index),
      content: String(row.original_text || row.translated_text || "").trim(),
      source: row.title,
      sourceUrl: metadata.sourceUrl || row.canonical_url || relationship?.sourceUrl || null,
      pdfUrl: metadata.pdfUrl || null,
      pageStart: metadata.pageStart || null,
      pageEnd: metadata.pageEnd || null,
      sectionId: metadata.sectionId || null,
      sectionTitle: metadata.sectionTitle || null,
      languageCode: metadata.languageCode || row.language || "und",
      structuralType: "historical_source_passage",
      retrievalMode: "temporal_fts",
      temporalRole: role,
      relationshipType: relationship?.type || null,
      authorityClass: classifySourceAuthority({
        sourceUrl: metadata.sourceUrl || row.canonical_url || relationship?.sourceUrl,
        source: row.title,
      }),
      publicationDate: relationship?.events?.find((event) => event.kind === "published")?.date || null,
      effectiveDate: relationship?.events?.find((event) => event.kind === "effective_from")?.date || null,
    };
  }).filter((passage) => passage.content);
};

const buildBeforeAfterComparison = ({ previousPassages = [], currentPassages = [] } = {}) => {
  if (!previousPassages.length || !currentPassages.length) return {
    status: "insufficient_source_evidence",
    previousProvision: previousPassages,
    currentProvision: currentPassages,
    limitation: "A before/after conclusion requires cited text from both versions.",
  };
  return {
    status: "source_evidence_available",
    previousProvision: previousPassages,
    currentProvision: currentPassages,
    limitation: null,
  };
};

const retrieveTemporalPassages = async (documentId, question, queryFn = query) => {
  const context = await loadTemporalContext(documentId, queryFn);
  if (!context) return [];
  const intent = parseTemporalIntent(question);
  const relatedEvidence = intent.asksChange
    ? await loadRelatedTemporalEvidence(context, question, queryFn)
    : [];
  const applicabilityDate = intent.targetDate || (intent.asksCurrentStatus
    ? new Date().toISOString().slice(0, 10)
    : null);
  const applicability = applicabilityDate
    ? applicabilityAt(context.document, applicabilityDate) : null;
  const ownEvents = context.events.map((event, index) => ({
    passage: index + 1,
    score: 1,
    lexicalScore: 1,
    chunkIndex: `temporal:${event.kind}`,
    content: `${event.kind}: ${event.date}. Date basis: ${event.dateBasis}. Verification: ${event.verificationStatus}.`,
    source: "Recorded document temporal metadata",
    documentId: String(documentId),
    sourceUrl: event.sourceUrl,
    structuralType: "temporal_metadata",
    retrievalMode: "temporal",
    temporal: event,
  }));
  const related = context.relationships.flatMap((relationship) =>
    relationship.events.map((event) => ({
      passage: 0,
      score: 0.9,
      lexicalScore: 0.9,
      chunkIndex: `temporal-related:${relationship.documentId}:${event.kind}`,
      content: `${relationship.type}: ${relationship.title}. ${event.kind}: ${event.date}. Verification: source_verified.`,
      source: relationship.title,
      documentId: relationship.documentId,
      sourceUrl: relationship.sourceUrl || event.sourceUrl,
      structuralType: "verified_temporal_relationship",
      retrievalMode: "temporal",
      temporal: event,
      relationshipType: relationship.type,
      authorityClass: classifySourceAuthority({
        sourceUrl: relationship.sourceUrl || event.sourceUrl,
        source: relationship.title,
      }),
      publicationDate: relationship.events.find((item) => item.kind === "published")?.date || null,
      effectiveDate: relationship.events.find((item) => item.kind === "effective_from")?.date || null,
    })));
  if (applicability) ownEvents.unshift({
    passage: 0,
    score: 1,
    lexicalScore: 1,
    chunkIndex: `temporal-applicability:${applicabilityDate}`,
    content: `Applicability assessment for ${applicabilityDate}: ${applicability.status}. Reason: ${applicability.reason || applicability.caveat || "recorded interval"}. Publication date is not treated as commencement, and absence of a recorded later instrument is not proof that none exists.`,
    source: "Recorded temporal metadata assessment",
    documentId: String(documentId),
    sourceUrl: context.document.canonical_url || null,
    structuralType: "temporal_assessment",
    retrievalMode: "temporal",
    temporal: { targetDate: applicabilityDate, ...applicability },
  });
  const limitation = intent.asksChange && context.relationships.length && !relatedEvidence.length
    ? [{
        passage: 0,
        documentId: String(documentId),
        score: 0.8,
        lexicalScore: 0.8,
        chunkIndex: "temporal-history-unavailable",
        content: "Historical relationship metadata exists, but cited text from the related version was not retrieved. Do not infer a before/after change from titles or dates alone.",
        source: "Temporal evidence limitation",
        sourceUrl: context.document.canonical_url || null,
        structuralType: "temporal_limitation",
        retrievalMode: "temporal",
      }]
    : [];
  return [...ownEvents, ...related, ...relatedEvidence, ...limitation]
    .slice(0, 30).map((passage, index) => ({
    ...passage, passage: index + 1,
  }));
};

const loadDocumentSourceFreshness = async (document, queryFn = query) => {
  const source = String(document?.canonical_source || document?.canonicalSource ||
    document?.source_name || document?.sourceName || document?.source || "").trim();
  if (!source) return {
    status: "not_checked",
    checkedThrough: null,
    sourceNames: [],
  };
  const sourceNames = sourceNameGroup(source);
  try {
    const result = await queryFn(
      `SELECT health.source_name, health.status, health.reachable,
              health.parser_status, health.last_checked_at,
              health.last_successful_run_at, health.last_failed_run_at,
              health.consecutive_failures, registry.ingestion_frequency
         FROM source_health health
         LEFT JOIN source_registry registry ON registry.source_name = health.source_name
        WHERE health.source_name = ANY($1::TEXT[])
        ORDER BY health.last_checked_at DESC NULLS LAST`,
      [sourceNames],
    );
    if (!result.rows.length) return {
      status: "not_checked",
      checkedThrough: null,
      sourceNames,
    };
    const maximumAgeMs = (frequency) => {
      const value = String(frequency || "").toLowerCase();
      if (value.includes("hour")) return 12 * 60 * 60 * 1_000;
      if (value.includes("daily")) return 2 * 24 * 60 * 60 * 1_000;
      if (value.includes("weekly")) return 10 * 24 * 60 * 60 * 1_000;
      return 30 * 24 * 60 * 60 * 1_000;
    };
    const stale = result.rows.some((row) => {
      const last = row.last_successful_run_at || row.last_checked_at;
      return !last || Date.now() - new Date(last).getTime() > maximumAgeMs(row.ingestion_frequency);
    });
    const degraded = result.rows.some((row) =>
      row.reachable === false || Number(row.consecutive_failures || 0) > 0 ||
      /^(failed|error|stale|degraded|blocked)$/i.test(String(row.status || "")) ||
      /^(failed|changed|blocked)$/i.test(String(row.parser_status || "")),
    );
    const checkedThrough = result.rows
      .map((row) => row.last_successful_run_at || row.last_checked_at)
      .filter(Boolean)
      .sort((left, right) => new Date(right) - new Date(left))[0] || null;
    return {
      status: degraded ? "degraded" : stale ? "stale" : "fresh",
      checkedThrough: checkedThrough ? new Date(checkedThrough).toISOString() : null,
      sourceNames,
      sources: result.rows.map((row) => ({
        sourceName: row.source_name,
        status: row.status,
        parserStatus: row.parser_status,
        reachable: row.reachable,
        lastCheckedAt: row.last_checked_at,
        lastSuccessfulRunAt: row.last_successful_run_at,
      })),
    };
  } catch (error) {
    return {
      status: "error",
      checkedThrough: null,
      sourceNames,
      error: "Source freshness could not be checked.",
    };
  }
};

const assessCurrentVerification = ({ document = {}, passages = [], freshness = {} } = {}) => {
  const temporalPassages = passages.filter((passage) =>
    passage.retrievalMode === "temporal" || passage.retrievalMode === "temporal_fts",
  );
  const laterAuthoritativeEvidence = temporalPassages.filter((passage) =>
    (passage.temporalRole === "later_version" ||
      ["AMENDED_BY", "REPEALED_BY", "SUPERSEDED_BY", "REPLACED_BY"].includes(passage.relationshipType)) &&
    [SOURCE_AUTHORITY.PRIMARY_OFFICIAL, SOURCE_AUTHORITY.OFFICIAL_SECONDARY]
      .includes(passage.authorityClass || classifySourceAuthority(passage)),
  );
  const checkedAt = new Date().toISOString();
  const verified = freshness.status === "fresh" && laterAuthoritativeEvidence.length > 0;
  return {
    required: true,
    status: verified ? "VERIFIED_CURRENT" :
      temporalPassages.length || freshness.checkedThrough ? "PARTIALLY_VERIFIED" : "UNVERIFIED",
    checkedAt,
    checkedThrough: freshness.checkedThrough || null,
    connectorStatus: freshness.status || "not_checked",
    connectorWarning: ["degraded", "error", "stale", "not_checked"].includes(freshness.status)
      ? "Freshness could not be fully verified for the selected source."
      : null,
    laterEvidenceCount: laterAuthoritativeEvidence.length,
    temporalEvidenceCount: temporalPassages.length,
    selectedDocumentDate: document.publicationDate || document.publication_date || null,
    limitation: verified
      ? null
      : "The indexed corpus does not establish that no later amendment, repeal, or superseding instrument exists.",
  };
};

module.exports = {
  applicabilityAt,
  buildBeforeAfterComparison,
  loadTemporalContext,
  loadRelatedTemporalEvidence,
  loadDocumentSourceFreshness,
  assessCurrentVerification,
  parseTemporalIntent,
  retrieveTemporalPassages,
  temporalEventsFromDocument,
  verifiedRelationship,
};
