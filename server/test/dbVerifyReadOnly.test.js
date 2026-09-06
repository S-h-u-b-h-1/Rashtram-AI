const test = require('node:test');
const assert = require('node:assert/strict');
const { verifyDatabase, main } = require('../cli/dbVerify');
function database() {
  const calls = [];
  const client = { query: async sql => {
    calls.push(sql);
    return { rows: [{ passed: true, rows: 1, hash: 'stable' }] };
  }, release: () => calls.push('release') };
  return { calls, pool: { connect: async () => client } };
}
test('default verifier is transaction-enforced read only with stable fingerprints', async () => {
  const { calls, pool } = database();
  const result = await verifyDatabase(pool, [{ name: 'check', sql: 'SELECT true AS passed' }]);
  assert.equal(calls[0], 'BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
  assert.ok(calls.slice(1,-2).every(sql => /^SELECT/.test(sql)));
  assert.deepEqual(calls.slice(-2), ['ROLLBACK', 'release']);
  assert.equal(result.fingerprint.unchanged, true);
});
test('verification rejects a write or multiple statements and always rolls back', async () => {
  for (const sql of ['UPDATE documents SET research_ready=false', 'SELECT 1; DELETE FROM documents']) {
    const { calls, pool } = database();
    await assert.rejects(verifyDatabase(pool, [{ name: 'bad', sql }]));
    assert.ok(!calls.includes(sql));
    assert.deepEqual(calls.slice(-2), ['ROLLBACK', 'release']);
  }
});
test('unknown flags cannot accidentally opt into reconciliation', async () => {
  await assert.rejects(main(['--apply=true']), /explicit/);
});

test('preserves latest main lexical-ready invariant',()=>{const {checks}=require('../cli/dbVerify');const sql=checks.find(c=>c.name==='strict research-ready invariant').sql;assert.ok(sql.includes("ps.embedding_status IN ('fallback', 'deferred')"));assert.ok(sql.includes("ps.retrieval_mode IN ('local_text', 'fts', 'hybrid')"));});
