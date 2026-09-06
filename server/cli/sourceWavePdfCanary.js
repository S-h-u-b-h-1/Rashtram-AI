#!/usr/bin/env node
require('dotenv').config({path:process.env.ENV_FILE,quiet:true});
const fs=require('node:fs'), path=require('node:path'), {execFileSync}=require('node:child_process');
const {PDFProcessor}=require('../lib/pdfProcessor');
const {PoliteFetcher}=require('../lib/ingestion/core/fetcher');
const {sha256}=require('../lib/ingestion/core/hashing');
async function main(){
  const input=JSON.parse(fs.readFileSync(process.argv.find(a=>a.startsWith('--records='))?.slice(10)||'/tmp/rashtram-wave1-cag-records.json'));
  const records=Array.isArray(input)?input:input.records;
  const directory=fs.mkdtempSync('/tmp/rashtram-wave1-pdf-');
  const results=[];
  const indices=(process.argv.find(a=>a.startsWith('--indices='))?.slice(10)||'0,2').split(',').map(Number);
  if(indices.length>3 || indices.some(i=>!Number.isInteger(i)||i<0||i>=records.length))throw new Error('Select at most three existing sample indices');
  for(const record of indices.map(i=>records[i])){
    const processor=new PDFProcessor();let requests=0;
    const recover=processor.recoverPageWithOcr.bind(processor);
    processor.recoverPageWithOcr=async(...args)=>{if(++requests>6)throw new Error('Bounded canary OCR page budget exhausted');return recover(...args);};
    const response=await new PoliteFetcher({timeoutMs:20000,retries:0,delayMs:750}).getBuffer(record.pdfUrl,{maxContentLength:20*1024*1024});
    if(response.body.subarray(0,5).toString()!=='%PDF-')throw new Error('Invalid PDF response');
    const file=path.join(directory,record.metadata.publisherId+'.pdf');fs.writeFileSync(file,response.body);
    processor.downloadPDF=async()=>response.body;
    try{const processed=await processor.processPDFByPages(record.pdfUrl);
      fs.writeFileSync(path.join(directory,record.metadata.publisherId+'-extraction.json'),JSON.stringify(processed));
      for(const page of [2,Math.min(37,processed.numPages)])execFileSync('/opt/homebrew/bin/pdftoppm',['-f',String(page),'-l',String(page),'-scale-to','1400','-png',file,path.join(directory,record.metadata.publisherId+'-page')],{timeout:30000});
      results.push({publisherId:record.metadata.publisherId,url:record.pdfUrl,sha256:sha256(response.body),pages:processed.numPages,
        extractionMode:processed.extractionMethod,quality:processed.pdfQuality.documentTextQuality,
        ocrPagesAttempted:Math.min(requests,6),ocrPagesDeferredByBudget:Math.max(0,requests-6),
        pageQuality:processed.pdfQuality.pageExtraction.map(p=>({page:p.page,quality:p.quality,usable:p.usable,method:p.method})),
        visualReview:'PENDING',structuredTablesVerified:false});
    }catch(error){results.push({publisherId:record.metadata.publisherId,status:'FAILED',error:error.message});}
    console.log(JSON.stringify({...results.at(-1),pageQuality:undefined}));
  }
  fs.writeFileSync('/tmp/rashtram-wave1-pdf-results.json',JSON.stringify({directory,results},null,2));console.log(directory);
}
if(require.main===module)main().catch(e=>{console.error(e.message);process.exitCode=1;});
