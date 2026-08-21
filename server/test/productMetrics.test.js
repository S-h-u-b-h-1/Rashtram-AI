const assert = require("node:assert/strict");
const test = require("node:test");
const {
  getCommercialPilotMetrics, normalizeProductMetric, recordProductMetric,
} = require("../product/productMetricsService");

test("product telemetry accepts only bounded non-content metadata", () => {
  const metric = normalizeProductMetric({
    eventType: "report_generated", workflowType: "research_report",
    sessionId: "private-browser-session", evidenceBacked: true,
    evidenceCount: 9, metadata: { documentCount: 3, rawQuestion: "sensitive question",
      sourceText: "private source" },
  });
  assert.equal(metric.sessionHash.length, 64);
  assert.notEqual(metric.sessionHash, "private-browser-session");
  assert.deepEqual(metric.metadata, { documentCount: 3 });
  assert.equal(JSON.stringify(metric).includes("sensitive question"), false);
  assert.equal(JSON.stringify(metric).includes("private source"), false);
});

test("product telemetry writes no raw question or source fields", async () => {
  let call;
  const success = await recordProductMetric(8, {
    eventType: "compliance_workflow_used", workflowType: "compliance_copilot",
    evidenceBacked: true, evidenceCount: 4, timeToFinalAnswerMs: 900,
  }, async (sql, values) => { call = { sql, values }; return { rows: [] }; });
  assert.equal(success, true);
  assert.match(call.sql, /product_usage_telemetry/);
  assert.doesNotMatch(call.sql, /question_text|source_text/);
});

test("commercial metrics calculate usefulness and repeat-use indicators", async () => {
  const writer = async (sql) => {
    if (sql.includes("FROM user_activity_events")) return { rows: [{ research_sessions: 2,
      questions: 5, citation_opens: 3, source_opens: 4, comparison_usage: 2,
      active_users: 1, users_with_sessions: 1, repeat_users: 1 }] };
    if (sql.includes("FROM research_query_telemetry")) return { rows: [{ answers: 5,
      evidence_answers: 4, abstentions: 1, time_to_first_evidence_ms: 700,
      time_to_final_answer_ms: 1400 }] };
    return { rows: [{ event_type: "report_generated", uses: 2,
      evidence_backed: 2, abstained: 0, users: 1, repeat_users: 1 }] };
  };
  const result = await getCommercialPilotMetrics({ userId: 8, writer });
  assert.equal(result.questionsPerSession, 2.5);
  assert.equal(result.abstentionRate, 0.2);
  assert.equal(result.repeatUsers, 1);
  assert.equal(result.workflows[0].repeatUsers, 1);
});
