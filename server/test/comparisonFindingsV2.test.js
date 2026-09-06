const test = require('node:test');
const assert = require('node:assert/strict');
const { buildFindingsV2, validateFinding, EMPTY } = require('../document/comparisonFindingsV2');
const { comparisonPdfPresentation } = require('../document/comparisonPdfPresentation');
const fixtures = require('./fixtures/amendment-integration-public-sources.json');
for (const fixture of fixtures) test(`V2 exact-source findings ${fixture.ids}`, async () => {
  const report = await buildFindingsV2(fixture);
  assert.equal(report.findings.length, fixture.expected);
  for (const f of report.findings) assert.ok(validateFinding(f, fixture.evidence, fixture.ids));
  const reopened = JSON.parse(JSON.stringify(report));
  const regenerated = await buildFindingsV2({ ...fixture, previous: reopened });
  assert.equal(regenerated.factualFingerprint, report.factualFingerprint);
  assert.deepEqual(regenerated.findings, report.findings);
  const pdf = comparisonPdfPresentation({ result: report }).reportText;
  for (const f of report.findings) assert.ok(pdf.includes(f.verifiedComparison));
  assert.doesNotMatch(pdf, /Missing Evidence|Detailed Comparison/);
  if (fixture.ids.includes(1361)) assert.ok(report.omittedFindingCount > 0);
});
test('V2 unrelated evidence does not create filler or call AI', async () => {
  const report = await buildFindingsV2({ documents: [{ id: '1', title: 'Water' }, { id: '2', title: 'Tax' }],
    evidence: [{ id: 'A', documentId: '1', content: 'Clean water supplies are necessary.' }, { id: 'B', documentId: '2', content: 'Tax returns shall be filed annually.' }],
    explain: () => { throw new Error('AI must not invent findings'); } });
  assert.deepEqual(report.findings, []); assert.equal(report.executiveSummary, EMPTY);
  assert.equal(report.explanationStatus.attempted, false);
});
test('V2 rejects tampered source text, wrong document citations and unavailable findings', async () => {
  const fixture = fixtures[0]; const report = await buildFindingsV2(fixture);
  const f = structuredClone(report.findings[0]);
  f.sourceA.excerpt = 'An invented statutory penalty applies to everyone.';
  assert.equal(validateFinding(f, fixture.evidence, fixture.ids), false);
  f.sourceA = report.findings[0].sourceA; f.confidenceState = 'CONFLICTING';
  assert.equal(validateFinding(f, fixture.evidence, fixture.ids), false);
});
test('related non-amendment values compare only an identical textual obligation', async () => {
  const documents = [{ id: '1', title: 'Policy A' }, { id: '2', title: 'Policy B' }];
  const content = days => `Registered suppliers shall submit the annual compliance return within ${days} days to the authority.`;
  const evidence = [{ id: 'A', documentId: '1', content: content(30) }, { id: 'B', documentId: '2', content: content(60) }];
  const report = await buildFindingsV2({ documents, evidence });
  assert.equal(report.findings.length, 1); assert.equal(report.findings[0].findingType, 'DIFFERENCE');
  assert.equal(report.relationship, 'NO_VERIFIED_RELATIONSHIP');
  const conflicting = await buildFindingsV2({ documents, evidence: [...evidence, { id: 'C', documentId: '1', content: content(90) }] });
  assert.equal(conflicting.findings.length, 0);
});
test('a proposed Act short title is not amendment lineage', async () => {
  const report = await buildFindingsV2({ documents: [{id:'1',title:'Example Act 2023',type:'act'}, {id:'2',title:'Example Bill 2023',type:'bill'}],
    evidence:[{id:'B',documentId:'2',content:'This Act may be called the Example Act, 2023. Power to amend Schedule. Section 2 shall be omitted.'}] });
  assert.equal(report.relationship,'NO_VERIFIED_RELATIONSHIP');
});
test('mention inside amendment of a different Act does not establish lineage', async () => {
  const report = await buildFindingsV2({ documents: [{id:'1',title:'Example Act 2023'}, {id:'2',title:'Example Bill 2023'}],
    evidence:[{id:'B',documentId:'2',content:'Amendments to other Acts. The Tribunal under the Example Act, 2023. The Other Act, 2000 shall be amended: section 43A shall be omitted.'}] });
  assert.equal(report.relationship,'NO_VERIFIED_RELATIONSHIP');
});
