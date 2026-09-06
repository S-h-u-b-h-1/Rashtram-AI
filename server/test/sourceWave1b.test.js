const test=require('node:test'),assert=require('node:assert/strict');
const {hindiPublicationMonth}=require('../lib/ingestion/core/hindiPublicationMonth');
const {cagIdentity}=require('../lib/ingestion/connectors/cagReportsConnector');
const {rightsFor}=require('../document/sourceRights');
const {PDFProcessor}=require('../lib/pdfProcessor');
test('Hindi month abbreviations preserve MONTH and unknown tokens do not guess',()=>{
  ['जन','फ़र','मा','अप्र','मई','जून','जुल','अग','सित','अक्टू','नव','दिस'].forEach((token,i)=>assert.equal(hindiPublicationMonth(`${token}, 2026`),i+1));
  assert.equal(hindiPublicationMonth('अनिश्चित, 2026'),null);assert.equal(hindiPublicationMonth('2026'),null);
});
test('CAG identity separates same report number/year by jurisdiction and landing page',()=>{
  const base={sourceUrl:'https://cag.gov.in/en/audit-report/details/126325',jurisdiction:'Nagaland',metadata:{reportNumber:'2',reportYear:'2026'}};
  assert.equal(cagIdentity(base),cagIdentity({...base,pdfUrl:'https://cag.gov.in/chapter.pdf'}));
  assert.notEqual(cagIdentity(base),cagIdentity({...base,jurisdiction:'Himachal Pradesh'}));
  assert.notEqual(cagIdentity(base),cagIdentity({...base,sourceUrl:'https://cag.gov.in/en/audit-report/details/126303'}));
});
test('rights states are independent from authority and readiness',()=>{
  assert.ok(rightsFor('research-nipfp').states.includes('METADATA_ALLOWED'));
  assert.ok(rightsFor('research-nipfp').states.includes('MANUAL_REVIEW_REQUIRED'));
  assert.equal(rightsFor('research-nipfp').fullTextProcessingAllowed,false);
  assert.ok(rightsFor('research-takshashila').states.includes('AUTOMATION_BLOCKED'));
  assert.ok(rightsFor('cag-reports').states.includes('FULL_TEXT_PROCESSING_ALLOWED'));
  assert.equal(rightsFor('ministry-home-circulars').permissions.sourceLinks,'PERMISSION_REQUIRED');
});
test('bounded OCR never includes deferred pages as evidence',async()=>{
  let calls=0;const processor=new PDFProcessor({ocrExtractor:async()=>{calls++;throw new Error('Should not run');}});
  const good='The government must prepare annual accounts and submit the audit report to the legislature for public oversight. '.repeat(4);
  processor.downloadPDF=async()=>Buffer.from('%PDF-fixture');
  processor.parsePDFBuffer=async()=>({fullText:good+'\f',pages:[good,''],numPages:2,info:{},metadata:{}});
  const result=await processor.processPDFAndCreateChunks('https://example.org/report.pdf','1','Report',{maxOcrPages:0});
  assert.equal(calls,0);assert.ok(result.chunks.every(c=>c.pageStart===1));
  assert.equal(result.pdfQuality.pageExtraction[1].ocrFailureCode,'OCR_BUDGET_DEFERRED');
});
