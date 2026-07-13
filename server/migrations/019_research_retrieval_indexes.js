const crypto = require("node:crypto");

const sql = `
CREATE INDEX IF NOT EXISTS document_text_chunks_original_text_fts_idx
  ON document_text_chunks
  USING GIN (to_tsvector('simple', COALESCE(original_text, '')));

CREATE INDEX IF NOT EXISTS documents_title_fts_idx
  ON documents
  USING GIN (to_tsvector('simple', COALESCE(title, '')));

CREATE INDEX IF NOT EXISTS document_processing_state_retrieval_verified_idx
  ON document_processing_state (document_id)
  WHERE retrieval_verified;
`;

module.exports = {
  checksum: crypto.createHash("sha256").update(sql).digest("hex"),
  up: (client) => client.query(sql),
};
