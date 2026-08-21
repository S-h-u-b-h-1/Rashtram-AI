const assert = require("node:assert/strict");
const test = require("node:test");
const {
  eventMatches, refreshWatchlists, validateWatchlist,
} = require("../product/watchlistService");

test("watchlists validate supported, meaningful values", () => {
  assert.deepEqual(validateWatchlist({ watchType: "Ministry", watchValue: "  Finance  " }), {
    watchType: "ministry", watchValue: "Finance", normalizedValue: "finance",
  });
  assert.throws(() => validateWatchlist({ watchType: "anything", watchValue: "x" }));
});

test("regulator and state alerts require exact verified metadata matches", () => {
  const event = { authority: "Reserve Bank of India", jurisdiction: "Odisha" };
  assert.equal(eventMatches({ watchType: "regulator", watchValue: "Reserve Bank of India" }, event), true);
  assert.equal(eventMatches({ watchType: "regulator", watchValue: "Reserve Bank" }, event), false);
  assert.equal(eventMatches({ watchType: "state", watchValue: "Odisha" }, event), true);
});

test("refresh creates an evidence-linked alert only for events with source identity", async () => {
  const calls = [];
  const watchlists = [{ id: "9", watchType: "topic", watchValue: "taxation" }];
  const events = [{
    id: "21", event_type: "document_updated", title: "Taxation rules updated",
    summary: "Official update", source_name: "Official Gazette",
    source_url: "https://example.gov.in/rule", event_date: "2026-08-20",
    authority: "Revenue Department", jurisdiction: "India",
  }];
  const fakeQuery = async (sql, values) => {
    calls.push({ sql, values });
    if (sql.includes("INSERT INTO regulatory_alerts")) return { rows: [{
      id: 1, watchlist_id: 9, intelligence_event_id: 21,
      title: values[3], why_triggered: values[4], impact_summary: values[5],
      source_name: values[6], source_url: values[7], event_date: values[8],
      evidence_json: JSON.parse(values[9]), created_at: new Date().toISOString(),
    }] };
    return { rows: [], rowCount: 1 };
  };
  const result = await refreshWatchlists(7, { query: fakeQuery, watchlists, events });
  assert.equal(result.created, 1);
  assert.equal(result.alerts[0].sourceUrl, "https://example.gov.in/rule");
  assert.match(result.alerts[0].whyTriggered, /topic matches/);
  assert.equal(calls.some((call) => call.sql.includes("INSERT INTO regulatory_alerts")), true);
});

test("unrelated similarity never triggers a regulator alert", async () => {
  const result = await refreshWatchlists(7, {
    query: async () => ({ rows: [], rowCount: 1 }),
    watchlists: [{ id: "9", watchType: "regulator", watchValue: "SEBI" }],
    events: [{ id: "22", title: "Securities update", authority: "Ministry of Finance",
      source_name: "Official", source_url: "https://example.gov.in/update" }],
  });
  assert.equal(result.created, 0);
});
