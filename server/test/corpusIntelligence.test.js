const test = require("node:test");
const assert = require("node:assert/strict");

const {
  corpusAuthorityReport,
  documentQualitySignals,
  groupCounts,
  p2SelectionPriority,
} = require("../document/corpusIntelligenceService");

const row = (overrides = {}) => ({
  id: 1,
  title: "Model Regulation, 2026",
  document_type: "regulation",
  jurisdiction: "India",
  state: null,
  regulator: "Model Authority",
  ministry: "Model Ministry",
  year: 2026,
  authority_tier: "A",
  source: "official-source",
  quality_score: 80,
  validation_status: "validated",
  has_primary_provenance: true,
  has_accessible_resource: true,
  text_length: 5_000,
  page_coordinate_chunks: 4,
  structural_chunks: 3,
  effective_date: "2026-01-01",
  expiry_date: null,
  legislative_status: "effective",
  pending_duplicate_warning: false,
  demand_30d: 0,
  comparison_30d: 0,
  knowledge_links: 0,
  benchmark_coverage_gap: false,
  resource_ready: true,
  text_ready: true,
  search_ready: true,
  semantic_ready: false,
  ...overrides,
});

test("document quality signals remain explainable and provenance based", () => {
  assert.deepEqual(documentQualitySignals(row()), {
    officialPrimarySource: true,
    verifiedResource: true,
    textExtractionQuality: "substantial",
    pageProvenanceQuality: "available",
    structuralQuality: "structured",
    effectiveStatusEvidence: "recorded",
    duplicateConfidence: "no_pending_warning",
  });

  assert.deepEqual(documentQualitySignals(row({
    authority_tier: "D",
    has_primary_provenance: false,
    has_accessible_resource: false,
    validation_status: "unverified",
    text_length: 0,
    page_coordinate_chunks: 0,
    structural_chunks: 0,
    effective_date: null,
    legislative_status: null,
    pending_duplicate_warning: true,
  })), {
    officialPrimarySource: false,
    verifiedResource: false,
    textExtractionQuality: "missing",
    pageProvenanceQuality: "not_recorded",
    structuralQuality: "unstructured",
    effectiveStatusEvidence: "unknown",
    duplicateConfidence: "review_required",
  });
});

test("P2 selection is deterministic, bounded, and favors observed gaps and demand", () => {
  const now = new Date("2026-08-21T00:00:00.000Z");
  const low = p2SelectionPriority(row(), now);
  const high = p2SelectionPriority(row({
    id: 2,
    authority_tier: "D",
    has_primary_provenance: false,
    demand_30d: 500,
    comparison_30d: 500,
    knowledge_links: 500,
    benchmark_coverage_gap: true,
  }), now);

  assert.equal(low.primarySourceGap, false);
  assert.equal(high.primarySourceGap, true);
  assert.equal(high.signals.observedDemand, 180);
  assert.equal(high.signals.comparisonDemand, 120);
  assert.equal(high.signals.knowledgeRelevance, 60);
  assert.ok(high.score > low.score);
  assert.deepEqual(high, p2SelectionPriority(row({
    id: 2,
    authority_tier: "D",
    has_primary_provenance: false,
    demand_30d: 500,
    comparison_30d: 500,
    knowledge_links: 500,
    benchmark_coverage_gap: true,
  }), now));
});

test("group counts expose readiness and primary-source coverage", () => {
  const groups = groupCounts([
    row(),
    row({ id: 2, source: "secondary-source", authority_tier: "D",
      has_primary_provenance: false, semantic_ready: true }),
  ], "source");

  assert.deepEqual(groups, [
    { value: "official-source", catalogued: 1, resourceReady: 1, textReady: 1,
      searchReady: 1, semanticReady: 0, primary: 1 },
    { value: "secondary-source", catalogued: 1, resourceReady: 1, textReady: 1,
      searchReady: 1, semanticReady: 1, primary: 0 },
  ]);
});

test("corpus report ranks but never executes P2 work", async () => {
  let calls = 0;
  const queryFn = async (sql) => {
    calls += 1;
    assert.match(sql, /WHERE document\.visibility_status = 'public'/);
    return { rows: [
      row(),
      row({ id: 2, title: "Secondary Circular", authority_tier: "D",
        has_primary_provenance: false, demand_30d: 6, comparison_30d: 2 }),
      row({ id: 3, title: "Already semantic", authority_tier: "D",
        has_primary_provenance: false, semantic_ready: true }),
    ] };
  };

  const report = await corpusAuthorityReport({ queryFn, p2Limit: 1 });

  assert.equal(calls, 1);
  assert.equal(report.summary.publicCatalogue, 3);
  assert.equal(report.summary.primarySourceDocuments, 1);
  assert.equal(report.summary.searchReadyPrimarySourceGaps, 1);
  assert.equal(report.rankedP2.length, 1);
  assert.equal(report.rankedP2[0].documentId, "2");
  assert.deepEqual(report.policy, {
    deterministic: true,
    automaticallyExecutesBackfill: false,
    p2Processed: 0,
  });
});
