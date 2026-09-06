const { sources } = require('../config/source-rights.json');
const rightsFor = source => {
  const policy=sources[source];
  if (!policy) return null;
  const fullTextProcessingAllowed=policy.mode==='ATTRIBUTION_REQUIRED';
  const automationBlocked=policy.automatedCollection==='BLOCKED';
  const metadataAllowed=['cag-reports','research-nipfp'].includes(source);
  return {...policy,
    states:[...(metadataAllowed?['METADATA_ALLOWED']:[]),...(fullTextProcessingAllowed?['FULL_TEXT_PROCESSING_ALLOWED']:['MANUAL_REVIEW_REQUIRED']),...(automationBlocked?['AUTOMATION_BLOCKED']:[])],
    permissions:{metadataDiscovery:metadataAllowed?'ALLOWED':'MANUAL_REVIEW_REQUIRED',
      sourceLinks:source==='ministry-home-circulars'?'PERMISSION_REQUIRED':source==='union-budget'?'MANUAL_REVIEW_REQUIRED':'ALLOWED',
      extractedTextStorage:fullTextProcessingAllowed?'ALLOWED_WITH_ATTRIBUTION':'PERMISSION_NOT_ESTABLISHED',
      pdfProcessingOcr:fullTextProcessingAllowed?'ALLOWED_WITH_ATTRIBUTION':'PERMISSION_NOT_ESTABLISHED',
      citedPassages:fullTextProcessingAllowed?'ALLOWED_WITH_ATTRIBUTION':'PERMISSION_NOT_ESTABLISHED',
      automatedCollection:automationBlocked?'BLOCKED':'SUBJECT_TO_ROBOTS_AND_SOURCE_ACCEPTANCE'},
    fullTextProcessingAllowed,metadataAllowed,automationBlocked};
};
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
