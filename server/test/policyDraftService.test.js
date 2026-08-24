const test = require("node:test");
const assert = require("node:assert/strict");
const {
  generateValidatedPolicyDraft,
  groundedDraftFallback,
  parsePolicyDraftJson,
  policyDraftToMarkdown,
} = require("../policy/policyDraftService");

const validDraft = {
  title: "University Research Policy",
  executiveSummary: "A proposed evidence-led framework.",
  sections: [{
    heading: "Problem and Evidence",
    content: "The selected report identifies a research-capacity gap.",
    citations: ["Catalogue document: Research report"],
  }],
  recommendations: [{ content: "Pilot the framework before scale-up.", citations: [] }],
  implementation: [],
  risks: [],
  evidenceLimitations: [{ content: "Cost data must be validated.", citations: [] }],
};

test("canonical policy drafts render readable Markdown without implicit object coercion", () => {
  const markdown = policyDraftToMarkdown(validDraft);
  assert.match(markdown, /# University Research Policy/);
  assert.match(markdown, /Catalogue document: Research report/);
  assert.doesNotMatch(markdown, /\[object Object\]/i);
});

test("structured policy draft parser accepts fenced JSON and validates required content", () => {
  const parsed = parsePolicyDraftJson(`\`\`\`json\n${JSON.stringify(validDraft)}\n\`\`\``);
  assert.equal(parsed.title, validDraft.title);
  assert.equal(parsed.sections.length, 1);
  assert.throws(() => parsePolicyDraftJson('{"title":"Incomplete"}'), /missing/i);
});

test("malformed generation receives exactly one repair attempt", async () => {
  let repairs = 0;
  const result = await generateValidatedPolicyDraft({
    prompt: "Draft a university policy",
    context: "[Catalogue document: Research report] Evidence",
    brief: { objective: "improve university research", responseLanguage: "English" },
    title: validDraft.title,
    evidenceLabels: ["Catalogue document: Research report"],
    generate: async () => "not-json",
    repair: async () => {
      repairs += 1;
      return JSON.stringify(validDraft);
    },
  });
  assert.equal(repairs, 1);
  assert.equal(result.generationMode, "repaired");
  assert.doesNotMatch(result.markdown, /\[object Object\]/i);
});

test("provider timeout returns a usable grounded draft instead of a generic failure", async () => {
  const result = await generateValidatedPolicyDraft({
    prompt: "Draft a policy",
    context: "[Catalogue document: Source A] Evidence",
    brief: {
      objective: "reduce barriers to university research",
      audience: "universities",
      geography: "India",
      responseLanguage: "English",
    },
    title: "University policy",
    evidenceLabels: ["Catalogue document: Source A"],
    generate: async () => { throw new Error("provider timeout"); },
    repair: async () => { throw new Error("repair must not run"); },
  });
  assert.equal(result.generationMode, "grounded_fallback");
  assert.match(result.markdown, /University policy/);
  assert.match(result.markdown, /To be validated/);
  assert.doesNotMatch(result.markdown, /\[object Object\]/i);
});

test("grounded fallback labels proposals and evidence limitations", () => {
  const draft = groundedDraftFallback({
    brief: { objective: "improve public consultation" },
    evidenceLabels: ["Catalogue summary: Consultation report"],
    reason: "invalid structured response",
  });
  assert.ok(draft.recommendations.length);
  assert.ok(draft.evidenceLimitations.length);
  assert.match(policyDraftToMarkdown(draft), /not assert.*existing law/i);
});
