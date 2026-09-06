const test = require('node:test');
const assert = require('node:assert/strict');
const { publicationDateInfo } = require('../lib/ingestion/core/publicationDate');
test('partial publication dates preserve precision without inventing a day',()=>{
  for (const [raw,precision,value] of [['September 2026','MONTH','2026-09'],['2026','YEAR','2026'],['2026-08','MONTH','2026-08'],['','UNKNOWN',null]]) {
    assert.deepEqual(publicationDateInfo(raw),{raw:raw||null,precision,value,date:null});
  }
});
test('exact dates validate calendar boundaries',()=>{
  assert.equal(publicationDateInfo('22-08-2025').date,'2025-08-22');
  assert.equal(publicationDateInfo('02-Apr-2026').date,'2026-04-02');
  assert.equal(publicationDateInfo('2026-02-30').precision,'UNKNOWN');
  assert.equal(publicationDateInfo('2026-27-08').precision,'UNKNOWN');
  assert.equal(publicationDateInfo('31 February 2026').precision,'UNKNOWN');
  assert.equal(publicationDateInfo(new Date('invalid')).precision,'UNKNOWN');
  assert.equal(publicationDateInfo('Tue, 30 Jun 2026 10:00:00 GMT').date,'2026-06-30');
});
test('normalization retains partial precision and year across retries',()=>{
  const {normalizeRecord}=require('../lib/ingestion/core/normalizer');
  const first=normalizeRecord({sourceName:'research-test',sourceRecordId:'1',sourceUrl:'https://example.org/a',title:'Working paper',publicationDateRaw:'September 2026'});
  const again=normalizeRecord(first);
  assert.equal(first.year,2026);
  assert.equal(again.metadata.publicationDate.precision,'MONTH');
  assert.equal(again.publicationDate,null);
});
