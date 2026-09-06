// Explicit live QA: uses a separately authenticated disposable account session.
// No synthetic APIs, minted tokens, publisher fetches, or personal session access.
import {execFileSync} from 'node:child_process';
import {mkdirSync,writeFileSync} from 'node:fs';
const bin=process.env.UX_BROWSER_BIN;
if(!bin || process.env.CONFIRM_PRODUCTION_QA!=='wave1b')throw new Error('Explicit production QA confirmation required');
const run=(...args)=>execFileSync(bin,['--session','wave1b',...args],{encoding:'utf8',timeout:45000});
const ref=label=>{const line=run('snapshot','-i').split('\n').find(l=>l.includes(`"${label}"`));if(!line)throw new Error(`Missing ${label}`);return '@'+line.match(/ref=(e\d+)/)[1];};
const unwrap=value=>{const parsed=JSON.parse(value);return typeof parsed==='string'?JSON.parse(parsed):parsed;};
const sources=[['cag-reports','OFFICIAL GOVERNMENT'],['ministry-home-circulars','OFFICIAL GOVERNMENT'],['union-budget','OFFICIAL GOVERNMENT'],['research-nipfp','INSTITUTIONAL SECONDARY'],['research-takshashila','INSTITUTIONAL SECONDARY']];
const results=[];mkdirSync('output/wave1b',{recursive:true});
for(const width of [1440,768,390,360]){
  run('set','viewport',String(width),'1000');run('open','https://rashtram-ai.vercel.app/app/coverage');
  run('wait','section[aria-label="Source classification"]');
  for(const [source,authority] of sources){
    run('fill',ref('Find a publisher'),source);
    const body=run('get','text','body');
    // Mobile intentionally hides the sidebar account label; authenticated
    // Coverage content is still required at every viewport.
    for(const expected of [...(width===1440?['Rashtram QA Wave B']:[]),'1 publishers',authority,'Rights:','Last attempt','Last successful collection','Newest catalogued publication','Errors in last run'])if(!body.includes(expected))throw new Error(`${source}/${width}: missing ${expected}`);
    if(source==='research-takshashila' && !body.includes('automation blocked'))throw new Error('Missing automation restriction');
    const geometry=unwrap(run('eval','JSON.stringify({width:innerWidth,scrollWidth:document.documentElement.scrollWidth})'));
    const a11y=unwrap(run('a11y','--json')).data;
    const result={width,source,geometry,violations:a11y.violations,overflow:geometry.scrollWidth>width};results.push(result);
    if(source==='cag-reports')run('screenshot',`${process.cwd()}/output/wave1b/coverage-${width}.png`);
    if(result.overflow || result.violations.length)process.exitCode=1;
  }
}
writeFileSync('output/wave1b/coverage-results.json',JSON.stringify(results,null,2));
console.log(JSON.stringify(results));
