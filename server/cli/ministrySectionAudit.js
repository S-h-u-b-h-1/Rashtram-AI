#!/usr/bin/env node
// Bounded read-only checks of links observed in IGOD-linked ministry homepages.
const fs = require('node:fs');
const path = require('node:path');
const cheerio = require('cheerio');
const {PoliteFetcher} = require('../lib/ingestion/core/fetcher');
const {parseListing} = require('../lib/ingestion/connectors/publicListingConnector');
const {classifyFailure} = require('../lib/ingestion/core/sourceHealthPolicy');
const matrixPath = path.resolve(__dirname,'../config/ministry-onboarding.json');
const priorities = /Civil Aviation|\bCoal\b|\bCulture\b|Environment|External Affairs|Food Processing|Heavy Industries|Information and Broadcasting|Minority Affairs|Petroleum|Shipping|Steel/i;
async function main(){
  const matrix = JSON.parse(fs.readFileSync(matrixPath,'utf8'));
  const fetcher = new PoliteFetcher({timeoutMs:8000,retries:0,delayMs:750});
  for(const entry of matrix.entries.filter((item)=>item.entityType === 'ministry' && priorities.test(item.ministry))){
    const sections = entry.sections.filter((item)=>!new URL(item.url).pathname.endsWith('.pdf')).slice(0,3);
    for(const section of sections){
      const checkedAt = new Date().toISOString();
      try {
        const page = await fetcher.getText(section.url);
        const $ = cheerio.load(page.body);
        const records = parseListing(page.body,page.url||section.url,{name:'ministry-section-audit',authority:entry.authority,allowedHosts:[new URL(section.url).hostname],linkPattern:/\.pdf(?:$|[?#])/i});
        section.audit = {checkedAt,fetchSuccess:true,downloadableCandidates:records.length,
          paginationObserved:$('a[rel="next"], .pager a, .pagination a').length>0,
          status:records.length?'ADAPTER_NEEDED':'LISTING_NOT_VERIFIED',
          sample:records.slice(0,3).map(({title,pdfUrl,publicationDateRaw})=>({title,pdfUrl,publicationDateRaw:publicationDateRaw||null})),
          note:'Link discovery only; publication validity, pagination traversal and PDF quality are not accepted.'};
      } catch(error){section.audit = {checkedAt,fetchSuccess:false,status:'BLOCKED_EXTERNAL',failureType:classifyFailure({message:error.message}),failureDetail:error.message};}
    }
    entry.sectionInvestigation = {checkedAt:new Date().toISOString(),checkedSections:sections.length,reason:sections.length?null:'No non-PDF section link observed in the bounded homepage audit'};
    console.log(JSON.stringify({ministry:entry.ministry,sections:sections.map((s)=>({url:s.url,...s.audit}))}));
  }
  matrix.sectionAuditAt = new Date().toISOString();
  fs.writeFileSync(matrixPath,JSON.stringify(matrix,null,2));
}
if(require.main === module)main().catch((e)=>{console.error(e.message);process.exitCode=1;});
