const crypto = require("crypto");

const sql = `
ALTER TABLE document_text_chunks
  ADD COLUMN IF NOT EXISTS content_hash TEXT;

ALTER TABLE document_text_chunks
  ADD COLUMN IF NOT EXISTS embedding_namespace TEXT;

CREATE INDEX IF NOT EXISTS document_text_chunks_content_hash_idx
  ON document_text_chunks (document_id, content_hash)
  WHERE content_hash IS NOT NULL;
`;

module.exports = {
  checksum: crypto.createHash("sha256").update(sql).digest("hex"),
  up: (client) => client.query(sql),
};
