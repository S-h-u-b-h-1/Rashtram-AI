const assert = require("node:assert/strict");
const test = require("node:test");
const {
  INSUFFICIENT, assembleResearchReport, generateResearchReport, reportAsMarkdown,
} = require("../product/researchReportService");

const input = { title: "Licensing report", researchQuestion: "What licensing duties apply?", documentIds: ["1"] };
const document = { id: 1, title: "Official Rules", documentType: "rule",
  authority: "State Board", sourceUrl: "https://gov.example/rules" };

test("report sections without verified evidence state insufficiency explicitly", () => {
  const report = assembleResearchReport({ input, runs: [{ document, passages: [],
    sufficiency: { level: "INSUFFICIENT", reasons: ["No passage"] } }] });
  assert.equal(report.sections.executiveSummary, INSUFFICIENT);
  assert.equal(report.sections.keyProvisions, INSUFFICIENT);
  assert.equal(report.sections.timeline, INSUFFICIENT);
  assert.equal(report.verificationStatus, "insufficient_evidence");
});

test("verified report preserves citation and source identity through persistence", async () => {
  let persisted;
  const result = await generateResearchReport(9, input, {
    loadDocument: async () => document,
    retrieve: async () => ({ retrievalVerified: true, passages: [{
      content: "The operator must obtain a licence from the State Board.",
      documentId: "1", sourceUrl: document.sourceUrl, pageStart: 4,
      sectionId: "7", authorityClass: "PRIMARY_OFFICIAL", ftsScore: 1,
    }] }),
    persist: async (_sql, values) => { persisted = values; return { rows: [{ id: 3, created_at: "now" }] }; },
  });
  assert.equal(result.verificationStatus, "verified_evidence");
  assert.equal(result.evidence[0].id, "R-D1-C1");
  assert.equal(result.evidence[0].sourceUrl, document.sourceUrl);
  assert.match(persisted[5], /R-D1-C1/);
  assert.match(reportAsMarkdown(result), /Key Provisions/);
});

test("multi-document comparison does not invent a difference", () => {
  const run = (id) => ({ document: { ...document, id, title: `Rules ${id}` },
    passages: [{ content: "The operator may apply.", sourceUrl: `https://gov/${id}` }],
    sufficiency: { level: "LOW", reasons: [] } });
  const report = assembleResearchReport({ input: { ...input, documentIds: ["1", "2"] },
    runs: [run(1), run(2)] });
  assert.match(report.sections.comparison.note, /No difference is inferred/);
});
