const test = require('node:test');
const assert = require('node:assert/strict');
const { publicationIdentity: identity, canonicalPublicationUrl } = require('../lib/ingestion/core/publicationIdentity');
test('publication URLs ignore tracking and query order, retain semantic parameters', () => {
  assert.equal(canonicalPublicationUrl('https://example.org/p?b=2&utm_source=x&a=1#download'), 'https://example.org/p?a=1&b=2');
  assert.equal(identity({publisher:'a',resourceUrl:'https://example.org/p?b=2&a=1'}), identity({publisher:'a',resourceUrl:'https://example.org/p?a=1&b=2&utm_medium=web'}));
});
test('publisher identity dominates files and remains scoped to publisher and edition', () => {
  const record = {publisher:'a',publisherId:'42',title:'Same report',edition:'2026'};
  assert.equal(identity({...record,resourceUrl:'https://example.org/full.pdf'}),identity({...record,resourceUrl:'https://example.org/chapter.pdf'}));
  assert.notEqual(identity(record),identity({...record,edition:'2025'}));
  assert.notEqual(identity(record),identity({...record,publisher:'b'}));
  assert.equal(identity(record),identity(record));
});
test('canonical publication page outranks resource, unknown identity fails closed', () => {
  const record = {publisher:'a',landingUrl:'https://example.org/report/42'};
  assert.equal(identity({...record,resourceUrl:'https://example.org/a.pdf'}),identity({...record,resourceUrl:'https://example.org/b.pdf'}));
  assert.throws(()=>identity({publisher:'a'}));
});
test('fuzzy matching cannot erase publisher editions even when a PDF URL is reused',()=>{
  const {evaluateCandidate}=require('../lib/ingestion/core/dedupe');
  assert.equal(evaluateCandidate({sourceName:'budget',sourceRecordId:'2026',pdfUrl:'https://example.org/b.pdf',metadata:{edition:'2026'}},
    {source_name:'budget',source_record_id:'2025',pdf_url:'https://example.org/b.pdf',metadata_json:{edition:'2025'}}).action,'create');
});
