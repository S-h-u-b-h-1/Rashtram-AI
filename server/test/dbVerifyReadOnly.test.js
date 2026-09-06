const test = require('node:test');
const assert = require('node:assert/strict');
const { verifyDatabase, checks } = require('../cli/dbVerify');

test('database verification is transaction-enforced read-only without quality refresh or initialization', async () => {
  const calls = [];
  const result = await verifyDatabase({ queryFn: async (sql) => { calls.push(sql); return { rows: [{ passed: true }] }; } });
  assert.equal(calls[0], 'BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');
  assert.equal(calls.at(-1), 'COMMIT');
  assert.equal(calls.length, checks.length + 2);
  assert.equal(result.readOnly, true);
  assert.equal(result.ok, true);
  assert.deepEqual(result.mutationCounts, { created: 0, updated: 0, deleted: 0 });
  assert.ok(calls.slice(1, -1).every((sql) => /^SELECT\b/i.test(sql)));
});

test('database verification rolls back query failures', async () => {
  const calls = [];
  await assert.rejects(verifyDatabase({ queryFn: async (sql) => {
    calls.push(sql);
    if (sql.startsWith('SELECT')) throw new Error('fixture failure');
    return { rows: [] };
  } }), /fixture failure/);
  assert.equal(calls.at(-1), 'ROLLBACK');
});
