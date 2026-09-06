const assert = require('node:assert/strict');
const { normalizeRecord } = require('../lib/ingestion/core/normalizer');
const { persistRecord, findCandidates } = require('../lib/ingestion/core/catalogRepository');
const { query, getPool } = require('../db');

async function main() {
  const target = new URL(process.env.DATABASE_URL || 'https://invalid');
  if (!['localhost','127.0.0.1'].includes(target.hostname) || target.pathname !== '/rashtram_source_canary') throw new Error('Requires the disposable local source-canary database');
  const id = `canary-${Date.now()}`;
  const raw = {sourceName:'research-canary',sourceRecordId:id,title:'Disposable source identity canary',
    sourceUrl:`https://example.org/${id}`,pdfUrl:`https://example.org/${id}.pdf`,documentType:'report',
    publicationDateRaw:'September 2026',authority:'Disposable test publisher',
    resources:[{url:`https://example.org/${id}.pdf`,resourceType:'pdf',label:'Full report'}]};
  const record = normalizeRecord(raw);
  const insert = () => persistRecord(record, {action:'insert',reason:'fixture'});
  const results = await Promise.all(Array.from({length:8}, insert));
  assert.equal(new Set(results.map((item) => String(item.documentId))).size,1);
  const documentId = results[0].documentId;
  const documents = await query('SELECT * FROM legislative_documents WHERE id=$1',[documentId]);
  assert.equal(documents.rows[0].publication_date,null);
  assert.equal(documents.rows[0].metadata_json.publicationDate.precision,'MONTH');
  const sources = await query('SELECT * FROM document_sources WHERE source_name=$1 AND source_record_id=$2',[record.sourceName,id]);
  assert.equal(sources.rows.length,1);
  assert.equal(String(sources.rows[0].document_id),String(documentId));
  // Only this disposable fixture's source link is removed to simulate a legacy import.
  await query('DELETE FROM document_sources WHERE source_name=$1 AND source_record_id=$2',[record.sourceName,id]);
  assert.equal(String((await findCandidates(record))[0].id),String(documentId));
  const recovered = await insert();
  assert.equal(String(recovered.documentId),String(documentId));
  const resources = await query('SELECT * FROM document_resources WHERE document_id=$1',[documentId]);
  assert.equal(resources.rows.length,1);
  const retry = normalizeRecord({...raw,resources:[...raw.resources,{url:`https://example.org/${id}.csv`,resourceType:'file',label:'Explicit fixture companion'}]});
  await persistRecord(retry,{action:'insert',reason:'retry-with-companion'});
  await persistRecord(retry,{action:'insert',reason:'repeat-retry'});
  const afterRetry = await query('SELECT * FROM document_resources WHERE document_id=$1',[documentId]);
  assert.equal(afterRetry.rows.length,2);
  assert.ok(afterRetry.rows.every((row)=>String(row.document_id)===String(documentId)));
  const other = normalizeRecord({...raw,sourceRecordId:`${id}-edition`,year:2025,metadata:{edition:'2025'},sourceUrl:`https://example.org/${id}-2025`});
  const otherResult = await persistRecord(other,{action:'insert',reason:'different-edition-fixture'});
  assert.notEqual(String(otherResult.documentId),String(documentId));
  const prepared = await query('SELECT * FROM document_processing_state WHERE document_id=$1',[documentId]);
  assert.equal(prepared.rows[0].processing_status,'not_started');
  console.log(JSON.stringify({ok:true,concurrentCalls:8,canonicalDocuments:1,sourceRows:1,resourceRowsAfterRetry:2,retryIdempotency:true,resourceOwnership:true,separateEdition:true,legacyRecovery:true,datePrecision:'MONTH',researchReady:false,disposableDocumentId:documentId}));
}
main().catch((error)=>{console.error(error);process.exitCode=1}).finally(()=>getPool().end());
