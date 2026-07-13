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

test("scheduled ingestion profiles are bounded and source-based", () => {
  assert.equal(scheduleForProfile("daily"), DAILY_SOURCES);
  assert.equal(scheduleForProfile("weekly"), WEEKLY_SOURCES);
  assert.equal(scheduleForProfile("cron"), BOUNDED_CRON_SOURCES);
  assert.ok(DAILY_SOURCES.includes("pib"));
  assert.ok(DAILY_SOURCES.includes("niti-aayog"));
  assert.ok(WEEKLY_SOURCES.includes("state-gazette"));
  assert.ok(BOUNDED_CRON_SOURCES.length <= 3);
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
