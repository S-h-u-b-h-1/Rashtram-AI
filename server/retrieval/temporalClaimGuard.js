// A freshness check is not proof of either commencement or non-commencement.
// Each permitted conclusion needs its own explicit, authoritative premise.
const STATES = Object.freeze({ POSITIVE: 'VERIFIED_POSITIVE', NEGATIVE: 'VERIFIED_NEGATIVE', UNKNOWN: 'UNKNOWN' });
const dimensions = ['commencement', 'notification', 'force', 'repeal', 'supersession', 'applicability'];
const negativePatterns = [
  ['notification', /\b(?:has|have|had)\s+not\s+(?:yet\s+)?been\s+(?:(?:officially|formally)\s+)?notified\b|\b(?:not|never)\s+(?:(?:yet|officially)\s+)?notified\b/i],
  ['commencement', /\b(?:has|have)\s+not\s+(?:yet\s+)?(?:commenced|come into (?:force|effect))\b|\bnot\s+(?:yet\s+)?(?:commenced|effective)\b|\byet to (?:commence|come into force)\b/i],
  ['force', /\b(?:not|no longer)\s+(?:(?:currently|presently|yet|still|legally)\s+)?in force\b|\b(?:is|remains)\s+(?:currently\s+)?(?:inactive|unenforceable)\b/i],
  ['applicability', /\b(?:does|do)\s+not\s+(?:currently\s+)?apply\b|\bnot\s+(?:currently\s+)?applicable\b/i],
  ['repeal', /\b(?:has|have)\s+(?:now\s+)?been\s+repealed\b|\b(?:is|stands)\s+(?:now\s+)?repealed\b/i],
  ['supersession', /\b(?:has|have)\s+(?:now\s+)?been\s+superseded\b|\b(?:is|stands)\s+(?:now\s+)?superseded\b/i],
];
const detectNegativeTemporalClaims = text => negativePatterns.filter(([,pattern]) => pattern.test(text)).map(([dimension]) => dimension);
const explicitTemporalClaims = ({document={},passages=[],freshness={},now=new Date()}={}) => {
  const asOf=now.toISOString().slice(0,10);
  const claims=[];
  if (!(freshness.status==='fresh'||freshness.freshnessStatus==='FRESH')) return claims;
  for (const p of passages) {
    // Do not transfer another document's commencement to this document.
    if (String(p.documentId)!==String(document.id) || p.authorityClass!=='PRIMARY_OFFICIAL') continue;
    const text=String(p.content||p.originalText||'');
    const citationId=p.citationId||p.id;
    if (!citationId) continue;
    const dateMatch=text.match(/\b(?:this (?:act|bill|notification|order)|these (?:rules|regulations)) (?:shall come|comes|came) into (?:force|effect) on\s+(\d{4}-\d{2}-\d{2}|\d{1,2}(?:st|nd|rd|th)?\s+[A-Za-z]+\s+\d{4})\b/i);
    if (dateMatch) {
      const date=new Date(dateMatch[1].replace(/(\d)(?:st|nd|rd|th)/g,'$1'));
      if (!Number.isNaN(date.getTime())) {
        const effectiveDate=date.toISOString().slice(0,10);
        const future=effectiveDate>asOf;
        claims.push({dimension:'commencement',state:future?STATES.NEGATIVE:STATES.POSITIVE,asOf,effectiveDate,citationId,documentId:String(document.id)});
        // Future commencement establishes non-force only at the checked date,
        // not repeal, non-notification or permanent inapplicability.
        if(future) claims.push({dimension:'force',state:STATES.NEGATIVE,asOf,effectiveDate,citationId,documentId:String(document.id)});
      }
    }
    // An explicit dated official statement may establish a negative. An
    // undated quotation, catalogue flag or missing date never does.
    if (text.includes(asOf) && /\bas (?:of|at)\b/i.test(text) && /\b(?:this (?:act|bill|notification|order)|these (?:rules|regulations))\b/i.test(text) && !/unknown|unverified|uncertain|whether|cannot|could not|unable|\bif\b/i.test(text)) {
      for(const dimension of detectNegativeTemporalClaims(text)) claims.push({dimension,state:STATES.NEGATIVE,asOf,citationId,documentId:String(document.id)});
    }
  }
  return claims;
};
const temporalState = (verification={},dimension) => {
  const records=verification.documents?.length?verification.documents:[verification];
  const states=records.map(record=>{
    // Contradictory commencement premises cannot establish current force.
    const commencement=new Set((record.temporalClaims||[]).filter(f=>f.dimension==='commencement'&&f.citationId&&f.asOf).map(f=>f.state));
    if (commencement.size>1) return STATES.UNKNOWN;
    const facts=(record.temporalClaims||[]).filter(f=>f.dimension===dimension&&f.citationId&&f.asOf);
    const unique=new Set(facts.map(f=>f.state));
    return unique.size===1?[...unique][0]:STATES.UNKNOWN;
  });
  return states.length&&states.every(s=>s===states[0])?states[0]:STATES.UNKNOWN;
};
const guardNegativeTemporalClaims = (answer,verification={}) => {
  if (!detectNegativeTemporalClaims(String(answer||'')).length) return {answer:String(answer||''),rejected:[]};
  const rejected=[];
  const answerParts=String(answer||'').split(/(?<=[.!?])\s+|\n+/);
  const output=answerParts.map(sentence=>{
    const kinds=detectNegativeTemporalClaims(sentence);
    if(!kinds.length) return sentence;
    // Conditional questions and explicit uncertainty are not assertions.
    if(/\b(?:could not|cannot|unable to) verify (?:whether|if)\b|^\s*(?:if|suppose|assuming)\b/i.test(sentence)) return sentence;
    if(kinds.every(kind=>temporalState(verification,kind)===STATES.NEGATIVE)) {
      const facts=[...(verification.temporalClaims||[]),...(verification.documents||[]).flatMap(d=>d.temporalClaims||[])];
      const checked=facts.filter(f=>kinds.includes(f.dimension)).map(f=>f.asOf).sort()[0];
      return checked&&!sentence.includes(checked)?`As of ${checked}: ${sentence}`:sentence;
    }
    rejected.push({sentence,dimensions:kinds});
    return 'Rashtram could not verify the current commencement or applicability status from the available authoritative evidence.';
  });
  return {answer:output.join('\n\n').replace(/(Rashtram could not verify[^\n]+\.)(?:\s*\1)+/g,'$1'),rejected};
};
module.exports={STATES,dimensions,explicitTemporalClaims,temporalState,detectNegativeTemporalClaims,guardNegativeTemporalClaims};
