const crypto = require("crypto");

const sql = `
ALTER TABLE document_comparisons
  ADD COLUMN IF NOT EXISTS user_question TEXT,
  ADD COLUMN IF NOT EXISTS recommended_documents_json JSONB
    NOT NULL DEFAULT '[]'::jsonb;

CREATE INDEX IF NOT EXISTS document_comparisons_documents_gin_idx
  ON document_comparisons USING GIN (document_ids_json);

CREATE INDEX IF NOT EXISTS recommendations_user_recent_idx
  ON recommendations (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS recommendations_document_score_idx
  ON recommendations (document_id, score DESC);

CREATE INDEX IF NOT EXISTS recommendations_expiry_idx
  ON recommendations (expires_at)
  WHERE expires_at IS NOT NULL;
`;

module.exports = {
  checksum: crypto.createHash("sha256").update(sql).digest("hex"),
  up: (client) => client.query(sql),
};
