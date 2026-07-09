const crypto = require("crypto");

const sql = `
ALTER TABLE document_text_artifacts
  DROP CONSTRAINT IF EXISTS document_text_artifacts_extraction_method_check;

ALTER TABLE document_text_artifacts
  ADD CONSTRAINT document_text_artifacts_extraction_method_check
  CHECK (
    extraction_method IN (
      'pdf_text',
      'gemini_ocr',
      'openai_ocr',
      'source_html'
    )
  );
`;

module.exports = {
  checksum: crypto.createHash("sha256").update(sql).digest("hex"),
  up: (client) => client.query(sql),
};
