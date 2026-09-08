// Saved-result presentation only. No retrieval, generation, or validation changes.
const { createResearchBriefPdf } = require('./reportPdfService');

const text = value => {
  if (value == null) return '';
  if (typeof value !== 'object') return String(value);
  if (Array.isArray(value)) return value.map(text).filter(Boolean).join('; ');
  return ['topic', 'dimension', 'term', 'date', 'name', 'point', 'event', 'analysis', 'impact', 'finding', 'description', 'content', 'significance', 'whyItMatters', 'synthesis', 'documentA', 'documentB'].map(key => value[key] ? `${['documentA', 'documentB'].includes(key) ? key === 'documentA' ? 'Document A: ' : 'Document B: ' : ''}${text(value[key])}` : '').filter(Boolean).join(' - ');
};
const statusOf = (result = {}) => {
  const validation = result.quality?.outputValidation;
  if (result.generationMode === 'evidence_abstention' || validation?.status === 'INSUFFICIENT_EVIDENCE') return 'Insufficient evidence';
  if (validation?.valid === true && validation.status === 'SUCCESS' && result.generationMode !== 'extractive_fallback' && result.comparisonSchemaVersion === 'comparison-quality-v3') return 'AI comparative analysis';
  return 'Partial evidence comparison';
};
const fields = [
  ['differences', 'Key Differences'], ['whatChanged', 'What Changed'], ['practicalImplications', 'Practical Implications', 'impactAssessment'],
  ['purpose', 'Purpose'], ['scope', 'Scope'], ['applicability', 'Applicability'], ['keyProvisions', 'Key Provisions', 'keyClauses'], ['similarities', 'Major Similarities'], ['obligations', 'Obligations / Requirements', 'complianceImpact'], ['rights', 'Rights / Protections'], ['definitions', 'Definitions'], ['legalEffect', 'Authority / Legal Effect', 'authorityDifferences'], ['timeline', 'Dates / Timeline'], ['stakeholderImpact', 'Stakeholder Impact', 'stakeholders'], ['keyTakeaways', 'Key Takeaways', 'keyFindings'],
];
const excerpt = value => {
  const normalized = text(value).replace(/\s+/gu, ' ').trim();
  if (normalized.length <= 550) return normalized;
  return `${normalized.slice(0, 550).replace(/\s+\S*$/, '')}… [Excerpt; full passage in app.]`;
};
const comparisonPdfPresentation = comparison => {
  const result = comparison.result || {};
  if (result.comparisonSchemaVersion === 'comparison-findings-v2') {
    const allFindings = result.findings || [];
    const lines = ['## Documents Compared', ...(result.documents || []).map(d =>
      [d.title, d.type, d.authority || d.ministry, d.publicationDate || d.year].filter(Boolean).join(' · ')),
      ...(result.relationship && result.relationship !== 'NO_VERIFIED_RELATIONSHIP' ? [`Relationship: ${result.relationship.replaceAll('_', ' ')}`] : []),
      '## Executive Summary', result.executiveSummary];
    for (const f of allFindings) {
      if (!['VERIFIED', 'SUPPORTED_LIMITED'].includes(f.confidenceState)) continue;
      const amendment = ['AMENDS', 'ADDENDUM_TO'].includes(f.relationshipContext);
      lines.push(`## ${f.title}`, `### ${amendment ? 'Before' : 'Document A'}`, excerpt(f.sourceA.excerpt),
        `[${f.sourceA.citationIds.join(', ')}]`, `### ${amendment ? 'After' : 'Document B'}`, excerpt(f.sourceB.excerpt),
        `[${f.sourceB.citationIds.join(', ')}]`, '### Comparison', f.verifiedComparison);
      if (f.significance) lines.push('### Why it matters', f.significance);
      for (const member of f.supportingFindings || []) lines.push('### Supporting evidence',
        member.sourceA.excerpt, `[${member.sourceA.citationIds.join(', ')}]`,
        member.sourceB.excerpt, `[${member.sourceB.citationIds.join(', ')}]`, member.verifiedComparison);
    }
    if (result.additionalFindings?.length) lines.push('## Additional findings',
      'Additional evidence was identified but omitted from the primary report for readability.');
    lines.push('## Limitations', ...(result.limitations || []), '## Sources');
    const used = new Set(allFindings.flatMap(f => [f, ...(f.supportingFindings || [])])
      .flatMap(f => [...f.sourceA.citationIds, ...f.sourceB.citationIds]));
    for (const c of result.citations || []) if (used.has(c.id || c.citationId)) lines.push(
      `[${c.id || c.citationId}] ${c.documentTitle || c.title || 'Source'}${c.pageStart ? ` — page ${c.pageStart}` : ''}`,
      c.canonicalSourceUrl || c.sourceUrl || c.pdfUrl || 'Source URL unavailable.');
    return { title: comparison.title || 'Compare Documents', documentType: 'Supported comparison findings', reportText: lines.join('\n\n'),
      sources: [], completeEvidence: true, sourcesOnNewPage: false, generatedAt: comparison.createdAt || new Date() };
  }
  const status = statusOf(result);
  if (['AMENDMENT_COMPARISON','ADDENDUM_COMPARISON'].includes(result.comparisonKind) && result.lineage && result.quality?.outputValidation?.valid && result.whatChanged?.length) {
    const facts=result.whatChanged;
    const lines=['## Amendment relationship',
      `${result.lineage.modifyingDocumentReference.title} — ${result.lineage.relationshipType} — ${result.lineage.baseDocumentReference.title}`,
      `Evidence status: ${result.quality.outputValidation.status}`,
      '## Executive Summary',
      `${facts.length} source-verified changes are set out below. Unresolved instructions are withheld, not inferred.`,
      ...facts.map(f=>`- Clause ${f.change.section}: ${f.change.operation}. [${f.citations.join(', ')}]`),
    ];
    for(const fact of facts){const c=fact.change;lines.push('',`## Affected section ${c.section}${c.proviso?' — proviso':''}`,
      '### Before:',c.before,`[${c.evidenceBefore}]`,'### After (modifying text):',c.after||`Explicit operation: ${c.operation}.`,`[${c.evidenceAfter}]`,
      '### What Changed',`Verified operation: ${c.operation}. The before and modifying text above establish this change. [${fact.citations.join(', ')}]`);
    }
    lines.push('','## Why it matters',...(result.practicalImplications||[]).map(i=>`${text(i)} [${i.citations.join(', ')}]`));
    if(!result.practicalImplications?.length)lines.push('No separately verified explanatory analysis is available.');
    lines.push('','## Limitations',...(result.limitations||[]).map(text),
      'This is the saved comparison, not regenerated analysis or a statement of current consolidated law.');
    const used=new Set(facts.flatMap(f=>f.citations));
    lines.push('','## Sources');
    for(const citation of result.citations||[])if(used.has(citation.id))lines.push(
      `- [${citation.id}] ${citation.documentTitle||citation.title||'Source'}; page ${citation.pageStart||citation.page||'not recorded'}${citation.pageEnd&&citation.pageEnd!==citation.pageStart?`–${citation.pageEnd}`:''}.`,
      citation.canonicalSourceUrl||citation.sourceUrl||citation.pdfUrl||'Source URL not recorded.');
    return {title:comparison.title||'Amendment comparison',documentType:status,reportText:lines.join('\n\n'),sources:[],completeEvidence:true,sourcesOnNewPage:false,generatedAt:comparison.createdAt||new Date()};
  }
  const insufficient = status === 'Insufficient evidence';
  const extractive = result.generationMode === 'extractive_fallback';
  const documents = result.documents || [];
  const citations = result.citations || [];
  const sections = fields.map(([key, title, alias]) => {
    const state = String(result.sectionStatus?.[key] || '').toLowerCase();
    const values = result[key]?.length ? result[key] : result[alias];
    const items = !extractive && !insufficient && !['not_applicable', 'insufficient_evidence'].includes(state) && Array.isArray(values) ? values.filter(item => text(item).trim()) : [];
    return { key, title, items, state };
  });
  const lines = [`## ${insufficient ? 'Requested comparison' : status === 'AI comparative analysis' ? 'Compared documents' : 'Partial Analysis'}`];
  documents.forEach((document, index) => lines.push(`- D${index + 1}: ${document.title || 'Selected document'}`));
  if (['AMENDMENT_COMPARISON','ADDENDUM_COMPARISON'].includes(result.comparisonKind) && result.lineage) {
    lines.push('', '## Amendment relationship',
      `${result.lineage.modifyingDocumentReference.title} — ${result.lineage.relationshipType} — ${result.lineage.baseDocumentReference.title}`,
      `Affected provisions: ${(result.lineage.affectedSections || []).join(', ')}. Only the verified changes below are findings; unresolved instructions remain listed in Limitations.`);
  }
  lines.push('', `## ${insufficient ? 'Why a complete analysis could not be produced' : 'Executive Summary'}`, extractive ? 'AI comparative analysis was unavailable. Retrieved excerpts below are source material, not comparative findings.' : text(result.executiveSummary) || 'Insufficient evidence in the selected sources.');
  const supported = sections.filter(section => section.items.length);
  if (status === 'Partial evidence comparison' && supported.length) lines.push('', '## Supported Findings');
  let detailedStarted = false;
  for (const section of supported) {
    if (!detailedStarted && !['differences', 'whatChanged', 'practicalImplications', 'keyTakeaways'].includes(section.key)) {
      lines.push('', '## Detailed Comparison'); detailedStarted = true;
    }
    lines.push('', `### ${result.lineage && section.key === 'practicalImplications' ? 'Why it matters' : section.title}`);
    for (const item of section.items) lines.push(`- ${text(item)}${Array.isArray(item?.citations) && item.citations.length ? ` [${item.citations.join(', ')}]` : ''}`);
  }
  const missing = sections.filter(section => !section.items.length && section.state !== 'not_applicable');
  if (missing.length) lines.push('', '## Missing Evidence', `Insufficient evidence in the selected sources for: ${missing.map(section => section.title).join('; ')}.`);
  const notApplicable = sections.filter(section => section.state === 'not_applicable');
  if (notApplicable.length) lines.push('', `Not materially applicable: ${notApplicable.map(section => section.title).join('; ')}.`);
  lines.push('', `## ${insufficient ? 'What evidence was available' : 'Available Sources'}`, `${citations.length} saved passages. A maximum of three excerpts per document is included below. Full evidence remains available in the saved in-app comparison.`);
  const sourceGroups = new Map();
  for (const citation of citations) {
    const key = String(citation.documentId || citation.documentTitle || 'unknown');
    if (!sourceGroups.has(key)) sourceGroups.set(key, []);
    sourceGroups.get(key).push(citation);
  }
  lines.push('', '## Sources');
  const sources = [];
  for (const [key, entries] of sourceGroups) {
    const docIndex = documents.findIndex(document => String(document.id) === key);
    const label = docIndex >= 0 ? `D${docIndex + 1}` : entries[0].documentTitle || 'Source';
    const first = entries[0];
    lines.push(`- ${label}: ${entries.map(citation => `${citation.id || citation.citationId}${citation.page ? ` (p. ${citation.page})` : ''}`).join(', ')}`);
    const url = first.canonicalSourceUrl || first.sourceUrl || first.pdfUrl;
    if (/^https?:\/\//i.test(url || '')) lines.push(url);
    // Stable sample: highest saved retrieval scores, never a new relevance judgment.
    const sampled = [...entries].sort((a, b) => Number(b.score || 0) - Number(a.score || 0)).slice(0, 3);
    for (const citation of sampled) sources.push({ citationId: citation.id || citation.citationId, documentTitle: label, page: citation.page ?? citation.pageStart, section: citation.heading || citation.section || citation.sectionTitle, content: excerpt(citation.snippet || citation.content) });
  }
  const limitations = (Array.isArray(result.limitations) ? result.limitations : [result.limitations]).map(text).filter(Boolean);
  lines.push('', '## Limitations', ...(limitations.length ? limitations.map(value => `- ${value}`) : ['Verify material conclusions against the original sources and their current applicability.']), 'The export is a presentation of the saved result, not a new or revalidated analysis. Excerpts are bounded; consult the in-app evidence for complete passages.');
  return { title: comparison.title || 'Document comparison', documentType: status, reportText: lines.join('\n'), sources, completeEvidence: true, sourcesOnNewPage: false, generatedAt: comparison.createdAt || new Date() };
};
const createComparisonPdf = comparison => createResearchBriefPdf(comparisonPdfPresentation(comparison));
module.exports = { comparisonPdfPresentation, createComparisonPdf, statusOf };
