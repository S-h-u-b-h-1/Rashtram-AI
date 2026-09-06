import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read = file => readFileSync(new URL(`../src/${file}`, import.meta.url), 'utf8');
test('search shortcuts follow the current research architecture', () => {
  const view = read('components/documents/GlobalCommandPalette.jsx');
  for (const name of ['New Research', 'Library', 'My Research']) assert.ok(view.includes(`label: "${name}"`));
  assert.doesNotMatch(view, /label: "Dashboard"|label: "Demo mode"/);
  assert.match(view, /resumeChatHref\(chat\)/);
});
test('search exposes an accessible label, focus containment and honest request states', () => {
  const view = read('components/documents/GlobalCommandPalette.jsx');
  for (const value of ['aria-modal="true"', 'aria-label="Search documents and research"', 'previousFocus.focus()', 'event.key === "Tab"', 'ArrowDown', 'No documents found', 'Search is temporarily unavailable', 'if (active) setDocuments']) assert.ok(view.includes(value), value);
});
test('focus styling belongs to the complete input surface, not a clipped input outline', () => {
  const css = read('app/workspace-controls.css');
  assert.match(css, /\.workspace-input-surface:focus-within/);
  assert.match(css, /\.workspace-input-surface :is\(input, textarea\):focus-visible/);
  assert.match(css, /\.command-results\s*\{[^}]*overflow-y: auto/);
});
test('studio keeps readiness gates and preserves readable suggested question text', () => {
  const studio = read('components/document-chat/StudioPanel.jsx');
  assert.match(studio, /documents.every\(isComparisonReady\)/);
  assert.match(studio, /disabled=\{disabled \|\| !canCompare\}/);
  const questions = read('components/document-chat/SuggestedQuestions.jsx');
  assert.match(questions, /title=\{question\}/);
  assert.match(questions, /line-clamp-2/);
  assert.doesNotMatch(questions, /whitespace-nowrap/);
});
