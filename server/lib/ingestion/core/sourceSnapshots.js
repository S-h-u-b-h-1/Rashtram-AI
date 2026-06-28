const { sha256 } = require("./hashing");

const createSnapshot = ({
  sourceName,
  sourceUrl,
  body,
  responseStatus = 200,
  recordCount = 0,
  metadata = {},
}) => ({
  sourceName,
  sourceUrl,
  contentSha256: sha256(body),
  htmlHash: sha256(body),
  responseStatus,
  recordCount,
  collectedAt: new Date().toISOString(),
  metadata,
});

module.exports = {
  createSnapshot,
};
