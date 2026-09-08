// Deliberately conservative: a numeric/legal claim must be a literal proposition
// in a cited original passage. A number occurring elsewhere is not entailment.
const normal = value => String(value || '').normalize('NFKC').replace(/[*_`]/g, '')
  .replace(/\s+/g, ' ').trim().toLowerCase();
const labelsIn = value => [...String(value).matchAll(/\[(Catalogue document|User source):\s*([^\]]+)\]/g)]
  .map(match => normal(`${match[1]}: ${match[2]}`));
const sensitive = value => /\d|\b(?:section|sub-section|rule|clause|article)\s+(?:one|two|three|four|five|six|seven|eight|nine|ten)\b|\b(?:one|two|three|four|five|six|seven|eight|nine|ten|twenty|thirty|hundred|thousand|million|crore|lakh)\s+(?:per\s+cent|percent|days?|months?|years?|rupees|dollars)\b/i.test(value);
function validateDraftGrounding(markdown, context) {
  const evidence = [...String(context).matchAll(/\[(Catalogue document|Catalogue summary|User source):\s*([^\]]+)\]([^]*?)(?=\[(?:Catalogue document|Catalogue summary|User source):|$)/g)]
    .filter(m => m[1] !== 'Catalogue summary')
    .map(m => ({ label: normal(`${m[1]}: ${m[2]}`), text: normal(m[3].replace(/^\s*Passage\s+\d+\s*/, '')) }));
  const withheld = [];
  const output = String(markdown).split(/\n/).map(line => {
    if (!line.trim() || /^\s*#/.test(line)) return line;
    const claim = line.replace(/\[(?:Catalogue document|Catalogue summary|User source):[^\]]+\](?:\s*Passage\s+\d+)?/g, '')
      .replace(/^\s*(?:[-*•]|\d+[.)])\s*/, '').trim();
    if (!sensitive(claim)) return line;
    const citations = labelsIn(line);
    // Proposed quantified targets are not existing legal/source facts. They
    // require an explicit local proposal label and no attribution to a source.
    if (!citations.length && /^(?:recommendation|proposal|proposed target):/i.test(claim) &&
        !/\b(?:section|rule|clause|article|requires|mandates|current|in force)\b/i.test(claim)) return line;
    const supported = evidence.some(e => citations.includes(e.label) && e.text.includes(normal(claim)));
    if (supported) return line;
    withheld.push({ reason: 'UNSUPPORTED_NUMERIC_OR_LEGAL_PROPOSITION', claim, citations });
    return '';
  }).join('\n').replace(/\n{3,}/g, '\n\n');
  return { markdown: output, withheld, version: 'draft-reference-safety-v1' };
}
module.exports = { validateDraftGrounding };
