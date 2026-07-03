const crypto = require("crypto");

const sql = `
ALTER TABLE document_relationships
  ADD COLUMN IF NOT EXISTS relationship_strength NUMERIC(5, 4),
  ADD COLUMN IF NOT EXISTS relationship_source TEXT,
  ADD COLUMN IF NOT EXISTS explanation TEXT,
  ADD COLUMN IF NOT EXISTS relationship_evidence JSONB
    NOT NULL DEFAULT '{}'::jsonb;

UPDATE document_relationships
SET relationship_strength = COALESCE(relationship_strength, confidence, 0.5),
    relationship_source = COALESCE(
      relationship_source,
      source_name,
      'catalogue'
    ),
    explanation = COALESCE(
      explanation,
      metadata_json->>'explanation',
      metadata->>'explanation'
    ),
    relationship_evidence = CASE
      WHEN relationship_evidence = '{}'::jsonb
      THEN COALESCE(NULLIF(metadata_json, '{}'::jsonb), metadata, '{}'::jsonb)
      ELSE relationship_evidence
    END;

ALTER TABLE document_relationships
  ADD COLUMN IF NOT EXISTS source_document_id BIGINT
    GENERATED ALWAYS AS (from_document_id) STORED,
  ADD COLUMN IF NOT EXISTS target_document_id BIGINT
    GENERATED ALWAYS AS (to_document_id) STORED;

CREATE INDEX IF NOT EXISTS document_relationships_source_type_strength_idx
  ON document_relationships (
    source_document_id,
    relationship_type,
    relationship_strength DESC
  );

CREATE INDEX IF NOT EXISTS document_relationships_target_type_strength_idx
  ON document_relationships (
    target_document_id,
    relationship_type,
    relationship_strength DESC
  );

CREATE INDEX IF NOT EXISTS document_relationships_confidence_idx
  ON document_relationships (confidence DESC, updated_at DESC);

CREATE INDEX IF NOT EXISTS document_relationships_evidence_gin_idx
  ON document_relationships USING GIN (relationship_evidence);

CREATE TABLE IF NOT EXISTS saved_graph_paths (
  id BIGSERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  source_document_id BIGINT NOT NULL
    REFERENCES legislative_documents(id) ON DELETE CASCADE,
  target_document_id BIGINT NOT NULL
    REFERENCES legislative_documents(id) ON DELETE CASCADE,
  path_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  title TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, source_document_id, target_document_id)
);

CREATE INDEX IF NOT EXISTS saved_graph_paths_user_recent_idx
  ON saved_graph_paths (user_id, updated_at DESC);
`;

module.exports = {
  checksum: crypto.createHash("sha256").update(sql).digest("hex"),
  up: (client) => client.query(sql),
};
