const crypto = require("node:crypto");

const sql = `
CREATE TABLE IF NOT EXISTS document_chat_generations (
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  document_type TEXT NOT NULL,
  document_id TEXT NOT NULL,
  request_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'processing',
  owner_token TEXT NOT NULL,
  response_json JSONB,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, document_type, document_id, request_id),
  CHECK (status IN ('processing', 'completed', 'failed')),
  CHECK (CHAR_LENGTH(request_id) BETWEEN 1 AND 80),
  CHECK (JSONB_TYPEOF(response_json) = 'object' OR response_json IS NULL)
);

CREATE INDEX IF NOT EXISTS document_chat_generations_cleanup_idx
  ON document_chat_generations (
    user_id, document_type, document_id, updated_at DESC
  )
  WHERE status IN ('completed', 'failed');
`;

module.exports = {
  checksum: crypto.createHash("sha256").update(sql).digest("hex"),
  up: (client) => client.query(sql),
};
