// Observed Hindi publisher abbreviations. Exact tokens avoid substring guesses
// (for example जन inside another word). Unknown tokens retain YEAR precision.
const months = [
  ['जनवरी','जन'], ['फरवरी','फ़रवरी','फर','फ़र'], ['मार्च','मा'], ['अप्रैल','अप्र'],
  ['मई'], ['जून'], ['जुलाई','जुल'], ['अगस्त','अग'], ['सितंबर','सितम्बर','सित'],
  ['अक्टूबर','अक्टू','अक्ट'], ['नवंबर','नवम्बर','नव'], ['दिसंबर','दिसम्बर','दिस'],
];
const hindiPublicationMonth = value => {
  const token=String(value||'').trim().split(/[\s,।.]+/u)[0];
  const index=months.findIndex(aliases=>aliases.includes(token));
  return index<0?null:index+1;
};
module.exports={hindiPublicationMonth};
