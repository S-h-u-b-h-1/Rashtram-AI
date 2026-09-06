// Structural references are never numeric evidence. Values retain dimensions;
// calendar months/years are deliberately not converted to an assumed day count.
const classifyNumericTokens = value => {
  const text=String(value||''); const result=[]; const occupied=[];
  const add=(m,type,dimension,number,unit)=>{result.push({text:m[0],start:m.index,end:m.index+m[0].length,type,dimension,value:number,unit});occupied.push([m.index,m.index+m[0].length]);};
  // Include closing nested parentheses (word boundary alone would omit them).
  const refs=/\b(?:section|clause|rule|regulation|article|schedule|para(?:graph)?)\s+(?:\d+(?:\.\d+)*(?:\([a-z0-9]+\))*|[IVXLCDM]+)(?![\w])/gi;
  for(const m of text.matchAll(refs))add(m,'PROVISION_IDENTIFIER',null,null,null);
  for(const m of text.matchAll(/\b\d{4}-\d{2}-\d{2}\b|\b\d{1,2}[\/-]\d{1,2}[\/-]\d{4}\b/g))add(m,'DATE','date',m[0],null);
  for(const m of text.matchAll(/\d[\d,]*(?:\.\d+)?/g)){
    if(occupied.some(([a,b])=>m.index>=a&&m.index<b))continue;
    let number=Number(m[0].replace(/,/g,'')),type='UNKNOWN',dimension=null,unit=null;
    const before=text.slice(Math.max(0,m.index-45),m.index),after=text.slice(m.index+m[0].length);
    const suffix=after.match(/^\s*-?\s*(%|percent(?:age)?|days?|months?|years?|rupees?|lakhs?|crores?|kg|tonnes?|mw|kw)\b/i)||after.match(/^\s*(%)/);
    unit=suffix?.[1]?.toLowerCase();
    if(/(?:₹|\bRs\.?|\brupees?)\s*$/i.test(before)||['rupee','rupees','lakh','lakhs','crore','crores'].includes(unit)){
      type='MONEY';dimension='money:INR';number*=unit?.startsWith('lakh')?100000:unit?.startsWith('crore')?10000000:1;
    }else if(unit==='%'||unit?.startsWith('percent')){type='PERCENTAGE';dimension='percentage';}
    else if(/\bage\s*(?:of|limit|is|:)?\s*$/i.test(before)){type='QUANTITY';dimension='age:years';}
    else if(unit&&/^(day|month|year)/.test(unit)){type='DURATION';dimension='duration:'+unit.replace(/s$/,'');}
    else if(unit&&/^(kg|tonne)/.test(unit)){type='QUANTITY';dimension='mass:kg';number*=unit.startsWith('tonne')?1000:1;}
    else if(unit&&/^(mw|kw)$/.test(unit)){type='QUANTITY';dimension='power:kw';number*=unit==='mw'?1000:1;}
    else if(/^(st|nd|rd|th)\b/i.test(after)){type='ORDINAL';}
    else if(number>=1800&&number<=2200&&m[0].length===4){type='YEAR';dimension='year';}
    else if(/\b(?:number|count|quantity)\s*(?:of\s+\w+\s+)?(?:is|:)?\s*$/i.test(before)){type='FACTUAL_VALUE';dimension='count';}
    add(m,type,dimension,number,unit||null);
  }
  return result.sort((a,b)=>a.start-b.start);
};
const provisionIdentifiers = value => classifyNumericTokens(value).filter(t=>t.type==='PROVISION_IDENTIFIER').map(t=>t.text.replace(/^\w+\s+/,'').toLowerCase());
const incompatibleNumericValues = (left,right) => {
  const a=classifyNumericTokens(left),b=classifyNumericTokens(right);
  // Agreement in a different dimension (or in a section ID) cannot hide a conflict.
  const dimensions=[...new Set(a.filter(t=>t.dimension).map(t=>t.dimension))];
  return dimensions.some(d=>{
    const x=a.filter(t=>t.dimension===d).map(t=>String(t.value)),y=b.filter(t=>t.dimension===d).map(t=>String(t.value));
    return y.length>0&&!x.some(v=>y.includes(v));
  });
};
module.exports={classifyNumericTokens,provisionIdentifiers,incompatibleNumericValues};
