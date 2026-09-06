import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const root = new URL('../src/', import.meta.url);
const css = readFileSync(new URL('app/globals.css', root), 'utf8');

test('shared typography keeps labels at 14px, controls at 16px and body text at 17px', () => {
  assert.match(css, /--text-xs:\s*0\.875rem/);
  assert.match(css, /--text-sm:\s*1rem/);
  assert.match(css, /--text-base:\s*1\.0625rem/);
  assert.match(css, /\.chat-markdown\s*\{\s*font-size:\s*1\.0625rem/);
  assert.doesNotMatch(css, /font-size:\s*0\.(?:8|93)rem/);
});

test('screens use shared readable typography instead of tiny fixed-pixel text', () => {
  const visit = dir => readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const path = join(dir, entry.name);
    return entry.isDirectory() ? visit(path) : /\.(jsx?|tsx?|mjs)$/.test(path) ? [path] : [];
  });
  for (const path of visit(root.pathname)) {
    const text = readFileSync(path, 'utf8');
    for (const match of text.matchAll(/text-\[(\d+(?:\.\d+)?)px\]/g)) {
      assert.ok(Number(match[1]) >= 16, `Unreadable fixed text size in ${path}: ${match[0]}`);
    }
  }
});
