const test = require("node:test");
const assert = require("node:assert/strict");
const {
  SOURCE_DEFINITIONS,
  extractYear,
  parseBillDetail,
  parseListingPage,
  sourceDocumentId,
} = require("../lib/prsCatalog");

const definition = (key) =>
  SOURCE_DEFINITIONS.find((item) => item.key === key);

test("parses Parliament bills with status and stable source identity", () => {
  const html = `
    <div class="view-content">
      <div class="views-row">
        <div class="views-field-title-field">
          <a href="/billtrack/example-bill-2026">The Example Bill, 2026</a>
        </div>
        <div class="views-field-field-bill-status"><span>Pending</span></div>
      </div>
    </div>
  `;

  const result = parseListingPage(
    html,
    definition("parliament-bills"),
    "https://prsindia.org/billtrack",
  );

  assert.equal(result.documents.length, 1);
  assert.equal(result.documents[0].title, "The Example Bill, 2026");
  assert.equal(result.documents[0].year, 2026);
  assert.equal(result.documents[0].status, "Pending");
  assert.equal(result.documents[0].jurisdiction, "India");
  assert.equal(
    result.documents[0].sourceDocumentId,
    sourceDocumentId("https://prsindia.org/billtrack/example-bill-2026"),
  );
});

test("parses direct state Act PDFs, jurisdiction, and next page", () => {
  const html = `
    <div class="view-content">
      <div class="views-row">
        <div class="views-field-title-field">
          <a href="/files/acts_states/goa/1950/example.pdf"
             title="The Example Act, 1950">The Example Act, 1950</a>
        </div>
        <div class="views-field-field-bill-status"><span>Goa</span></div>
      </div>
    </div>
    <ul><li class="next"><a href="/acts/states?page=2&per-page=50">Next</a></li></ul>
  `;

  const result = parseListingPage(
    html,
    definition("state-acts"),
    "https://prsindia.org/acts/states?page=1&per-page=50",
  );

  assert.equal(result.documents.length, 1);
  assert.equal(result.documents[0].jurisdiction, "Goa");
  assert.equal(result.documents[0].pdfUrl.endsWith("example.pdf"), true);
  assert.equal(result.documents[0].resources[0].resourceType, "pdf");
  assert.equal(
    result.nextUrl,
    "https://prsindia.org/acts/states?page=2&per-page=50",
  );
});

test("extracts Parliament bill detail metadata and resources", () => {
  const html = `
    <ul class="breadcrumb">
      <li>Home</li><li>Bills & Acts</li><li>Bills Parliament</li>
      <li>Governance and Strategic Affairs</li><li>The Example Bill, 2025</li>
    </ul>
    <div class="field-name-title-field"><h2>The Example Bill, 2025</h2></div>
    <div class="field-name-field-ministry"><div class="field-item">Law and Justice</div></div>
    <ul class="bp-link-slides"><li>
      <div class="field-name-field-own-status"><div class="field-item">Passed</div></div>
      <div class="field-name-field-own-status-date"><div class="field-item">1 Jan 2026</div></div>
    </li></ul>
    <div class="field-name-body"><div class="field-item">A short legislative note.</div></div>
    <div class="relevant_links_s">
      <h4>Original Text</h4>
      <a href="../files/example.pdf">Bill text</a>
    </div>
  `;

  const result = parseBillDetail(
    html,
    "https://prsindia.org/billtrack/example-bill-2025",
  );

  assert.equal(result.ministry, "Law and Justice");
  assert.equal(result.category, "Governance and Strategic Affairs");
  assert.equal(result.status, "Passed");
  assert.equal(result.resources.length, 1);
  assert.equal(result.resources[0].resourceType, "pdf");
  assert.equal(result.metadata.body, "A short legislative note.");
  assert.equal(result.metadata.timeline[0].date, "1 Jan 2026");
});

test("uses the latest legislative year in a title", () => {
  assert.equal(
    extractYear(
      "The Industrial Relations Code (Amendment) Act, 2026",
      "https://prsindia.org/files/2026/example.pdf",
    ),
    2026,
  );
});
