const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

// Execute the real Express handlers with bounded service doubles. Existing
// evidence/retrieval suites test the unchanged engines; these tests cover the
// V1 source-selection, owner, history and SSE compatibility boundary.
function harness({ failPersistence = false } = {}) {
  const routes = new Map(), records = new Map(), calls = { generation: 0, verification: 0, sources: [] };
  const router = Object.fromEntries(['get', 'post', 'delete', 'patch'].map((method) => [method, (route, ...handlers) => routes.set(`${method} ${route}`, handlers.at(-1))]));
  const query = async (sql, args) => {
    const key = `${args[0]}|${args[1]}`;
    if (/INSERT INTO multi_document_chats/.test(sql)) { if (failPersistence) throw new Error('simulated storage failure'); records.set(key, [...(records.get(key) || []), ...JSON.parse(args[4])]); return { rows: [] }; }
    if (/DELETE FROM multi_document_chats/.test(sql)) { records.delete(key); return { rows: [] }; }
    return { rows: records.has(key) ? [{ messages: records.get(key) }] : [] };
  };
  const sourceContext = async (owner, ids) => {
    calls.sources.push({ owner, ids });
    const evidence = owner === 'owner-a' && ids.includes('7') ? [{ id: 'S7-C1', passage: 1, content: 'A selected private source passage.', documentTitle: 'Private QA source', userSource: true }] : [];
    return { sources: evidence, evidence, context: evidence.map((item) => item.content).join('\n'), chunks: evidence.length };
  };
  const doubles = {
    express: { Router: () => router },
    '../db': { query },
    './DocumentRepository': { getById: async () => null },
    '../research/sourceService': { getSourceContext: sourceContext },
    '../retrieval/queryPlanner': { planQuery: () => ({ useGraph: false, queryType: 'general', plannerVersion: 'test' }) },
    '../retrieval/retrievalConfig': { retrievalConfig: () => ({ versions: { retrievalVersion: 'test' } }) },
    '../retrieval/featureFlags': { resolveResearchFlags: () => ({ evidenceSufficiency: true, citationVerifier: true }), applyResearchFlags: (plan) => plan },
    '../retrieval/researchTelemetry': { recordResearchTelemetry: async () => {} },
    '../retrieval/evidenceSafetyService': {
      SUFFICIENCY_LEVELS: { MEDIUM: 'MEDIUM', INSUFFICIENT: 'INSUFFICIENT', CONFLICTING: 'CONFLICTING' },
      assessEvidenceSufficiency: (message, evidence, options) => { assert.equal(options.retrievalVerified, true); assert.ok(evidence.length); return { level: 'MEDIUM' }; },
      verifyAndRepairAnswer: async (answer, evidence) => { calls.verification++; assert.ok(evidence[0].userSource); return { answer, supportedFacts: 1 }; },
      summarizeVerification: () => ({ supportedFacts: 1 }),
    },
    '../retrieval/adaptiveIntelligenceService': {
      ANSWER_INTENTS: { GENERAL_CONTEXT: 'GENERAL_CONTEXT', CURRENT_STATUS: 'CURRENT_STATUS', TIMELINE: 'TIMELINE' },
      classifyAnswerIntent: (message) => message.includes('current') ? 'CURRENT_STATUS' : 'GENERAL_CONTEXT',
      classifyFreshness: (message) => message.includes('current') ? 'current' : 'not_required',
      requiresCurrentVerification: (freshness) => freshness === 'current',
      enforceFreshnessGuard: (answer, verification) => verification.required ? `${answer}\nCurrent status: ${verification.status}` : answer,
    },
    '../lib/vectordb': { providerConfig: () => ({}), generateResponse: async function* () { calls.generation++; yield { text: () => 'Verified source answer [S7-C1].' }; } },
    '../lib/sse': require('../lib/sse'),
    './researchSelection': require('../document/researchSelection'),
    '../lib/httpResponse': { sendError: (res, error) => res.status(error.status || 500).json({ error: error.status ? error.message : 'Request failed.' }) },
  };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../document/documentsRoute.js'), 'utf8'), {
    require: (name) => name === 'node:crypto' ? require(name) : doubles[name] || {},
    module: { exports: {} }, console: { error() {}, warn() {}, info() {} }, Date, URL, Set, Map, Buffer,
  });
  const request = async (method, route, { owner = 'owner-a', body = {}, query = {} } = {}) => {
    const res = { writes: [], statusCode: 200, destroyed: false, writableEnded: false, headersSent: false,
      status(code) { this.statusCode = code; return this; }, json(value) { this.body = value; return this; },
      setHeader() {}, flushHeaders() { this.headersSent = true; }, write(chunk) { this.writes.push(chunk); }, end() { this.writableEnded = true; } };
    await routes.get(`${method} ${route}`)({ user: { id: owner }, body, query }, res);
    return res;
  };
  return { request, calls, records };
}

