const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const {
  migrationFiles,
} = require("../lib/database/migrator");
const {
  scoreDocumentQuality,
} = require("../lib/database/quality");
const {
  BOUNDED_CRON_SOURCES,
  DAILY_SOURCES,
  WEEKLY_SOURCES,
  scheduleForProfile,
} = require("../lib/ingestion/schedules");
const {
  REQUIRED_CATEGORIES,
  RESEARCH_BENCHMARKS,
} = require("../evaluation/researchBenchmarks");

test("database migrations are versioned and ordered", () => {
  const files = migrationFiles();
  assert.deepEqual(files, [...files].sort());
  assert.ok(files.includes("001_database_v2.js"));
  assert.ok(files.includes("002_normalized_support_tables.js"));
  assert.ok(files.includes("003_quarantine_navigation_artifacts.js"));
  assert.ok(files.includes("004_comparison_recommendation_intelligence.js"));
  assert.ok(files.includes("005_government_knowledge_graph.js"));
  assert.ok(files.includes("006_full_research_readiness.js"));
  assert.ok(files.includes("007_mass_processing_infrastructure.js"));
  assert.ok(files.includes("012_source_authority_and_canonical_provenance.js"));
  assert.ok(files.includes("013_processing_failure_taxonomy.js"));
  assert.ok(files.includes("014_document_content_fingerprint.js"));
  assert.ok(files.includes("015_normalize_failure_pipeline_stage.js"));
  assert.ok(files.includes("016_processing_audit_log.js"));
  assert.ok(files.includes("017_normalize_download_failure_codes.js"));
  assert.equal(files.at(-1), "038_research_reports_v1.js");
});

test("database verifier derives the expected latest migration from the registry", () => {
  const source = fs.readFileSync(
    path.join(__dirname, "../cli/dbVerify.js"),
    "utf8",
  );
  assert.match(source, /const migrations = require\("\.\.\/migrations"\)/);
  assert.match(source, /expectedLatestMigration = migrations\.at\(-1\)\?\.name/);
  assert.doesNotMatch(source, /latest migration is 029/);
  assert.match(source, /migration 032 semantic coverage complete/);
});

test("semantic coverage migration adds only bounded audit indexes", () => {
  const source = fs.readFileSync(
    path.join(__dirname, "../migrations/032_semantic_coverage_v1.js"),
    "utf8",
  );
  assert.match(source, /document_processing_state_semantic_backlog_idx/);
  assert.match(source, /document_text_chunks_namespace_document_idx/);
  assert.match(source, /user_activity_events_document_recent_idx/);
  assert.match(source, /processing_attempts_semantic_backfill_idx/);
  assert.doesNotMatch(source, /DROP|DELETE|TRUNCATE|UPDATE\s/i);
});

test("large-document migration preserves ordinary semantic readiness truth", () => {
  const source = fs.readFileSync(
    path.join(__dirname, "../migrations/033_large_document_intelligence.js"),
    "utf8",
  );
  assert.match(source, /document_chunk_groups/);
  assert.match(source, /hierarchical_semantic_ready/);
  assert.doesNotMatch(source, /SET\s+semantic_ready|DROP|TRUNCATE/i);
});

test("temporal migration keeps legal date kinds separate", () => {
  const source = fs.readFileSync(
    path.join(__dirname, "../migrations/034_temporal_legal_intelligence_v1.js"),
    "utf8",
  );
  for (const field of ["notified_date", "repealed_date", "superseded_date", "amended_date"]) {
    assert.match(source, new RegExp(field));
  }
  assert.doesNotMatch(source, /\b(?:UPDATE|TRUNCATE|DROP)\s|\bDELETE\s+FROM\b/i);
});

test("compliance workflow storage is account-owned and additive", () => {
  const source = fs.readFileSync(
    path.join(__dirname, "../migrations/035_compliance_copilot_v1.js"), "utf8",
  );
  assert.match(source, /user_id BIGINT NOT NULL REFERENCES users\(id\) ON DELETE CASCADE/);
  assert.match(source, /evidence_refs_json/);
  assert.doesNotMatch(source, /\b(?:UPDATE|TRUNCATE|DROP)\s|\bDELETE\s+FROM\b/i);
});

