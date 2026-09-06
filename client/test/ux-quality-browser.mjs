// Local-only synthetic UI verification. Never points fixture credentials at production.
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
const bin = process.env.UX_BROWSER_BIN;
if (!bin) throw new Error('Set UX_BROWSER_BIN to agent-browser.');
const output = resolve('output/playwright/ux-quality');
mkdirSync(output, { recursive: true });
const run = (...args) => execFileSync(bin, ['--session', 'ux-quality', ...args], { encoding: 'utf8', timeout: 45000 });
const target = name => {
  const line = run('snapshot', '-i').split('\n').find(line => line.includes(`"${name}"`));
  const ref = line?.match(/ref=(e\d+)/)?.[1];
  if (!ref) throw new Error(`Missing ${name}`);
  return `@${ref}`;
};
const results = [];
for (const width of [1440, 768, 430, 390, 360, 320]) {
  run('set', 'viewport', String(width), '900');
  for (const [name, route, action] of [
    ['home', '/app'], ['suggested', '/app/recommend', 'suggested'],
    ['comparison', '/app/compare?comparison=1&ids=101,102'],
    ['comparison-evidence', '/app/compare?comparison=1&ids=101,102', 'evidence'],
    ['partial', '/app/compare?comparison=2&ids=101,102'],
    ['insufficient', '/app/compare?comparison=3&ids=101,102'],
    ['studio', '/app/document/101', 'studio'],
  ]) {
    run('open', `http://localhost:5050${route}`); run('wait', '--load', 'networkidle');
    if (action === 'suggested') { run('fill', target('Business or policy problem'), 'SaaS privacy compliance in India'); run('click', target('Find relevant documents')); run('wait', '--load', 'networkidle'); }
    if (action === 'studio' && width < 1024) run('click', target('Studio'));
    if (action === 'evidence') { run('find', 'text', 'Supporting evidence · 1 passages', 'click'); run('find', 'text', 'D101-P1 · Digital Personal Data Protection Act, 2023', 'click'); }
    run('screenshot', `${output}/${name}-${width}.png`);
    const raw = JSON.parse(run('eval', 'JSON.stringify({ width: innerWidth, scrollWidth: document.documentElement.scrollWidth, content: document.body.innerText.length, errorOverlay: !!document.querySelector("[data-nextjs-dialog]") })'));
    const geometry = typeof raw === 'string' ? JSON.parse(raw) : raw;
    const accessibility = JSON.parse(run('a11y', '--json')).data;
    const errors = run('errors').trim();
    const result = { name, width, geometry, errors, violations: accessibility.violations, incomplete: accessibility.incomplete };
    results.push(result);
    writeFileSync(`${output}/results.json`, JSON.stringify({ kind: 'LOCAL SYNTHETIC UI CHECK, not live backend acceptance', results }, null, 2));
    console.log(JSON.stringify({ name, width, overflow: geometry.scrollWidth > width, violations: accessibility.violations.length, errors }));
    if (geometry.scrollWidth > width || geometry.errorOverlay || !geometry.content || accessibility.violations.length) process.exitCode = 1;
  }
}
