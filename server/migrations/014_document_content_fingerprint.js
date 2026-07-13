const crypto = require("crypto");

const sql = `
ALTER TABLE documents
  ADD COLUMN IF NOT EXISTS content_fingerprint_sha256 TEXT;

UPDATE documents document
SET content_fingerprint_sha256 = COALESCE(
      document.content_fingerprint_sha256,
      state.output_checksum_sha256,
      artifact.metadata_json ->> 'textSha256'
    )
FROM document_processing_state state
LEFT JOIN document_text_artifacts artifact
  ON artifact.document_id = state.document_id
WHERE state.document_id = document.id
  AND COALESCE(
    document.content_fingerprint_sha256,
    state.output_checksum_sha256,
    artifact.metadata_json ->> 'textSha256'
  ) IS NOT NULL;

CREATE INDEX IF NOT EXISTS documents_content_fingerprint_sha256_idx
  ON documents (content_fingerprint_sha256)
  WHERE content_fingerprint_sha256 IS NOT NULL;
`;

module.exports = {
  checksum: crypto.createHash("sha256").update(sql).digest("hex"),
  up: (client) => client.query(sql),
};
