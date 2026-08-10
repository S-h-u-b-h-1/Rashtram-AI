const crypto = require("node:crypto");

const sql = `
DROP TRIGGER IF EXISTS source_collection_snapshots_sync_v2
  ON source_collection_snapshots;
DROP FUNCTION IF EXISTS sync_source_snapshot_v2();

DROP TABLE IF EXISTS document_topics;
DROP TABLE IF EXISTS topic_taxonomy;
DROP TABLE IF EXISTS source_connectors;
DROP TABLE IF EXISTS source_snapshots;
DROP TABLE IF EXISTS contact_submissions;
DROP TABLE IF EXISTS dedupe_candidates;
DROP TABLE IF EXISTS document_relationship_quarantine;
DROP TABLE IF EXISTS system_events;
`;

module.exports = {
  checksum: crypto.createHash("sha256").update(sql).digest("hex"),
  up: (client) => client.query(sql),
};
