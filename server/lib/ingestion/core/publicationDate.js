const MONTHS = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'];
const publicationDateInfo = (input) => {
  const raw = input instanceof Date ? (Number.isNaN(input.getTime()) ? '' : input.toISOString()) : String(input || '').trim();
  const unknown = { raw: raw || null, precision: 'UNKNOWN', value: null, date: null };
  if (!raw) return unknown;
  if (/^(?:18|19|20|21)\d{2}$/.test(raw)) return {raw, precision:'YEAR', value:raw, date:null};
  const month = raw.match(/^((?:18|19|20|21)\d{2})-(0[1-9]|1[0-2])$/);
  if (month) return {raw, precision:'MONTH', value:raw, date:null};
  const named = raw.match(/^([A-Za-z]+)[,\s]+((?:18|19|20|21)\d{2})$/);
  if (named && MONTHS.includes(named[1].slice(0,3).toLowerCase())) return {
    raw, precision:'MONTH', value:`${named[2]}-${String(MONTHS.indexOf(named[1].slice(0,3).toLowerCase())+1).padStart(2,'0')}`, date:null,
  };
  let iso;
  const numeric = raw.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
  if (numeric) iso = `${numeric[3]}-${numeric[2].padStart(2,'0')}-${numeric[1].padStart(2,'0')}`;
  else if (/^\d{4}-\d{2}-\d{2}(?:T.*)?$/.test(raw)) iso = raw.slice(0,10);
  else if (/^(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun),? \d{1,2} [A-Za-z]{3} \d{4} \d{2}:\d{2}(?::\d{2})? (?:GMT|UTC|[+-]\d{4})$/i.test(raw)) {
    const dated = raw.replace(/^[A-Za-z]{3},?\s+/, '').split(' ').slice(0,3).join(' ');
    return {...publicationDateInfo(dated), raw};
  }
  else {
    const dayFirst = raw.match(/^(\d{1,2})[-\s]+([A-Za-z]+)[-\s,]+(\d{4})$/);
    const monthFirst = raw.match(/^([A-Za-z]+)[-\s]+(\d{1,2})[,\s-]+(\d{4})$/);
    const parts = dayFirst || (monthFirst && [null, monthFirst[2], monthFirst[1], monthFirst[3]]);
    const index = parts ? MONTHS.indexOf(parts[2].slice(0, 3).toLowerCase()) : -1;
    if (index >= 0) iso = `${parts[3]}-${String(index+1).padStart(2,'0')}-${parts[1].padStart(2,'0')}`;
  }
  if (!iso) return unknown;
  const parsed = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0,10) !== iso) return unknown;
  return {raw, precision:'DAY', value:iso, date:iso};
};
module.exports = { publicationDateInfo };
