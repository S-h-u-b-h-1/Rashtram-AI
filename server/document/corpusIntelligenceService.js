const { query } = require("../db");

const PRIMARY_TYPES = new Set([
  "act", "regulation", "rule", "notification", "gazette", "circular",
  "order", "ordinance",
]);

const bounded = (value, min, max) => Math.min(max, Math.max(min, Number(value) || 0));

const documentQualitySignals = (row = {}) => ({
  officialPrimarySource: String(row.authority_tier || "").toUpperCase() === "A" ||
    Boolean(row.has_primary_provenance),
  verifiedResource: Boolean(row.has_accessible_resource) &&
    ["validated", "verified"].includes(String(row.validation_status || "").toLowerCase()),
  textExtractionQuality: Number(row.text_length || 0) >= 1_000
    ? "substantial" : Number(row.text_length || 0) >= 200 ? "limited" : "missing",
  pageProvenanceQuality: Number(row.page_coordinate_chunks || 0) > 0
    ? "available" : "not_recorded",
  structuralQuality: Number(row.structural_chunks || 0) > 0
    ? "structured" : "unstructured",
  effectiveStatusEvidence: row.effective_date || row.expiry_date || row.legislative_status
    ? "recorded" : "unknown",
  duplicateConfidence: Boolean(row.pending_duplicate_warning)
    ? "review_required" : "no_pending_warning",
});

const p2SelectionPriority = (row = {}, now = new Date()) => {
  const quality = documentQualitySignals(row);
  const year = Number(row.year || 0);
  const currentYear = now.getUTCFullYear();
  const primarySourceGap = !quality.officialPrimarySource;
  const regulatoryImportance = PRIMARY_TYPES.has(String(row.document_type || "").toLowerCase());
  const recency = year >= currentYear ? 100
    : year === currentYear - 1 ? 70 : year >= currentYear - 5 ? 35 : 0;
  const signals = {
    observedDemand: Math.min(180, bounded(row.demand_30d, 0, 9) * 20),
    primarySourceGap: primarySourceGap ? 140 : 0,
    regulatoryImportance: regulatoryImportance ? 100 : 30,
    recency,
    authority: ({ A: 100, B: 70, C: 35, D: 10 }[
      String(row.authority_tier || "").toUpperCase()
    ] || 20),
    comparisonDemand: Math.min(120, bounded(row.comparison_30d, 0, 4) * 30),
    knowledgeRelevance: Math.min(60, bounded(row.knowledge_links, 0, 6) * 10),
    documentQuality: Math.round(bounded(row.quality_score, 0, 100)),
    benchmarkCoverageGap: row.benchmark_coverage_gap ? 80 : 0,
  };
  return {
    score: Object.values(signals).reduce((sum, value) => sum + value, 0),
    signals,
    primarySourceGap,
    quality,
  };
};

const groupCounts = (rows, field) => Object.values(rows.reduce((groups, row) => {
  const key = String(row[field] || "unknown");
  const value = groups[key] || {
    value: key, catalogued: 0, resourceReady: 0, textReady: 0,
    searchReady: 0, semanticReady: 0, primary: 0,
  };
  value.catalogued += 1;
  value.resourceReady += Number(Boolean(row.resource_ready));
  value.textReady += Number(Boolean(row.text_ready));
  value.searchReady += Number(Boolean(row.search_ready));
  value.semanticReady += Number(Boolean(row.semantic_ready));
  value.primary += Number(
    String(row.authority_tier || "").toUpperCase() === "A" || row.has_primary_provenance);
  groups[key] = value;
  return groups;
}, {})).sort((left, right) => right.catalogued - left.catalogued);

