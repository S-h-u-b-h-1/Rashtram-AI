const crypto = require("node:crypto");

const sql = `
CREATE TABLE IF NOT EXISTS document_chunk_groups (
  id BIGSERIAL PRIMARY KEY,
  document_id BIGINT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  group_index INTEGER NOT NULL CHECK (group_index >= 0),
  group_title TEXT,
  child_start_index INTEGER NOT NULL CHECK (child_start_index >= 0),
  child_end_index INTEGER NOT NULL CHECK (child_end_index >= child_start_index),
  child_count INTEGER NOT NULL CHECK (child_count > 0),
  representation_text TEXT NOT NULL,
  representation_hash TEXT NOT NULL,
  vector_reference TEXT,
  embedding_namespace TEXT,
  metadata_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (document_id, group_index)
);

CREATE INDEX IF NOT EXISTS document_chunk_groups_document_range_idx
  ON document_chunk_groups (document_id, child_start_index, child_end_index);
CREATE INDEX IF NOT EXISTS document_chunk_groups_vector_idx
  ON document_chunk_groups (embedding_namespace, vector_reference)
  WHERE vector_reference IS NOT NULL;

ALTER TABLE document_processing_state
  ADD COLUMN IF NOT EXISTS hierarchical_semantic_ready BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS hierarchical_vectors_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS hierarchical_index_version TEXT;
`;

module.exports = {
  checksum: crypto.createHash("sha256").update(sql).digest("hex"),
  up: (client) => client.query(sql),
};
