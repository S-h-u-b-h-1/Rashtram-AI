const crypto = require("node:crypto");

const sql = `
CREATE TABLE IF NOT EXISTS document_retry_domain_state (
  source_host TEXT PRIMARY KEY,
  policy_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  circuit_state TEXT NOT NULL DEFAULT 'closed'
    CHECK (circuit_state IN ('closed', 'cooldown', 'open')),
  cooldown_until TIMESTAMPTZ,
  window_started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  window_attempts INTEGER NOT NULL DEFAULT 0,
  window_failures INTEGER NOT NULL DEFAULT 0,
  consecutive_failures INTEGER NOT NULL DEFAULT 0,
  total_attempts BIGINT NOT NULL DEFAULT 0,
  total_successes BIGINT NOT NULL DEFAULT 0,
  total_failures BIGINT NOT NULL DEFAULT 0,
  last_request_at TIMESTAMPTZ,
  last_success_at TIMESTAMPTZ,
  last_failure_at TIMESTAMPTZ,
  last_status_code INTEGER,
  last_failure_code TEXT,
  last_failure_reason TEXT,
  circuit_activations INTEGER NOT NULL DEFAULT 0,
  metadata_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS document_retry_domain_state_cooldown_idx
  ON document_retry_domain_state (circuit_state, cooldown_until);

ALTER TABLE document_processing_jobs
  ADD COLUMN IF NOT EXISTS retry_decision TEXT,
  ADD COLUMN IF NOT EXISTS retry_after_seconds INTEGER,
  ADD COLUMN IF NOT EXISTS circuit_opened_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS document_processing_jobs_retry_decision_idx
  ON document_processing_jobs (retry_decision, source_host, updated_at DESC)
  WHERE retry_decision IS NOT NULL;
`;

module.exports = {
  checksum: crypto.createHash("sha256").update(sql).digest("hex"),
  up: (client) => client.query(sql),
};
