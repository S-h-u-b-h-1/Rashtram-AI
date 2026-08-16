const crypto = require("node:crypto");

const sql = `
CREATE TABLE IF NOT EXISTS policy_drafts (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  brief_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  document_ids_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  source_ids_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  draft_text TEXT NOT NULL DEFAULT '',
  citations_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  status TEXT NOT NULL DEFAULT 'processing'
    CHECK (status IN ('processing', 'ready', 'failed')),
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS policy_drafts_user_recent_idx
  ON policy_drafts (user_id, updated_at DESC, id DESC);
`;

module.exports = {
  checksum: crypto.createHash("sha256").update(sql).digest("hex"),
  up: (client) => client.query(sql),
};
