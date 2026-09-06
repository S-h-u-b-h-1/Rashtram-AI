// Presentation only: never upgrades the saved backend validation result.
export const comparisonStatus = (result = {}) => {
  const validation = result.quality?.outputValidation;
  if (result.generationMode === 'evidence_abstention' || validation?.status === 'INSUFFICIENT_EVIDENCE') return { key: 'insufficient', label: 'Insufficient evidence' };
  if (validation?.valid === true && validation.status === 'SUCCESS' && result.generationMode !== 'extractive_fallback' && result.comparisonSchemaVersion === 'comparison-quality-v3') return { key: 'success', label: 'AI comparative analysis' };
  return { key: 'partial', label: 'Partial evidence comparison' };
};

export const displayText = (value) => {
  if (value == null) return '';
  if (typeof value === 'string' || typeof value === 'number') return String(value);
  if (Array.isArray(value)) return value.map(displayText).filter(Boolean).join('; ');
  return ['topic', 'dimension', 'term', 'date', 'name', 'clause', 'point', 'event', 'analysis', 'impact', 'finding', 'description', 'content', 'significance', 'whyItMatters', 'synthesis', 'value', 'focus', 'documentA', 'documentB'].map(key => displayText(value[key])).filter(Boolean).join(' — ');
};
export const SECTION_CONFIG = [
  ['differences', 'Key differences'], ['whatChanged', 'What changed'], ['practicalImplications', 'Practical implications', 'impactAssessment'],
  ['purpose', 'Purpose / objective'], ['scope', 'Scope'], ['applicability', 'Applicability'],
  ['keyProvisions', 'Key provisions', 'keyClauses'], ['similarities', 'Major similarities'],
  ['obligations', 'Obligations / requirements', 'complianceImpact'], ['rights', 'Rights / protections'],
  ['definitions', 'Definitions'], ['legalEffect', 'Authority / legal effect', 'authorityDifferences'],
  ['timeline', 'Dates / timeline'], ['stakeholderImpact', 'Stakeholder impact', 'stakeholders'],
  ['keyTakeaways', 'Key takeaways', 'keyFindings'],
];
export const comparisonSections = (result = {}) => SECTION_CONFIG.map(([key, title, alias]) => {
  const state = String(result.sectionStatus?.[key] || '').toLowerCase();
  const raw = result[key]?.length ? result[key] : result[alias];
  // Extractive fallback remains evidence, never promoted into analysis cards.
  const blocked = result.generationMode === 'extractive_fallback' || result.generationMode === 'evidence_abstention' || ['insufficient_evidence', 'not_applicable'].includes(state);
  const items = !blocked && Array.isArray(raw) ? raw.filter(item => displayText(item).trim()) : [];
  return { key, title, items, state: items.length ? 'substantive' : state === 'not_applicable' ? state : 'insufficient_evidence' };
});
export const sourceHref = (citation = {}) => {
  const url = citation.pdfUrl || citation.sourceUrl || citation.canonicalSourceUrl;
  if (!/^https?:\/\//i.test(url || '')) return null;
  return citation.pdfUrl && citation.page ? `${url.split('#')[0]}#page=${citation.page}` : url;
};