const loadCorpusRows = async ({ queryFn = query } = {}) => {
  const result = await queryFn(`
    WITH source_provenance AS (
      SELECT source.document_id,
        BOOL_OR(registry.authority_tier = 'A') AS has_primary_provenance
      FROM document_sources source
      LEFT JOIN source_registry registry ON registry.source_name = source.source_name
      GROUP BY source.document_id
    ), resource_state AS (
      SELECT document_id,
        BOOL_OR(is_accessible) AS has_accessible_resource
      FROM document_resources GROUP BY document_id
    ), chunk_state AS (
      SELECT document_id, COUNT(*)::INTEGER AS chunks,
        COUNT(*) FILTER (WHERE metadata_json ? 'pageStart' OR metadata_json ? 'page')::INTEGER
          AS page_coordinate_chunks,
        COUNT(*) FILTER (
          WHERE metadata_json ? 'sectionId' OR metadata_json ? 'clauseId'
            OR metadata_json ? 'sectionTitle'
        )::INTEGER AS structural_chunks
      FROM document_text_chunks GROUP BY document_id
    ), duplicate_state AS (
      SELECT document_id, TRUE AS pending_duplicate_warning
      FROM (
        SELECT document_id FROM dedupe_candidates WHERE status = 'pending'
        UNION
        SELECT candidate_document_id FROM dedupe_candidates WHERE status = 'pending'
      ) warning GROUP BY document_id
    ), demand AS (
      SELECT document_id,
        COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '30 days')::INTEGER AS demand_30d,
        COUNT(*) FILTER (
          WHERE created_at >= NOW() - INTERVAL '30 days' AND event_type ILIKE '%compar%'
        )::INTEGER AS comparison_30d
      FROM user_activity_events
      WHERE document_id IS NOT NULL AND created_at >= NOW() - INTERVAL '30 days'
      GROUP BY document_id
    ), knowledge AS (
      SELECT document_id, COUNT(*)::INTEGER AS knowledge_links
      FROM knowledge_evidence WHERE document_id IS NOT NULL AND owner_user_id IS NULL
      GROUP BY document_id
    )
    SELECT document.id, document.title, document.document_type,
      document.jurisdiction, document.state, document.regulator, document.ministry,
      document.year, document.source_authority_tier AS authority_tier,
      document.quality_score, document.validation_status, document.effective_date,
      document.expiry_date, document.legislative_status,
      COALESCE(registry.source_name, 'unknown') AS source,
      COALESCE(provenance.has_primary_provenance, FALSE) AS has_primary_provenance,
      COALESCE(resource.has_accessible_resource, FALSE) AS has_accessible_resource,
      COALESCE(chunk.chunks, 0)::INTEGER AS chunks,
      COALESCE(chunk.page_coordinate_chunks, 0)::INTEGER AS page_coordinate_chunks,
      COALESCE(chunk.structural_chunks, 0)::INTEGER AS structural_chunks,
      COALESCE(process.text_length, 0)::INTEGER AS text_length,
      COALESCE(duplicate.pending_duplicate_warning, FALSE) AS pending_duplicate_warning,
      COALESCE(demand.demand_30d, 0)::INTEGER AS demand_30d,
      COALESCE(demand.comparison_30d, 0)::INTEGER AS comparison_30d,
      COALESCE(knowledge.knowledge_links, 0)::INTEGER AS knowledge_links,
      COALESCE(process.resource_ready, FALSE) AS resource_ready,
      COALESCE(process.text_ready, FALSE) AS text_ready,
      COALESCE(process.search_ready, FALSE) AS search_ready,
      COALESCE(process.semantic_ready, FALSE) AS semantic_ready
    FROM documents document
    LEFT JOIN source_registry registry ON registry.id = document.canonical_source_id
    LEFT JOIN document_processing_state process ON process.document_id = document.id
    LEFT JOIN source_provenance provenance ON provenance.document_id = document.id
    LEFT JOIN resource_state resource ON resource.document_id = document.id
    LEFT JOIN chunk_state chunk ON chunk.document_id = document.id
    LEFT JOIN duplicate_state duplicate ON duplicate.document_id = document.id
    LEFT JOIN demand ON demand.document_id = document.id
    LEFT JOIN knowledge ON knowledge.document_id = document.id
    WHERE document.visibility_status = 'public'
  `);
  return result.rows;
};

const corpusAuthorityReport = async ({ queryFn = query, p2Limit = 100 } = {}) => {
  const rows = await loadCorpusRows({ queryFn });
  const searchReady = rows.filter((row) => row.search_ready);
  const primary = rows.filter((row) =>
    String(row.authority_tier || "").toUpperCase() === "A" || row.has_primary_provenance);
  const gaps = rows.filter((row) =>
    !row.semantic_ready && row.search_ready &&
    String(row.authority_tier || "").toUpperCase() !== "A" && !row.has_primary_provenance);
  const p2 = gaps.map((row) => ({ ...row, ...p2SelectionPriority(row) }))
    .sort((left, right) => right.score - left.score || Number(left.id) - Number(right.id))
    .slice(0, Math.max(1, Math.min(500, Number(p2Limit) || 100)));
  return {
    generatedAt: new Date().toISOString(),
    summary: {
      publicCatalogue: rows.length,
      resourceReady: rows.filter((row) => row.resource_ready).length,
      textReady: rows.filter((row) => row.text_ready).length,
      searchReady: searchReady.length,
      semanticReady: rows.filter((row) => row.semantic_ready).length,
      primarySourceDocuments: primary.length,
      primarySourcePercent: rows.length
        ? Number(((primary.length / rows.length) * 100).toFixed(2)) : 0,
      searchReadyPrimarySourceGaps: gaps.length,
    },
    breakdowns: {
      source: groupCounts(rows, "source"),
      authority: groupCounts(rows, "authority_tier"),
      documentType: groupCounts(rows, "document_type"),
      jurisdiction: groupCounts(rows, "jurisdiction"),
      state: groupCounts(rows, "state"),
      regulator: groupCounts(rows, "regulator"),
      ministry: groupCounts(rows, "ministry"),
      year: groupCounts(rows, "year"),
    },
    primarySourceGapSample: gaps.slice(0, 100).map((row) => ({
      documentId: String(row.id), title: row.title, source: row.source,
      documentType: row.document_type, jurisdiction: row.jurisdiction,
    })),
    rankedP2: p2.map((row) => ({
      documentId: String(row.id), title: row.title, source: row.source,
      documentType: row.document_type, jurisdiction: row.jurisdiction,
      score: row.score, signals: row.signals, quality: row.quality,
    })),
    policy: {
      deterministic: true,
      automaticallyExecutesBackfill: false,
      p2Processed: 0,
    },
  };
};

module.exports = {
  corpusAuthorityReport,
  documentQualitySignals,
  groupCounts,
  loadCorpusRows,
  p2SelectionPriority,
};
