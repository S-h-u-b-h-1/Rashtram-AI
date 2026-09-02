const assert = require("node:assert/strict");
const test = require("node:test");
const JSZip = require("jszip");
const { buildPolicyDraftDocx } = require("../policy/policyDraftDocxService");

test("policy draft export is a genuine branded DOCX rendered from canonical data", async () => {
  const buffer = await buildPolicyDraftDocx({
    draft: {
      title: "University Research Integrity Policy",
      executiveSummary: "This working policy establishes a transparent research-integrity framework.",
      sections: [{ heading: "Purpose and Scope", content: "The proposed policy applies to university research teams.", citations: ["Catalogue document: Research report"] }],
      recommendations: [{ content: "Create an independent review mechanism.", citations: [] }],
      implementation: [{ content: "Use a phased implementation plan.", citations: [] }],
      risks: [{ content: "Insufficient capacity may delay delivery.", citations: [] }],
      evidenceLimitations: [{ content: "Budget estimates remain to be validated.", citations: [] }],
    },
    brief: { geography: "India", audience: "Universities" },
    citations: [{ title: "Research report", authority: "Rashtram catalogue", sourceUrl: "https://example.org/report" }],
    createdAt: "2026-09-02T00:00:00.000Z",
  });
  assert.equal(buffer.subarray(0, 2).toString("latin1"), "PK");
  const archive = await JSZip.loadAsync(buffer);
  const documentXml = await archive.file("word/document.xml").async("string");
  const headerXml = await archive.file("word/header1.xml").async("string");
  const footerXml = await archive.file("word/footer1.xml").async("string");
  assert.match(documentXml, /University Research Integrity Policy/);
  assert.match(documentXml, /References \/ Sources/);
  assert.match(documentXml, /Research report/);
  assert.doesNotMatch(documentXml, /\[object Object\]/i);
  assert.match(headerXml, /RASHTRAM AI/);
  assert.match(footerXml, /Confidential working draft/);
});
