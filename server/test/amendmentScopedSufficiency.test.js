const test=require('node:test'),assert=require('node:assert/strict');
const {assessAmendmentSufficiency,buildAmendmentComparison}=require('../document/amendmentLineage');
const {assessEvidenceSufficiency,verifyStructuredComparison}=require('../retrieval/evidenceSafetyService');
const fixtures=require('./fixtures/amendment-integration-public-sources.json');
const docs=[{id:'1',title:'Example Policy 2020'},{id:'2',title:'Addendum 2022'}];
const ev=(id,doc,content)=>({id,documentId:doc,content});
const before=value=>ev('B','1',`2.1 Filing obligation\nThe company shall submit the annual report within ${value}.\n2.2 Other section\nA different subject.`);
const after=value=>ev('A','2',`ADDENDUM to Example Policy 2020. Clause 2.1 shall be substituted: “The company shall submit the annual report within ${value}.”`);
for(const [a,b] of [['30 days','60 days'],['20%','30%'],['45 years','50 years']])test(`incompatible same-provision ${a} / ${b} remains conflicting`,()=>{
 const r=assessAmendmentSufficiency(docs,[before(a),{...before(b),id:'B2'},after('90 days')],assessEvidenceSufficiency);
 assert.equal(r.level,'CONFLICTING');assert.ok(r.components.every(c=>c.state==='CONFLICTING'));
});
test('two incompatible instructions are conflicting, not two findings',()=>{
 const r=assessAmendmentSufficiency(docs,[before('30 days'),after('60 days'),{...after('90 days'),id:'A2'}],assessEvidenceSufficiency);
 assert.equal(r.level,'CONFLICTING');
});
test('different section numbers and values do not conflict in scoped mode',()=>{
 const r=assessAmendmentSufficiency(docs,[before('30 days'),after('60 days'),ev('X','1','4.3 Eligibility\nThe minimum age limit is 45 years.\n4.4 Next clause')],assessEvidenceSufficiency);
 assert.equal(r.components[0].state,'SUPPORTED');
});
for(const fixture of fixtures)test(`scoped real pair ${fixture.ids} preserves supported components`,async()=>{
 const scoped=assessAmendmentSufficiency(fixture.documents,fixture.evidence,assessEvidenceSufficiency);
 const result=await buildAmendmentComparison({documents:fixture.documents,evidence:fixture.evidence,verify:verifyStructuredComparison,scopedSufficiency:scoped});
 assert.equal(result.whatChanged.length,fixture.expected);
 assert.equal(scoped.components.filter(c=>c.state==='SUPPORTED').length,fixture.expected);
 if(fixture.ids.includes(20592))assert.equal(scoped.status,'PARTIAL_EVIDENCE');
});
test('unverified title, historical or negated references do not enter scoped mode',()=>{
 for(const text of ['A similar title, Example Policy 2020.', 'A historical reference to Example Policy 2020.', 'This does not amend Example Policy 2020. Clause 2.1 shall be omitted.'])
 assert.equal(assessAmendmentSufficiency(docs,[before('30 days'),ev('A','2',text)],assessEvidenceSufficiency),null);
});
