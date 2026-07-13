const crypto = require("crypto");

const sql = `
CREATE TABLE IF NOT EXISTS document_processing_audit_log (
  id BIGSERIAL PRIMARY KEY,
  document_id BIGINT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  previous_state_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  new_state_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  evidence_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  performed_by TEXT NOT NULL DEFAULT 'system',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS document_processing_audit_log_document_idx
  ON document_processing_audit_log (document_id, created_at DESC);

CREATE INDEX IF NOT EXISTS document_processing_audit_log_action_idx
  ON document_processing_audit_log (action, created_at DESC);
`;

module.exports = {
  checksum: crypto.createHash("sha256").update(sql).digest("hex"),
  up: (client) => client.query(sql),
};
