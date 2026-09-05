const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { normalizeSourceIds, researchSelectionKey } = require('../document/researchSelection');
const { getResearchHistory } = require('../profile/researchHistoryService');
const { validateChatMessageData } = require('../models/DocumentChat');

test('redesign preserves existing catalogue conversation keys', () => { assert.equal(researchSelectionKey(['10', '2'], ['8']), '2:10'); assert.equal(researchSelectionKey(['1']), '1'); });
test('private source conversations have a distinct bounded key namespace', () => { assert.equal(researchSelectionKey([], ['10', '2', '2']), 'sources:2:10'); assert.deepEqual(normalizeSourceIds(['1', '../3', 'x', '2']), ['1', '2']); assert.equal(normalizeSourceIds(Array.from({ length: 30 }, (_, index) => index + 1)).length, 20); });
test('My Research reads existing data with owner predicates and no writes', async () => {
  const calls = [];
  const result = await getResearchHistory('owner-7', async (sql, args) => { calls.push({ sql, args }); return { rows: [] }; });
  assert.deepEqual(result, { chats: [], reports: [] }); assert.equal(calls.length, 2);
  calls.forEach(({ sql, args }) => { assert.match(sql, /WHERE user_id = \$1/); assert.deepEqual(args, ['owner-7']); assert.doesNotMatch(sql, /INSERT|UPDATE|DELETE|CREATE|ALTER/); assert.match(sql, /LIMIT 50/); });
});
test('My Research does not lose source-only conversation identity', async () => {
  const result = await getResearchHistory('owner', async (sql) => ({ rows: sql.includes('multi_document_chats') ? [{ id: 1, document_ids_json: [], source_ids: ['3'], history_source_ids: ['2'], title: 'Question', updated_at: '2026-09-05' }] : [] }));
  assert.deepEqual(result.chats[0].sourceIds, ['3']); assert.deepEqual(result.chats[0].historySourceIds, ['2']);
});
test('clock-only timestamp reproduces rejection while ISO welcome succeeds', () => {
  assert.throws(() => validateChatMessageData({ text: 'Welcome', sender: 'assistant', timestamp: '08:36 PM' }), /timestamp must be a valid date/);
  assert.doesNotThrow(() => validateChatMessageData({ text: 'Welcome', sender: 'assistant', timestamp: '2026-09-05T10:00:00.000Z' }));
});
test('source-only chat preserves ownership, evidence verification and unverified-current guard', () => {
  const route = fs.readFileSync(path.join(__dirname, '../document/documentsRoute.js'), 'utf8');
  assert.match(route, /getSourceContext\(\s*req.user.id,/);
  assert.match(route, /passageGroups.length > 0 && passageGroups.every/);
  assert.match(route, /!passageGroups.length\s*\? "not_checked"/);
  assert.match(route, /verifyAndRepairAnswer\(generatedAnswer, verificationEvidence/);
  assert.match(route, /enforceFreshnessGuard\(verification.answer, currentVerification\)/);
});
