const crypto = require("node:crypto");

// Migration 020 established the quarantine table. A production graph batch
// running the previous inference code created more legacy title-token edges
// after 020 was recorded, so this follow-up performs the same auditable cleanup
// when the corrected inference code is deployed.
const sql = `
INSERT INTO document_relationship_quarantine
SELECT relationship.*,
  'Created by legacy title-token inference after migration 020',
  NOW()
FROM document_relationships relationship
WHERE relationship.relationship_source = 'metadata_heuristic'
  AND relationship.relationship_evidence->>'signal' = 'title_reference';

DELETE FROM document_relationships relationship
WHERE relationship.relationship_source = 'metadata_heuristic'
  AND relationship.relationship_evidence->>'signal' = 'title_reference';
`;

module.exports = {
  checksum: crypto.createHash("sha256").update(sql).digest("hex"),
  up: (client) => client.query(sql),
};
