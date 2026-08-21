const crypto = require("node:crypto");

const sql = `
ALTER TABLE documents
  ADD COLUMN IF NOT EXISTS notified_date DATE,
  ADD COLUMN IF NOT EXISTS repealed_date DATE,
  ADD COLUMN IF NOT EXISTS superseded_date DATE,
  ADD COLUMN IF NOT EXISTS amended_date DATE,
  ADD COLUMN IF NOT EXISTS temporal_metadata_json JSONB NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE legislative_documents
  ADD COLUMN IF NOT EXISTS notified_date DATE,
  ADD COLUMN IF NOT EXISTS repealed_date DATE,
  ADD COLUMN IF NOT EXISTS superseded_date DATE,
  ADD COLUMN IF NOT EXISTS amended_date DATE,
  ADD COLUMN IF NOT EXISTS temporal_metadata_json JSONB NOT NULL DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS documents_temporal_effect_idx
  ON documents (effective_date, commencement_date, expiry_date)
  WHERE effective_date IS NOT NULL OR commencement_date IS NOT NULL;
CREATE INDEX IF NOT EXISTS documents_temporal_end_idx
  ON documents (repealed_date, superseded_date)
  WHERE repealed_date IS NOT NULL OR superseded_date IS NOT NULL;
`;

module.exports = {
  checksum: crypto.createHash("sha256").update(sql).digest("hex"),
  up: (client) => client.query(sql),
};