test("regulatory watchlists and alerts are account-owned and evidence-linked", () => {
  const source = fs.readFileSync(
    path.join(__dirname, "../migrations/036_regulatory_watchlists_v1.js"), "utf8",
  );
  assert.match(source, /CREATE TABLE IF NOT EXISTS research_watchlists/);
  assert.match(source, /CREATE TABLE IF NOT EXISTS regulatory_alerts/);
  assert.match(source, /intelligence_event_id BIGINT NOT NULL REFERENCES intelligence_events/);
  assert.match(source, /source_url TEXT NOT NULL/);
  assert.match(source, /UNIQUE \(watchlist_id, intelligence_event_id\)/);
});

test("cross-state comparison storage is account-owned and evidence-preserving", () => {
  const source = fs.readFileSync(
    path.join(__dirname, "../migrations/037_cross_state_comparisons_v1.js"), "utf8",
  );
  assert.match(source, /CREATE TABLE IF NOT EXISTS cross_state_comparisons/);
  assert.match(source, /user_id BIGINT NOT NULL REFERENCES users\(id\) ON DELETE CASCADE/);
  assert.match(source, /evidence_refs_json/);
  assert.doesNotMatch(source, /\b(?:UPDATE|TRUNCATE|DROP)\s|\bDELETE\s+FROM\b/i);
});

test("research report storage is account-owned and preserves citations", () => {
  const source = fs.readFileSync(
    path.join(__dirname, "../migrations/038_research_reports_v1.js"), "utf8",
  );
  assert.match(source, /CREATE TABLE IF NOT EXISTS research_reports/);
  assert.match(source, /user_id BIGINT NOT NULL REFERENCES users\(id\) ON DELETE CASCADE/);
  assert.match(source, /evidence_refs_json/);
  assert.match(source, /selected_document_ids BIGINT\[\]/);
});

test("research observability migration is additive and privacy safe", () => {
  const source = fs.readFileSync(
    path.join(__dirname, "../migrations/031_research_query_observability.js"),
    "utf8",
  );
  assert.match(source, /CREATE TABLE IF NOT EXISTS research_query_telemetry/);
  assert.match(source, /research_query_telemetry_type_created_idx/);
  assert.doesNotMatch(source, /raw_question|source_text|assistant_answer/i);
  assert.doesNotMatch(source, /DROP TABLE|DELETE FROM/i);
});

test("Knowledge Layer V1 migration keeps structured knowledge evidence-backed", () => {
  const source = fs.readFileSync(
    path.join(__dirname, "../migrations/030_knowledge_layer_v1.js"),
    "utf8",
  );
  assert.match(source, /CREATE TABLE IF NOT EXISTS knowledge_nodes/);
  assert.match(source, /CREATE TABLE IF NOT EXISTS knowledge_edges/);
  assert.match(source, /CREATE TABLE IF NOT EXISTS knowledge_evidence/);
  assert.match(source, /SOURCE_VERIFIED/);
  assert.match(source, /QUARANTINED/);
  assert.match(source, /owner_user_id/);
  assert.match(source, /enforce_knowledge_node_evidence/);
  assert.match(source, /enforce_knowledge_edge_evidence/);
  assert.doesNotMatch(source, /DROP TABLE/);
});

test("dedupe review queue is restored after cleanup dependency verification", () => {
  const migration = fs.readFileSync(
    path.join(__dirname, "../migrations/026_restore_dedupe_candidates.js"),
    "utf8",
  );
  assert.match(migration, /CREATE TABLE IF NOT EXISTS dedupe_candidates/);
  assert.match(migration, /CHECK \(document_id <> candidate_document_id\)/);
  assert.match(migration, /UNIQUE \(document_id, candidate_document_id, match_type\)/);
});

