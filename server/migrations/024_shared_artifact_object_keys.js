const crypto = require("node:crypto");

const sql = `
ALTER TABLE document_artifact_objects
  DROP CONSTRAINT IF EXISTS document_artifact_objects_object_key_key;

CREATE INDEX IF NOT EXISTS document_artifact_objects_object_key_idx
  ON document_artifact_objects (object_key);
`;

module.exports = {
  checksum: crypto.createHash("sha256").update(sql).digest("hex"),
  up: (client) => client.query(sql),
};
