const test=require('node:test'),assert=require('node:assert/strict');
const fixtures=require('./fixtures/amendment-integration-public-sources.json');
const {buildAmendmentComparison}=require('../document/amendmentLineage');
const {verifyStructuredComparison}=require('../retrieval/evidenceSafetyService');
const {validateComparisonOutput}=require('../document/documentComparisonService');
const {comparisonPdfPresentation}=require('../document/comparisonPdfPresentation');
for(const fixture of fixtures)test(`real source regression ${fixture.ids.join(' → ')}`,async()=>{
 const generated=await buildAmendmentComparison({documents:fixture.documents,evidence:fixture.evidence,verify:verifyStructuredComparison});
 assert.equal(generated.amendmentVerification.accepted,fixture.expected);
 const validation=validateComparisonOutput(generated,fixture.evidence,{requireCompleteSections:true});
 assert.equal(validation.valid,true);
 if(fixture.ids.includes(1361)){
  assert.equal(validation.status,'PARTIAL_EVIDENCE');
  assert.equal(generated.whatChanged[0].change.section,'7(1)');
  assert.equal(generated.whatChanged[0].change.proviso,true);
 }
 const report=comparisonPdfPresentation({result:{...generated,documents:fixture.documents,citations:fixture.evidence,quality:{outputValidation:validation},comparisonSchemaVersion:'comparison-quality-v3'}}).reportText;
 assert.match(report,/Amendment relationship/);assert.match(report,/Before:/);assert.match(report,/After/);assert.match(report,/Limitations/);
 const altered=structuredClone(generated);altered.whatChanged[0].change.after='Invented statutory requirement.';
 assert.equal(validateComparisonOutput(altered,fixture.evidence).valid,false);
});
