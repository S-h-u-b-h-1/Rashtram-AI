const crypto = require("node:crypto");
const { query } = require("../db");

const EVENT_TYPES = new Set([
  "compliance_workflow_used", "watchlist_created", "cross_state_comparison_used",
  "report_generated", "report_downloaded",
]);
const SAFE_METADATA_KEYS = new Set(["documentCount", "stateCount", "watchType", "mode"]);
const integer = (value) => Number.isFinite(Number(value)) ? Math.max(0, Math.round(Number(value))) : 0;

const normalizeProductMetric = (value = {}) => {
  const eventType = String(value.eventType || "").slice(0, 60);
  if (!EVENT_TYPES.has(eventType)) throw new Error("Unsupported product telemetry event.");
  const metadata = Object.fromEntries(Object.entries(value.metadata || {})
    .filter(([key, item]) => SAFE_METADATA_KEYS.has(key) && ["string", "number", "boolean"].includes(typeof item))
    .map(([key, item]) => [key, typeof item === "string" ? item.slice(0, 80) : item]));
  return {
    eventType, workflowType: String(value.workflowType || eventType).slice(0, 80),
    sessionHash: value.sessionId ? crypto.createHash("sha256")
      .update(String(value.sessionId).slice(0, 200)).digest("hex") : null,
    success: value.success !== false, evidenceBacked: Boolean(value.evidenceBacked),
    abstained: Boolean(value.abstained), evidenceCount: integer(value.evidenceCount),
    citationCount: integer(value.citationCount),
    timeToFirstEvidenceMs: integer(value.timeToFirstEvidenceMs),
    timeToFinalAnswerMs: integer(value.timeToFinalAnswerMs), metadata,
  };
};

const recordProductMetric = async (userId, value, writer = query) => {
  try {
    const metric = normalizeProductMetric(value);
    await writer(
      `INSERT INTO product_usage_telemetry
         (user_id, event_type, workflow_type, session_hash, success,
          evidence_backed, abstained, evidence_count, citation_count,
          time_to_first_evidence_ms, time_to_final_answer_ms, metadata_json)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12::jsonb)`,
      [userId, metric.eventType, metric.workflowType, metric.sessionHash,
        metric.success, metric.evidenceBacked, metric.abstained,
        metric.evidenceCount, metric.citationCount, metric.timeToFirstEvidenceMs,
        metric.timeToFinalAnswerMs, JSON.stringify(metric.metadata)],
    );
    return true;
  } catch (error) {
    console.warn("[product-telemetry] write unavailable", { eventType: value.eventType, code: error.code || null });
    return false;
  }
};

const getCommercialPilotMetrics = async ({ userId = null, writer = query } = {}) => {
  const scope = userId ? "AND user_id = $1" : "";
  const values = userId ? [userId] : [];
  const [activity, research, product] = await Promise.all([
    writer(`SELECT
       COUNT(DISTINCT session_id) FILTER (WHERE session_id IS NOT NULL)::INTEGER AS research_sessions,
       COUNT(*) FILTER (WHERE event_type = 'chat_message_sent')::INTEGER AS questions,
       COUNT(*) FILTER (WHERE event_type = 'citation_opened')::INTEGER AS citation_opens,
       COUNT(*) FILTER (WHERE event_type = 'source_opened')::INTEGER AS source_opens,
       COUNT(*) FILTER (WHERE event_type IN ('comparison_created','documents_compared'))::INTEGER AS comparison_usage,
       COUNT(DISTINCT user_id)::INTEGER AS active_users,
       COUNT(DISTINCT user_id) FILTER (WHERE session_id IS NOT NULL)::INTEGER AS users_with_sessions,
       (SELECT COUNT(*)::INTEGER FROM (
          SELECT user_id FROM user_activity_events
          WHERE created_at >= NOW() - INTERVAL '30 days' ${scope}
            AND session_id IS NOT NULL
          GROUP BY user_id HAVING COUNT(DISTINCT session_id) >= 2
        ) repeated) AS repeat_users
     FROM user_activity_events WHERE created_at >= NOW() - INTERVAL '30 days' ${scope}`, values),
    writer(`SELECT COUNT(*)::INTEGER AS answers,
       COUNT(*) FILTER (WHERE NOT abstained AND evidence_sufficiency_level IN ('HIGH','MEDIUM'))::INTEGER AS evidence_answers,
       COUNT(*) FILTER (WHERE abstained)::INTEGER AS abstentions,
       ROUND(AVG(metadata_latency_ms + GREATEST(fts_latency_ms, vector_latency_ms, graph_latency_ms)
         + fusion_latency_ms + rerank_latency_ms))::INTEGER AS time_to_first_evidence_ms,
       ROUND(AVG(metadata_latency_ms + GREATEST(fts_latency_ms, vector_latency_ms, graph_latency_ms)
         + fusion_latency_ms + rerank_latency_ms + generation_latency_ms + verification_latency_ms))::INTEGER
         AS time_to_final_answer_ms
     FROM research_query_telemetry WHERE created_at >= NOW() - INTERVAL '30 days'
       ${userId ? "AND user_id = $1" : ""}`, values),
    writer(`WITH scoped AS (
       SELECT * FROM product_usage_telemetry
       WHERE created_at >= NOW() - INTERVAL '30 days' ${scope}
     ), repeated AS (
       SELECT event_type, COUNT(*)::INTEGER AS repeat_users FROM (
         SELECT event_type, user_id FROM scoped GROUP BY event_type, user_id HAVING COUNT(*) >= 2
       ) grouped GROUP BY event_type
     ) SELECT scoped.event_type, COUNT(*)::INTEGER AS uses,
       COUNT(*) FILTER (WHERE evidence_backed)::INTEGER AS evidence_backed,
       COUNT(*) FILTER (WHERE abstained)::INTEGER AS abstained,
       COUNT(DISTINCT user_id)::INTEGER AS users, COALESCE(repeated.repeat_users, 0) AS repeat_users
     FROM scoped LEFT JOIN repeated ON repeated.event_type = scoped.event_type
     GROUP BY scoped.event_type, repeated.repeat_users ORDER BY scoped.event_type`, values),
  ]);
  const a = activity.rows[0] || {};
  const r = research.rows[0] || {};
  const sessions = integer(a.research_sessions);
  const answers = integer(r.answers);
  return {
    window: "30d", scope: userId ? "account" : "aggregate",
    researchSessions: sessions, questions: integer(a.questions),
    questionsPerSession: sessions ? Number((integer(a.questions) / sessions).toFixed(2)) : 0,
    answers, successfulEvidenceBackedAnswers: integer(r.evidence_answers),
    abstentions: integer(r.abstentions), abstentionRate: answers
      ? Number((integer(r.abstentions) / answers).toFixed(4)) : 0,
    citationOpens: integer(a.citation_opens), sourceOpens: integer(a.source_opens),
    comparisonUsage: integer(a.comparison_usage),
    averageTimeToFirstEvidenceMs: integer(r.time_to_first_evidence_ms),
    averageTimeToFinalAnswerMs: integer(r.time_to_final_answer_ms),
    activeUsers: integer(a.active_users), usersWithSessions: integer(a.users_with_sessions),
    repeatUsers: integer(a.repeat_users),
    workflows: product.rows.map((row) => ({ eventType: row.event_type,
      uses: integer(row.uses), evidenceBacked: integer(row.evidence_backed),
      abstained: integer(row.abstained), users: integer(row.users),
      repeatUsers: integer(row.repeat_users) })),
  };
};

module.exports = { EVENT_TYPES, getCommercialPilotMetrics,
  normalizeProductMetric, recordProductMetric };
