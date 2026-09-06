const test=require('node:test'), assert=require('node:assert/strict');
const {assertPreparationRights,rightsFor}=require('../document/sourceRights');
for(const source of ['ministry-home-circulars','union-budget','research-nipfp','research-takshashila'])test(`${source} remains metadata-only`,()=>{
  assert.equal(rightsFor(source).mode,'METADATA_ONLY');
  for(const field of ['sourceName','source_name','canonical_source','canonicalSource'])assert.throws(()=>assertPreparationRights({[field]:source}),{code:'SOURCE_METADATA_ONLY',status:403});
});
test('CAG requires attribution; unrelated sources unchanged',()=>{assert.equal(rightsFor('cag-reports').mode,'ATTRIBUTION_REQUIRED');assert.doesNotThrow(()=>assertPreparationRights({sourceName:'cag-reports'}));assert.equal(rightsFor('regulator-rbi'),null);});
test('Takshashila blocks collection before making any request',async()=>{
  const connector=require('../lib/ingestion/connectors/researchExpansionConnectors').expansionConnectors.find(c=>c.name==='research-takshashila');
  let calls=0;
  await assert.rejects(connector.collect({}, {fetcher:{getText:async()=>{calls++;}}}),{code:'SOURCE_COLLECTION_BLOCKED'});
  assert.equal(calls,0);
});
