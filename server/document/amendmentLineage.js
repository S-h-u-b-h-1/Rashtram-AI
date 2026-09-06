const clean=s=>String(s||'').normalize('NFKC').replace(/\s+/g,' ').trim();
const identity=s=>clean(s).toLowerCase().replace(/[^\p{L}\p{N}]+/gu,' ').trim();
const escape=s=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
const REF='\\d+[A-Z]?(?:\\.\\d+)*(?:\\([a-z0-9]+\\))*';
const normalizeOperative = text => {
 let result=String(text||'');
 for(const word of ['substituted','inserted','omitted']) {
  const letters=word.split('').join('[\\s-]*');
  result=result.replace(new RegExp(`(\\b(?:shall\\s+be|is|be)\\s+)${letters}(?=\\s*[,.:;]|\\s+(?:namely|as|in|after))`,'gi'),`$1${word}`);
 }
 return result;
};
const operationOf=text=>/substitut|replac/i.test(text)?'SUBSTITUTE':/omit|delet/i.test(text)?'DELETE':
  /renumber/i.test(text)?'RENUMBER':/repeal/i.test(text)?'REPEAL':/insert/i.test(text)?'INSERT':
  /add(?:ed|ition)/i.test(text)?'ADD':/modif|redefin/i.test(text)?'MODIFY':null;

