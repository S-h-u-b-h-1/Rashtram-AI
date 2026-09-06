const { createHash } = require('node:crypto');
const { buildAmendmentComparison, assessAmendmentSufficiency } = require('./amendmentLineage');
const { assessEvidenceSufficiency, verifyStructuredComparison } = require('../retrieval/evidenceSafetyService');
const { classifyNumericTokens } = require('../retrieval/numericClaims');

const VERSION = 'comparison-findings-v2';
const EMPTY = 'Rashtram could not identify a sufficiently supported direct comparison between these documents.';
const clean = value => String(value || '').replace(/\s+/gu, ' ').trim();
const fingerprint = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
// Exact textual proposition matching after masking only dimensioned values.
// Subject, negation, modal verb, units and provision identifiers must remain
// identical; sharing a topic or a heading alone is never a finding.
const propositionKey = text => {
  let result = clean(text).toLowerCase();
  const tokens = classifyNumericTokens(result).filter(t => t.dimension && !['YEAR', 'DATE'].includes(t.type));
  for (const t of tokens.reverse()) result = result.slice(0, t.start) + `{${t.dimension}}` + result.slice(t.end);
  return result;
};
const sentences = citation => clean(citation.content || citation.snippet).split(/(?<=;)\s+|(?<=\.)\s+(?=[A-Z(])/u)
  .filter(s => s.length >= 60 && s.length <= 1500 && /\b(shall|must|required|means)\b/i.test(s));
const findingTitle = text => {
  const definition = text.match(/[“"]([^”"]{2,70})[”"]\s+means/);
  if (definition) return `Definition: ${definition[1]}`;
  const heading = text.replace(/^\([a-z0-9]+\)\s*/i, '').split(/\s+/).slice(0, 10).join(' ');
  return heading.length < text.length ? `${heading}…` : heading;
};
const source = (citation, excerpt, section) => ({ documentId: String(citation.documentId), section: section || citation.section || citation.heading || null,
  excerpt, citationIds: [citation.id || citation.citationId] });
const operationLabel = operation => ({ MODIFY: 'modification', SUBSTITUTE: 'substitution', ADD: 'addition', INSERT: 'insertion', DELETE: 'deletion', REPEAL: 'repeal', RENUMBER: 'renumbering' })[operation] || 'a change';

// Presentation grouping never manufactures a broader proposition. All members
// remain available as exact source pairs, including those outside the first page.
const consolidateFindings = candidates => {
  const groups = new Map();
  const identity = f => fingerprint([f.relationshipContext, f.findingType,
    [f.sourceA, f.sourceB].map(s => [s.documentId, propositionKey(s.excerpt), clean(s.excerpt)]).sort()]);
  const unique = [...new Map(candidates.map(f => [identity(f), f])).values()];
  for (const f of unique) {
    const sections = [f.sourceA, f.sourceB].map(s => clean(s.section));
    // Only explicit provision identifiers justify grouping different sentences.
    // Broad chapter headings and inferred topical resemblance are insufficient.
    const provision = sections.every(s => /^(?:(?:section|clause|provision)\s+)?\d+[A-Za-z]?(?:\.[\dA-Za-z]+)*(?:\([\da-z]+\))*$/i.test(s));
    const key = provision ? JSON.stringify([f.relationshipContext, f.findingType,
      f.sourceA.documentId, f.sourceB.documentId, sections]) : identity(f);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(f);
  }
  const findings = [...groups.values()].map(members => {
    members.sort((a, b) => (b.confidenceState === 'VERIFIED') - (a.confidenceState === 'VERIFIED') ||
      (b.sourceA.excerpt.length + b.sourceB.excerpt.length) - (a.sourceA.excerpt.length + a.sourceB.excerpt.length) || a.id.localeCompare(b.id));
    return { ...members[0], supportingFindings: members.slice(1) };
  });
  findings.sort((a, b) => (b.findingType !== 'SIMILARITY') - (a.findingType !== 'SIMILARITY') ||
    (b.confidenceState === 'VERIFIED') - (a.confidenceState === 'VERIFIED') || a.id.localeCompare(b.id));
  return { findings, duplicateCount: candidates.length - unique.length,
    consolidatedCount: unique.length - findings.length };
};

// A finding is admissible only when both exact excerpts can be located in the
// saved evidence and every citation belongs to its declared selected document.
const validateFinding = (finding, evidence, documentIds) => {
  if (!['VERIFIED', 'SUPPORTED_LIMITED'].includes(finding.confidenceState)) return false;
  if (finding.confidenceState === 'SUPPORTED_LIMITED' && !finding.limitations?.length) return false;
  if (!finding.verifiedComparison || finding.sourceA?.documentId === finding.sourceB?.documentId) return false;
  return [finding.sourceA, finding.sourceB].every(side => side && documentIds.map(String).includes(String(side.documentId)) &&
    clean(side.excerpt).length >= 20 && side.citationIds?.length && side.citationIds.every(id => evidence.some(c =>
      (c.id || c.citationId) === id && String(c.documentId) === String(side.documentId) &&
      clean(c.content || c.snippet).includes(clean(side.excerpt)))));
};

const buildFindingsV2 = async ({ documents, evidence, explain, previous, relationships = [] }) => {
  const ids = documents.map(d => String(d.id));
  const evidenceHash = fingerprint([evidence.map(c => [String(c.documentId), c.chunkIndex, clean(c.content || c.snippet)]).sort(), relationships]);
  let findings = [], relationship = 'NO_VERIFIED_RELATIONSHIP', omitted = 0;
  const permittedRelationships = new Set(['BILL_TO_ACT', 'RULE_UNDER_ACT', 'CIRCULAR_UNDER_PARENT', 'SUPERSEDES', 'RELATED_POLICY', 'RELATED_SUBJECT']);
  const verifiedRelationship = documents.length === 2 ? relationships.find(r => r.isVerified === true &&
    permittedRelationships.has(r.type) && ids.includes(String(r.sourceDocumentId)) && ids.includes(String(r.targetDocumentId)) &&
    String(r.sourceDocumentId) !== String(r.targetDocumentId)) : null;
  // Default regeneration reuses the factual layer. Re-evaluate only if the
  // retrieved evidence changed; never reuse a fact whose excerpts disappeared.
  if (previous?.comparisonSchemaVersion === VERSION && previous.evidenceHash === evidenceHash &&
      [...previous.findings, ...(previous.additionalFindings || [])].every(f =>
        [f, ...(f.supportingFindings || [])].every(member => validateFinding(member, evidence, ids)))) {
    findings = structuredClone([...previous.findings, ...(previous.additionalFindings || [])])
      .flatMap(f => [f, ...(f.supportingFindings || [])]).map(({ supportingFindings, ...f }) => ({ ...f, significance: '' }));
    relationship = previous.relationship;
    omitted = previous.omittedFindingCount || 0;
  } else {
    const scopedSufficiency = assessAmendmentSufficiency(documents, evidence, assessEvidenceSufficiency);
    const amendment = await buildAmendmentComparison({ documents, evidence, verify: verifyStructuredComparison, scopedSufficiency });
    if (amendment?.lineage) {
      relationship = amendment.lineage.relationshipType;
      omitted = amendment.amendmentVerification?.rejected?.length || 0;
      findings = (amendment.whatChanged || []).map(item => {
        const change = item.change;
        const before = evidence.find(c => (c.id || c.citationId) === change.evidenceBefore);
        const after = evidence.find(c => (c.id || c.citationId) === change.evidenceAfter);
        if (!before || !after) return null;
        return { id: fingerprint([before.documentId, after.documentId, change.section, change.before, change.after]).slice(0, 20),
          title: `Provision ${change.section}`, subject: change.section, relationshipContext: relationship,
          sourceA: source(before, change.before, change.section), sourceB: source(after, change.after, change.section),
          findingType: change.operation, verifiedComparison: `The modifying instrument specifies ${operationLabel(change.operation)} of provision ${change.section}${change.proviso ? ' (proviso)' : ''}. The before text and the modifying instruction are shown with their source references.`, significance: '',
          confidenceState: 'VERIFIED', limitations: change.limitations || [] };
      }).filter(Boolean);
    }
    // Non-lineage discovery is deliberately conservative. A shared exact
    // provision is a supported similarity, not proof of legal succession.
    // Wider semantic/analytical matches require a separate entailment gate.
    if (!amendment?.lineage) {
      for (let a = 0; a < documents.length; a++) for (let b = a + 1; b < documents.length; b++) {
        const left = evidence.filter(c => String(c.documentId) === ids[a]);
        const right = evidence.filter(c => String(c.documentId) === ids[b]);
        for (const l of left) {
          for (const text of sentences(l)) {
            if (new Set(left.flatMap(c => sentences(c)).filter(s => propositionKey(s) === propositionKey(text))).size !== 1) continue;
            const matches = right.flatMap(c => sentences(c).filter(s => propositionKey(s) === propositionKey(text)).map(s => ({ c, s })));
            if (!matches.length || new Set(matches.map(m => clean(m.s))).size !== 1) continue;
            const { c: r, s: other } = matches[0];
            const same = text === other;
            findings.push({ id: fingerprint([ids[a], ids[b], text, other]).slice(0, 20), title: findingTitle(text), subject: l.section || l.heading || 'Provision',
              relationshipContext: 'NO_VERIFIED_RELATIONSHIP', sourceA: source(l, text), sourceB: source(r, other),
              findingType: same ? 'SIMILARITY' : 'DIFFERENCE', verifiedComparison: same
                ? 'The cited provisions use the same wording. This does not establish legal lineage or identical current applicability.'
                : 'The cited provisions state different values for the same textual requirement. Compare the values below in their respective document contexts; no amendment relationship is implied.',
              significance: '', confidenceState: 'SUPPORTED_LIMITED', limitations: ['Only the cited provisions were matched; the full instruments and their applicability may differ.'] });
          }
        }
      }
    }
  }
  findings = [...new Map(findings.filter(f => validateFinding(f, evidence, ids)).map(f => [f.id, f])).values()];
  if (relationship === 'NO_VERIFIED_RELATIONSHIP' && verifiedRelationship) {
    relationship = verifiedRelationship.type;
    findings = findings.map(f => {
      let sourceA = f.sourceA, sourceB = f.sourceB;
      const a = documents.find(d => String(d.id) === sourceA.documentId);
      const b = documents.find(d => String(d.id) === sourceB.documentId);
      if ((relationship === 'BILL_TO_ACT' && a?.type !== 'bill' && b?.type === 'bill') ||
          (['RULE_UNDER_ACT', 'CIRCULAR_UNDER_PARENT'].includes(relationship) && a?.type !== 'act' && b?.type === 'act')) [sourceA, sourceB] = [sourceB, sourceA];
      return { ...f, sourceA, sourceB, relationshipContext: relationship };
    });
  }
  const consolidation = consolidateFindings(findings);
  findings = consolidation.findings.slice(0, 12);
  const additionalFindings = consolidation.findings.slice(12);
  const frozen = structuredClone([...findings, ...additionalFindings]);
  const explanationStatus = { attempted: false, accepted: 0 };
  if (findings.length && explain) {
    explanationStatus.attempted = true;
    try {
      // Keep interactive generation bounded. Remaining findings remain visible
      // as verified text without an invented significance paragraph.
      const analysis = await explain(frozen.slice(0, 12).map(f => ({ id: f.id, relationship: f.relationshipContext,
        section: f.subject, operation: f.findingType, before: f.sourceA.excerpt, after: f.sourceB.excerpt,
        citations: [...f.sourceA.citationIds, ...f.sourceB.citationIds] })));
      for (const f of findings) {
        const item = analysis?.find(a => a.id === f.id);
        if (typeof item?.text !== 'string' || !/\b(may|could|might)\b/i.test(item.text) || /\b(currently|latest|now in force|not present|does not contain)\b/i.test(item.text)) continue;
        // A missing phrase in a replacement is not proof that an obligation
        // disappeared elsewhere in the instrument. Keep that inference out.
        if (/\b(remove|abolish|eliminate|no longer)\b/i.test(item.text) && !['DELETE', 'REPEAL'].includes(f.findingType)) continue;
        const verified = verifyStructuredComparison({ practicalImplications: [{ point: `Analysis: ${item.text}`, citations: [...f.sourceA.citationIds, ...f.sourceB.citationIds] }] }, evidence);
        f.significance = verified.generated.practicalImplications?.[0]?.point || '';
        if (f.significance) explanationStatus.accepted++;
      }
    } catch (error) {
      explanationStatus.unavailable = true;
      explanationStatus.failureClass = /timeout|timed out|deadline/i.test(String(error.message)) ? 'timeout' : 'provider_or_format_failure';
    }
  }
  const limitations = [...new Set(findings.flatMap(f => f.limitations))];
  if (omitted) limitations.push(`${omitted} additional provision${omitted === 1 ? ' was' : 's were'} omitted because the available text did not support reliable comparison.`);
  limitations.push('This report compares the cited text; it does not verify current legal applicability.');
  return { comparisonSchemaVersion: VERSION, findings, additionalFindings, relationship, evidenceHash,
    presentation: { visibleLimit: 12, additionalFindingCount: additionalFindings.length,
      duplicateCount: consolidation.duplicateCount, consolidatedCount: consolidation.consolidatedCount },
    structure: documents.map(d => ({ documentId: String(d.id), title: d.title, documentType: d.type,
      publisher: d.authority || d.ministry || null, date: d.publicationDate || null,
      provisions: evidence.filter(c => String(c.documentId) === String(d.id)).map(c => ({
        citationId: c.id || c.citationId, section: c.section || c.heading || null,
        pageStart: c.pageStart || null, pageEnd: c.pageEnd || null,
      })) })),
    relationshipEvidence: verifiedRelationship || null,
    factualFingerprint: fingerprint(frozen.map(({ significance, ...f }) => f)), omittedFindingCount: omitted,
    executiveSummary: findings.length ? `${documents.map(d => d.title).join(' and ')}: ${findings.length} supported finding${findings.length === 1 ? '' : 's'}. The findings cover ${findings.slice(0, 3).map(f => f.title).join('; ')}${findings.length > 3 ? ', among other cited provisions' : ''}. Each finding below shows the text from both sources. ${relationship === 'NO_VERIFIED_RELATIONSHIP' ? 'No legal lineage has been established between these documents. ' : ''}${omitted ? `${omitted} unresolved provision(s) have been withheld. ` : ''}This is a comparison of the selected text, not a statement of current law.` : EMPTY,
    keyTakeaways: [], limitations, explanationStatus, generationMode: findings.length ? 'verified_findings' : 'evidence_abstention',
    documents, citations: evidence, quality: { outputValidation: { valid: true, status: findings.length ? omitted ? 'PARTIAL_EVIDENCE' : 'SUCCESS' : 'INSUFFICIENT_EVIDENCE' } } };
};
module.exports = { VERSION, EMPTY, validateFinding, buildFindingsV2, propositionKey };