test("unused-schema cleanup is explicit and never cascades", () => {
  const migration = fs.readFileSync(
    path.join(__dirname, "../migrations/025_remove_unused_schema_mirrors.js"),
    "utf8",
  );
  assert.match(migration, /DROP TRIGGER IF EXISTS source_collection_snapshots_sync_v2/);
  assert.match(migration, /DROP TABLE IF EXISTS source_snapshots/);
  assert.match(migration, /DROP TABLE IF EXISTS document_relationship_quarantine/);
  assert.doesNotMatch(migration, /CASCADE/i);
  assert.doesNotMatch(migration, /legislative_documents/);
  assert.doesNotMatch(migration, /document_text_(chunks|artifacts)/);
});

test("quality score rewards provenance and processing evidence", () => {
  const complete = scoreDocumentQuality({
    title: "Public policy report",
    sourceUrl: "https://example.gov.in/report",
    hasPdf: true,
    publicationDate: "2026-07-02",
    ministry: "Ministry",
    jurisdiction: "India",
    accessibleResource: true,
    processingSuccess: true,
    textExtracted: true,
  });
  const incomplete = scoreDocumentQuality({
    title: "Untitled source record",
    sourceUrl: "https://example.gov.in/record",
  });
  const warned = scoreDocumentQuality({
    title: "Public policy report",
    sourceUrl: "https://example.gov.in/report",
    hasPdf: true,
    year: 2026,
    authority: "Authority",
    jurisdiction: "India",
    accessibleResource: true,
    processingSuccess: true,
    textExtracted: true,
    duplicateWarning: true,
  });

  assert.equal(complete, 100);
  assert.equal(incomplete, 30);
  assert.equal(warned, 80);
});

test("quality refresh avoids rewriting unchanged document rows", () => {
  const source = fs.readFileSync(
    path.join(__dirname, "../lib/database/quality.js"),
    "utf8",
  );
  assert.match(source, /quality_score IS DISTINCT FROM quality\.score/);
  assert.match(source, /research_ready IS DISTINCT FROM quality\.ready/);
  assert.match(source, /visibility_status IS DISTINCT FROM CASE/);
});

