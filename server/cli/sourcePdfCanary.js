#!/usr/bin/env node
// Downloads one observed PDF per pilot, never ingests or prepares evidence.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {execFileSync} = require('node:child_process');
const pdf = require('pdf-parse');
const {PoliteFetcher} = require('../lib/ingestion/core/fetcher');
const {sha256} = require('../lib/ingestion/core/hashing');
const {classifyFailure} = require('../lib/ingestion/core/sourceHealthPolicy');
const {pilots} = require('../config/source-acceptance.json');
async function main(){
  const out = fs.mkdtempSync(path.join(os.tmpdir(),'rashtram-source-pdf-canary-'));
  const audit = require('../config/source-connection-audit.json');
  const fetcher = new PoliteFetcher({timeoutMs:15000,retries:0,delayMs:750});
  const results = [];
  for(const source of audit.sources.filter((s)=>pilots[s.source])){
    const sample = source.sample?.find((item)=>item.pdfUrl);
    if(!sample){results.push({source:source.source,status:'NO_OBSERVED_PDF'});continue;}
    try {
      const response = await fetcher.getBuffer(sample.pdfUrl,{maxContentLength:20*1024*1024});
      if(!response.body.subarray(0,5).equals(Buffer.from('%PDF-')))throw new Error('Downloaded response is HTML or not a PDF');
      const file = path.join(out,`${source.source}.pdf`);
      fs.writeFileSync(file,response.body);
      const pages=[];
      const parsed=await pdf(response.body,{pagerender:async(page)=>{
        const content=await page.getTextContent({normalizeWhitespace:false,disableCombineTextItems:false});
        const text=content.items.map((item)=>item.str).join(' ');
        pages.push({page:page.pageNumber,characters:text.length,textSha256:sha256(text),sample:text.slice(0,700)});
        return text;
      }});
      const prefix=path.join(out,source.source);
      execFileSync('/opt/homebrew/bin/pdftoppm',['-f','1','-l',String(Math.min(2,parsed.numpages)),'-scale-to','1400','-png',file,prefix],{timeout:30000});
      results.push({source:source.source,url:sample.pdfUrl,title:sample.title,file,sha256:sha256(response.body),pageCount:parsed.numpages,pages,
        lowTextPages:pages.filter((p)=>p.characters<100).map((p)=>p.page),status:'TEXT_AND_RENDER_INSPECTION_REQUIRED',
        structuredTablesVerified:false,citationReady:false});
    } catch(error){results.push({source:source.source,url:sample.pdfUrl,status:'FAILED',failureType:classifyFailure({message:error.message}),error:error.message});}
    console.log(JSON.stringify({...results.at(-1),pages:results.at(-1).pages?.slice(0,2)}));
  }
  // Retain verification hashes/metrics in the repository, not publisher text.
  const evidence = results.map(({file,...result})=>({...result,pages:result.pages?.map(({sample,...page})=>page)}));
  fs.writeFileSync(path.resolve(__dirname,'../config/source-pdf-canary.json'),JSON.stringify({checkedAt:new Date().toISOString(),results:evidence},null,2));
  console.log(JSON.stringify({output:out,samples:results.length}));
}
if(require.main === module)main().catch((e)=>{console.error(e);process.exitCode=1;});
