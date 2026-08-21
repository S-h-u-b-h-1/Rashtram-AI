const crypto = require("node:crypto");

const sql = `
CREATE TABLE IF NOT EXISTS compliance_research_runs (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  problem_fingerprint TEXT NOT NULL,
  business_profile_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  result_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  evidence_refs_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  status TEXT NOT NULL CHECK (status IN ('completed', 'insufficient_evidence')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS compliance_research_runs_user_recent_idx
  ON compliance_research_runs (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS compliance_research_runs_problem_idx
  ON compliance_research_runs (user_id, problem_fingerprint, created_at DESC);
`;

module.exports = {
  checksum: crypto.createHash("sha256").update(sql).digest("hex"),
  up: (client) => client.query(sql),
};
