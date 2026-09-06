const test = require('node:test'), assert = require('node:assert/strict');
const { buildPolicyDraftDocx } = require('../policy/policyDraftDocxService');
const { standardTemplate, extractTemplate, applyTemplate } = require('../policy/policyTemplateV2');
const { policyDraftMarkdownToCanonical } = require('../policy/policyDraftService');
for (const mode of ['standard', 'user']) test(`V2 ${mode} template DOCX exports canonical order`, async () => {
  const template = mode === 'standard' ? standardTemplate() : extractTemplate({title:'Reference',content:'## Purpose\n### Scope\n## Review'});
  const draft = applyTemplate(policyDraftMarkdownToCanonical('# Proposal\n## Executive Summary\nA proposed policy.\n## Purpose\nImprove services.\n### Scope\nA pilot.\n## Review\nAnnual evaluation.'), template);
  const buffer = await buildPolicyDraftDocx({draft,brief:{template}});
  assert.ok(Buffer.isBuffer(buffer)); assert.equal(buffer.readUInt16LE(0), 0x4b50);
  assert.deepEqual(draft.sections.map(s=>s.heading), template.sections.filter(s=>!s.optional).map(s=>s.heading));
});
