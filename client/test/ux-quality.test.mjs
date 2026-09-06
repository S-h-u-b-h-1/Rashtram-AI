import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { comparisonStatus, comparisonSections, displayText, sourceHref } from '../src/lib/comparison-presentation.mjs';
import { researchAreas, recommendationReadinessLabel } from '../src/components/recommendations/recommendation-utils.mjs';
const read = name => readFileSync(new URL(`../src/${name}`, import.meta.url), 'utf8');
test('only verified current-contract success receives the AI analysis label', () => {
  assert.equal(comparisonStatus({}).key, 'partial');
  const good = { comparisonSchemaVersion: 'comparison-quality-v3', quality: { outputValidation: { valid: true, status: 'SUCCESS' } } };
  assert.equal(comparisonStatus(good).key, 'success');
  assert.equal(comparisonStatus({ ...good, generationMode: 'extractive_fallback' }).key, 'partial');
  assert.equal(comparisonStatus({ ...good, generationMode: 'evidence_abstention' }).key, 'insufficient');
});
test('missing sections are grouped, explicit not-applicable is honored, fallback cannot become analysis', () => {
  const result = { differences: [{ analysis: 'Saved finding' }], scope: [{ content: 'Should not show' }], sectionStatus: { scope: 'NOT_APPLICABLE' } };
  assert.equal(comparisonSections(result)[0].items.length, 1);
  assert.equal(comparisonSections(result).find(s => s.key === 'scope').state, 'not_applicable');
  assert.equal(comparisonSections({ ...result, generationMode: 'extractive_fallback' }).filter(s => s.items.length).length, 0);
});
test('nested saved findings render without JSON or object coercion', () => {
  assert.equal(displayText({ content: 'Finding', citations: ['C1'] }), 'Finding');
  assert.doesNotMatch(displayText({ documentA: { content: 'A' }, documentB: { content: 'B' } }), /object Object|citations/);
});
test('source links preserve page and reject unsafe schemes', () => {
  assert.equal(sourceHref({ pdfUrl: 'https://example.test/a.pdf', page: 3 }), 'https://example.test/a.pdf#page=3');
  assert.equal(sourceHref({ sourceUrl: 'javascript:alert(1)' }), null);
});
test('research areas are unique and bounded to six, not re-ranked', () => {
  assert.equal(researchAreas([{ area: 'Consent' }, { area: 'consent' }]).length, 1);
  assert.equal(researchAreas(Array.from({ length: 9 }, (_, i) => ({ area: String(i) }))).length, 6);
});
test('readiness labels distinguish ready, preparing, official-unready and supporting sources', () => {
  assert.equal(recommendationReadinessLabel({ researchReady: true }), 'Ready to research');
  assert.equal(recommendationReadinessLabel({ processingStatus: 'queued' }), 'Preparing');
  assert.match(recommendationReadinessLabel({ authorityClass: 'PRIMARY_OFFICIAL' }), /not ready yet/);
  assert.match(recommendationReadinessLabel({}), /Supporting source/);
});
test('evidence is collapsed by default and mobile differences stack', () => {
  const view = read('components/documents/ComparisonAnalysis.jsx');
  assert.match(view, /<details>\s*<summary[^>]*>Supporting evidence/);
  assert.doesNotMatch(view, /<details[^>]*\bopen[ =>]/);
  assert.match(view, /sm:grid-cols-2/); assert.match(view, /overflow-wrap:anywhere/);
});
test('comparison selection rechecks existing readiness, without upgrading from researchReady', () => {
  const card = read('components/recommendations/RecommendationCard.jsx');
  assert.match(card, /await getDocumentReadiness/);
  assert.match(card, /if \(!readiness.comparisonReady\)/);
  assert.match(card, /Check for comparison/);
});
test('unavailable controls explain themselves and report navigation requires a saved ID', () => {
  assert.match(read('components/document-chat/ChatInput.jsx'), /!canRegenerate/);
  assert.match(read('components/document-chat/StudioPanel.jsx'), /if \(!reportId\) throw/);
  assert.match(read('components/recommendations/BusinessProblemRecommender.jsx'), /suggested-compare-reason/);
});
test('home architecture and export route remain intact', () => {
  const home = read('components/workspace/NewResearch.jsx');
  assert.match(home, /Draft a policy/i); assert.match(home, /Compare documents/i);
  assert.doesNotMatch(home, /Recent Research/);
  assert.match(read('components/documents/DocumentComparison.jsx'), /downloadComparisonPdf\(comparison.id\)/);
});
