#!/usr/bin/env node
// Explicitly scoped operational canary. Never schedules a source or backfills vectors.
require('dotenv').config({path:process.env.ENV_FILE,quiet:true});
const fs=require('node:fs'),assert=require('node:assert/strict');
const {getPool}=require('../db');
const {cagReportsConnector}=require('../lib/ingestion/connectors/cagReportsConnector');
const {runIngestion}=require('../lib/ingestion/core/ingestionRunner');
const allowedIds=['126325','126303','126301'];
const phase=process.argv.find(a=>a.startsWith('--phase='))?.slice(8);
async function sourceRows(){
  const c=await getPool().connect();try{return (await c.query(`SELECT s.document_id,s.source_record_id,d.metadata_json,
    (SELECT COUNT(*)::int FROM document_resources r WHERE r.document_id=s.document_id) resources
    FROM document_sources s JOIN documents d ON d.id=s.document_id WHERE s.source_name='cag-reports'`)).rows;}finally{c.release();}
}
async function ingest(ids){
  return runIngestion({...cagReportsConnector,collect:async(options,context)=>{
    const result=await cagReportsConnector.collect({...options,maxPages:3,limit:5},context);
    assert.equal(result.errors.length,0,'Live collection failed');assert.equal(result.window.pages.length,3);
    result.records=result.records.filter(r=>ids.includes(r.metadata.publisherId));
    assert.equal(result.records.length,ids.length,'Expected canary publications missing');
    return result;
  }},{limit:ids.length,maxPages:3,downloadPdfs:false,reason:'source_acceptance_wave1b',timeoutMs:20000,retries:0,delayMs:750});
}
async function main(){
  assert.ok(process.argv.includes('--apply'),'Requires explicit --apply');
  assert.ok(['duplicate','catchup','prepare'].includes(phase),'Unknown canary phase');
  assert.equal(new URL(process.env.DATABASE_URL).hostname,'ep-holy-dew-ahu5clty-pooler.c-3.us-east-1.aws.neon.tech','Wrong database target');
  const before=await sourceRows();assert.ok(before.length<=3,'Unexpected CAG population; re-audit before running');
  for(const row of before)assert.ok(allowedIds.includes(row.metadata_json.publisherId),'Unexpected CAG identity');
  const output={phase,startedAt:new Date().toISOString(),before,runs:[]};
  if(phase==='duplicate'){
    assert.equal(before.length,0,'Duplicate phase requires the verified empty starting source');
    for(let i=0;i<2;i++){const run=await ingest([allowedIds[0]]);output.runs.push(run);assert.equal(run.status,'completed');}
    const after=await sourceRows();assert.equal(after.length,1);assert.equal(after[0].resources,4);
    assert.equal(output.runs[0].counters.inserted,1);assert.equal(output.runs[1].counters.inserted,0);
  }else if(phase==='catchup'){
    const proof=JSON.parse(fs.readFileSync('/tmp/rashtram-wave1b-duplicate.json'));
    assert.equal(proof.passed,true);assert.equal(before.length,1);
    output.runs.push(await ingest(allowedIds));assert.equal(output.runs[0].status,'completed');
    assert.equal((await sourceRows()).length,3);
  }else{
    assert.equal(before.length,3);
    const {prepareDocument}=require('../document/readinessService');
    const {getDocumentReadiness}=require('../document/readinessContract');
    output.prepared=[];
    for(const row of before){
      const result=await prepareDocument(row.document_id,{userId:80,reason:'source_acceptance_wave1b',skipSemantic:true,skipSummary:true,discoverGraph:false,maxOcrPages:6});
      const readiness=await getDocumentReadiness(row.document_id);
      const entry={documentId:row.document_id,publisherId:row.metadata_json.publisherId,result,readiness};
      output.prepared.push(entry);
      fs.writeFileSync('/tmp/rashtram-wave1b-prepare-progress.json',JSON.stringify(output,null,2));
      console.log(JSON.stringify({documentId:row.document_id,publisherId:row.metadata_json.publisherId,status:readiness.status,capabilities:readiness.capabilities,counts:readiness.counts}));
    }
  }
  output.after=await sourceRows();output.passed=true;output.completedAt=new Date().toISOString();
  fs.writeFileSync(`/tmp/rashtram-wave1b-${phase}.json`,JSON.stringify(output,null,2));
  console.log(JSON.stringify({phase,passed:true,documents:output.after.map(r=>r.document_id),runs:output.runs.map(r=>r.counters)}));
}
if(require.main===module)main().catch(e=>{console.error(e.message);process.exitCode=1;}).finally(()=>getPool().end());
