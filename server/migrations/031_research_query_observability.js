const crypto = require("node:crypto");

const sql = `
CREATE TABLE IF NOT EXISTS research_query_telemetry (
  id BIGSERIAL PRIMARY KEY,
  query_id UUID NOT NULL UNIQUE,
  query_type TEXT NOT NULL,
  query_planner_version TEXT NOT NULL,
  privacy_scope TEXT NOT NULL CHECK (privacy_scope IN ('public', 'account_private')),
  metadata_latency_ms INTEGER NOT NULL DEFAULT 0,
  fts_latency_ms INTEGER NOT NULL DEFAULT 0,
  vector_latency_ms INTEGER NOT NULL DEFAULT 0,
  graph_latency_ms INTEGER NOT NULL DEFAULT 0,
  fusion_latency_ms INTEGER NOT NULL DEFAULT 0,
  rerank_latency_ms INTEGER NOT NULL DEFAULT 0,
  generation_latency_ms INTEGER NOT NULL DEFAULT 0,
  verification_latency_ms INTEGER NOT NULL DEFAULT 0,
  lexical_candidate_count INTEGER NOT NULL DEFAULT 0,
  vector_candidate_count INTEGER NOT NULL DEFAULT 0,
  fused_candidate_count INTEGER NOT NULL DEFAULT 0,
  final_evidence_count INTEGER NOT NULL DEFAULT 0,
  source_authority_distribution JSONB NOT NULL DEFAULT '{}'::jsonb,
  top_scores JSONB NOT NULL DEFAULT '[]'::jsonb,
  evidence_sufficiency_level TEXT NOT NULL DEFAULT 'UNKNOWN',
  citations_generated INTEGER NOT NULL DEFAULT 0,
  citations_verified INTEGER NOT NULL DEFAULT 0,
  unsupported_claims_removed INTEGER NOT NULL DEFAULT 0,
  abstained BOOLEAN NOT NULL DEFAULT FALSE,
  fallback_used BOOLEAN NOT NULL DEFAULT FALSE,
  tokens_in INTEGER NOT NULL DEFAULT 0,
  tokens_out INTEGER NOT NULL DEFAULT 0,
  model TEXT NOT NULL,
  embedding_model TEXT NOT NULL,
  retrieval_version TEXT NOT NULL,
  cache_status TEXT NOT NULL CHECK (cache_status IN ('hit', 'miss', 'bypass')),
  flags_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS research_query_telemetry_created_idx
  ON research_query_telemetry (created_at DESC);
CREATE INDEX IF NOT EXISTS research_query_telemetry_type_created_idx
  ON research_query_telemetry (query_type, created_at DESC);
`;

module.exports = {
  checksum: crypto.createHash("sha256").update(sql).digest("hex"),
  up: (client) => client.query(sql),
};
