const crypto = require("node:crypto");

const sql = `
CREATE TABLE IF NOT EXISTS document_relationship_quarantine AS
SELECT relationship.*, NULL::TEXT AS quarantine_reason,
  NULL::TIMESTAMPTZ AS quarantined_at
FROM document_relationships relationship
WITH NO DATA;

INSERT INTO document_relationship_quarantine
SELECT relationship.*,
  'Legacy title-token heuristic did not prove a contiguous source reference',
  NOW()
FROM document_relationships relationship
WHERE relationship.relationship_source = 'metadata_heuristic'
  AND relationship.relationship_evidence->>'signal' = 'title_reference';

DELETE FROM document_relationships relationship
WHERE relationship.relationship_source = 'metadata_heuristic'
  AND relationship.relationship_evidence->>'signal' = 'title_reference';

CREATE INDEX IF NOT EXISTS document_relationship_quarantine_document_idx
  ON document_relationship_quarantine (from_document_id, to_document_id);
`;

module.exports = {
  checksum: crypto.createHash("sha256").update(sql).digest("hex"),
  up: (client) => client.query(sql),
};
