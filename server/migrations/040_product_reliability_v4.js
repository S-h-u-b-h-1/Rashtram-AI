const crypto = require("node:crypto");

const sql = `
ALTER TABLE policy_drafts
  ADD COLUMN IF NOT EXISTS draft_json JSONB NOT NULL DEFAULT '{}'::jsonb;

CREATE TABLE IF NOT EXISTS document_research_profiles (
  document_id BIGINT PRIMARY KEY REFERENCES documents(id) ON DELETE CASCADE,
  content_hash TEXT NOT NULL,
  executive_summary TEXT NOT NULL DEFAULT '',
  document_purpose TEXT NOT NULL DEFAULT '',
  topics_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  themes_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  industries_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  entities_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  authorities_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  regulators_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  ministries_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  jurisdictions_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  important_dates_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  legal_instruments_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  key_provisions_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  obligations_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  rights_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  penalties_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  implementation_topics_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  model TEXT,
  prompt_version TEXT NOT NULL,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS document_structure_nodes (
  id BIGSERIAL PRIMARY KEY,
  document_id BIGINT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  node_id TEXT NOT NULL,
  parent_node_id TEXT,
  title TEXT NOT NULL,
  node_type TEXT NOT NULL,
  summary TEXT NOT NULL DEFAULT '',
  page_start INTEGER,
  page_end INTEGER,
  child_ids_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  source_chunk_ids_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  content_hash TEXT NOT NULL,
  index_version TEXT NOT NULL,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (document_id, node_id)
);

CREATE INDEX IF NOT EXISTS document_structure_nodes_parent_idx
  ON document_structure_nodes (document_id, parent_node_id);
`;

module.exports = {
  checksum: crypto.createHash("sha256").update(sql).digest("hex"),
  up: (client) => client.query(sql),
};
