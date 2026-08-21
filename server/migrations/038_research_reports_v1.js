const crypto = require("node:crypto");

const sql = `
CREATE TABLE IF NOT EXISTS research_reports (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  research_question TEXT NOT NULL,
  selected_document_ids BIGINT[] NOT NULL DEFAULT '{}',
  report_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  evidence_refs_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  verification_status TEXT NOT NULL CHECK (
    verification_status IN ('verified_evidence', 'limited_evidence', 'insufficient_evidence')
  ),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS research_reports_user_recent_idx
  ON research_reports (user_id, created_at DESC);
`;

module.exports = {
  checksum: crypto.createHash("sha256").update(sql).digest("hex"),
  up: (client) => client.query(sql),
};
