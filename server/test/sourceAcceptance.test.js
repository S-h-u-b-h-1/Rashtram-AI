const test = require('node:test');
const assert = require('node:assert/strict');
const {definitions} = require('../lib/ingestion/connectors/researchExpansionConnectors');
const {acceptanceFor,isScheduleAccepted,assertScheduleAccepted} = require('../lib/ingestion/core/sourceAcceptance');
const {classifyConnectorState} = require('../lib/ingestion/core/sourceHealthPolicy');
test('every pilot has an explicit acceptance decision and incomplete sources cannot be scheduled',()=>{
  for(const {name} of definitions){
    assert.ok(['ACCEPTED_FOR_SCHEDULE','MANUAL_ONLY','BLOCKED','NEEDS_MORE_WORK'].includes(acceptanceFor(name).decision));
    if(acceptanceFor(name).decision !== 'ACCEPTED_FOR_SCHEDULE') {
      assert.equal(isScheduleAccepted(name),false);
      assert.throws(()=>assertScheduleAccepted(name),/acceptance/);
    }
  }
});
test('old stored records and a recent attempt cannot make an empty or unaccepted pilot fresh',()=>{
  assert.equal(classifyConnectorState({sourceName:'pib',liveStatus:'connected',storedSourceRecords:100,lastSuccess:new Date().toISOString()}),'NO_DATA');
  assert.notEqual(classifyConnectorState({sourceName:'research-takshashila',liveStatus:'connected',sampleRecordsDiscovered:3,lastSuccess:new Date().toISOString()}),'FRESH');
  assert.equal(classifyConnectorState({sourceName:'pib',liveStatus:'connected',sampleRecordsDiscovered:3,lastSuccess:new Date().toISOString()}),'DELAYED');
});
