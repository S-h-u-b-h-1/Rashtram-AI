const assert = require("node:assert/strict");
const test = require("node:test");

const {
  chunkStructuredHtml,
  extractStructuredHtml,
} = require("../document/htmlResourceService");
const {
  isExtractableSourceDocument,
  pineconeSafeHtmlMetadata,
} = require("../document/documentResearchService");
const {
  SOURCE_AUTHORITY,
  classifySourceAuthority,
} = require("../retrieval/sourceAuthority");
const { reciprocalRankFusion } = require("../retrieval/rankFusion");
const { citationSupportsClaim } = require("../retrieval/evidenceSafetyService");
const { buildComparisonCitation } = require("../document/documentComparisonService");

const page = (body, noise = "") => `<!doctype html><html><head><title>Policy page</title></head><body>
  <nav>${noise || "Home About Subscribe Contact"}</nav>
  <article>${body}</article>
  <footer>${noise || "Privacy Terms Newsletter"}</footer>
</body></html>`;

test("PolicyEdge HTML preserves sections, lists, tables, real anchors, and no fake pages", () => {
  const extracted = extractStructuredHtml({
    url: "https://www.policyedge.in/p/sample-policy",
    html: page(`
      <h1 id="overview">National Clean Transport Policy</h1>
      <p>The policy establishes accountable implementation duties for public authorities and regulated operators.</p>
      <h2 id="eligibility">Eligibility criteria</h2>
      <ul><li>Registered operators may apply.</li><li>Annual compliance reporting is mandatory.</li></ul>
      <table><caption>Implementation schedule</caption><thead><tr><th>Stage</th><th>Deadline</th></tr></thead>
      <tbody><tr><td>Registration</td><td>30 June 2027</td></tr></tbody></table>`),
  });
  assert.equal(extracted.quality.valid, true);
  assert.equal(extracted.pageCount, null);
  assert.equal(extracted.quality.tableRowCount, 1);
  const chunks = chunkStructuredHtml(extracted, { chunkSize: 700 });
  assert.ok(chunks.some((chunk) => chunk.metadata.sectionPath.includes("Eligibility criteria")));
  assert.ok(chunks.some((chunk) => chunk.metadata.tableContext?.headers.includes("Deadline")));
  assert.ok(chunks.some((chunk) => chunk.metadata.sourceAnchor === "eligibility"));
  assert.ok(chunks.every((chunk) => chunk.metadata.pageStart === null));
  assert.ok(chunks.every((chunk) => !/#undefined|#section-/i.test(chunk.metadata.sourceUrl || "")));
});

test("PolicyEdge clean hashes ignore boilerplate changes but detect evidence changes", () => {
  const body = `<h1>Implementation</h1><p>The authority shall publish quarterly implementation reports and consult affected institutions.</p>`;
  const first = extractStructuredHtml({ html: page(body, "Home Subscribe v1"), url: "https://www.policyedge.in/p/hash-test" });
  const boilerplateChanged = extractStructuredHtml({ html: page(body, "Home Subscribe v2 Advertising"), url: "https://www.policyedge.in/p/hash-test" });
  const evidenceChanged = extractStructuredHtml({
    html: page(`<h1>Implementation</h1><p>The authority shall publish monthly implementation reports and consult affected institutions.</p>`, "Home Subscribe v2"),
    url: "https://www.policyedge.in/p/hash-test",
  });
  assert.notEqual(first.rawHtmlHash, boilerplateChanged.rawHtmlHash);
  assert.equal(first.cleanContentHash, boilerplateChanged.cleanContentHash);
  assert.notEqual(first.cleanContentHash, evidenceChanged.cleanContentHash);
});

test("dynamic shells and access pages are rejected instead of becoming evidence", () => {
  const dynamic = extractStructuredHtml({ html: "<html><body><main>Loading...</main></body></html>", url: "https://www.policyedge.in/p/loading" });
  const denied = extractStructuredHtml({ html: "<html><body><main><h1>Access denied</h1><p>Sign in to continue.</p></main></body></html>", url: "https://www.policyedge.in/p/denied" });
  assert.equal(dynamic.quality.valid, false);
  assert.ok(dynamic.quality.reasons.includes("dynamic_shell") || dynamic.quality.reasons.includes("no_meaningful_blocks"));
  assert.equal(denied.quality.valid, false);
  assert.equal(denied.quality.errorPatternDetected, true);
});

test("current and legacy PolicyEdge records are routed through the shared policy retrieval family", () => {
  for (const sourceName of ["policy-edge", "PolicyEdge"]) {
    assert.equal(isExtractableSourceDocument({
      type: "report",
      sourceName,
      sourceUrl: "https://www.policyedge.in/p/sample-policy",
      metadata: {},
    }), true);
  }
});

test("PolicyEdge parse quality does not promote it to primary authority", () => {
  assert.equal(classifySourceAuthority({ sourceUrl: "https://www.policyedge.in/p/sample" }), SOURCE_AUTHORITY.RESEARCH);
  const ranked = reciprocalRankFusion([[
    { documentId: "policyedge", chunkIndex: 0, content: "directly relevant tax filing duty", score: 0.95, sourceUrl: "https://www.policyedge.in/p/tax" },
    { documentId: "official", chunkIndex: 0, content: "unrelated official material", score: 0.05, sourceUrl: "https://example.gov.in/notice" },
  ]], { limit: 2 });
  assert.equal(ranked[0].documentId, "policyedge");
  assert.equal(ranked[0].authorityClass, SOURCE_AUTHORITY.RESEARCH);
});

test("HTML evidence participates in the same citation safety check", () => {
  const evidence = [{
    citationId: "D1-C1",
    content: "The authority shall publish quarterly implementation reports.",
    resourceType: "html",
    sourceUrl: "https://www.policyedge.in/p/sample#implementation",
  }];
  assert.equal(citationSupportsClaim(
    "The authority shall publish quarterly implementation reports [D1-C1].",
    evidence[0],
  ).supported, true);
});

test("HTML table structure is flattened at the Pinecone boundary", () => {
  const metadata = pineconeSafeHtmlMetadata({
    resourceType: "html",
    sectionPath: ["Implementation"],
    tableContext: { caption: "Schedule", headers: ["Stage", "Deadline"], rowIndex: 2, cells: ["Registration", "June"] },
  }, "Grounded summary");
  assert.equal(metadata.tableContext, undefined);
  assert.equal(metadata.tableCaption, "Schedule");
  assert.deepEqual(metadata.tableHeaders, ["Stage", "Deadline"]);
  assert.ok(Object.values(metadata).every((value) =>
    value == null || ["string", "number", "boolean"].includes(typeof value) ||
    (Array.isArray(value) && value.every((item) => typeof item === "string"))));
});

test("mixed HTML and PDF comparison citations preserve each resource identity", () => {
  const html = buildComparisonCitation({
    label: "D1-C1",
    document: { id: "html-1", type: "report", title: "PolicyEdge report", sourceUrl: "https://www.policyedge.in/p/sample" },
    passage: { chunkIndex: 0, content: "Implementation evidence", resourceType: "html", sourceAnchor: "implementation", sourceUrl: "https://www.policyedge.in/p/sample#implementation", sectionPath: ["Implementation"], pdfUrl: "https://wrong.example/file.pdf" },
  });
  const pdf = buildComparisonCitation({
    label: "D2-C1",
    document: { id: "pdf-1", type: "act", title: "Official Act", pdfUrl: "https://example.gov.in/act.pdf" },
    passage: { chunkIndex: 0, content: "Section evidence", resourceType: "pdf", pageStart: 4 },
  });
  assert.equal(html.pdfUrl, null);
  assert.equal(html.page, null);
  assert.equal(html.anchor, "implementation");
  assert.equal(pdf.pdfUrl, "https://example.gov.in/act.pdf");
  assert.equal(pdf.page, 4);
  assert.notEqual(html.documentId, pdf.documentId);
});
