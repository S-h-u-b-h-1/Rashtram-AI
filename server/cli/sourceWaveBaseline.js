#!/usr/bin/env node
// Uses a database-enforced read-only snapshot. Never calls connectDB/migrations.
require('dotenv').config({ path: process.env.ENV_FILE, quiet: true });
const { getPool } = require('../db');
const { verifyDatabase } = require('./dbVerify');
const { runReadinessAudit } = require('../document/readinessService');
const { pilots } = require('../config/source-acceptance.json');
const schedules = require('../lib/ingestion/schedules');
const fs = require('node:fs');
const sources = ['ministry-home-circulars', 'union-budget', 'cag-reports', 'research-nipfp', 'research-takshashila'];

async function main() {
  const verification = await verifyDatabase();
  const readiness = await runReadinessAudit();
  const client = await getPool().connect();
  try {
    await client.query('BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');
    const rows = (await client.query(`SELECT s.source_name, COUNT(DISTINCT d.id)::int AS documents,
      MAX(d.publication_date) AS newest_publication FROM document_sources s
      JOIN documents d ON d.id=s.document_id WHERE s.source_name=ANY($1)
      GROUP BY s.source_name`, [sources])).rows;
    const health = (await client.query('SELECT * FROM source_health WHERE source_name=ANY($1)', [sources])).rows;
    const runs = (await client.query(`SELECT DISTINCT ON (source_name) source_name,status,started_at,completed_at,
      records_discovered,records_stored,resources_stored,counters_json,errors_json
      FROM ingestion_runs WHERE source_name=ANY($1) ORDER BY source_name,started_at DESC`, [sources])).rows;
    const fingerprint = (await client.query(`SELECT
      (SELECT COUNT(*) FROM documents) AS documents,
      (SELECT COUNT(*) FROM document_sources) AS source_rows,
      (SELECT COUNT(*) FROM document_resources) AS resource_rows,
      (SELECT MD5(STRING_AGG(MD5(ROW_TO_JSON(s)::text),'' ORDER BY s.id)) FROM document_sources s) AS sources_hash,
      (SELECT MD5(STRING_AGG(MD5(ROW_TO_JSON(r)::text),'' ORDER BY r.id)) FROM document_resources r) AS resources_hash`)).rows[0];
    await client.query('COMMIT');
    const result = { checkedAt: new Date().toISOString(), readOnly: true, verification, readiness, fingerprint,
      sources: sources.map(source => ({ source, acceptance: pilots[source], scheduled:
        schedules.DAILY_SOURCES.includes(source)||schedules.WEEKLY_SOURCES.includes(source),
        catalogue: rows.find(r=>r.source_name===source)||{documents:0,newest_publication:null},
        health: health.find(r=>r.source_name===source)||null, latestRun:runs.find(r=>r.source_name===source)||null })) };
    const output = process.argv.find(a=>a.startsWith('--output='))?.slice(9);
    if (output) fs.writeFileSync(output,JSON.stringify(result,null,2));
    console.log(JSON.stringify(result,null,2));
  } catch(error) { await client.query('ROLLBACK').catch(()=>{}); throw error; }
  finally { client.release(); }
}
if(require.main===module) main().catch(e=>{console.error(e.message);process.exitCode=1;}).finally(()=>getPool().end());
module.exports={sources};
