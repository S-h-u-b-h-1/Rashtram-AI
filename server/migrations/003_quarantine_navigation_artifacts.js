const crypto = require("crypto");

const sql = `
UPDATE documents d
SET quality_score = 0,
    research_ready = FALSE,
    visibility_status = 'hidden_invalid',
    metadata_json = d.metadata_json || JSONB_BUILD_OBJECT(
      'qualityDisposition', 'invalid_navigation',
      'qualityReason', 'Navigation or category link collected by an early generic regulator parser.'
    ),
    updated_at = NOW()
FROM source_registry sr
WHERE sr.id = d.canonical_source_id
  AND sr.source_type = 'Official Regulator Source'
  AND (
    d.canonical_url ~ '#(?:main-content|mainsection|skipCont)?$'
    OR LOWER(TRIM(d.title)) ~
      '^(skip to (main )?content|print this page|color blindness|text size:.*|user login|about us|privacy policy|english|हिंदी|हिन्दी|description|other initiatives|telecom|broadcasting|legal|notifications?|master directions?|master circulars?|draft notifications?/guidelines|draft directions.*|index to rbi circulars|standalone circulars|circulars withdrawn|guidelines|regulations|policies|bulletins|secretariat|heis|organization(al)? chart|rules? & regulations|individual regulation|consolidated regulation|draft regulation / discussion paper|principal regulation|[0-9]+\\. (gazette|notification))$'
  );
`;

module.exports = {
  checksum: crypto.createHash("sha256").update(sql).digest("hex"),
  up: (client) => client.query(sql),
};
