import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const source = path => readFileSync(new URL(`../src/${path}`, import.meta.url), 'utf8');
test('V2 comparison has expandable source evidence and a usable zero-finding route', () => {
  const ui = source('components/documents/ComparisonFindingsV2.jsx');
  assert.match(ui, /View evidence/); assert.match(ui, /<details/);
  assert.match(ui, /\/app\/library/); assert.match(ui, /\/app\/document\//);
  assert.doesNotMatch(ui, /confidence.*%|Missing Evidence|forced timeline/i);
  assert.match(ui, /md:grid-cols-2/); assert.match(ui, /overflow-wrap:anywhere/);
});
test('API opts into finding-first creation', () => {
  const api = source('lib/api.js');
  assert.match(api, /reportVersion: 2/);
});
