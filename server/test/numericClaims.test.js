const test=require('node:test'),assert=require('node:assert/strict');
const {classifyNumericTokens,provisionIdentifiers,incompatibleNumericValues}=require('../retrieval/numericClaims');
const {detectEvidenceConflicts}=require('../retrieval/evidenceSafetyService');
const cases=[
 ['Clause 2.1 filing deadline is 30 days.','Clause 2.1 filing deadline is 60 days.',true],
 ['Clause 2.1 filing deadline is 30 days.','Clause 4.3 filing deadline is 60 days.',false],
 ['Section 7(1) age 50','Section 7(1) age 55',true],
 ['Section 7(1) age 50','Section 7(1) term 5 years',false],
 ['Clause 2.2 levy rate is 20%','Clause 2.2 levy rate is 30%',true],
 ['Clause 2.2 levy rate is 20%','Clause 2.2 levy amount is ₹20 lakh',false],
 ['Clause 2.1 filing deadline is 30 days.','Clause 2.1 filing deadline is 30 days.',false],
 ['Clause 2.1 filing deadline is 30 days.','Clause 4.3 filing deadline is 30 days.',false],
 ['Clause 2.1 filing deadline is 30 days.','Clause 2.1 application fee is ₹30,000.',false],
];
for(const [a,b,expected] of cases)test(`numeric conflict ${a} / ${b}`,()=>assert.equal(detectEvidenceConflicts([a,b].map((content,i)=>({id:'C'+i,documentId:'1',chunkIndex:i,content}))).length>0,expected));
test('all requested provision forms stay structural',()=>{
 for(const ref of ['Section 7','Section 7(1)','Section 7(1)(a)','Clause 2.1','Clause 2.1(a)','Rule 4','Regulation 12','Article 14','Schedule III','Para 3.2']){
  assert.equal(provisionIdentifiers(ref).length,1,ref);assert.equal(classifyNumericTokens(ref).length,1,ref);
 }
});
test('equivalent units do not conflict',()=>{
 for(const [a,b] of [['₹5 lakh','500000 rupees'],['1 MW','1000 kW'],['1 tonne','1000 kg'],['30 day','30 days']])assert.equal(incompatibleNumericValues(a,b),false);
 assert.equal(incompatibleNumericValues('20% and 30 days','20% and 60 days'),true);
});
test('dates, years, ordinals, unknowns are classified without structural contamination',()=>{
 assert.equal(classifyNumericTokens('2025-01-02')[0].type,'DATE');
 assert.equal(classifyNumericTokens('2026')[0].type,'YEAR');
 assert.equal(classifyNumericTokens('3rd')[0].type,'ORDINAL');
 assert.equal(classifyNumericTokens('42')[0].type,'UNKNOWN');
});
test('production safety probe retains conflicting evidence and uses no caller data',()=>{
 const {numericSafetyProbe}=require('../retrieval/numericSafetyProbe');
 assert.deepEqual(numericSafetyProbe(),{ok:true,fixture:'same-provision-deadline-v1',retainedPassages:2,decision:'CONFLICTING'});
});
