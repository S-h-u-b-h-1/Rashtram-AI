#!/usr/bin/env node
const cheerio = require('cheerio');
const fs = require('node:fs');
const path = require('node:path');
const { classifyFailure } = require('../lib/ingestion/core/sourceHealthPolicy');
const { ministryConnector } = require('../lib/ingestion/connectors/ministryConnector');
const { PoliteFetcher } = require('../lib/ingestion/core/fetcher');

const officialUrl = (value) => {
  try {
    const url = new URL(value);
    return ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password &&
      /\.(?:gov|nic)\.in$/i.test(url.hostname) ? url.toString() : null;
  } catch { return null; }
};
async function main() {
  const matrixPath = path.resolve(__dirname, '../config/ministry-onboarding.json');
  const previous = fs.existsSync(matrixPath) ? JSON.parse(fs.readFileSync(matrixPath,'utf8')).entries || [] : [];
  const fetcher = new PoliteFetcher({ timeoutMs: 8000, retries: 0, delayMs: 750 });
  const directory = await ministryConnector.collect({ maxPages: 30, limit: 250 }, { fetcher });
  console.log(JSON.stringify({ type: 'directory', entries: directory.directoryEntries.length, errors: directory.errors }));
  const seen = new Set();
  const matrix = [];
  const emit = (entry, result) => {
    const prior = previous.find((item)=>item.key === entry.entryKey && item.officialUrl === (result.url || null));
    const failureType = result.error ? classifyFailure({message:result.error}) : null;
    const state = result.status === 'listing_candidates_found' ? 'ADAPTER_NEEDED'
      : result.status === 'blocked_or_unreachable' ? 'BLOCKED_EXTERNAL'
      : result.status === 'needs_official_url_review' ? 'ADAPTER_NEEDED' : 'DISCOVERED';
    matrix.push({ key: entry.entryKey, ministry: entry.name, entityType: entry.entityType,
      officialDomain: result.url ? new URL(result.url).hostname : null, officialUrl: result.url || null,
      directoryUrl: entry.directoryUrl, sections: result.listings || [],
      collectorStatus: ['ACCEPTED','CANARY_READY','UNSUPPORTED','NO_PUBLIC_LISTING'].includes(prior?.collectorStatus) ? prior.collectorStatus : state,
      operationalStatus: state === 'BLOCKED_EXTERNAL' ? state : prior?.collectorStatus === 'ACCEPTED' ? 'ACCEPTED' : state,
      discoverySupport: Boolean(result.listings?.length),
      pdfSupport: 'NOT_TESTED', htmlSupport: 'NOT_TESTED', paginationSupport: 'NOT_TESTED', publicationDateSupport: 'NOT_TESTED',
      authority: entry.name, latestTestedPublication: null, lastAttempt: result.checkedAt || null,
      lastSuccess: prior?.lastSuccess || null, failureType, failureDetail: result.error || null, ...result });
    const row = matrix.at(-1);
    for (const field of ['pdfSupport','htmlSupport','paginationSupport','publicationDateSupport','latestTestedPublication','sectionInvestigation']) {
      if (prior?.[field] != null) row[field] = prior[field];
    }
    row.sections = (result.listings || prior?.sections || []).map((section)=>{
      const old = prior?.sections?.find((item)=>item.url === section.url);
      return old?.audit ? {...section,audit:old.audit} : section;
    });
    console.log(JSON.stringify(matrix.at(-1)));
  };
  for (const entry of directory.directoryEntries) {
    const url = officialUrl(entry.officialUrl);
    if (entry.entityType !== 'ministry') {
      emit(entry, {url, status: url ? 'needs_listing_review' : 'needs_official_url_review'});
      continue;
    }
    if (!url || seen.has(url)) {
      emit(entry, {url, status: url ? 'shared_portal' : 'needs_official_url_review'});
      continue;
    }
    seen.add(url);
    try {
      const page = await fetcher.getText(url);
      const $ = cheerio.load(page.body);
      const listings = [];
      $('a[href]').each((_, anchor) => {
        const title = $(anchor).text().replace(/\s+/g, ' ').trim();
        if (!/circular|notification|office memorandum|orders|publications|अधिसूचना|परिपत्र/i.test(title)) return;
        try {
          const target = officialUrl(new URL($(anchor).attr('href'), page.url || url).toString());
          if (target && !listings.some((item) => item.url === target)) listings.push({ title, url: target });
        } catch { /* malformed publisher link */ }
      });
      emit(entry, {url, checkedAt: new Date().toISOString(),
        status: listings.length ? 'listing_candidates_found' : 'needs_listing_review', listings: listings.slice(0, 12).map((item) => ({...item, sectionType: /circular|परिपत्र/i.test(item.title) ? 'circular' : /notification|अधिसूचना/i.test(item.title) ? 'notification' : /order/i.test(item.title) ? 'order' : 'publication'})) });
    } catch (error) {
      emit(entry, {url, checkedAt: new Date().toISOString(), status: 'blocked_or_unreachable', error: error.message});
    }
  }
  if (process.argv.includes('--persist')) fs.writeFileSync(matrixPath, JSON.stringify({ generatedAt:new Date().toISOString(), expectedEntries:directory.directoryEntries.length, entries:matrix }, null, 2));
}
if (require.main === module) main().catch((error) => { console.error(error.message); process.exitCode = 1; });
module.exports = { officialUrl };