test("readiness audit avoids rewriting unchanged processing rows", () => {
  const source = fs.readFileSync(
    path.join(__dirname, "../document/readinessService.js"),
    "utf8",
  );
  assert.match(source, /FROM desired[\s\S]*ROW\([\s\S]*IS DISTINCT FROM ROW\(/);
});

test("scheduled ingestion profiles are bounded and source-based", () => {
  assert.equal(scheduleForProfile("daily"), DAILY_SOURCES);
  assert.equal(scheduleForProfile("weekly"), WEEKLY_SOURCES);
  assert.equal(scheduleForProfile("cron"), BOUNDED_CRON_SOURCES);
  assert.ok(DAILY_SOURCES.includes("pib"));
  assert.ok(DAILY_SOURCES.includes("niti-aayog"));
  assert.ok(WEEKLY_SOURCES.includes("state-gazette"));
  assert.ok(BOUNDED_CRON_SOURCES.length <= 3);
});

test("account deletion tolerates retired optional user-data tables", () => {
  const source = fs.readFileSync(
    path.join(__dirname, "..", "profile", "profileService.js"),
    "utf8",
  );
  assert.match(source, /SELECT to_regclass\(\$1\) IS NOT NULL AS exists/);
  assert.match(source, /if \(!\(await relationExists\(table\)\)\)/);
  assert.match(source, /await deleteOwned\("policy_chats"\)/);
});

test("canonical provenance migration adds authority tiers and operations view", () => {
  const source = fs.readFileSync(
    path.join(
      __dirname,
      "..",
      "migrations",
      "012_source_authority_and_canonical_provenance.js",
    ),
    "utf8",
  );
  assert.match(source, /source_authority_tier/);
  assert.match(source, /original_source_page/);
  assert.match(source, /file_checksum_sha256/);
  assert.match(source, /authority_tier/);
  assert.match(source, /supported_document_types/);
  assert.match(source, /source_registry_operations/);
  assert.match(source, /Tier|authority_tier|source_authority_tier/);
});

test("processing failure taxonomy migration adds traceability fields", () => {
  const source = fs.readFileSync(
    path.join(
      __dirname,
      "..",
      "migrations",
      "013_processing_failure_taxonomy.js",
    ),
    "utf8",
  );
  assert.match(source, /failure_code/);
  assert.match(source, /retry_eligible/);
  assert.match(source, /pipeline_stage/);
  assert.match(source, /input_checksum_sha256/);
  assert.match(source, /output_checksum_sha256/);
  assert.match(source, /extraction_quality_json/);
  assert.match(source, /document_processing_attempts/);
});

test("content fingerprint migration adds duplicate analysis support", () => {
  const source = fs.readFileSync(
    path.join(
      __dirname,
      "..",
      "migrations",
      "014_document_content_fingerprint.js",
    ),
    "utf8",
  );
  assert.match(source, /content_fingerprint_sha256/);
  assert.match(source, /documents_content_fingerprint_sha256_idx/);
});

test("failure pipeline stage normalization uses structured codes", () => {
  const source = fs.readFileSync(
    path.join(
      __dirname,
      "..",
      "migrations",
      "015_normalize_failure_pipeline_stage.js",
    ),
    "utf8",
  );
  assert.match(source, /HTTP_SERVER_ERROR/);
  assert.match(source, /download/);
  assert.match(source, /document_processing_jobs/);
  assert.match(source, /document_processing_attempts/);
});

test("processing audit log migration records corrective actions", () => {
  const source = fs.readFileSync(
    path.join(
      __dirname,
      "..",
      "migrations",
      "016_processing_audit_log.js",
    ),
    "utf8",
  );
  assert.match(source, /document_processing_audit_log/);
  assert.match(source, /previous_state_json/);
  assert.match(source, /new_state_json/);
  assert.match(source, /evidence_json/);
});

test("processing V3 migration adds stages, capabilities, and hashes", () => {
  const migration = fs.readFileSync(
    path.join(__dirname, "../migrations/029_processing_stage_capabilities.js"),
    "utf8",
  );
  assert.match(migration, /CREATE TABLE IF NOT EXISTS document_processing_stages/);
  assert.match(migration, /search_ready BOOLEAN/);
  assert.match(migration, /semantic_ready BOOLEAN/);
  assert.match(migration, /extracted_text_sha256/);
  assert.match(migration, /embedding_input_sha256/);
});

test("download failure normalization migration uses download-specific codes", () => {
  const source = fs.readFileSync(
    path.join(
      __dirname,
      "..",
      "migrations",
      "017_normalize_download_failure_codes.js",
    ),
    "utf8",
  );
  assert.match(source, /DOWNLOAD_SERVER_ERROR/);
  assert.match(source, /DOWNLOAD_NOT_FOUND/);
  assert.match(source, /DOWNLOAD_ACCESS_DENIED/);
});

test("source-aware retry control migration adds domain circuit state", () => {
  const source = fs.readFileSync(
    path.join(
      __dirname,
      "..",
      "migrations",
      "018_source_aware_retry_controls.js",
    ),
    "utf8",
  );
  assert.match(source, /document_retry_domain_state/);
  assert.match(source, /cooldown_until/);
  assert.match(source, /circuit_state/);
  assert.match(source, /retry_decision/);
});

test("research evaluation scaffold covers required benchmark categories", () => {
  const categories = new Set(RESEARCH_BENCHMARKS.map((item) => item.category));
  for (const category of REQUIRED_CATEGORIES) {
    assert.equal(categories.has(category), true);
  }
  for (const benchmark of RESEARCH_BENCHMARKS) {
    assert.ok(benchmark.id);
    assert.ok(benchmark.query);
    assert.ok(Array.isArray(benchmark.requiredDocumentTypes));
    assert.ok(Array.isArray(benchmark.mustMeasure));
  }
});
