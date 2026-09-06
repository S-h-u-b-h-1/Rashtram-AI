const test = require('node:test');
const assert = require('node:assert/strict');
const { expansionConnectors } = require('../lib/ingestion/connectors/researchExpansionConnectors');
const { parseListing, fileMetadata } = require('../lib/ingestion/connectors/publicListingConnector');
const { sourcePolicyFor } = require('../lib/ingestion/core/sourcePolicy');
const { scheduleForProfile } = require('../lib/ingestion/schedules');
const { officialUrl } = require('../cli/ministryDiscoveryAudit');
const { parseArguments } = require('../cli/scheduledIngestion');

test('pilots are registered but not automatically scheduled', () => {
  for (const source of expansionConnectors) {
    assert.ok(!scheduleForProfile('daily').includes(source.name));
    assert.ok(!scheduleForProfile('weekly').includes(source.name));
  }
  assert.equal(parseArguments(['--dry-run']).dryRun, true);
});
test('structured companion formats are not misclassified as HTML', () => {
  assert.equal(fileMetadata('https://example.gov.in/data.csv').mimeType, 'text/csv');
  assert.match(fileMetadata('https://example.gov.in/data.xlsx').mimeType, /spreadsheet/);
});
test('listing identity and resources ignore tracking decoration',()=>{
  const records=parseListing('<a href="/report.pdf?b=2&utm_source=test&a=1">Annual report</a><a href="/report.pdf?a=1&b=2">Annual report</a>','https://example.gov.in/',{name:'fixture'});
  assert.equal(records.length,1);
  assert.equal(records[0].resources[0].url,'https://example.gov.in/report.pdf?a=1&b=2');
});
test('NIPFP publisher metadata preserves month precision and working-paper identity',async()=>{
  const connector=expansionConnectors.find((s)=>s.name==='research-nipfp');
  const result=await connector.collect({limit:1},{fetcher:{getText:async()=>({status:200,body:'<div class="faculty"><h3>Credit constraints research</h3><ul class="misc-details-job">जून, 2026<li><span>Authors</span>Example Author</li><li><span>Details</span>NIPFP Working Paper No. 449</li><li><a href="/publication-index-page/working-paper-index-page/credit/">Comment</a></li><li><a href="/media/documents/WP_449_2026.pdf">Download</a></li></ul></div>'})}});
  assert.equal(result.records[0].publicationDateRaw,'2026-06');
  assert.equal(result.records[0].publicationDate,null);
  assert.equal(result.records[0].metadata.publisherId,'449');
  assert.equal(result.records[0].metadata.authors,'Example Author');
});
test('host restrictions require a DNS label boundary', () => {
  const records = parseListing('<a href="https://evilgov.in/f.pdf">False document</a>', 'https://gov.in/', {name:'test', allowedHosts:['gov.in']});
  assert.deepEqual(records, []);
  assert.equal(officialUrl('https://gov.in.evil.com/'), null);
  assert.equal(officialUrl('http://127.0.0.1/'), null);
});
test('MHA circular title and date do not become download labels or invalid months', async () => {
  const connector = expansionConnectors.find((item) => item.name === 'ministry-home-circulars');
  const result = await connector.collect({}, {fetcher: {getText: async () => ({body:'<table><tr><td>1</td><td>Vigilance Awareness Week</td><td><a href="/file.pdf">Download 12 KB</a></td><td>Tue, 08/18/2026 - Wed, 11/18/2026</td></tr></table>',status:200})}});
  assert.equal(result.records[0].title, 'Vigilance Awareness Week');
  assert.equal(result.records[0].publicationDate, '2026-08-18');
  assert.equal(result.records[0].metadata.textQuality, 'not_checked');
});
test('Takshashila remains secondary research, never official policy', () => {
  assert.equal(sourcePolicyFor('research-takshashila').authorityClass, 'INSTITUTIONAL_SECONDARY');
});
test('CAG navigation PDFs are excluded and chapter files stay attached to one report', async () => {
  const connector = expansionConnectors.find((item) => item.name === 'cag-reports');
  const fetcher = { getText: async (url) => ({status:200,url,body:url.includes('/details/')
    ? '<a href="/uploads/download_audit_report/2026/full.pdf">Full Report</a><a href="/uploads/download_audit_report/2026/cover.pdf">Cover</a>'
    : '<a href="/uploads/media/nav.pdf">Navigation file</a><a href="/en/audit-report/details/42">State Finances Report</a>'}) };
  const result = await connector.collect({limit:3}, {fetcher});
  assert.equal(result.records.length, 1);
  assert.equal(result.records[0].resources.length, 2);
  assert.match(result.records[0].pdfUrl, /full.pdf$/);
});
