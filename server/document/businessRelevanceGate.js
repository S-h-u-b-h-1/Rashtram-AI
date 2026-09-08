// Bounded topic/instrument gates for business discovery. These classify
// relevance, never current legal force, and do not depend on processing state.
const norm = value => String(value||'').normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]+/gu,' ').trim();
const scopeFor = input => {
  const q=norm(input.problem);
  if (/digital lending|lending app/.test(q)) return 'digital_lending';
  if (/cert in|cybersecurity incident|log retention/.test(q)) return 'cert_in';
  if (/\bgst\b|goods and services tax|composition scheme/.test(q)) return 'gst';
  if (/income tax|tax audit|business deductions|direct tax/.test(q)) return 'income_tax';
  if (/minimum wage|provident fund|factory workers/.test(q)) return 'labour';
  if (/importer exporter code|foreign trade|\bexporter\b/.test(q)) return 'foreign_trade';
  return null;
};
const searchHints = input => ({
  digital_lending:{queries:['RBI Digital Lending','Digital Lending Directions','Digital Lending Guidelines'],patterns:['%digital%lending%'],exclude:'micro.?loan|small.?loan'},
  cert_in:{queries:['CERT-In Directions','Indian Computer Emergency Response Team','Incident Reporting Log Retention'],patterns:['%cert-in%','%computer%emergency%response%'],exclude:'university|institut.*technology'},
  gst:{queries:['Central Goods and Services Tax Act','Central Goods and Services Tax Rules','GST Registration Composition'],patterns:['%central%goods%services%tax%'],exclude:'tribunal|appointment|extension.*jammu|union territor'},
  income_tax:{queries:['Income-tax Act','Income-tax Bill','Income Tax Audit Business Deductions'],patterns:['%income%tax%act%','%income%tax%bill%'],exclude:'agricultur|salaries|salary|forecast'},
  labour:{queries:['Code on Wages','Employees Provident Funds','Minimum Wages Act'],patterns:['%code%wages%','%employees%provident%fund%','%minimum%wages%act%'],exclude:'educational|district|nagaland'},
  foreign_trade:{queries:['Foreign Trade Development Regulation','Foreign Trade Policy','Importer Exporter Code'],patterns:['%foreign%trade%','%importer%exporter%code%'],exclude:'statistics|statistical|data|watch|exports.*growth'},
}[scopeFor(input)] || {queries:[],patterns:[],exclude:'a^'});

const evaluateScope = (row,input,inferred={}) => {
  const scope=scopeFor(input);
  if(!scope) return {eligible:true,promotable:true,scope:null};
  const title=norm(row.title), summary=norm([row.candidate_summary,row.candidate_purpose].filter(Boolean).join(' '));
  const issuer=norm([row.authority,row.ministry,row.source_name,row.canonical_source].filter(Boolean).join(' '));
  const text=[title,summary].join(' ');
  const jurisdiction=norm(row.schema_state||row.jurisdiction);
  const requested=(inferred.jurisdictions||input.states||[]).map(norm);
  const national=!jurisdiction||/^(india|central|national|union of india|all india)$/.test(jurisdiction);
  const compatible=national||requested.some(s=>s===jurisdiction);
  const secondary=/report|policy|other/.test(String(row.document_type)) && !/\b(act|rules|directions|regulations|ordinance|bill|code)\b/.test(title);
  let eligible=false,core=false,reason='No sufficiently specific topic/instrument match.';
  if(scope==='digital_lending'){
    const topic=/digital lending/.test(title);
    const regulator=/\brbi\b|reserve bank of india/.test([title,issuer,summary].join(' '));
    eligible=topic&&regulator&&compatible;
    core=eligible&&/directions|guidelines|regulations/.test(title)&&/\brbi\b|reserve bank/.test([title,issuer].join(' '));
  } else if(scope==='cert_in'){
    const regulator=/\bcert in\b|indian computer emergency response team/.test([title,issuer].join(' '));
    const purpose=/directions|incident reporting|log retention|cyber security incidents/.test(text);
    eligible=regulator&&purpose&&compatible&&!/university|institutes? of .*technology/.test(title);
    core=eligible&&!secondary;
  } else if(scope==='gst'){
    const central=/central goods and services tax|\bcgst\b/.test(title);
    const targeted=/registration|composition/.test(title)&&/gst|goods and services/.test(text);
    eligible=compatible&&(central||targeted)&&!/tribunal|appointment|newsletter|discussion paper|council meeting/.test(title);
    core=eligible&&central&&!secondary;
  } else if(scope==='income_tax'){
    eligible=compatible&&/income tax|tax audit/.test(title)&&!/agricultur|salary|salaries|forecast|revenue projection/.test(title);
    const legislation=/^the income tax (?:act|bill)|^income tax (?:act|bill)/.test(title);
    const targeted=/tax audit|deduction|44ab|business income/.test(text);
    eligible=eligible&&(legislation||targeted);
    core=eligible&&/\b(act|bill|rules|circular|notification)\b/.test(title);
  } else if(scope==='labour'){
    eligible=compatible&&/wages|provident fund|occupational safety|working conditions|labour code/.test(title)&&!/educational institutions|district|local authorities/.test(title);
    core=eligible&&/\b(act|code|rules)\b/.test(title)&&!secondary;
  } else if(scope==='foreign_trade'){
    eligible=compatible&&/foreign trade|importer exporter code|export authori[sz]ation/.test(title)&&!/statistics|statistical|trade data|trade watch|growth|outlook|forecasts?/.test(title);
    core=eligible&&/development.*regulation|foreign trade policy|importer exporter code/.test(title)&&!secondary;
  }
  if(eligible) reason=`The title identifies ${row.title}. ${core?'This is a directly relevant instrument to review.':'This is supporting reading, not proof of an applicable legal requirement.'}`;
  return {scope,eligible,promotable:eligible&&core,core,reason};
};
module.exports={scopeFor,searchHints,evaluateScope};
