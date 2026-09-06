const test=require('node:test');const assert=require('node:assert/strict');
const {planComparisonThemes,verifyThemeFinding,generateThemeComparison}=require('../document/comparisonThemes');
const docs=[{id:'a',title:'Act'},{id:'b',title:'Amendment Bill'}];
const evidence=[{id:'D1-C1',documentId:'a',content:'The authority shall require quarterly reporting by regulated companies. Companies shall keep records and provide returns to the authority.'},{id:'D2-C1',documentId:'b',content:'The authority shall require monthly reporting by regulated companies. Companies shall keep records and provide returns to the authority.'}];
const finding={topic:'obligations',status:'substantive',documentA:'The authority requires quarterly reporting by regulated companies.',documentB:'The authority requires monthly reporting by regulated companies.',comparison:'The reporting frequency differs: A requires quarterly returns whereas B requires monthly returns from regulated companies.',whyItMatters:'This could increase reporting workload for regulated companies.',citationsA:['D1-C1'],citationsB:['D2-C1']};
test('theme evidence balances both documents even when one has many passages',()=>{
 const plan=planComparisonThemes(docs,[...evidence,...Array.from({length:20},(_,i)=>({...evidence[0],id:`D1-C${i+2}`}))]);
 assert.equal(plan.length,6);assert.ok(plan.some(t=>t.key==='whatChanged'));
 for(const t of plan){assert.equal(t.sources.length,2);assert.equal(t.sources[0].evidence.length,2);assert.equal(t.sources[1].evidence.length,1);}
});
test('theme verification accepts grounded comparison but rejects swapped citations, invented figures and current claims',()=>{
 const theme=planComparisonThemes(docs,evidence).find(t=>t.key==='obligations');
 assert.equal(verifyThemeFinding(finding,theme).valid,true);
 assert.equal(verifyThemeFinding({...finding,citationsA:['D2-C1']},theme).reason,'WRONG_SOURCE_CITATION');
 assert.equal(verifyThemeFinding({...finding,documentB:'Companies pay a penalty of 999 rupees.'},theme).reason,'UNSUPPORTED_NUMBER');
 assert.equal(verifyThemeFinding({...finding,comparison: finding.comparison+' B is currently in force.'},theme).reason,'UNVERIFIED_CURRENT_STATUS');
});
test('one bad theme does not erase good themes and executive digest contains only verified findings',async()=>{
 let calls=0;const result=await generateThemeComparison({documents:docs,evidence,language:'english',generateJson:async()=>{
  calls++;return {findings:[{...finding,topic:'purpose'},{...finding,topic:'scope'}, {...finding,documentB:'Companies pay 999 rupees.'}]};
 }});
 assert.equal(calls,2);assert.equal(result.themeVerification.verified,2);assert.equal(result.generationMode,'ai');
 assert.doesNotMatch(result.executiveSummary,/999/);assert.equal(result.sectionStatus.obligations,'insufficient_evidence');
 assert.ok(result.executiveSummary.includes('[D1-C1]'));assert.ok(result.executiveSummary.includes('[D2-C1]'));
});
