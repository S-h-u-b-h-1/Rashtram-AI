const test = require('node:test');
const assert = require('node:assert/strict');
const { comparisonPdfPresentation, createComparisonPdf, statusOf } = require('../document/comparisonPdfPresentation');
const fixture = mode => ({ title: `Presentation fixture - ${mode}`, createdAt: '2026-09-06T00:00:00Z', result: {
  generationMode: mode === 'insufficient' ? 'evidence_abstention' : 'gemini', comparisonSchemaVersion: 'comparison-quality-v3',
  quality: { outputValidation: { valid: mode !== 'insufficient', status: mode === 'success' ? 'SUCCESS' : mode === 'partial' ? 'PARTIAL_EVIDENCE' : 'INSUFFICIENT_EVIDENCE' } },
  documents: [{ id: '1', title: 'Research fixture A — भारत' }, { id: '2', title: 'Research fixture B — हिन्दी' }],
  executiveSummary: 'Saved presentation fixture only. Not legal analysis. भारत में डेटा संरक्षण।',
  differences: [{ topic: 'Instrument', documentA: 'First source', documentB: 'Second source', whyItMatters: 'Their roles differ.', citations: ['D1-C1', 'D2-C1'] }],
  citations: ['1', '2'].flatMap(id => Array.from({ length: 10 }, (_, i) => ({ id: `D${id}-C${i + 1}`, documentId: id, page: i + 1, score: 10 - i, snippet: 'Readable source excerpt. भारत में डेटा संरक्षण।\n'.repeat(90), sourceUrl: 'https://example.test/source.pdf' }))),
  limitations: [{ content: 'Illustrative QA material, not legal evidence.' }],
} });
test('PDF samples at most three excerpts per document with collapsed extraction whitespace', () => {
  const options = comparisonPdfPresentation(fixture('insufficient'));
  assert.equal(options.sources.length, 6);
  assert.ok(options.sources.every(source => source.content.length < 610 && !source.content.includes('\n')));
  assert.doesNotMatch(options.reportText, /\[object Object\]|"citations"/);
  assert.equal((options.reportText.match(/Insufficient evidence in the selected sources for:/g) || []).length, 1);
  assert.match(options.reportText, /D2-C10/);
});
test('fallback and historical outputs never claim successful AI analysis', () => {
  assert.equal(statusOf({}), 'Partial evidence comparison');
  assert.equal(statusOf({ ...fixture('success').result, generationMode: 'extractive_fallback' }), 'Partial evidence comparison');
});
for (const mode of ['success', 'partial', 'insufficient']) test(`${mode} PDF is valid, bounded and Unicode-readable`, async () => {
  const pdf = await createComparisonPdf(fixture(mode));
  const parsed = await require('pdf-parse')(new Uint8Array(pdf));
  assert.ok(parsed.numpages >= 2 && parsed.numpages <= 5, `${parsed.numpages} pages`);
  assert.match(parsed.text, /भारत/);
  assert.doesNotMatch(parsed.text, /\[object Object\]|Validated comparative analysis/);
});
