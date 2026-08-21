const crypto = require("node:crypto");

const sql = `
CREATE TABLE IF NOT EXISTS knowledge_nodes (
  id BIGSERIAL PRIMARY KEY,
  node_type TEXT NOT NULL CHECK (node_type IN (
    'CONCEPT', 'DEFINITION', 'OBLIGATION', 'RIGHT', 'PROHIBITION',
    'EXEMPTION', 'PENALTY', 'PROCEDURE', 'AUTHORITY', 'INDUSTRY',
    'JURISDICTION', 'SCHEME', 'REQUIREMENT', 'ENTITY'
  )),
  canonical_name TEXT NOT NULL,
  normalized_name TEXT NOT NULL,
  description TEXT,
  jurisdiction TEXT NOT NULL DEFAULT 'unspecified',
  authority_id BIGINT REFERENCES legislative_documents(id) ON DELETE SET NULL,
  effective_from DATE,
  effective_to DATE,
  verification_status TEXT NOT NULL DEFAULT 'MODEL_EXTRACTED' CHECK (
    verification_status IN (
      'SOURCE_VERIFIED', 'MODEL_EXTRACTED', 'MODEL_CHECKED',
      'HUMAN_VERIFIED', 'DISPUTED', 'QUARANTINED'
    )
  ),
  generation_method TEXT NOT NULL DEFAULT 'deterministic',
  model_version TEXT,
  owner_user_id BIGINT REFERENCES users(id) ON DELETE CASCADE,
  metadata_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS knowledge_nodes_public_identity_idx
  ON knowledge_nodes (node_type, normalized_name, jurisdiction)
  WHERE owner_user_id IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS knowledge_nodes_private_identity_idx
  ON knowledge_nodes (owner_user_id, node_type, normalized_name, jurisdiction)
  WHERE owner_user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS knowledge_nodes_discovery_fts_idx
  ON knowledge_nodes USING GIN (
    to_tsvector('simple', canonical_name || ' ' || COALESCE(description, ''))
  );
CREATE INDEX IF NOT EXISTS knowledge_nodes_status_idx
  ON knowledge_nodes (verification_status, node_type, jurisdiction);

CREATE TABLE IF NOT EXISTS knowledge_edges (
  id BIGSERIAL PRIMARY KEY,
  source_node_id BIGINT NOT NULL REFERENCES knowledge_nodes(id) ON DELETE CASCADE,
  relationship_type TEXT NOT NULL,
  target_node_id BIGINT NOT NULL REFERENCES knowledge_nodes(id) ON DELETE CASCADE,
  verification_status TEXT NOT NULL DEFAULT 'MODEL_EXTRACTED' CHECK (
    verification_status IN (
      'SOURCE_VERIFIED', 'MODEL_EXTRACTED', 'MODEL_CHECKED',
      'HUMAN_VERIFIED', 'DISPUTED', 'QUARANTINED'
    )
  ),
  confidence NUMERIC(5, 4) CHECK (confidence IS NULL OR (confidence >= 0 AND confidence <= 1)),
  generation_method TEXT NOT NULL DEFAULT 'deterministic',
  model_version TEXT,
  metadata_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (source_node_id <> target_node_id),
  UNIQUE (source_node_id, relationship_type, target_node_id)
);

CREATE INDEX IF NOT EXISTS knowledge_edges_source_idx
  ON knowledge_edges (source_node_id, verification_status, relationship_type);
CREATE INDEX IF NOT EXISTS knowledge_edges_target_idx
  ON knowledge_edges (target_node_id, verification_status, relationship_type);

CREATE TABLE IF NOT EXISTS knowledge_evidence (
  id BIGSERIAL PRIMARY KEY,
  knowledge_node_id BIGINT REFERENCES knowledge_nodes(id) ON DELETE CASCADE,
  knowledge_edge_id BIGINT REFERENCES knowledge_edges(id) ON DELETE CASCADE,
  document_id BIGINT REFERENCES documents(id) ON DELETE CASCADE,
  chunk_id BIGINT REFERENCES document_text_chunks(id) ON DELETE CASCADE,
  resource_id BIGINT REFERENCES document_resources(id) ON DELETE SET NULL,
  owner_user_id BIGINT REFERENCES users(id) ON DELETE CASCADE,
  page_start INTEGER,
  page_end INTEGER,
  section_label TEXT,
  clause_label TEXT,
  evidence_span TEXT NOT NULL,
  evidence_hash TEXT NOT NULL,
  source_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK ((knowledge_node_id IS NOT NULL)::INTEGER + (knowledge_edge_id IS NOT NULL)::INTEGER = 1),
  CHECK (document_id IS NOT NULL OR owner_user_id IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS knowledge_evidence_node_idx
  ON knowledge_evidence (knowledge_node_id, document_id, chunk_id);
CREATE INDEX IF NOT EXISTS knowledge_evidence_edge_idx
  ON knowledge_evidence (knowledge_edge_id, document_id, chunk_id);
CREATE INDEX IF NOT EXISTS knowledge_evidence_document_idx
  ON knowledge_evidence (document_id, chunk_id);
CREATE INDEX IF NOT EXISTS knowledge_evidence_owner_idx
  ON knowledge_evidence (owner_user_id)
  WHERE owner_user_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS knowledge_evidence_node_hash_idx
  ON knowledge_evidence (knowledge_node_id, evidence_hash)
  WHERE knowledge_node_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS knowledge_evidence_edge_hash_idx
  ON knowledge_evidence (knowledge_edge_id, evidence_hash)
  WHERE knowledge_edge_id IS NOT NULL;

CREATE OR REPLACE FUNCTION enforce_knowledge_node_evidence()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.verification_status IN ('SOURCE_VERIFIED', 'HUMAN_VERIFIED')
     AND NOT EXISTS (
       SELECT 1 FROM knowledge_evidence evidence
       WHERE evidence.knowledge_node_id = NEW.id
     ) THEN
    RAISE EXCEPTION 'verified knowledge node requires source evidence';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS knowledge_node_evidence_guard ON knowledge_nodes;
CREATE CONSTRAINT TRIGGER knowledge_node_evidence_guard
AFTER INSERT OR UPDATE OF verification_status ON knowledge_nodes
DEFERRABLE INITIALLY IMMEDIATE
FOR EACH ROW EXECUTE FUNCTION enforce_knowledge_node_evidence();

CREATE OR REPLACE FUNCTION enforce_knowledge_edge_evidence()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.verification_status IN ('SOURCE_VERIFIED', 'HUMAN_VERIFIED')
     AND NOT EXISTS (
       SELECT 1 FROM knowledge_evidence evidence
       WHERE evidence.knowledge_edge_id = NEW.id
     ) THEN
    RAISE EXCEPTION 'verified knowledge edge requires source evidence';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS knowledge_edge_evidence_guard ON knowledge_edges;
CREATE CONSTRAINT TRIGGER knowledge_edge_evidence_guard
AFTER INSERT OR UPDATE OF verification_status ON knowledge_edges
DEFERRABLE INITIALLY IMMEDIATE
FOR EACH ROW EXECUTE FUNCTION enforce_knowledge_edge_evidence();
`;

module.exports = {
  checksum: crypto.createHash("sha256").update(sql).digest("hex"),
  up: (client) => client.query(sql),
};
