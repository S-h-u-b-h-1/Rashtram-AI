const test = require("node:test");
const assert = require("node:assert/strict");

const {
  SOURCE_REGISTRY,
  buildBriefSummary,
  buildRecentActivity,
  deriveSourceStatus,
  findLatestDatedEvent,
  mapDocument,
} = require("../dashboard/intelligenceService");

test("source registry distinguishes all requested official source groups", () => {
  assert.equal(SOURCE_REGISTRY.length, 9);
  assert.deepEqual(
    SOURCE_REGISTRY.map((source) => source.key),
    [
      "prs-india",
      "digital-sansad",
      "lok-sabha",
      "rajya-sabha",
      "egazette",
      "india-code",
      "ministry",
      "state-legislature",
      "state-gazette",
    ],
  );
});

test("source health safely reports not-run, fresh, stale, degraded, and blocked states", () => {
  const now = new Date("2026-06-28T00:00:00.000Z").getTime();
  assert.equal(deriveSourceStatus({ now }), "Not Run");
  assert.equal(
    deriveSourceStatus({
      documentCount: 10,
      latestRun: {
        status: "completed",
        completed_at: "2026-06-27T00:00:00.000Z",
      },
      now,
    }),
    "Fresh",
  );
  assert.equal(
    deriveSourceStatus({
      documentCount: 10,
      latestRun: {
        status: "completed",
        completed_at: "2026-06-01T00:00:00.000Z",
      },
      now,
    }),
    "Stale",
  );
  assert.equal(
    deriveSourceStatus({
      documentCount: 10,
      latestRun: { status: "completed_with_errors" },
      now,
    }),
    "Degraded",
  );
  assert.equal(
    deriveSourceStatus({
      latestRun: {
        status: "failed",
        errors_json: [{ message: "robots.txt blocked this path" }],
      },
      now,
    }),
    "Blocked",
  );
});

test("brief summary never invents current Parliament activity", () => {
  assert.match(
    buildBriefSummary({
      recentEventCount: 0,
      freshSourceCount: 0,
      recentDocumentCount: 3,
    }),
    /No current Parliament event feed is connected yet/,
  );
  assert.match(
    buildBriefSummary({
      recentEventCount: 2,
      freshSourceCount: 2,
      recentDocumentCount: 10,
    }),
    /2 verified legislative updates/,
  );
});

test("recent activity prefers verified events and falls back to documents", () => {
  assert.deepEqual(
    buildRecentActivity({
      recentEventCount24h: 2,
      recentEventCount: 4,
      recentDocumentCount24h: 20,
      recentDocumentCount: 40,
    }),
    { last24Hours: 2, last7Days: 4 },
  );
  assert.deepEqual(
    buildRecentActivity({
      recentDocumentCount24h: 3,
      recentDocumentCount: 8,
    }),
    { last24Hours: 3, last7Days: 8 },
  );
});

test("what changed recently uses the newest dated event, not importance", () => {
  assert.equal(
    findLatestDatedEvent([
      {
        title: "High importance older event",
        eventDate: "2026-06-20T00:00:00.000Z",
        importanceScore: 100,
      },
      {
        title: "Newest verified event",
        eventDate: "2026-06-27T00:00:00.000Z",
        importanceScore: 10,
      },
      { title: "Undated event", eventDate: null, importanceScore: 200 },
    ]).title,
    "Newest verified event",
  );
  assert.equal(findLatestDatedEvent([]), null);
});

test("document mapping exposes provenance without leaking source metadata", () => {
  const document = mapDocument({
    id: 42,
    canonical_id: "canonical-42",
    title: "Public Safety Act, 2025",
    document_type: "act",
    jurisdiction_level: "union",
    jurisdiction: "India",
    canonical_source: "india-code",
    canonical_url: "https://www.indiacode.nic.in/handle/42",
    source_name: "prs-india",
    source_url: "https://prsindia.org/42",
    pdf_url: "https://www.indiacode.nic.in/42.pdf",
    publication_date: "2025-08-22",
    first_seen_at: "2026-06-27T00:00:00.000Z",
    updated_at: "2026-06-27T00:00:00.000Z",
  });
  assert.equal(document.id, "42");
  assert.equal(document.sourceName, "india-code");
  assert.equal(
    document.sourceUrl,
    "https://www.indiacode.nic.in/handle/42",
  );
  assert.equal("metadataJson" in document, false);
});
