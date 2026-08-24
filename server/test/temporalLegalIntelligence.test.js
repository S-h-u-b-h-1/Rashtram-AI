const test = require("node:test");
const assert = require("node:assert/strict");

const { classifyQuery, QUERY_TYPES } = require("../retrieval/queryPlanner");
const {
  applicabilityAt,
  buildBeforeAfterComparison,
  parseTemporalIntent,
  retrieveTemporalPassages,
  temporalEventsFromDocument,
  verifiedRelationship,
} = require("../document/temporalLegalService");

test("time-aware questions route through the existing TIMELINE planner", () => {
  assert.equal(classifyQuery("What applied on 1 January 2025?"), QUERY_TYPES.TIMELINE);
  assert.equal(classifyQuery("Which version applied during FY 2024-25?"), QUERY_TYPES.TIMELINE);
  assert.equal(classifyQuery("Was this rule still in force before 2026?"), QUERY_TYPES.TIMELINE);
  assert.equal(classifyQuery("What changed after amendment?"), QUERY_TYPES.TIMELINE);
});

test("before and after comparisons require source text from both versions", () => {
  assert.equal(buildBeforeAfterComparison({ previousPassages: [{}] }).status,
    "insufficient_source_evidence");
  assert.equal(buildBeforeAfterComparison({ previousPassages: [{}], currentPassages: [{}] }).status,
    "source_evidence_available");
});

test("temporal intent reads exact and financial-year dates without guessing", () => {
  assert.equal(parseTemporalIntent("What applied on 1 January 2025?").targetDate, "2025-01-01");
  assert.deepEqual(parseTemporalIntent("Which version applied during FY 2024-25?").range, {
    from: "2024-04-01", to: "2025-03-31",
  });
  assert.equal(parseTemporalIntent("What applies now?").targetDate, null);
});

test("publication alone never establishes legal effect", () => {
  assert.deepEqual(applicabilityAt({ publication_date: "2024-01-01" }, "2025-01-01"), {
    status: "unknown",
    reason: "effective_or_commencement_date_unverified",
    publicationDate: "2024-01-01",
  });
});

test("explicit effective intervals preserve before, current, and ended states", () => {
  const document = { effective_date: "2024-04-01", repealed_date: "2026-01-01" };
  assert.equal(applicabilityAt(document, "2024-01-01").status, "not_yet_effective");
  assert.equal(applicabilityAt(document, "2025-01-01").status, "potentially_effective");
  assert.equal(applicabilityAt(document, "2026-01-01").status, "no_longer_effective");
});

test("date events remain separate and unknown dates are omitted", () => {
  const events = temporalEventsFromDocument({
    id: 1,
    publication_date: "2024-01-01",
    notified_date: "2024-02-01",
    effective_date: "2024-03-01",
    commencement_date: null,
  });
  assert.deepEqual(events.map((event) => event.kind), ["published", "notified", "effective_from"]);
  assert.deepEqual(events.map((event) => event.dateBasis), [
    "publication_date", "notified_date", "effective_date",
  ]);
});

test("only explicit source-backed relationships enter temporal reasoning", () => {
  assert.equal(verifiedRelationship({ relationship_source: "heuristic", relationship_evidence: {} }), false);
  assert.equal(verifiedRelationship({ relationship_source: "source_explicit", relationship_evidence: {} }), true);
  assert.equal(verifiedRelationship({ relationship_source: "heuristic",
    relationship_evidence: { sourceVerified: true } }), true);
});

test("temporal retrieval states uncertainty and keeps source identity", async () => {
  let call = 0;
  const queryFn = async (sql) => {
    call += 1;
    if (call === 1) {
      assert.doesNotMatch(sql, /current\.canonical_source\b|current\.source_name\b/);
      assert.match(sql, /source_registry registry/);
      return { rows: [{
      id: 10, title: "Model Rule", publication_date: "2024-01-01",
      effective_date: null, commencement_date: null,
      canonical_url: "https://official.example/rule",
      temporal_metadata_json: {},
      }] };
    }
    return { rows: [] };
  };
  const passages = await retrieveTemporalPassages(
    10, "What applied on 1 January 2025?", queryFn,
  );
  assert.match(passages[0].content, /unknown/);
  assert.match(passages[0].content, /Publication date is not treated as commencement/);
  assert.equal(passages[0].sourceUrl, "https://official.example/rule");
  assert.ok(passages.some((passage) => passage.temporal?.dateBasis === "publication_date"));
});
