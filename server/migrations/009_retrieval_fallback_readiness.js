const crypto = require("crypto");

const sql = `
ALTER TABLE document_processing_state
  ADD COLUMN IF NOT EXISTS retrieval_mode TEXT NOT NULL DEFAULT 'unknown',
  ADD COLUMN IF NOT EXISTS retrieval_verified BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS retrieval_verified_at TIMESTAMPTZ;

UPDATE document_processing_state state
SET retrieval_mode = CASE
      WHEN state.embedding_status = 'ready'
        AND state.embeddings_count >= state.chunks_count
        AND state.chunks_count > 0
        THEN 'vector'
      WHEN state.chunks_count > 0
        THEN 'local_text'
      ELSE retrieval_mode
    END,
    retrieval_verified = CASE
      WHEN state.chunks_count > 0 THEN TRUE
      ELSE retrieval_verified
    END,
    retrieval_verified_at = CASE
      WHEN state.chunks_count > 0
        THEN COALESCE(state.retrieval_verified_at, state.last_processed_at, NOW())
      ELSE state.retrieval_verified_at
    END
WHERE state.retrieval_mode = 'unknown'
   OR (state.chunks_count > 0 AND NOT state.retrieval_verified);
`;

module.exports = {
  checksum: crypto.createHash("sha256").update(sql).digest("hex"),
  up: (client) => client.query(sql),
};
