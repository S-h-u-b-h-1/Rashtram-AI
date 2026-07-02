const assert = require("node:assert/strict");
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

test("database migrations are versioned and ordered", () => {
  const files = migrationFiles();
  assert.deepEqual(files, [...files].sort());
  assert.ok(files.includes("001_database_v2.js"));
  assert.ok(files.includes("002_normalized_support_tables.js"));
  assert.ok(files.includes("003_quarantine_navigation_artifacts.js"));
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
