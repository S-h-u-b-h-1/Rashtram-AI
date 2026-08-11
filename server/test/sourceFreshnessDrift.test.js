const test = require("node:test");
const assert = require("node:assert/strict");
const { probeConnector } = require("../lib/ingestion/core/healthCheck");

// Regression cover for the PRS June-27 incident: the connector kept
// reporting healthy for weeks while the catalogue silently stopped
// receiving new Parliament Bills. Every existing signal — last run
// status, last_successful_at, error count, records discovered — was
// green, because none of them ask whether what the source is publishing
// right now actually landed in our catalogue.

const fakeConnector = (records) => ({
  name: "test-source",
  collect: async () => ({
    records,
    directoryEntries: [],
    errors: [],
    diagnostics: [],
    snapshots: [{ url: "https://example.invalid" }],
  }),
});

const record = (id) => ({
  sourceRecordId: id,
  sourceName: "test-source",
  title: `Doc ${id}`,
  sourceUrl: `https://example.invalid/${id}`,
  pdfUrl: `https://example.invalid/${id}.pdf`,
});

const healthyHistory = {
  latestRunStatus: "completed",
  lastSuccessfulAt: new Date().toISOString(),
  documentCount: 500,
  errorCount: 0,
};

test("a source publishing records we never stored is flagged, not called healthy", async () => {
  const report = await probeConnector(
    fakeConnector([record("A"), record("B"), record("C")]),
    { limit: 3 },
    {
      history: healthyHistory,
      // Two of the three upstream records are absent locally.
      findUnseenSourceRecordIds: async () => ["B", "C"],
    },
  );

  assert.equal(
    report.status,
    "behind upstream",
    "a successful run that is missing upstream records must not read as connected",
  );
  assert.equal(report.displayStatus, "Behind Upstream");
  assert.equal(report.sampleRecordsUnseenLocally, 2);
  assert.deepEqual(report.unseenSampleRecordIds, ["B", "C"]);
});

test("a source whose upstream records are all present stays healthy", async () => {
  const report = await probeConnector(
    fakeConnector([record("A"), record("B")]),
    { limit: 2 },
    { history: healthyHistory, findUnseenSourceRecordIds: async () => [] },
  );

  assert.equal(report.status, "connected");
  assert.equal(report.sampleRecordsUnseenLocally, 0);
  assert.equal(report.freshnessCheck, "checked");
});

test("drift never overrides a more serious failure", async () => {
  // A parser break is a bigger problem than being behind; the drift rule
  // must not mask it.
  const brokenConnector = {
    name: "test-source",
    collect: async () => ({
      records: [{ nonsense: true }],
      directoryEntries: [],
      errors: [],
      diagnostics: [],
      snapshots: [],
    }),
  };
  const report = await probeConnector(
    brokenConnector,
    { limit: 1 },
    { history: healthyHistory, findUnseenSourceRecordIds: async () => ["X"] },
  );
  assert.notEqual(report.status, "behind upstream");
});

test("a failed freshness lookup is reported, never treated as fresh", async () => {
  const report = await probeConnector(
    fakeConnector([record("A")]),
    { limit: 1 },
    {
      history: healthyHistory,
      findUnseenSourceRecordIds: async () => {
        throw new Error("database unavailable");
      },
    },
  );

  assert.equal(
    report.freshnessCheck,
    "unavailable",
    "an unavailable check must be visible, not silently pass as zero drift",
  );
  assert.equal(report.status, "connected", "a lookup failure is not itself drift");
});

test("freshness is marked not_checked when no lookup is supplied", async () => {
  const report = await probeConnector(
    fakeConnector([record("A")]),
    { limit: 1 },
    { history: healthyHistory },
  );
  assert.equal(report.freshnessCheck, "not_checked");
  assert.equal(report.sampleRecordsUnseenLocally, 0);
});

test("zero discovered records does not falsely report drift", async () => {
  const report = await probeConnector(
    fakeConnector([]),
    { limit: 3 },
    {
      history: healthyHistory,
      findUnseenSourceRecordIds: async () => {
        throw new Error("must not be called when nothing was discovered");
      },
    },
  );
  assert.equal(report.sampleRecordsUnseenLocally, 0);
  assert.notEqual(report.status, "behind upstream");
});
