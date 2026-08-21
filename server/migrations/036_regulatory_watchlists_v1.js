const crypto = require("node:crypto");

const sql = `
CREATE TABLE IF NOT EXISTS research_watchlists (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  watch_type TEXT NOT NULL CHECK (watch_type IN (
    'regulator', 'ministry', 'industry', 'document', 'jurisdiction', 'state', 'topic'
  )),
  watch_value TEXT NOT NULL,
  normalized_value TEXT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  last_checked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, watch_type, normalized_value)
);

CREATE INDEX IF NOT EXISTS research_watchlists_user_active_idx
  ON research_watchlists (user_id, active, updated_at DESC);

CREATE TABLE IF NOT EXISTS regulatory_alerts (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  watchlist_id BIGINT NOT NULL REFERENCES research_watchlists(id) ON DELETE CASCADE,
  intelligence_event_id BIGINT NOT NULL REFERENCES intelligence_events(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  why_triggered TEXT NOT NULL,
  impact_summary TEXT NOT NULL,
  source_name TEXT NOT NULL,
  source_url TEXT NOT NULL,
  event_date DATE,
  evidence_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (watchlist_id, intelligence_event_id)
);

CREATE INDEX IF NOT EXISTS regulatory_alerts_user_recent_idx
  ON regulatory_alerts (user_id, created_at DESC);
`;

module.exports = {
  checksum: crypto.createHash("sha256").update(sql).digest("hex"),
  up: (client) => client.query(sql),
};
