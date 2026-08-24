const crypto = require("node:crypto");

const sql = `
ALTER TABLE document_comparisons
  ADD COLUMN IF NOT EXISTS current_version INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS regeneration_status TEXT NOT NULL DEFAULT 'idle',
  ADD COLUMN IF NOT EXISTS regeneration_started_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_regenerated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS regeneration_failure_stage TEXT;

CREATE TABLE IF NOT EXISTS document_comparison_versions (
  id BIGSERIAL PRIMARY KEY,
  comparison_id BIGINT NOT NULL REFERENCES document_comparisons(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL CHECK (version_number > 0),
  document_ids_json JSONB NOT NULL,
  mode TEXT NOT NULL,
  language TEXT NOT NULL,
  user_question TEXT,
  result_json JSONB NOT NULL,
  generation_mode TEXT,
  timings_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (comparison_id, version_number),
  CHECK (JSONB_TYPEOF(document_ids_json) = 'array')
);

CREATE INDEX IF NOT EXISTS document_comparison_versions_recent_idx
  ON document_comparison_versions (comparison_id, version_number DESC);

INSERT INTO document_comparison_versions (
  comparison_id, version_number, document_ids_json, mode, language,
  user_question, result_json, generation_mode, created_at
)
SELECT comparison.id, 1, comparison.document_ids_json, comparison.mode,
       comparison.language, comparison.user_question, comparison.result_json,
       comparison.result_json->>'generationMode', comparison.created_at
  FROM document_comparisons comparison
ON CONFLICT (comparison_id, version_number) DO NOTHING;
`;

module.exports = {
  checksum: crypto.createHash("sha256").update(sql).digest("hex"),
  up: (client) => client.query(sql),
};
