const test = require("node:test");
const assert = require("node:assert/strict");

const {
  parseBrowsePage,
  parseDetailPage,
  parseYearLinks,
  mapWithConcurrency,
} = require("../lib/ingestion/connectors/indiaCodeConnector");
const {
  parseHomePage,
  pdfUrlForGazette,
} = require("../lib/ingestion/connectors/eGazetteConnector");
const {
  parseOfficialDirectory,
} = require("../lib/ingestion/connectors/officialDirectoryConnector");

test("IndiaCode parser discovers year buckets and canonical act rows", () => {
  const years = parseYearLinks(
    `<a href="/handle/123456789/1362/browse?type=actyear&value=2025">2025 (14)</a>`,
    "https://www.indiacode.nic.in/handle/123456789/1362/browse",
  );
  assert.equal(years[0].year, 2025);

  const records = parseBrowsePage(
    `<table><tr>
      <td>22-Aug-2025</td><td>32</td>
      <td>The Public Safety Act, 2025</td>
      <td><a href="/handle/123456789/22148?view_type=browse">View...</a></td>
    </tr></table>`,
    "https://www.indiacode.nic.in/handle/123456789/1362/browse?type=actyear&value=2025",
    "central-acts",
  );
  assert.equal(records.length, 1);
  assert.equal(records[0].sourceRecordId, "22148");
  assert.equal(records[0].actNumber, "32");
  assert.equal(records[0].year, 2025);
});

test("IndiaCode detail parser extracts Dublin Core fields and official PDF", () => {
  const detail = parseDetailPage(
    `<head>
      <meta name="DC.title" content="The Public Safety Act, 2025">
      <meta name="DCTERMS.issued" content="2025-08-22">
      <meta name="DC.identifier" content="2025-32">
      <meta name="DC.relation" content="Ministry of Home Affairs">
      <meta name="citation_pdf_url" content="/bitstream/123456789/22148/1/a2025-32.pdf">
    </head><body></body>`,
    "https://www.indiacode.nic.in/handle/123456789/22148",
    {
      title: "Public Safety",
      year: 2025,
      metadata: {},
    },
  );
  assert.equal(detail.legalIdentifier, "2025-32");
  assert.equal(detail.ministry, "Ministry of Home Affairs");
  assert.equal(
    detail.pdfUrl,
    "https://www.indiacode.nic.in/bitstream/123456789/22148/1/a2025-32.pdf",
  );
});

test("eGazette parser maps recent rows to stable official archive PDFs", () => {
  const records = parseHomePage(`
    <table><tr>
      <td><span id="rpt_Extra_lbl_MinistryE_0">Ministry of Law and Justice</span></td>
      <td><span id="rpt_Extra_lbl_SubjectE_0">Publication of a notification</span></td>
      <td><span id="rpt_Extra_lbl_DateE_0">27-Jun-2026</span></td>
      <td><span id="rpt_Extra_lbl_UGIDExtra_0">CG-DL-E-27062026-273894</span></td>
      <td><span id="rpt_Extra_lbl_FileSizeE_0">0.55 MB</span></td>
    </tr></table>
  `);
  assert.equal(records.length, 1);
  assert.equal(records[0].documentType, "notification");
  assert.equal(records[0].publicationDate, "2026-06-27");
  assert.equal(
    records[0].pdfUrl,
    "https://egazette.gov.in/WriteReadData/2026/273894.pdf",
  );
  assert.equal(
    pdfUrlForGazette("CG-DL-W-27062026-273868", "2026-06-27"),
    "https://egazette.gov.in/WriteReadData/2026/273868.pdf",
  );
});

test("official directory adapter stores only linked official PDFs", () => {
  const records = parseOfficialDirectory(
    `<a href="/docs/questions/question-2025.pdf">Question No. 42, 2025</a>
     <a href="/about">About</a>`,
    "https://sansad.in/ls",
    {
      name: "lok-sabha",
      collection: "questions",
      authority: "Lok Sabha Secretariat",
      jurisdictionLevel: "union",
      jurisdiction: "India",
    },
  );
  assert.equal(records.length, 1);
  assert.equal(records[0].documentType, "question");
  assert.equal(records[0].year, 2025);
});

test("IndiaCode detail work respects the requested concurrency bound", async () => {
  let active = 0;
  let peak = 0;
  await mapWithConcurrency([1, 2, 3, 4, 5], 2, async () => {
    active += 1;
    peak = Math.max(peak, active);
    await new Promise((resolve) => setImmediate(resolve));
    active -= 1;
  });
  assert.equal(peak, 2);
});
