const crypto = require("node:crypto");

const activityEvents = [
  "login", "logout", "dashboard_viewed", "document_opened", "bill_opened",
  "act_opened", "search_performed", "filter_used", "chat_started",
  "chat_message_sent", "summary_viewed", "source_opened", "citation_opened",
  "profile_viewed", "research_continued", "export_clicked", "comparison_created",
  "documents_compared", "recommendation_viewed", "recommendation_opened",
  "recommendation_added_to_compare", "business_problem_searched", "graph_viewed",
  "graph_node_opened", "graph_path_searched", "graph_path_saved",
].map((value) => `'${value}'`).join(", ");

const sql = `
ALTER TABLE research_query_telemetry
  ADD COLUMN IF NOT EXISTS user_id BIGINT REFERENCES users(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS research_query_telemetry_user_created_idx
  ON research_query_telemetry (user_id, created_at DESC)
  WHERE user_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS product_usage_telemetry (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (event_type IN (
    'compliance_workflow_used', 'watchlist_created',
    'cross_state_comparison_used', 'report_generated', 'report_downloaded'
  )),
  workflow_type TEXT NOT NULL,
  session_hash TEXT,
  success BOOLEAN NOT NULL DEFAULT TRUE,
  evidence_backed BOOLEAN NOT NULL DEFAULT FALSE,
  abstained BOOLEAN NOT NULL DEFAULT FALSE,
  evidence_count INTEGER NOT NULL DEFAULT 0,
  citation_count INTEGER NOT NULL DEFAULT 0,
  time_to_first_evidence_ms INTEGER NOT NULL DEFAULT 0,
  time_to_final_answer_ms INTEGER NOT NULL DEFAULT 0,
  metadata_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS product_usage_telemetry_user_recent_idx
  ON product_usage_telemetry (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS product_usage_telemetry_type_recent_idx
  ON product_usage_telemetry (event_type, created_at DESC);

ALTER TABLE user_activity_events
  DROP CONSTRAINT IF EXISTS user_activity_events_event_type_check;
ALTER TABLE user_activity_events
  ADD CONSTRAINT user_activity_events_event_type_check
  CHECK (event_type IN (${activityEvents}));
`;

module.exports = {
  checksum: crypto.createHash("sha256").update(sql).digest("hex"),
  up: (client) => client.query(sql),
};
