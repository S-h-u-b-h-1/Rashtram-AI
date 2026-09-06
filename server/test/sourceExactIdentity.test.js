const test = require('node:test');
const assert = require('node:assert/strict');

test('legacy canonical source identity is found without a document_sources row', async () => {
  const db = require('../db');
  const original = db.query;
  const calls = [];
  const modulePath = require.resolve('../lib/ingestion/core/catalogRepository');
  try {
    db.query = async (sql, values) => {
      calls.push({sql, values});
      return {rows:[{id:'42', source_name:'pib', source_document_id:'2306930', source_record_id:'2306930'}]};
    };
    delete require.cache[modulePath];
    const {findCandidates} = require(modulePath);
    const rows = await findCandidates({sourceName:'pib',sourceRecordId:'2306930'});
    assert.equal(rows[0].id, '42');
    assert.equal(calls.length, 1);
    assert.match(calls[0].sql, /d.source_document_id = \$2/);
    assert.deepEqual(calls[0].values, ['pib','2306930']);
  } finally {
    db.query = original;
    delete require.cache[modulePath];
  }
});
