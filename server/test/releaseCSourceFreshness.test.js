const assert = require("node:assert/strict");
const test = require("node:test");

const {
  CONNECTOR_STATUS,
  classifyConnectorState,
  classifyFailure,
} = require("../lib/ingestion/core/sourceHealthPolicy");
const {
  assessCurrentVerification,
  loadDocumentSourceFreshness,
} = require("../document/temporalLegalService");

test("failure taxonomy keeps externally blocked causes distinct", () => {
  assert.equal(classifyFailure({ message: "robots.txt disallows catalog fetch" }), "ROBOTS_BLOCK");
  assert.equal(classifyFailure({ message: "unable to verify the first certificate" }), "TLS_CERTIFICATE_FAILURE");
  assert.equal(classifyFailure({ message: "Status code 429" }), "HTTP_429");
  assert.equal(classifyFailure({ message: "official endpoint URL pattern changed" }), "URL_PATTERN_CHANGED");
  assert.equal(classifyFailure({ message: "downloaded response is HTML, not a PDF" }), "HTML_INSTEAD_OF_PDF");
});

test("freshness thresholds are source-cadence aware", () => {
  const now = new Date("2026-09-05T12:00:00.000Z").getTime();
  assert.equal(classifyConnectorState({
    sourceName: "pib",
    liveStatus: "connected",
    lastSuccess: "2026-09-05T08:00:00.000Z",
    storedSourceRecords: 1,
    now,
  }), CONNECTOR_STATUS.FRESH);
  assert.equal(classifyConnectorState({
    sourceName: "pib",
    liveStatus: "connected",
    lastSuccess: "2026-09-04T23:00:00.000Z",
    storedSourceRecords: 1,
    now,
  }), CONNECTOR_STATUS.STALE);
  assert.equal(classifyConnectorState({
    sourceName: "state-legislature",
    liveStatus: "connected",
    lastSuccess: "2026-08-28T12:00:00.000Z",
    storedSourceRecords: 1,
    now,
  }), CONNECTOR_STATUS.FRESH);
});

test("external TLS, robots, and access controls classify as BLOCKED_EXTERNAL", () => {
  for (const failureClass of ["TLS_CERTIFICATE_FAILURE", "ROBOTS_BLOCK", "CAPTCHA_BLOCK", "HTTP_403"]) {
    assert.equal(classifyConnectorState({
      sourceName: "egazette",
      liveStatus: "unavailable",
      failureClass,
      storedSourceRecords: 10,
    }), CONNECTOR_STATUS.BLOCKED_EXTERNAL);
  }
});

test("stored source health is normalized for current-status safety", async () => {
  const rows = [{
    source_name: "egazette",
    status: "blocked_external",
    reachable: false,
    parser_status: "failed",
    last_checked_at: "2026-09-05T10:00:00.000Z",
    last_successful_run_at: "2026-07-15T10:00:00.000Z",
    last_failed_run_at: "2026-09-05T10:00:00.000Z",
    consecutive_failures: 3,
    last_error: "unable to verify the first certificate",
    metadata_json: {
      finalStatus: "BLOCKED_EXTERNAL",
      failureClass: "TLS_CERTIFICATE_FAILURE",
    },
    ingestion_frequency: "daily",
    enabled: true,
  }];
  const freshness = await loadDocumentSourceFreshness(
    { source: "egazette" },
    async () => ({ rows }),
  );
  assert.equal(freshness.freshnessStatus, CONNECTOR_STATUS.BLOCKED_EXTERNAL);
  assert.equal(freshness.verificationLevel, "PARTIALLY_VERIFIED");
  assert.equal(freshness.failureClass, "TLS_CERTIFICATE_FAILURE");

  const verification = assessCurrentVerification({
    passages: [{
      retrievalMode: "temporal_fts",
      temporalRole: "later_version",
      authorityClass: "PRIMARY_OFFICIAL",
    }],
    freshness,
  });
  assert.notEqual(verification.status, "VERIFIED_CURRENT");
  assert.match(verification.connectorWarning, /externally blocked/i);
});

test("fresh connector without later authoritative evidence remains partial", async () => {
  const freshness = await loadDocumentSourceFreshness(
    { source: "india-code" },
    async () => ({ rows: [{
      source_name: "india-code",
      status: "fresh",
      reachable: true,
      parser_status: "valid",
      last_checked_at: "2026-09-05T10:00:00.000Z",
      last_successful_run_at: "2026-09-05T10:00:00.000Z",
      consecutive_failures: 0,
      last_error: null,
      metadata_json: { finalStatus: "FRESH" },
      ingestion_frequency: "daily",
      enabled: true,
    }] }),
  );
  assert.equal(freshness.verificationLevel, "FULLY_VERIFIED");
  assert.equal(assessCurrentVerification({ passages: [], freshness }).status, "PARTIALLY_VERIFIED");
});
