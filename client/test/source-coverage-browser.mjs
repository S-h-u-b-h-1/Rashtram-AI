// Isolated browser and synthetic API only; no production credentials.
import {execFileSync} from 'node:child_process';
import {mkdirSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
const bin=process.env.UX_BROWSER_BIN;
if(!bin)throw new Error('Set UX_BROWSER_BIN');
const run=(...args)=>execFileSync(bin,['--session','ux-quality',...args],{encoding:'utf8',timeout:45000});
const ref=(label)=>{
  const line=run('snapshot','-i').split('\n').find((line)=>line.includes(`"${label}"`));
  if(!line)throw new Error(`Missing ${label}`);
  return '@'+line.match(/ref=(e\d+)/)[1];
};
const text=()=>run('get','text','body');
const assertText=(value)=>{if(!text().includes(value))throw new Error(`Missing text: ${value}`);};
const results=[];
mkdirSync('output/source-coverage',{recursive:true});
for(const width of [430,390,360,320]){
  run('set','viewport',String(width),'900');
  run('open',`http://localhost:5050/app/coverage?qa=${width}-${Date.now()}`);run('wait','--load','networkidle');
  run('wait','section[aria-label="Source classification"]');
  assertText('6 publishers');assertText('Pilot · not scheduled');assertText('TLS_CERTIFICATE_FAILURE');
  for(const label of ['Last attempt','Last successful collection','Newest catalogued publication','New records in last run','Updated in last run','Errors in last run'])assertText(label);
  run('fill',ref('Find a publisher'),'Takshashila');assertText('1 publishers');
  run('fill',ref('Find a publisher'),'no-such-publisher');assertText('No publishers match these filters.');
  run('fill',ref('Find a publisher'),' ');
  for(const category of ['Regulators','Institutional research','Universities & academic research','Government publications','Ministries']){
    run('select',ref('Source type'),category);
    assertText(category==='Government publications'?'2 publishers':'1 publishers');
  }
  run('select',ref('Source type'),'All sources');
  run('find','text','Ministry & department onboarding · 103 entries','click');
  run('fill',ref('Find a ministry or onboarding state'),'Steel');assertText('Steel');
  run('fill',ref('Find a ministry or onboarding state'),'no-such-ministry');assertText('No ministry entries match this search.');
  run('fill',ref('Find a ministry or onboarding state'),'Steel');
  const geometry=JSON.parse(run('eval','JSON.stringify({width:innerWidth,scrollWidth:document.documentElement.scrollWidth})'));
  const actual=typeof geometry==='string'?JSON.parse(geometry):geometry;
  const a11y=JSON.parse(run('a11y','--json')).data;
  run('screenshot',resolve(`output/source-coverage/coverage-${width}.png`));
  const result={width,geometry:actual,violations:a11y.violations,overflow:actual.scrollWidth>width};
  results.push(result);console.log(JSON.stringify(result));
  if(result.overflow || result.violations.length)process.exitCode=1;
}
writeFileSync('output/source-coverage/results.json',JSON.stringify(results,null,2));
