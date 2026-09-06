const cheerio = require('cheerio');
const { publicationIdentity, canonicalPublicationUrl } = require('../core/publicationIdentity');
const { dateFromText } = require('./publicListingConnector');
const { createSnapshot } = require('../core/sourceSnapshots');
const clean = value => String(value || '').replace(/\s+/g, ' ').trim();
const cagIdentity = ({sourceUrl, jurisdiction, metadata}) => publicationIdentity({publisher:'cag-reports',
  publisherId:JSON.stringify([metadata.reportNumber,metadata.reportYear,clean(jurisdiction).toLowerCase(),canonicalPublicationUrl(sourceUrl)])});
const allowedUrl = (value, base) => {
  try { const url = canonicalPublicationUrl(new URL(value, base).href); return url && new URL(url).hostname === 'cag.gov.in' ? url : null; }
  catch { return null; }
};
function parseCagListing(html, pageUrl) {
  const $ = cheerio.load(html);
  const records = [];
  $('.AuditReportlisting').each((_, el) => {
    const row = $(el), link = row.find('.reportDetail > a[href*="/audit-report/details/"]').first();
    const sourceUrl = allowedUrl(link.attr('href'), pageUrl);
    const title = clean(link.text());
    if (!sourceUrl || !title) return;
    const report = title.match(/Report\s+No\.?\s*(\d+)\s+of\s+(\d{4})/i);
    const jurisdiction = clean(row.find('.reportIcon h5').text()) || 'India';
    const dateRaw = clean(row.find('.dateFirst .dtn').text());
    const record = { sourceName:'cag-reports',
      sourceUrl, detailUrl:sourceUrl, title, documentType:'report', authority:'Comptroller and Auditor General of India',
      jurisdiction, jurisdictionLevel:jurisdiction==='India'?'union':'state',
      publicationDate:dateFromText(dateRaw), publicationDateRaw:dateRaw,
      metadata:{publisherId:sourceUrl.split('/').at(-1), reportNumber:report?.[1]||null, reportYear:report?.[2]||null,
        publicationType:clean(row.find('.reportType').text()), sectors:row.find('.sectorDetail > div').slice(1).map((i,n)=>clean($(n).text()).replace(/\s*\|\s*$/,'')).get(),
        department:null, departmentStatus:'not_published_in_listing', dateSemantics:'report_tabled', publisherPage:sourceUrl,
        publisherGroup:'government', onboardingStatus:'pilot', tableExtraction:'page_evidence_only', structuredTablesVerified:false},
      listedFullReport:allowedUrl(row.find('.pdfBottomReport a').filter((i,a)=>/Download Full Report/i.test($(a).text())).first().attr('href'),pageUrl) };
    record.sourceRecordId=cagIdentity(record);
    record.metadata.identityVersion='cag-report-v2';
    records.push(record);
  });
  const next = $('a[href]').filter((i,a)=>clean($(a).text())==='>>').first().attr('href');
  const nextUrl = next ? allowedUrl(next,pageUrl) : null;
  return {records,nextUrl:nextUrl && new URL(nextUrl).pathname==='/en/audit-report'?nextUrl:null};
}
function parseCagDetail(html, parent) {
  const $ = cheerio.load(html), section = $('.auditDetailColl');
  const title = clean(section.find('h3.singTitle').text());
  if (title !== parent.title) throw new Error('CAG detail title does not match listing identity');
  const resources = [], seen = new Set();
  // The publisher explicitly groups these in Download Audit Report; ignore
  // unrelated page links, icons and duplicate download controls.
  section.find('ul.guidelinesList > li').each((_,li)=>{
    const link=$(li).children('a[href]').first(), label=clean(link.text());
    const url=allowedUrl(link.attr('href'),parent.sourceUrl);
    if(!url || !/\/uploads\/download_audit_report\/.*\.pdf$/i.test(new URL(url).pathname) || seen.has(url)) return;
    const main=label===title, chapter=/^Chapter\b/i.test(label);
    if(!main && !chapter) return;
    seen.add(url); resources.push({label,resourceType:'pdf',url,metadata:{mimeType:'application/pdf',relationship:main?'full_report':'chapter',publisherPage:parent.sourceUrl}});
  });
  const full=resources.filter(r=>r.metadata.relationship==='full_report');
  if(full.length!==1) throw new Error('CAG canonical full report is missing or ambiguous');
  const labels={}; section.find('.auditRightLable').each((_,el)=>{labels[clean($(el).find('.labelTitleBold').text())]=clean($(el).find('.labelItemBold').text());});
  const tabled=Object.entries(labels).find(([key])=>/Report Tabled/i.test(key))?.[1];
  const observedDate=tabled?dateFromText(tabled.replace(/,/g,'')):null;
  if(observedDate && parent.publicationDate && observedDate!==parent.publicationDate) throw new Error('CAG tabling date conflicts with listing date');
  const governmentType=Object.entries(labels).find(([key])=>/Government Type/i.test(key))?.[1];
  const department=Object.entries(labels).find(([key])=>/Department/i.test(key))?.[1] || null;
  return {...parent,pdfUrl:full[0].url,mimeType:'application/pdf',resources,
    ...(governmentType && /^union$/i.test(governmentType) ? {jurisdictionLevel:'union',jurisdiction:'India'} : {}),
    metadata:{...parent.metadata,department,departmentStatus:department?'publisher_detail':'not_published_in_detail',
      detailLabels:labels,fullReportAssociation:'publisher_label_matches_report_title',chapterAssociation:'publisher_download_report_section'}};
}
const cagReportsConnector={name:'cag-reports',defaultCollection:'audit-reports',
  async collect(options={}, {fetcher}) {
    const result={records:[],snapshots:[],errors:[],diagnostics:[],window:{pages:[],orderChecked:false}};
    const limit=Math.min(5,Math.max(1,Number(options.limit)||5)), maxPages=Math.min(3,Math.max(1,Number(options.maxPages)||3));
    let url='https://cag.gov.in/en/audit-report'; const seen=new Set(), candidates=[];
    for(let page=0;url && page<maxPages;page++) {
      if(seen.has(url)) break; seen.add(url);
      try { const response=await fetcher.getText(url), parsed=parseCagListing(response.body,url);
        candidates.push(...parsed.records); result.window.pages.push({url,records:parsed.records.length,dates:parsed.records.map(r=>r.publicationDate)});
        result.snapshots.push(createSnapshot({sourceName:'cag-reports',sourceUrl:url,body:response.body,responseStatus:response.status,recordCount:parsed.records.length}));
        url=parsed.nextUrl;
      } catch(e){result.errors.push({stage:'listing',url,message:e.message});break;}
    }
    const dates=candidates.map(r=>r.publicationDate);
    result.window.orderChecked=dates.length>0 && dates.every((date,i)=>date && (!i || date<=dates[i-1]));
    const known=candidates.filter(r=>r.publicationDate);
    result.window.unknownDateReports=candidates.filter(r=>!r.publicationDate).map(r=>r.sourceUrl);
    result.window.orderAnomalies=known.flatMap((r,i)=>i && r.publicationDate>known[i-1].publicationDate
      ? [{previous:known[i-1].sourceUrl,current:r.sourceUrl,previousDate:known[i-1].publicationDate,currentDate:r.publicationDate}] : []);
    result.window.ordering='known_dates_sorted_locally_unknown_retained';
    result.window.candidates=candidates.map(r=>({sourceRecordId:r.sourceRecordId,sourceUrl:r.sourceUrl,
      reportNumber:r.metadata.reportNumber,reportYear:r.metadata.reportYear,jurisdiction:r.jurisdiction,publicationDate:r.publicationDate}));
    const unique=[...new Map(candidates.map(r=>[r.sourceRecordId,r])).values()].sort((a,b)=>(b.publicationDate||'').localeCompare(a.publicationDate||'')).slice(0,limit);
    for(const parent of unique) { try { const response=await fetcher.getText(parent.sourceUrl);
      result.records.push(parseCagDetail(response.body,parent));
      result.snapshots.push(createSnapshot({sourceName:'cag-reports',sourceUrl:parent.sourceUrl,body:response.body,responseStatus:response.status,recordCount:1}));
    } catch(e){result.errors.push({stage:'detail',url:parent.sourceUrl,message:e.message});} }
    if(!result.records.length)result.diagnostics.push({type:'empty-source',message:'No verified full-report association found.'});
    result.window.checkedWindow=result.window.pages.length===3 && result.errors.length===0;
    result.window.listingQualityAccepted=result.window.checkedWindow && result.records.length>0;
    return result;
  }};
require('./connectorLifecycle').attachConnectorLifecycle(cagReportsConnector,['audit-reports']);
module.exports={cagReportsConnector,parseCagListing,parseCagDetail,cagIdentity};
