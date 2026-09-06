const test=require('node:test'),assert=require('node:assert/strict');
const m=require('../document/amendmentLineage');
const docs=[{id:'1',title:'Example Solar Policy 2020'},{id:'2',title:'Addendum 2022'}];
const e=(id,doc,text)=>({id,documentId:doc,content:text});
const before=e('B','1','2.1 Surplus power\nThe developer may sell surplus power subject to approval.\n\n2.2 Other provision\nA different provision follows.');
const after=e('A','2','ADDENDUM to Example Solar Policy 2020. The clause no. 2.1 is redefined as under: “Surplus electricity may be sold through open access subject to grid conditions.”');
test('explicit addendum and affected clause detected, not title similarity',()=>{
 assert.equal(m.detectLineage(docs,[before,after]).relationshipType,'ADDENDUM_TO');
 assert.deepEqual(m.detectLineage(docs,[before,after]).affectedSections,['2.1']);
 assert.equal(m.detectLineage(docs,[before,e('A','2','The policies have similar titles.')]),null);
});
test('Act amendment reference is explicit',()=>{
 assert.equal(m.detectLineage([{id:'1',title:'Example Act 2020'},{id:'2',title:'Amendment Act 2022'}],[e('A','2','An Act to amend the Example Act, 2020. In section 2, the words shall be substituted: “New statutory wording applies.”')]).relationshipType,'AMENDS');
});
test('substitution carries old and new fragment',()=>{
 const i=m.parseInstructions([e('A','2','In clause 2.1, for the words “surplus power”, substitute “surplus electricity”.')])[0];
 assert.equal(i.operation,'SUBSTITUTE');assert.equal(i.oldTextFragment,'surplus power');assert.equal(i.newTextFragment,'surplus electricity');
});
test('insertion does not mean replacement',()=>{
 const i=m.parseInstructions([e('A','2','After clause 1.7(b), insert: “A new specified provision shall apply.”')])[0];assert.equal(i.operation,'INSERT');assert.equal(i.affectedSection,'1.7(b)');
});
test('omission is parsed only when stated',()=>{
 assert.equal(m.parseInstructions([e('A','2','Clause 2.1 shall be omitted.')])[0].operation,'DELETE');
 assert.equal(m.parseInstructions([e('A','2','Clause 2.1 discusses renewable power.')]).length,0);
});
test('low lexical overlap is allowed by explicit lineage and exact clause',()=>{
 const r=m.constructChanges(docs,[before,after]);assert.equal(r.changes.length,1);assert.equal(r.changes[0].operation,'MODIFY');assert.match(r.changes[0].after,/open access/);
});
test('wrong clause and missing base fail closed',()=>{
 const r=m.constructChanges(docs,[before,{...after,content:after.content.replace('2.1','8.9')}]);assert.equal(r.changes.length,0);assert.equal(r.rejected[0].reason,'INSUFFICIENT_BASE_EVIDENCE');
});
test('unrelated modifying document cannot compare the same clause number',()=>assert.equal(m.constructChanges(docs,[before,{...after,content:after.content.replace('Example Solar Policy','Unrelated Banking Policy')}]).changes.length,0));
test('citation document identity cannot be swapped',()=>assert.equal(m.constructChanges(docs,[{...before,documentId:'3'},after]).changes.length,0));
test('truncated base clause is not silently complete',()=>assert.equal(m.extractBaseSection([{...before,content:before.content.split('2.2')[0]}],'1','2.1'),null));
test('numeric subsection retains nested alphabetic list',()=>{
 const b=e('B','1','104.\n(1) The Government may specify the provisions of—\n(a) First Act;\n(b) Second Act;\nshall stand repealed on notification.\n(2) Transitional measures shall apply.\n105. Next section');
 assert.match(m.extractBaseSection([b],'1','104(1)').text,/Second Act/);assert.match(m.extractBaseSection([b],'1','104(1)').text,/shall stand repealed/);
});
test('summary and AI receive only final verified changes',async()=>{
 let called=false;const r=await m.buildAmendmentComparison({documents:docs,evidence:[before,after],verify:g=>({generated:{...g,whatChanged:[]},report:{}}),explain:()=>{called=true;}});
 assert.equal(called,false);assert.equal(r.amendmentVerification.accepted,0);assert.ok(!r.executiveSummary.includes('open access'));
});
test('both evidence IDs retained; AI cannot add factual changes',async()=>{
 const r=await m.buildAmendmentComparison({documents:docs,evidence:[before,after],verify:g=>({generated:g,report:{}}),explain:async()=>[{id:'WRONG',text:'It may impose a new penalty.'}]});
 assert.deepEqual(r.whatChanged[0].citations,['B','A']);assert.equal(r.practicalImplications.length,0);assert.ok(!r.executiveSummary.includes('penalty'));
});
test('retrieval query uses exact source and sections, no vector calls or writes',async()=>{
 const calls=[];const rows=[{document_id:1,chunk_index:0,original_text:before.content},{document_id:2,chunk_index:0,original_text:after.content}];
 await m.loadAmendmentPassages(docs,async(sql,args)=>{calls.push({sql,args});return {rows:calls.length===1?rows:calls.length===2?[rows[1]]:[rows[0]]};});
 assert.equal(calls.length,3);assert.equal(calls[2].args[0],'1');assert.match(calls[2].args[1][0],/2\\\.1/);assert.ok(calls.every(c=>/^SELECT/.test(c.sql)));
});
test('canonical adapter passes narrow validation and rejects altered facts or summary',async()=>{
 const evidence=[before,after];
 const r=await m.buildAmendmentComparison({documents:docs,evidence,verify:g=>({generated:g,report:{}})});
 assert.equal(m.validateAmendment(r,evidence).valid,true);
 assert.equal(r.sectionStatus.timeline,'insufficient_evidence');
 assert.equal(m.validateAmendment({...r,executiveSummary:'An invented penalty applies.'},evidence).valid,false);
 const altered=structuredClone(r);altered.whatChanged[0].change.operation='DELETE';
 assert.equal(m.validateAmendment(altered,evidence).valid,false);
});
test('nested clause and proviso preserve complete target identity',()=>{
 const instructions=m.parseInstructions([e('A','2',`In section 3, in sub-section (1), for clause (ze), the following clause shall be substituted, namely: '(ze) "Member" includes a part-time Member;'. In section 7 of the principal Act, in sub-section (1), for the proviso, the following proviso shall be subs tituted, namely: "Provided that the Chairperson shall not hold office after sixty-five years.".`)]);
 assert.deepEqual(instructions.map(i=>i.affectedSection),['3(1)(ze)','7(1)']);
 assert.equal(instructions[1].proviso,true);
});
test('operative OCR correction is bounded to operative syntax',()=>{
 assert.equal(m.normalizeOperative('shall be substi-\ntuted, namely:'),'shall be substituted, namely:');
 assert.equal(m.normalizeOperative('shall be insert ed, namely:'),'shall be inserted, namely:');
 assert.equal(m.normalizeOperative('A discussion of substi tuted text'),'A discussion of substi tuted text');
});
test('nested base extraction retains numeric parent and alphabetic child',()=>{
 const b=e('B','1','10. Example\n(2) Rules:\n(a) A full first requirement applies to the specified body.\n(b) Another requirement applies to that body.\n(3) Next subsection.\n11. Next section');
 assert.match(m.extractBaseSection([b],'1','10(2)(a)').text,/full first requirement/);
});
test('assembly requires same source, contiguous order/pages and no new heading',()=>{
 const a={...before,chunkIndex:0,pdfUrl:'https://example.com/base.pdf',pageStart:1,pageEnd:1};
 const b={...before,id:'B2',content:'continued text ending the same clause.',chunkIndex:1,pdfUrl:a.pdfUrl,pageStart:2,pageEnd:2};
 assert.match(m.assembleContiguous([a,b])[0].content,/continued/);
 for(const replacement of [{documentId:'other'},{chunkIndex:3},{pageStart:4},{content:'3. A new heading'},{pdfUrl:'https://example.com/other.pdf'}])
 assert.equal(m.assembleContiguous([a,{...b,...replacement}])[0].content,a.content);
});
test('historical reference and negated amendment do not create lineage',()=>{
 for(const text of ['A historical reference to Example Solar Policy 2020. Amendment procedures vary.', 'This does not amend Example Solar Policy 2020. Clause 2.1 shall be omitted.'])
 assert.equal(m.detectLineage(docs,[before,e('A','2',text)]),null);
});
