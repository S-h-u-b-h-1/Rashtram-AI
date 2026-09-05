// Deterministic local-fixture UI QA; deliberately rejects production URLs.
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
const cli = process.env.REDESIGN_BROWSER_BIN;
if (!cli) throw new Error('Set REDESIGN_BROWSER_BIN to the installed agent-browser executable.');
const output = resolve(process.cwd(), '../docs/redesign-v1-qa');
mkdirSync(output, { recursive: true });
const run = (...args) => execFileSync(cli, ['--session', 'rashtram-redesign-v1', ...args], { encoding: 'utf8', timeout: 45000 });
const read = (source) => { let value = JSON.parse(run('eval', source)); return typeof value === 'string' ? JSON.parse(value) : value; };
const snapshot = () => run('snapshot', '-i');
const clickNamed = (name) => {
  const line = snapshot().split('\n').find((item) => item.includes(`"${name}"`));
  const ref = line?.match(/ref=(e\d+)/)?.[1];
  if (!ref) throw new Error(`Control not found: ${name}`);
  run('click', `@${ref}`);
};
const routes = [
  ['new-research', '/app'], ['library', '/app/library'], ['my-research', '/app/research'],
  ['workspace', '/app/document/101'], ['source-selector', '/app/document/101', 'picker'],
  ['studio', '/app/document/101', 'studio'], ['comparison', '/app/compare?comparison=1&ids=101,102'],
  ['policy-output', '/app/policy-drafter?draft=1'], ['report', '/app/reports/1'],
];
const results = [];
for (const width of [1440, 768, 390]) {
  run('set', 'viewport', String(width), '900');
  for (const [name, path, action] of routes) {
    run('open', `http://localhost:5050${path}`);
    run('wait', '--load', 'networkidle');
    if (action === 'studio' && width < 1024) clickNamed('Studio');
    if (action === 'picker') {
      if (width < 1024) clickNamed('Studio');
      clickNamed('Add Library sources to compare');
      run('wait', '--load', 'networkidle');
    }
    run('screenshot', `${output}/${name}-${width}.png`);
    const geometry = read('JSON.stringify({viewport:innerWidth,width:document.documentElement.scrollWidth,bodyWidth:document.body.scrollWidth,overlay:!!document.querySelector("[data-nextjs-dialog]"),content:document.body.innerText.trim().length,visibleOverflow:[...document.querySelectorAll("body *")].filter(e=>e.getBoundingClientRect().width&&getComputedStyle(e).visibility!=="hidden"&&e.getBoundingClientRect().right>innerWidth+1).slice(0,8).map(e=>({tag:e.tagName,class:e.className,text:e.textContent.slice(0,60)}))})');
    const audit = JSON.parse(run('a11y', '--json'));
    const errors = run('errors').trim();
    const result = { name, width, geometry, errors, accessibility: audit.data?.counts, violations: audit.data?.violations };
    results.push(result);
    writeFileSync(`${output}/browser-results.json`, JSON.stringify({ kind: 'LOCAL FIXTURE — not production or legal accuracy verification', results }, null, 2));
    console.log(JSON.stringify({ name, width, overflow: geometry.width > width, errors, violations: audit.data?.counts?.violations }));
  }
}
for (const width of [320, 360, 375, 412, 430]) {
  run('set', 'viewport', String(width), '844');
  for (const [name, path] of routes.filter(([name]) => ['new-research', 'library', 'my-research', 'workspace', 'comparison', 'policy-output'].includes(name))) {
    run('open', `http://localhost:5050${path}`); run('wait', '--load', 'networkidle');
    const geometry = read('JSON.stringify({viewport:innerWidth,width:document.documentElement.scrollWidth,overlay:!!document.querySelector("[data-nextjs-dialog]")})');
    results.push({ name, width, geometry });
    console.log(JSON.stringify({ name, width, overflow: geometry.width > width }));
    writeFileSync(`${output}/browser-results.json`, JSON.stringify({ kind: 'LOCAL FIXTURE — not production or legal accuracy verification', results }, null, 2));
  }
}
