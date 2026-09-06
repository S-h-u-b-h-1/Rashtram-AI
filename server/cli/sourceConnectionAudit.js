#!/usr/bin/env node
// Read-only network pilot. Does not import ingestionRunner or connect to a database.
const { CONNECTORS } = require('../lib/ingestion/connectors');
const { PoliteFetcher } = require('../lib/ingestion/core/fetcher');
const fs = require('node:fs');
const path = require('node:path');
const { classifyFailure } = require('../lib/ingestion/core/sourceHealthPolicy');
const { publicationDateInfo } = require('../lib/ingestion/core/publicationDate');

async function auditConnector(connector) {
  const startedAt = new Date().toISOString();
  try {
    const result = await connector.collect({ maxPages: 1, limit: 3, catalogOnly: true }, {
      fetcher: new PoliteFetcher({ timeoutMs: 8000, retries: 0, delayMs: 750 }),
    });
    const records = result.records || [];
    const errors = result.errors || [];
    const diagnostics = result.diagnostics || [];
    const blocked = diagnostics.some((item) => ['error', 'blocked'].includes(item.type));
    return { source: connector.name, startedAt, checkedAt: new Date().toISOString(),
      status: errors.length || blocked ? 'needs_repair' : records.length ? 'discovery_only' : result.directoryEntries?.length ? 'directory_only' : 'no_records_found',
      discovered: records.length, directoryEntries: result.directoryEntries?.length || 0,
      datedRecords: records.filter((item) => item.publicationDate).length,
      pdfLinks: records.filter((item) => item.pdfUrl).length,
      newestPublication: records.map((item) => item.publicationDate).filter(Boolean).sort().at(-1) || null,
      pdfQuality: 'not_checked', errors, diagnostics,
      fetchSuccess: Boolean(result.snapshots?.length), listingSuccess: records.length > 0,
      extractionSuccess: null, lastSuccessfulIngestion: null,
      dateWindowCorrectness: 'NOT_VERIFIED', paginationCorrectness: 'NOT_VERIFIED',
      freshness: 'NOT_VERIFIED', blockReason: classifyFailure({message: [...errors,...diagnostics].map((item)=>item.message).filter(Boolean).join('; ')}),
      datePrecision: records.map((item)=>publicationDateInfo(item.publicationDateRaw || item.publicationDate)),
      sample: records.slice(0, 3).map(({ title, sourceUrl, pdfUrl, publicationDate }) => ({ title, sourceUrl, pdfUrl, publicationDate })),
    };
  } catch (error) {
    return { source: connector.name, startedAt, checkedAt: new Date().toISOString(), status: 'failed', fetchSuccess:false, listingSuccess:false, extractionSuccess:null, lastSuccessfulIngestion:null, dateWindowCorrectness:'NOT_VERIFIED', paginationCorrectness:'NOT_VERIFIED', freshness:'NOT_VERIFIED', blockReason:classifyFailure({message:error.message}), error: error.message };
  }
}
async function main() {
  const requested = process.argv.find((arg) => arg.startsWith('--sources='))?.slice(10).split(',');
  const connectors = requested ? CONNECTORS.filter((connector) => requested.includes(connector.name)) : CONNECTORS;
  if (requested?.some((name) => !connectors.some((connector) => connector.name === name))) throw new Error('Unknown source requested');
  // Sequential and rate-limited: no unbounded site crawl or document preparation.
  const results = [];
  for (const connector of connectors) {
    const result = await auditConnector(connector);
    results.push(result);
    console.log(JSON.stringify(result));
  }
  if (process.argv.includes('--persist')) {
    const destination=path.resolve(__dirname,'../config/source-connection-audit.json');
    const previous=requested && fs.existsSync(destination)?JSON.parse(fs.readFileSync(destination,'utf8')).sources:[];
    const sources=[...previous.filter((item)=>!requested.includes(item.source)),...results];
    fs.writeFileSync(destination, JSON.stringify({generatedAt:new Date().toISOString(),mode:'read-only-bounded-discovery',sources},null,2));
  }
}
if (require.main === module) main().catch((error) => { console.error(error.message); process.exitCode = 1; });
module.exports = { auditConnector };
