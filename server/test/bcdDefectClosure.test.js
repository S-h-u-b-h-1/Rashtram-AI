const test=require('node:test');
const assert=require('node:assert/strict');
const {explicitTemporalClaims,temporalState,STATES}=require('../retrieval/temporalClaimGuard');
const {enforceFreshnessGuard,qualifyUnverifiedCurrentClaims}=require('../retrieval/adaptiveIntelligenceService');
const {evaluateScope,searchHints}=require('../document/businessRelevanceGate');
const {inferBusinessSignals,evaluateBusinessCandidate,buildProblemSearchPlan,enrichProblemRecommendation}=require('../document/recommendationService');
const now=new Date('2026-09-08T12:00:00Z');
const evidence=(content,options={})=>explicitTemporalClaims({document:{id:83},passages:[{id:'S1',documentId:83,authorityClass:'PRIMARY_OFFICIAL',content,...options}],freshness:{status:'fresh'},now});

test('UNKNOWN cannot become non-notification or non-force even with an opening disclaimer',()=>{
 const bad='Current status could not be verified. Its effective date has not been officially notified, and therefore, it is not currently in force.';
 const verification={required:true,status:'PARTIALLY_VERIFIED',connectorStatus:'degraded',temporalClaims:[]};
 const answer=qualifyUnverifiedCurrentClaims(enforceFreshnessGuard(bad,verification),verification).answer;
 assert.doesNotMatch(answer,/has not been.*notified|not currently in force/);
 assert.match(answer,/could not verify/);
 assert.equal(temporalState(verification,'commencement'),STATES.UNKNOWN);
 for(const conclusion of ['It has not commenced.','This rule does not apply.','The Act is inactive.','This order is unenforceable.','The Act has been repealed.','This order has been superseded.']){
  assert.notEqual(enforceFreshnessGuard(conclusion,verification),conclusion);
 }
});
test('verified dated commencement permits a positive without granting unrelated negative claims',()=>{
 const temporalClaims=evidence('This Act came into force on 2026-09-01.');
 const v={required:true,status:'VERIFIED_CURRENT',temporalClaims};
 assert.equal(temporalState(v,'commencement'),STATES.POSITIVE);
 assert.equal(enforceFreshnessGuard('This Act commenced on 2026-09-01.',v),'This Act commenced on 2026-09-01.');
 assert.doesNotMatch(enforceFreshnessGuard('Its effective date has not been notified.',v),/has not been notified/);
});
test('explicit official future commencement allows only a dated, narrowly supported negative',()=>{
 const temporalClaims=evidence('This Act shall come into force on 2026-10-01.');
 const v={status:'VERIFIED_CURRENT',temporalClaims};
 assert.equal(temporalState(v,'force'),STATES.NEGATIVE);
 assert.match(enforceFreshnessGuard('It is not currently in force.',v),/As of 2026-09-08/);
 assert.doesNotMatch(enforceFreshnessGuard('It has not been notified.',v),/has not been notified/);
 assert.equal(evidence('Section 7 shall come into force on 2026-10-01.').length,0);
});
test('degraded connectors, unknown dates, other documents and mixed premises remain UNKNOWN',()=>{
 assert.equal(evidence('This Act shall come into force on a date appointed by notification.').length,0);
 assert.equal(evidence('This Act shall come into force on 2026-10-01.',{documentId:99}).length,0);
 const result=explicitTemporalClaims({document:{id:83},passages:[{id:'S1',documentId:83,authorityClass:'PRIMARY_OFFICIAL',content:'This Act shall come into force on 2026-10-01.'}],freshness:{status:'degraded'},now});
 assert.equal(result.length,0);
 const mixed={temporalClaims:[...evidence('This Act came into force on 2026-09-01.'),...evidence('This Act shall come into force on 2026-10-01.')]};
 assert.equal(temporalState(mixed,'commencement'),STATES.UNKNOWN);
 assert.equal(temporalState(mixed,'force'),STATES.UNKNOWN);
 assert.equal(evidence('As of 2026-09-08, we could not verify whether this Act has not commenced.').length,0);
 assert.doesNotMatch(enforceFreshnessGuard('It has not commenced.',mixed),/has not commenced/);
});
test('explicit dated official non-commencement is not confused with absent dates',()=>{
 const temporalClaims=evidence('As of 2026-09-08, this Act has not commenced.');
 assert.equal(temporalState({temporalClaims},'commencement'),STATES.NEGATIVE);
 assert.match(enforceFreshnessGuard('It has not commenced.',{status:'VERIFIED_CURRENT',temporalClaims}),/As of 2026-09-08/);
});

const cases=[
 ['A digital lending app needs RBI borrower consent, disclosure and grievance redress requirements.','The Karnataka Micro Loan and Small Loan Ordinance, 2025','RBI Digital Lending Directions, 2025'],
 ['A small trader needs GST registration and composition scheme eligibility.','Appointment of members to the J&K GST Tribunal','The Central Goods and Services Tax Act, 2017'],
 ['A CA needs income tax business deductions and tax audit.','The Tamil Nadu Agricultural Income Tax Act, 1955','The Income-tax Bill, 2025'],
 ['An employer needs minimum wage and provident fund obligations for factory workers.','West Bengal Educational Institutions Provident Fund Act','The Employees Provident Funds Act'],
 ['An exporter needs Importer Exporter Code and foreign trade permissions.','Foreign Trade Watch quarterly statistics','Foreign Trade Development and Regulation Amendment Act'],
 ['A cloud provider needs CERT-In cybersecurity incident reporting and log retention.','Indian Institutes of Information Technology Act','CERT-In Directions on incident reporting and log retention'],
];
for(const [problem,bad,good] of cases)test(`bounded topic/instrument gate: ${good}`,()=>{
 const input={problem,states:[]},inferred=inferBusinessSignals(input);
 assert.equal(evaluateScope({title:bad,jurisdiction:'India',document_type:'act'},input,inferred).eligible,false);
 assert.equal(evaluateScope({title:good,jurisdiction:'India',document_type:'act'},input,inferred).eligible,true);
 assert.ok(buildProblemSearchPlan(input,inferred).subqueries.length<=5);
 assert.ok(searchHints(input).patterns.length>0);
});
test('arbitrary topic metadata cannot rescue a wrong CERT-In instrument',()=>{
 const input={problem:cases[5][0],states:[]};
 const row={title:cases[5][1],document_type:'act',jurisdiction:'India',ministry:'MeitY',candidate_summary:'RBI cyber security incident reporting log retention',problem_rank:1,source_authority_tier:'PRIMARY_OFFICIAL'};
 assert.equal(evaluateBusinessCandidate(row,input).tier,'REJECTED');
});
test('generic direct-tax notifications need query-relevant purpose, not just tax metadata',()=>{
 const input={problem:cases[2][0],states:[]};
 assert.equal(evaluateScope({title:'Income Tax Notification under section 258',jurisdiction:'India'},input).eligible,false);
});
test('promoted readings and explanations require independent document support',()=>{
 const {recommendationPriority}=require('../document/recommendationService');
 const item={title:'The Food Safety Amendment Bill',authorityClass:'PRIMARY_LEGAL_TEXT',relevanceTier:'HIGH_RELEVANCE'};
 assert.equal(recommendationPriority(item),'background');
 assert.equal(recommendationPriority({...item,title:'Food Safety Act'}),'essential');
 const enriched=enrichProblemRecommendation({title:'Unrelated document'}, {problem:'tax audit'}, {}, [{area:'Tax audit'}]);
 assert.equal(enriched.whyThisMatters,null);
 assert.deepEqual(enriched.focusAreas,[]);
});
