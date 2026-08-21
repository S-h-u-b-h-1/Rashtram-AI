const crypto = require("node:crypto");

const sql = `
CREATE INDEX IF NOT EXISTS document_processing_state_semantic_backlog_idx
  ON document_processing_state (semantic_ready, retry_eligible, document_id)
  WHERE search_ready;

CREATE INDEX IF NOT EXISTS document_text_chunks_namespace_document_idx
  ON document_text_chunks (embedding_namespace, document_id)
  WHERE vector_reference IS NOT NULL;

CREATE INDEX IF NOT EXISTS user_activity_events_document_recent_idx
  ON user_activity_events (document_id, created_at DESC)
  WHERE document_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS processing_attempts_semantic_backfill_idx
  ON document_processing_attempts (completed_at DESC, status)
  WHERE pipeline_stage = 'semantic_backfill';
`;

module.exports = {
  checksum: crypto.createHash("sha256").update(sql).digest("hex"),
  up: (client) => client.query(sql),
};
