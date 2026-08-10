const crypto = require("node:crypto");

const sql = `
CREATE TABLE IF NOT EXISTS dedupe_candidates (
  id BIGSERIAL PRIMARY KEY,
  document_id BIGINT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  candidate_document_id BIGINT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  match_type TEXT NOT NULL,
  confidence NUMERIC(5, 4),
  status TEXT NOT NULL DEFAULT 'pending',
  evidence_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reviewed_at TIMESTAMPTZ,
  CHECK (document_id <> candidate_document_id),
  UNIQUE (document_id, candidate_document_id, match_type)
);
`;

module.exports = {
  checksum: crypto.createHash("sha256").update(sql).digest("hex"),
  up: (client) => client.query(sql),
};