const parseInstructions=evidence=>{
 const results=[];
 for(const e of evidence){
  const text=clean(normalizeOperative(e.content||e.snippet));
  // Bounded single nested target/proviso. Plural replacement ranges are withheld
  // rather than assigning one replacement to an arbitrary subsection.
  const nested=/\bin section\s+(\d+)(?:\s+of the principal Ac\s*t)?\s*,\s*in sub-section\s*(\([a-z0-9]+\))\s*,\s*for (?:clause\s*(\([a-z0-9]+\))|the\s+(proviso))\s*,\s*the following (?:clause|proviso) shall be substituted,?\s*namely\s*:\s*[-—]?\s*(["“'])([\s\S]*?)(?:\5|”)/gi;
  for(const m of text.matchAll(nested)) results.push({affectedSection:m[1]+m[2]+(m[3]||''),proviso:!!m[4],operation:'SUBSTITUTE',oldTextFragment:null,newTextFragment:m[6],instruction:m[0],evidenceId:e.id,documentId:String(e.documentId)});
  for(const m of text.matchAll(/\bin section\s+(\d+)\s+of the principal Ac\s*t,\s*for sub-sections\s*(\([a-z0-9]+\))\s+and\s*(\([a-z0-9]+\))/gi))
   results.push({affectedSection:`${m[1]}${m[2]}–${m[3]}`,operation:'SUBSTITUTE',instruction:m[0],documentId:String(e.documentId),evidenceId:e.id,incomplete:true});
  const inline=new RegExp(`\\b(?:in\\s+)?(?:clause|section)\\s+(${REF})\\s*,?\\s*for the words\\s+[“"]([^”"]+)[”"]\\s*,?\\s*(?:the words\\s+)?substitute\\s+[“"]([^”"]+)[”"]`, 'gi');
  for(const m of text.matchAll(inline)) results.push({affectedSection:m[1],operation:'SUBSTITUTE',oldTextFragment:m[2],newTextFragment:m[3],instruction:m[0],evidenceId:e.id,documentId:String(e.documentId),fragmentOnly:true});
  const patterns=[
   new RegExp(`\\b(?:in\\s+)?(?:clause|section|sub-section)\\s*(?:no\\.?\\s*)?(${REF})\\s*(?:,\\s*)?(?:shall\\s+(?:stand\\s+|be\\s+)?|is\\s+|for\\s+(?:the\\s+words|sub-section)|on\\s+[^:]{0,90}?is\\s+)(?:[^:;]{0,100}?)(?:substitut\\w*|insert\\w*|omitt\\w*|delet\\w*|modifi\\w*|redefin\\w*|renumber\\w*|repeal\\w*)[^:;]{0,50}(?::|;)`, 'gi'),
   new RegExp(`\\b(?:following\\s+)?(?:para(?:graph)?|words|provision)\\s+(?:is|shall be)\\s+(?:added|inserted)\\s+in\\s+(?:the\\s+)?(?:clause|section)\\s*(?:no\\.?\\s*)?(${REF})[^:]{0,60}:`, 'gi'),
   new RegExp(`\\bafter\\s+(?:clause|section)\\s+(${REF})\\s*,?\\s*(?:the following\\s+)?insert[^:]{0,60}:`, 'gi'),
   new RegExp(`\\b(?:clause|section)\\s+(${REF})\\s+shall\\s+be\\s+(?:omitted|deleted|repealed)\\s*\\.`, 'gi'),
  ];
  for(const pattern of patterns)for(const m of text.matchAll(pattern)){
   const operation=operationOf(m[0]);if(!operation)continue;
   const rest=text.slice(m.index+m[0].length);
   let after='',length=0;
   if(!['DELETE','REPEAL'].includes(operation)){
    const quoted=rest.match(/^[\s—–-]*[“"]([\s\S]+?)[”"]/);
    if(quoted){after=quoted[1];length=quoted[0].length;}
    else{
     const boundary=rest.search(/\s+(?:[IVX]+\.\s+(?:The )?clause|This has been issued|Dated:|ADDENDUM)/i);
     if(boundary<0){results.push({affectedSection:m[1],operation,oldTextFragment:null,newTextFragment:null,instruction:m[0],evidenceId:e.id,documentId:String(e.documentId),incomplete:true});continue;}after=rest.slice(0,boundary).trim();length=boundary;
    }
    if(after.length<15||after.length>6000)continue;
   }
   const oldFragment=m[0].match(/for the words\s+[“"](.+?)[”"]/i)?.[1]||null;
   const subsection=m[0].match(/for sub-section\s*(\([a-z0-9]+\))/i)?.[1]||'';
   results.push({affectedSection:m[1]+subsection,operation,oldTextFragment:oldFragment,newTextFragment:after||null,
    instruction:text.slice(m.index,m.index+m[0].length+length),evidenceId:e.id,documentId:String(e.documentId)});
  }
 }
 return [...new Map(results.map(r=>[r.affectedSection+':'+r.operation+':'+r.instruction,r])).values()].slice(0,16);
};

// A matching title in the modifying SOURCE, including the version/year, is
// required. Similar catalogue titles alone never establish a relationship.
const detectLineage=(documents,evidence)=>{
 const found=[];
 for(const base of documents)for(const modifier of documents){
  if(String(base.id)===String(modifier.id))continue;
  const reference=identity(base.title).replace(/^the /,'');
  if(!/\b(act|code|policy|rules?|regulations?|notification|circular)\b/.test(reference)||!(/\b\d{4}\b/.test(reference)))continue;
  for(const e of evidence.filter(e=>String(e.documentId)===String(modifier.id))){
   const text=clean(e.content||e.snippet),n=identity(text),index=n.indexOf(reference);
   if(index<0)continue;
   const neighbourhood=n.slice(Math.max(0,index-200),index+reference.length+350);
   if(/\b(?:does not|did not|not intended to|historical|previously amended)\b/.test(neighbourhood))continue;
   const prefix=n.slice(Math.max(0,index-100),index);
   // A Bill's proposed short title names the future Act, not an instrument
   // that this Bill amends. Nearby references to amending a schedule do not
   // turn that self-identification into legal lineage.
   if (/\b(?:may|shall) be (?:called|cited as)\s+(?:the\s+)?$/.test(prefix)) continue;
   if(!parseInstructions(evidence.filter(x=>String(x.documentId)===String(modifier.id))).length&&
    !/\b(?:act to amend|addendum to|modification of|continuation of)\s+(?:the\s+)?$/.test(prefix))continue;
   const type=/\baddendum\b/.test(neighbourhood)?'ADDENDUM_TO':
    /\bsupersedes?\b/.test(neighbourhood)?'SUPERSEDES':
    /\b(?:amendment|amended|amends|amend)\b/.test(neighbourhood)?'AMENDS':
    /\b(?:partial modification|modified|modification|redefined)\b/.test(neighbourhood)?'MODIFIES':
    /\bin continuation of\b/.test(neighbourhood)?'CONTINUES':null;
   const suffix=n.slice(index+reference.length,index+reference.length+120);
   if (type === 'AMENDS' && !(
     /\b(?:act to amend|bill to amend|amends|amendment of|amendment to)\s+(?:the\s+)?$/.test(prefix) ||
     /^\s+(?:shall be|is|stands) amended\b/.test(suffix) ||
     (/\bin\s+(?:the\s+)?$/.test(prefix) && /^\s+in (?:section|clause)\b/.test(suffix))
   )) continue;
   if(type)found.push({relationshipType:type,baseDocumentReference:{id:String(base.id),title:base.title},
    modifyingDocumentReference:{id:String(modifier.id),title:modifier.title},sourceEvidenceIds:[e.id],
    affectedSections:parseInstructions(evidence.filter(x=>String(x.documentId)===String(modifier.id))).map(i=>i.affectedSection)});
  }
 }
 const unique=[...new Map(found.map(r=>[r.baseDocumentReference.id+':'+r.modifyingDocumentReference.id,r])).values()];
 return unique.length===1?unique[0]:null; // conflicting directions require review
};

const extractBaseCandidates=(evidence,documentId,section)=>{
 const requested=section.split('(')[0],children=section.match(/\([a-z0-9]+\)/gi)||[],child=children.length>0;
 const starts=new RegExp(`(?:^|\\n)\\s*(?:Section\\s+|Clause\\s+)?${escape(requested)}(?:[.:]\\s*|\\s+)(?!\\d)`, 'gi');
 const options=[];
 for(const e of evidence.filter(e=>String(e.documentId)===String(documentId))){
  const raw=String(e.content||e.snippet||'');
  for(const m of raw.matchAll(starts)){
   const rest=raw.slice(m.index+m[0].length);
   const next=rest.search(/\n\s*(?:Section\s+|Clause\s+)?\d+(?:\.\d+)*[A-Z]?(?:[.:]\s*|\s+)(?=[A-Z(“"])/);
   // An open/truncated chunk tail cannot establish the whole base provision.
   if(next<0&&!child)continue;
   let body=raw.slice(m.index,next<0?undefined:m.index+m[0].length+next).trim();
   if(child){
    let complete=true;
    for(const child of children){
    const pos=body.indexOf(child);if(pos<0){complete=false;break;}
    // Numeric subsections contain alphabetic lists; stop at a sibling, never at
    // the first nested (a)/(b), which would cut away the operative requirement.
    const sibling=/^\(\d/.test(child)?/\n\s*\(\d+[a-z]?\)/i:/\n\s*\([a-z]+\)/i;
    const tail=body.slice(pos+child.length),end=tail.search(sibling);
    if(end<0){complete=false;break;}body=body.slice(pos,pos+child.length+end).trim();
    }
    if(!complete)continue;
   }
   if(body.length>=30&&body.length<=10000)options.push({section,text:body,evidenceId:e.id,documentId:String(documentId)});
  }
 }
 return options;
};
const extractBaseSection=(evidence,documentId,section)=>{
 const options=extractBaseCandidates(evidence,documentId,section);
 return new Set(options.map(o=>clean(o.text))).size===1?options[0]:null;
};

const proposition=(text,section)=>({section,actor:clean(text).match(/\b(developer|producer|government|company|board|registered person|bank)\b/i)?.[0]||null,
 legalConcept:section,action:clean(text).match(/\b(sell|purchase|install|pay|submit|register|lease)\w*/i)?.[0]||null,
 object:clean(text),modality:clean(text).match(/\b(shall|must|may|will)\b/i)?.[0]||null,
 condition:clean(text).match(/\b(?:if|subject to|provided that|unless)\b[\s\S]*/i)?.[0]||null,
 qualifier:null,numericValue:clean(text).match(/\b\d+(?:\.\d+)?\b/g)||[],unit:clean(text).match(/\b(MW|days|years|percent|rupees)\b/gi)||[],date:null});

const constructChanges=(documents,evidence)=>{
 const lineage=detectLineage(documents,evidence);if(!lineage)return {lineage:null,changes:[],rejected:[]};
 const instructions=parseInstructions(evidence.filter(e=>String(e.documentId)===lineage.modifyingDocumentReference.id));
 const changes=[],rejected=[];
 for(const i of instructions){
  if(i.incomplete){rejected.push({section:i.affectedSection,reason:'INSUFFICIENT_MODIFYING_EVIDENCE'});continue;}
  const competing=instructions.filter(other=>!other.incomplete&&other.affectedSection===i.affectedSection&&!!other.proviso===!!i.proviso);
  if(new Set(competing.map(other=>JSON.stringify([other.operation,clean(other.oldTextFragment),clean(other.newTextFragment)]))).size>1){
   rejected.push({section:i.affectedSection,reason:'CONFLICTING_MODIFYING_INSTRUCTIONS'});continue;
  }
  if(new Set(extractBaseCandidates(evidence,lineage.baseDocumentReference.id,i.affectedSection).map(b=>clean(b.text))).size>1){
   rejected.push({section:i.affectedSection,reason:'CONFLICTING_BASE_PROVISION'});continue;
  }
  const base=extractBaseSection(evidence,lineage.baseDocumentReference.id,i.affectedSection);
  if(!base){rejected.push({section:i.affectedSection,reason:'INSUFFICIENT_BASE_EVIDENCE'});continue;}
  if(i.proviso){const start=base.text.indexOf('Provided that');if(start<0){rejected.push({section:i.affectedSection,reason:'INSUFFICIENT_BASE_EVIDENCE'});continue;}base.text=base.text.slice(start);}
  if(i.oldTextFragment&&!clean(base.text).includes(clean(i.oldTextFragment))){rejected.push({section:i.affectedSection,reason:'OLD_FRAGMENT_NOT_FOUND'});continue;}
  const modifying=evidence.find(e=>e.id===i.evidenceId&&String(e.documentId)===i.documentId);
  if(!modifying||!clean(normalizeOperative(modifying.content||modifying.snippet)).includes(i.instruction))continue;
  // The after field is explicitly an instruction/replacement, not a fabricated
  // consolidated instrument. ADD/INSERT never claim replacement of the base.
  const verb={SUBSTITUTE:'specifies substitution',MODIFY:'specifies modification',INSERT:'specifies insertion',ADD:'specifies addition',DELETE:'specifies omission',REPEAL:'specifies repeal',RENUMBER:'specifies renumbering'}[i.operation];
  changes.push({section:i.affectedSection,operation:i.operation,before:base.text,after:i.newTextFragment,
   supportedChange:`For clause ${i.affectedSection}, the modifying document ${verb}. Before: ${base.text}\nModifying instruction: ${i.instruction}`,
   whyItMatters:'Review the quoted change when applying this particular provision; current applicability is not verified here.',
   proviso:!!i.proviso,evidenceBefore:base.evidenceId,evidenceAfter:i.evidenceId,baseDocumentId:base.documentId,modifierDocumentId:i.documentId,
   propositionBefore:proposition(base.text,i.affectedSection),propositionAfter:proposition(i.newTextFragment,i.affectedSection),
   limitations:['The after text is the explicit modifying text, not a consolidated current law. No absence outside the retrieved clause is inferred.']});
 }
 return {lineage,changes,rejected};
};
const summarizeChanges=changes=>changes.map(c=>`${c.supportedChange} [${c.evidenceBefore}] [${c.evidenceAfter}]`).join('\n\n');
// General Evidence Safety remains the scorer, but each invocation contains only
// one exact before/after bundle. Differences across instruments are the explicit
// amendment operation; divergent same-role versions are rejected above.
const assessAmendmentSufficiency=(documents,evidence,assess)=>{
 const built=constructChanges(documents,evidence);
 if(!built.lineage||!built.lineage.affectedSections.length)return null;
 const components=built.rejected.map(r=>({...r,state:r.reason.startsWith('CONFLICTING')?'CONFLICTING':
  r.reason==='INSUFFICIENT_MODIFYING_EVIDENCE'?'UNPARSEABLE':'INSUFFICIENT_EVIDENCE'}));
 for(const change of built.changes){
  const before=evidence.find(e=>e.id===change.evidenceBefore),after=evidence.find(e=>e.id===change.evidenceAfter);
  const assessment=assess(`Compare the amendment to clause ${change.section}`, [
   {...before,content:change.before}, {...after,content:change.after||change.supportedChange},
  ],{queryType:'COMPARISON',minimumEvidence:2,retrievalVerified:true});
  const state=assessment.level==='CONFLICTING'?'CONFLICTING':
   assessment.level==='INSUFFICIENT'||assessment.evidenceCount!==2?'INSUFFICIENT_EVIDENCE':'SUPPORTED';
  components.push({section:change.section,operation:change.operation,proviso:change.proviso,state,
   evidenceBefore:change.evidenceBefore,evidenceAfter:change.evidenceAfter,
   propositionFingerprint:require('crypto').createHash('sha256').update(JSON.stringify([change.section,change.proviso,change.operation,change.before,change.after])).digest('hex'),assessment});
 }
 const supported=components.filter(c=>c.state==='SUPPORTED');
 const conflicts=components.filter(c=>c.state==='CONFLICTING');
 return {mode:built.lineage.relationshipType==='ADDENDUM_TO'?'ADDENDUM_SCOPED':'AMENDMENT_SCOPED',
  level:supported.length?(supported.some(c=>c.assessment.level==='LOW')?'LOW':'MEDIUM'):conflicts.length?'CONFLICTING':'INSUFFICIENT',
  decision:supported.length?'SUFFICIENT':conflicts.length?'CONFLICT':'ABSTAIN',
  status:supported.length?(components.some(c=>c.state!=='SUPPORTED')?'PARTIAL_EVIDENCE':'SUCCESS'):conflicts.length?'CONFLICTING':'INSUFFICIENT_EVIDENCE',
  components,conflicts,reasons:['Evidence Safety assessed exact affected-provision bundles.'],missing:[],signals:{},version:'amendment-scoped-sufficiency-v1'};
};
const assembleContiguous = evidence => evidence.map(first => {
 if(first.assembledChunks)return first;
 let result={...first},last=first;
 const chunks=[Number(first.chunk_index??first.chunkIndex)];
 for(let count=1;count<3;count++){
  const index=Number(last.chunk_index??last.chunkIndex);
  if(!Number.isInteger(index))break;
  const next=evidence.find(e=>String(e.documentId)===String(first.documentId)&&Number(e.chunk_index??e.chunkIndex)===index+1);
  if(!next)break;
  const a=last.metadata_json||last,b=next.metadata_json||next;
  if(!a.pdfUrl||a.pdfUrl!==b.pdfUrl||!a.pageEnd||!b.pageStart||b.pageStart<a.pageEnd||b.pageStart>a.pageEnd+1||
   /^\s*(?:CHAPTER|SCHEDULE|\d+(?:\.\d+)*\.\s)/i.test(next.content||'')||String(result.content).length+String(next.content).length>12000)break;
  const left=String(result.content),right=String(next.content);let overlap=0;
  for(let n=Math.min(800,left.length,right.length);n>=40;n--)if(left.endsWith(right.slice(0,n))){overlap=n;break;}
  chunks.push(index+1);
  result={...result,content:left+'\n'+right.slice(overlap),pageEnd:b.pageEnd,
   metadata_json:{...a,pageStart:(first.metadata_json||first).pageStart,pageEnd:b.pageEnd},assembledChunks:[...chunks]};
  last=next;
 }
 return result;
});
const canonicalSections=['purpose','scope','applicability','keyProvisions','similarities','differences','obligations','rights','definitions','legalEffect','timeline','stakeholderImpact','whatChanged','practicalImplications','keyTakeaways'];
const adaptAmendment = result => {
 const facts=result.whatChanged||[];
 const mapped={...result,comparisonKind:result.lineage.relationshipType==='ADDENDUM_TO'?'ADDENDUM_COMPARISON':'AMENDMENT_COMPARISON'};
 mapped.keyProvisions=facts.map(f=>({point:`Affected provision ${f.change.section}${f.change.proviso?' (proviso)':''}.\nBefore: ${f.change.before}\nModifying text: ${f.change.after||f.change.operation}`,citations:f.citations}));
 mapped.differences=facts.map(f=>({point:`Verified ${f.change.operation.toLowerCase()} in ${f.change.section}.\nBefore: ${f.change.before}\nAfter (modifying text): ${f.change.after||'The instruction specifies omission/repeal.'}`,citations:f.citations}));
 mapped.keyTakeaways=facts.map(f=>({point:`Clause ${f.change.section}: the modifying instrument specifies ${f.change.operation.toLowerCase()}. Current applicability is not verified.`,citations:f.citations}));
 mapped.limitations=[...new Set(facts.flatMap(f=>f.change.limitations)),...(result.amendmentVerification?.rejected||[]).map(r=>`${r.section}: ${r.reason}`)];
 mapped.sectionStatus={};
 for(const key of canonicalSections){
  mapped[key]=mapped[key]||[];
  mapped.sectionStatus[key]=mapped[key].length?'available':'insufficient_evidence';
 }
 return mapped;
};
const validateAmendment = (generated,evidence) => {
 const fail=reason=>({valid:false,status:'INSUFFICIENT_EVIDENCE',reason});
 const lineage=generated.lineage;if(!lineage)return fail('UNVERIFIED_LINEAGE');
 const documents=[lineage.baseDocumentReference,lineage.modifyingDocumentReference];
 const rebuilt=constructChanges(documents,evidence);
 if(!rebuilt.lineage||JSON.stringify(rebuilt.lineage)!==JSON.stringify(lineage))return fail('UNVERIFIED_LINEAGE');
 const facts=generated.whatChanged||[];if(!facts.length)return fail('NO_VERIFIED_CHANGES');
 for(const item of facts){
  const expected=rebuilt.changes.find(c=>c.section===item.change?.section&&c.operation===item.change?.operation&&c.proviso===item.change?.proviso);
  if(!expected||JSON.stringify(expected)!==JSON.stringify(item.change)||item.point!==expected.supportedChange||
    JSON.stringify(item.citations)!==JSON.stringify([expected.evidenceBefore,expected.evidenceAfter]))return fail('UNVERIFIED_CHANGE');
 }
 const adapted=adaptAmendment({...generated});
 for(const key of ['keyProvisions','differences','keyTakeaways'])if(JSON.stringify(adapted[key])!==JSON.stringify(generated[key]))return fail('UNVERIFIED_ADAPTER');
 if(generated.executiveSummary!==summarizeChanges(facts.slice(0,3).map(f=>f.change)))return fail('UNVERIFIED_SUMMARY');
 const partial=rebuilt.rejected.length>0||generated.amendmentVerification?.rejected?.length>0;
 return {valid:true,status:partial?'PARTIAL_EVIDENCE':'SUCCESS',reason:partial?'WITHHELD_INSTRUCTIONS':null,citedItems:facts.length};
};
// Reads existing prepared text only. Exact numbered headings, not whole-document
// semantic/top-k similarity, determine which base chunks are eligible.
const loadAmendmentPassages=async(documents,queryFn)=>{
 if(documents.length!==2)return [];
 const ids=documents.map(d=>String(d.id));
 const first=await queryFn(`SELECT document_id,chunk_index,original_text,metadata_json
  FROM document_text_chunks WHERE document_id=ANY($1::bigint[]) AND chunk_index < 2
  ORDER BY document_id,chunk_index`,[ids]);
 const convert=r=>({...r,id:`L${r.document_id}-C${r.chunk_index}`,documentId:String(r.document_id),content:r.original_text});
 const front=first.rows.map(convert),lineage=detectLineage(documents,front);
 if(!lineage)return [];
 const modifier=await queryFn(`SELECT document_id,chunk_index,original_text,metadata_json
  FROM document_text_chunks WHERE document_id=$1 AND original_text ~* $2
  ORDER BY chunk_index LIMIT 20`,[lineage.modifyingDocumentReference.id,'(clause|section|addendum|substitut|modifi|redefin|omitt|insert)']);
 const after=modifier.rows.map(convert),instructions=parseInstructions(after);
 const sections=[...new Set(instructions.map(i=>i.affectedSection.split('(')[0]))].slice(0,16);
 if(!sections.length)return after;
 const patterns=sections.map(s=>`(^|\n)[[:space:]]*(Section[[:space:]]+|Clause[[:space:]]+)?${escape(s)}([.:][[:space:]]*|[[:space:]]+)`);
 const before=await queryFn(`SELECT document_id,chunk_index,original_text,metadata_json
  FROM document_text_chunks WHERE document_id=$1 AND original_text ~* ANY($2::text[])
  ORDER BY chunk_index LIMIT 40`,[lineage.baseDocumentReference.id,patterns]);
 return assembleContiguous([...new Map([...front,...after,...before.rows.map(convert)].map(e=>[e.id,e])).values()]);
};
const buildAmendmentComparison=async({documents,evidence,verify,explain,scopedSufficiency})=>{
 const built=constructChanges(documents,evidence),{lineage}=built;if(!lineage)return null;
 const changes=built.changes.filter(c=>!scopedSufficiency||scopedSufficiency.components.some(s=>s.state==='SUPPORTED'&&s.section===c.section&&s.operation===c.operation&&s.evidenceBefore===c.evidenceBefore&&s.evidenceAfter===c.evidenceAfter));
 const rejected=[...built.rejected,...(scopedSufficiency?.components||[]).filter(s=>s.state!=='SUPPORTED'&&!built.rejected.some(r=>r.section===s.section)).map(s=>({section:s.section,reason:s.state}))];
 const proposal={generationMode:'amendment_evidence',executiveSummary:'',whatChanged:changes.map((c,index)=>({
  point:c.supportedChange,citations:[c.evidenceBefore,c.evidenceAfter],changeId:`A${index}`,change:c,
 })),practicalImplications:[]};
 const checked=verify(proposal,evidence.map(e=>({...e,snippet:e.content||e.snippet})));
 const accepted=Object.freeze((checked.generated.whatChanged||[]).map(i=>Object.freeze(i)));
 // AI never selects a clause, invents an operation, or writes the before-state.
 let explanations=[];
 if(accepted.length&&explain)try{explanations=await explain(accepted.map(i=>({id:i.changeId,
  relationship:lineage.relationshipType,section:i.change.section,operation:i.change.operation,
  before:i.change.before,after:i.change.after,citations:i.citations})));}catch{}
 const result={...checked.generated,whatChanged:[...accepted],practicalImplications:[]};
 for(const e of Array.isArray(explanations)?explanations:[]){
  const fact=accepted.find(f=>f.changeId===e.id);if(!fact||typeof e.text!=='string')continue;
  // Interpretation is separate, conditional and must pass existing Evidence Safety.
  if(!/\b(may|could|might)\b/i.test(e.text)||/\b(currently|now in force|does not contain|not present|latest)\b/i.test(e.text))continue;
  result.practicalImplications.push({point:`Analysis: ${e.text.slice(0,1200)}`,citations:fact.citations});
 }
 const analysis=verify({executiveSummary:'',practicalImplications:result.practicalImplications},evidence.map(e=>({...e,snippet:e.content||e.snippet})));
 result.practicalImplications=analysis.generated.practicalImplications||[];
 result.executiveSummary=accepted.length?summarizeChanges(accepted.slice(0,3).map(i=>i.change)):
  'The sources establish a modifying relationship, but complete base and modifying provisions could not both be verified. No before-state has been inferred.';
 result.generationMode=accepted.length?'amendment_evidence':'evidence_abstention';
 result.comparisonArchitecture='explicit-lineage-v1';result.lineage=lineage;
 result.amendmentVerification={accepted:accepted.length,rejected,report:checked.report};
 result.sectionStatus={whatChanged:accepted.length?'available':'insufficient_evidence'};
 return adaptAmendment(result);
};
module.exports={clean,normalizeOperative,parseInstructions,detectLineage,extractBaseSection,constructChanges,proposition,summarizeChanges,loadAmendmentPassages,buildAmendmentComparison,adaptAmendment,validateAmendment,assembleContiguous,assessAmendmentSufficiency};
