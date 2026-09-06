// Only local synthetic fixtures. No production credentials or requests.
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
const bin = process.env.UX_BROWSER_BIN;
if (!bin) throw new Error('Set UX_BROWSER_BIN');
const output = resolve('output/workspace-controls'); mkdirSync(output, { recursive: true });
const run = (...args) => execFileSync(bin, ['--session', 'ux-quality', ...args], { encoding: 'utf8', timeout: 45000 });
const ref = name => {
  const line = run('snapshot', '-i').split('\n').find(line => line.includes(`"${name}"`));
  if (!line) throw new Error(`Missing ${name}`);
  return '@' + line.match(/ref=(e\d+)/)[1];
};
const results = [];
const capture = (name, width) => {
  const a11y = JSON.parse(run('a11y', '--json')).data;
  const raw = JSON.parse(run('eval', 'JSON.stringify({width:innerWidth,scrollWidth:document.documentElement.scrollWidth,dialog:document.querySelector(".command-dialog")?.getBoundingClientRect().toJSON()})'));
  const geometry = typeof raw === 'string' ? JSON.parse(raw) : raw;
  const errors = run('errors').trim();
  run('screenshot', `${output}/${name}-${width}.png`);
  const result = { name, width, geometry, errors, violations: a11y.violations };
  results.push(result); writeFileSync(`${output}/results.json`, JSON.stringify(results, null, 2));
  console.log(JSON.stringify({ name, width, violations: a11y.violations.length, overflow: geometry.scrollWidth > width, errors }));
  if (a11y.violations.length || errors || geometry.scrollWidth > width || (geometry.dialog && (geometry.dialog.left < 0 || geometry.dialog.right > width))) process.exitCode = 1;
};
for (const width of [1440, 768, 430, 390, 360, 320]) {
  run('set', 'viewport', String(width), '900');
  run('open', 'http://localhost:5050/app'); run('wait', '--load', 'networkidle');
  run('click', ref('Search Library shortcut')); capture('search', width);
  run('press', 'ArrowDown');
  if (!run('eval', 'document.activeElement.hasAttribute("data-search-result")').includes('true')) throw new Error('Arrow navigation failed');
  run('fill', ref('Search documents and research'), 'data'); run('wait', '--load', 'networkidle'); capture('search-results', width);
  run('press', 'Escape');
  if (run('snapshot', '-i').includes('Close command palette')) throw new Error('Escape failed');
  run('open', 'http://localhost:5050/app/document/101'); run('wait', '--load', 'networkidle');
  capture('chat', width);
  if (width < 1024) run('click', ref('Studio'));
  capture('studio', width);
}
