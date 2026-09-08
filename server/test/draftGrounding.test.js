const test = require('node:test');
const assert = require('node:assert/strict');
const { validateDraftGrounding } = require('../policy/draftGrounding');
const evidence = '[Catalogue document: Bill] Passage 1\nSection 9(4) exempts specified classes from the children’s-data obligations.\n\n[Catalogue document: Bill] Passage 2\nSection 8 requires safeguards.';
test('drafting withholds a wrong reference even when its number exists elsewhere', () => {
  const r = validateDraftGrounding('Section 8 exempts specified classes from the children’s-data obligations. [Catalogue document: Bill]', evidence);
  assert.equal(r.withheld.length, 1); assert.equal(r.markdown, '');
});
test('drafting retains an exact source-grounded reference', () => {
  const line = 'Section 9(4) exempts specified classes from the children’s-data obligations. [Catalogue document: Bill]';
  assert.equal(validateDraftGrounding(line, evidence).markdown, line);
});
test('source mapping and summaries cannot validate unsupported references', () => {
  assert.equal(validateDraftGrounding('Section 8 requires safeguards. [Catalogue document: Other]', evidence).withheld.length, 1);
  assert.equal(validateDraftGrounding('Section 8 requires safeguards. [Catalogue document: Bill]', '[Catalogue summary: Bill] Section 8 requires safeguards.').withheld.length, 1);
});
test('thresholds dates money percentages and spelled-out quantities require support', () => {
  for (const claim of ['The deadline is 1 January 2027.', 'A 25% rate applies.', 'The fine is INR 5000.', 'The limit is thirty days.', 'Article eight requires consent.', 'Rule 7 requires consent.']) {
    assert.equal(validateDraftGrounding(`${claim} [Catalogue document: Bill]`, evidence).withheld.length, 1, claim);
  }
});
test('template-only references cannot ground claims and proposal targets remain labelled', () => {
  assert.equal(validateDraftGrounding('Section 77 requires reporting. [User source: Template]', evidence).withheld.length, 1);
  const line = 'Proposal: Pilot training for 30 days.';
  assert.equal(validateDraftGrounding(line, evidence).markdown, line);
  assert.equal(validateDraftGrounding('Proposal: Section 77 requires reporting.', evidence).withheld.length, 1);
});
