const test=require('node:test'),assert=require('node:assert/strict'),Module=require('node:module');
// Run the real service and safety pipeline; isolate external I/O and generation.
// No synthetic public documents or external model calls are needed for controls.
let current;
const client={query:async(sql,args)=>{
 if(sql.includes('INSERT INTO document_comparisons'))return {rows:[{id:'control',title:args[1],document_ids_json:JSON.parse(args[2]),mode:args[3],language:args[4],result_json:JSON.parse(args[6])}]};
 return {rows:[]};
},release(){}};
const mocks={
 '../db':{query:async()=>({rows:[]}),getPool:()=>({connect:async()=>client})},
 './DocumentRepository':{getById:async id=>current.docs.find(d=>d.id===id)},
 './readinessContract':{getDocumentReadiness:async()=>({comparisonReady:true})},
 './documentResearchService':{retrieveDocumentContext:async(type,id)=>({passages:current.evidence.filter(e=>e.documentId===id),retrievalMode:'lexical',diagnostics:{}})},
 './recommendationService':{getProblemRecommendations:async()=>({recommendations:[]})},
 '../graph/knowledgeGraphService':{getComparisonGraphOverlap:async()=>({relationships:[]})},
 '../lib/vectordb':{providerConfig:()=>({chatModel:'fixture',embeddingModel:'fixture'}),generateDocumentComparison:async()=>({generationMode:'ai',executiveSummary:'Insufficient comparative evidence.',whatChanged:[]})},
 '../retrieval/researchTelemetry':{recordResearchTelemetry:async()=>{}},
};
const original=Module._load;
Module._load=function(name,parent,...args){if(parent?.filename.endsWith('/documentComparisonService.js')&&mocks[name])return mocks[name];return original.call(this,name,parent,...args)};
const {createComparison}=require('../document/documentComparisonService');Module._load=original;
const passage=(documentId,chunkIndex,content)=>({documentId,chunkIndex,content,score:0.9,authorityClass:'OFFICIAL',pageStart:1});
const cases=[
 ['unrelated Regulation and Circular',['Water Regulation 2020','Banking Circular 2022'],['Water quality shall be monitored by the Board.','Banks shall publish annual accounts for inspection.'],false],
 ['similar titles without lineage',['Example Act 2020','Example Act 2022'],['Section 2 defines reporting requirements for companies.','Section 2 defines reporting requirements for institutions.'],false],
 ['historical reference',['Example Act 2020','Review 2022'],['Section 2 establishes reporting duties.','This review discusses the historical background of Example Act 2020.'],false],
 ['negated amendment',['Example Act 2020','Review 2022'],['Section 2 establishes reporting duties.','This does not amend Example Act 2020. Clause 2 shall be omitted.'],false],
 ['different sections in same base',['Example Policy 2020','Independent Circular 2022'],['2.1 Filing obligation\nThe company shall file its report within 30 days.','The Board shall publish an annual report.'],false],
 ['true same-provision conflict',['Example Policy 2020','Independent Circular 2022'],['Clause 2.1 Filing deadline\nThe company shall file its report within 30 days.','The Board shall publish an annual report.'],true],
];
for(const [name,titles,texts,conflicting] of cases)test(`full comparison service control: ${name}`,async()=>{
 current={docs:titles.map((title,i)=>({id:String(i+1),title,type:i?'circular':'regulation'})),evidence:texts.map((text,i)=>passage(String(i+1),0,text))};
 if(name.startsWith('different sections'))current.evidence.push(passage('1',1,'4.3 Appointment\nThe minimum eligibility age is 45 years.'));
 if(conflicting)current.evidence.push(passage('1',1,'Clause 2.1 Filing deadline\nThe company shall file its report within 60 days.'));
 const saved=await createComparison('certification-'+name,{documentIds:['1','2'],mode:'full',userQuestion:'Compare the reporting provisions.'},{forceGeneration:true});
 assert.ok(!saved.result.lineage);assert.ok(!saved.result.evidenceSufficiency.mode);
 assert.equal(saved.result.evidenceSufficiency.level==='CONFLICTING',conflicting);
 assert.equal((saved.result.whatChanged||[]).length,0);
});
