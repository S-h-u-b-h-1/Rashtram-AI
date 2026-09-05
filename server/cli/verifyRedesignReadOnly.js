#!/usr/bin/env node
// Read-only release verification. Does not call db.query/init/migrations or
// refreshDataQuality, and cannot write even if a check is accidentally changed.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
require('dotenv').config({ path: process.env.ENV_FILE || path.resolve(__dirname, '../.env.local'), quiet: true });
const { Pool } = require('pg');
const { poolConfig } = require('../lib/database/connectionConfig');
const migrations = require('../migrations');
const { getResearchHistory } = require('../profile/researchHistoryService');
const original = fs.readFileSync(path.join(__dirname, 'dbVerify.js'), 'utf8');
const checkDefinitions = original.slice(original.indexOf('const checks = ['), original.indexOf('const main = async'));
const checks = vm.runInNewContext(`${checkDefinitions}\nchecks`, { expectedLatestMigration: migrations.at(-1)?.name });
const pool = new Pool(poolConfig(process.env.DATABASE_URL, { max: 1 }));
async function main() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN TRANSACTION READ ONLY');
    await client.query("SET LOCAL statement_timeout = '15s'");
    const results = [];
    for (const check of checks) {
      const response = await client.query(check.sql);
      results.push({ name: check.name, passed: response.rows[0]?.passed === true });
    }
    const owner = await client.query('SELECT id FROM users ORDER BY id DESC LIMIT 1');
    if (owner.rows[0]) {
      await getResearchHistory(owner.rows[0].id, (sql, args) => client.query(sql, args));
      results.push({ name: 'My Research queries execute against existing schema', passed: true });
    }
    console.log(JSON.stringify({ readOnly: true, passed: results.filter((item) => item.passed).length, failed: results.filter((item) => !item.passed).length, checks: results }, null, 2));
    if (results.some((item) => !item.passed)) process.exitCode = 1;
  } finally { await client.query('ROLLBACK'); client.release(); await pool.end(); }
}
main().catch((error) => { console.error('Read-only verification failed:', error.code || error.name, error.message.replace(/postgres(?:ql)?:\/\/\S+/g, '[redacted]')); process.exitCode = 1; });
