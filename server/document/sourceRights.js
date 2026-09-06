const { sources } = require('../config/source-rights.json');
const rightsFor = source => sources[source] || null;
function assertCollectionRights(source) {
  const rights = rightsFor(source);
  if (rights?.automatedCollection === 'BLOCKED') {
    const error = new Error(`Automated collection blocked: ${rights.reason}`);
    error.code = 'SOURCE_COLLECTION_BLOCKED'; error.status = 403; error.retryEligible = false;
    throw error;
  }
}
function assertPreparationRights(document = {}) {
  const names = [document.sourceName, document.canonical_source, document.source_name, document.canonicalSource];
  const restriction = names.map(rightsFor).find(rights => rights?.mode === 'METADATA_ONLY');
  if (restriction) {
    const error = new Error(`Metadata-only publisher: ${restriction.reason}`);
    error.code = 'SOURCE_METADATA_ONLY'; error.status = 403; error.retryEligible = false;
    throw error;
  }
}
module.exports = { rightsFor, assertPreparationRights, assertCollectionRights };
