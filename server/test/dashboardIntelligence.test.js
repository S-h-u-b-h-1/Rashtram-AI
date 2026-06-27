const test = require("node:test");
const assert = require("node:assert/strict");

const {
  SOURCE_REGISTRY,
  buildBriefSummary,
  deriveSourceStatus,
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

test("source health safely reports planned, fresh, stale, and error states", () => {
  const now = new Date("2026-06-28T00:00:00.000Z").getTime();
  assert.equal(deriveSourceStatus({ now }), "Planned");
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
      latestRun: { status: "failed" },
      now,
    }),
    "Error",
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
