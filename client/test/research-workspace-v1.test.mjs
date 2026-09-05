import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PRIMARY_NAVIGATION, uniqueIds, workspaceHref, resumeChatHref, savedSearchHref, formatMessageTime, restoreSourceIds, sourceCount } from '../src/lib/research-workspace.mjs';
const read = (path) => readFile(new URL(`../src/${path}`, import.meta.url), 'utf8');

test('primary navigation has three task-oriented destinations', () => assert.deepEqual(PRIMARY_NAVIGATION.map((item) => item.label), ['New Research', 'Library', 'My Research']));
test('resume follows durable identity without readiness metadata', () => assert.equal(resumeChatHref({ documentId: '101', id: 'chat-3' }), '/app/document/101'));
test('source-only resume uses its stable history scope', () => assert.equal(resumeChatHref({ documentIds: [], sourceIds: ['2'], historySourceIds: ['1'] }), '/app/multi-document-chat?sources=1'));
test('one-document multi-source history keeps its original storage route', () => assert.equal(resumeChatHref({ documentIds: ['101'], sourceIds: ['7'] }), '/app/multi-document-chat?ids=101&sources=7'));
test('saved searches preserve scope, filters and explicit all-source selection', () => assert.equal(savedSearchHref({ query: 'RBI', filters: { state: 'Delhi', researchReady: '', scope: 'state', token: 'never-copy' } }), '/app/library?q=RBI&state=Delhi&researchReady=&scope=state'));
test('workspace requires explicit sources and preserves encoded question', () => {
  assert.equal(workspaceHref({ question: 'Unscoped question' }), '/app');
  const url = new URL(workspaceHref({ documentIds: ['101'], sourceIds: ['8'], question: 'RBI & NBFC?' }), 'https://example.test');
  assert.equal(url.pathname, '/app/document/101'); assert.equal(url.searchParams.get('q'), 'RBI & NBFC?'); assert.equal(url.searchParams.get('sources'), '8');
});
test('source identifiers deduplicate and remain bounded', () => assert.deepEqual(uniqueIds(['1', '1', '../x', '2', '3'], 2), ['1', '2']));
test('source count includes the primary document and only usable personal sources', () => assert.equal(sourceCount([{ id: 1, researchReady: true }], [{ id: 2, status: 'ready' }, { id: 3, status: 'failed' }], ['2', '3', '999']), 2));
test('source restore excludes deleted, unavailable and other-account sources', () => assert.deepEqual(restoreSourceIds([{ metadata: { sourceIds: ['1'] } }, { metadata: { sourceIds: ['2', '3', '999'] } }], [{ id: 2, status: 'ready' }, { id: 3, status: 'failed' }]), ['2']));
test('timestamps render ISO, legacy clock-only, null and invalid values safely', () => {
  assert.ok(formatMessageTime('2026-09-05T10:00:00.000Z')); assert.equal(formatMessageTime('08:36 PM'), '08:36 PM'); assert.equal(formatMessageTime(null), ''); assert.equal(formatMessageTime('invalid'), '');
});
test('welcome timestamp is an ISO date; server generation still owns turns', async () => {
  const layout = await read('components/document-chat/DocumentChatLayout.jsx');
  assert.match(layout, /const timeLabel = \(\) => new Date\(\)\.toISOString\(\)/);
  assert.match(layout, /restoreSourceIds/); assert.match(layout, /conversationEpoch/);
});
test('question-first discovery never directly generates an answer', async () => {
  const home = await read('components/workspace/NewResearch.jsx');
  assert.match(home, /researchReady: true/); assert.match(home, /Start research with these sources/);
  assert.doesNotMatch(home, /sendDocumentChatMessage|sendCrossDocumentChat|generateResponse/);
});
test('Studio keeps summary collapsed and contextual tools accessible', async () => {
  const studio = await read('components/document-chat/StudioPanel.jsx');
  assert.match(studio, /Saved outputs/); assert.match(studio, /documents.length >= 2/);
  assert.match(studio, /<details[^>]*><summary[^>]*>Document overview/); assert.match(studio, /Compliance research & tracking/);
});
test('Library defaults to usable sources while keeping all-source discovery', async () => {
  const library = await read('components/documents/DocumentExplorer.jsx');
  assert.match(library, /researchReady: "true"/); assert.match(library, /Show all sources/);
  assert.match(library, /setSortBy\(value.trim\(\) \? "relevance"/);
});