test('source-only real route streams, verifies, persists citations and resumes by owner', async () => {
  const app = harness();
  const res = await app.request('post', '/chat', { body: { message: 'Summarise this source.', sourceIds: ['7'], workflow: { id: 'summary', title: 'Summary' } } });
  assert.equal(res.statusCode, 200); assert.equal(app.calls.generation, 1); assert.equal(app.calls.verification, 1);
  assert.match(res.writes.join(''), /"persisted":true/);
  const history = await app.request('get', '/chat/history', { query: { sources: '7' } });
  assert.equal(history.body.messages.length, 2);
  assert.equal(history.body.messages[1].sources[0].id, 'S7-C1');
  assert.equal(history.body.messages[1].metadata.workflowTitle, 'Summary');
  const other = await app.request('get', '/chat/history', { owner: 'owner-b', query: { sources: '7' } });
  assert.equal(other.body.messages.length, 0);
});

test('unscoped and inaccessible source-only requests cannot reach generation', async () => {
  const app = harness();
  assert.equal((await app.request('post', '/chat', { body: { message: 'A question' } })).statusCode, 400);
  assert.equal((await app.request('post', '/chat', { owner: 'owner-b', body: { message: 'A question', sourceIds: ['7'] } })).statusCode, 422);
  assert.equal((await app.request('post', '/chat', { body: { message: 'A question', documentIds: ['missing'], sourceIds: ['7'] } })).statusCode, 404);
  assert.equal(app.calls.generation, 0);
});

test('private sources alone never produce a verified-current marker', async () => {
  const app = harness();
  const res = await app.request('post', '/chat', { body: { message: 'What is the current position?', sourceIds: ['7'] } });
  assert.match(res.writes.join(''), /"status":"UNVERIFIED"/);
  assert.match(res.writes.join(''), /"connectorStatus":"not_checked"/);
  assert.doesNotMatch(res.writes.join(''), /"status":"VERIFIED_CURRENT"/);
});

test('source-only scope changes retain the original conversation anchor', async () => {
  const app = harness();
  await app.request('post', '/chat', { body: { message: 'Summarise.', sourceIds: ['7'], historySourceIds: ['4'] } });
  assert.equal((await app.request('get', '/chat/history', { query: { sources: '4' } })).body.messages.length, 2);
  assert.equal((await app.request('get', '/chat/history', { query: { sources: '7' } })).body.messages.length, 0);
  await app.request('delete', '/chat/history', { owner: 'owner-b', query: { sources: '4' } });
  assert.equal((await app.request('get', '/chat/history', { query: { sources: '4' } })).body.messages.length, 2);
});

test('a persistence failure cannot claim that a source-only answer was saved', async () => {
  const app = harness({ failPersistence: true });
  const res = await app.request('post', '/chat', { body: { message: 'Summarise.', sourceIds: ['7'] } });
  assert.match(res.writes.join(''), /"type":"error"/);
  assert.doesNotMatch(res.writes.join(''), /"persisted":true|simulated storage failure/);
});
