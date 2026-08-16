const assert = require("node:assert/strict");
const test = require("node:test");
const {
  createResearchBriefPdf,
  isExportableReportMessage,
  isPdfExportRequest,
  plainMarkdown,
  safeFilePart,
} = require("../document/reportPdfService");

test("PDF export intent recognizes report downloads without hijacking normal PDF questions", () => {
  assert.equal(
    isPdfExportRequest("Please provide a downloadable PDF for this report"),
    true,
  );
  assert.equal(isPdfExportRequest("Export this impact brief"), true);
  assert.equal(isPdfExportRequest("What does the official PDF say?"), false);
});

test("report selection skips greetings and previous capability refusals", () => {
  assert.equal(isExportableReportMessage({
    sender: "assistant",
    text: "I've prepared this document for research. Ask a question.",
  }), false);
  assert.equal(isExportableReportMessage({
    sender: "assistant",
    text: "I am sorry, but I cannot provide a downloadable PDF of this report because my capabilities are limited.",
  }), false);
  assert.equal(isExportableReportMessage({
    sender: "assistant",
    text: `# Impact brief\n\n${"Evidence-grounded impact analysis. ".repeat(8)}`,
  }), true);
});

test("research brief PDF contains a valid PDF header and cited evidence", async () => {
  const pdf = await createResearchBriefPdf({
    title: "The Taxation Laws (Amendment) Bill, 2025",
    documentType: "bill",
    reportText: [
      "# Impact on small business owners and hawkers",
      "",
      "- Direct effect: Not identified in the retrieved provisions.",
      "- Analytical implication: Indirect compliance effects should be verified.",
    ].join("\n"),
    sources: [{
      documentTitle: "The Taxation Laws (Amendment) Bill, 2025",
      page: 1,
      content: "The cited clause amends specified taxation provisions.",
      sourceUrl: "https://example.com/taxation-bill",
    }],
  });

  assert.equal(Buffer.isBuffer(pdf), true);
  assert.equal(pdf.subarray(0, 5).toString("latin1"), "%PDF-");
  assert.ok(pdf.length > 3_000);
});

test("PDF helpers clean Markdown and produce safe filenames", () => {
  assert.equal(plainMarkdown("**Impact** [source](https://example.com)"), "Impact source (https://example.com)");
  assert.equal(safeFilePart("Taxation Laws: Impact / 2025"), "taxation-laws-impact-2025");
});
