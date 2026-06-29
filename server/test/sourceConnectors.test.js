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
  parseOfficialPortalLinks,
} = require("../lib/ingestion/connectors/officialDirectoryConnector");
const {
  parseParliamentDetail,
  parseParliamentListing,
} = require("../lib/ingestion/connectors/parliamentPortalConnector");
const {
  CONNECTORS,
  connectorByName,
} = require("../lib/ingestion/connectors");
const {
  subordinateRecordsFor,
} = require("../lib/ingestion/connectors/indiaCodeConnector");

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

test("official directory adapter can reject unrelated landing-page PDFs", () => {
  const records = parseOfficialDirectory(
    `<a href="/files/history.pdf">About the Assembly</a>
     <a href="/files/bill-2026.pdf">Public Safety Bill, 2026</a>`,
    "https://assembly.example.gov.in/",
    {
      name: "state-legislature",
      collection: "example",
      authority: "Example Legislature",
      jurisdictionLevel: "state",
      jurisdiction: "Example",
      pdfLinkPattern: /\b(bill|act|question|debate|committee)\b/i,
    },
  );
  assert.equal(records.length, 1);
  assert.equal(records[0].title, "Public Safety Bill, 2026");
});

test("official directory discovery retains verified ministry portal links", () => {
  const records = parseOfficialPortalLinks(
    `<a href="https://lawmin.gov.in/">Ministry of Law and Justice</a>
     <a href="https://example.com/">Unverified directory</a>`,
    "https://www.india.gov.in/directory/web-directory",
    {
      name: "ministry",
      collection: "ministries-and-departments",
      authority: "Government of India",
      includeDirectoryLinks: true,
      linkPattern: /(ministry|department)/i,
      allowedHosts: ["gov.in", "nic.in"],
    },
  );
  assert.equal(records.length, 1);
  assert.equal(records[0].sourceUrl, "https://lawmin.gov.in/");
  assert.equal(records[0].metadata.directoryEntry, true);
});

test("Parliament listing parser normalizes questions and official PDFs", () => {
  const records = parseParliamentListing(
    `<table><tr>
      <td>560</td><td>Contribution of MSMEs in Maharashtra</td>
      <td>18</td><td>VII</td><td>Member Name</td>
      <td>MICRO, SMALL AND MEDIUM ENTERPRISES</td>
      <td>STARRED</td><td>02-Apr-2026</td>
      <td><a href="/getFile/questions/560.pdf?source=pqals">View</a></td>
    </tr></table>`,
    "https://sansad.in/ls/questions/questions-and-answers",
    { name: "lok-sabha", authority: "Lok Sabha Secretariat" },
    {
      collection: "questions",
      documentType: "question",
      titleCell: 1,
      ministryCell: 5,
      statusCell: 6,
    },
  );
  assert.equal(records.length, 1);
  assert.equal(records[0].documentType, "question");
  assert.equal(records[0].publicationDate, "2026-04-02");
  assert.equal(records[0].ministry, "MICRO, SMALL AND MEDIUM ENTERPRISES");
  assert.match(records[0].pdfUrl, /questions\/560\.pdf/);
});

test("Parliament detail parser enriches catalogue metadata and PDF provenance", () => {
  const record = parseParliamentDetail(
    `<head>
      <meta name="DC.title" content="Lok Sabha Debates">
      <meta name="DCTERMS.issued" content="03-Feb-2026">
    </head>
    <table>
      <tr><td>Type:</td><td>Full Text</td></tr>
      <tr><td>Lok Sabha Number:</td><td>18</td></tr>
      <tr><td>Session Number:</td><td>VII</td></tr>
    </table>
    <a href="/bitstream/123456789/1/1/debate.pdf">View PDF</a>`,
    "https://eparlib.sansad.in/handle/123456789/1",
    {
      title: "Debate",
      documentType: "debate",
      resources: [],
      metadata: {},
    },
  );
  assert.equal(record.title, "Lok Sabha Debates");
  assert.equal(record.publicationDate, "2026-02-03");
  assert.match(record.pdfUrl, /debate\.pdf$/);
  assert.equal(record.metadata.sessionNumber, "VII");
});

test("India Code subordinate resources become independently deduplicable records", () => {
  const records = subordinateRecordsFor({
    sourceName: "india-code",
    sourceRecordId: "1398",
    detailUrl: "https://www.indiacode.nic.in/handle/123456789/1398",
    title: "The Arms Act, 1959",
    year: 1959,
    jurisdictionLevel: "union",
    jurisdiction: "India",
    authority: "Ministry of Law and Justice",
    ministry: "Ministry of Home Affairs",
    resources: [
      {
        label: "13-Jul-1962 Arms Rules",
        resourceType: "pdf",
        category: "rule",
        url: "https://www.indiacode.nic.in/rules/arms-rules.pdf",
      },
    ],
  });
  assert.equal(records.length, 1);
  assert.equal(records[0].documentType, "rule");
  assert.equal(records[0].publicationDate, "1962-07-13");
  assert.match(records[0].sourceRecordId, /^1398:/);
});

test("every registered connector exposes the operational lifecycle contract", () => {
  for (const connector of CONNECTORS) {
    assert.equal(connector.sourceName, connector.name);
    assert.ok(Array.isArray(connector.collections));
    for (const method of [
      "discover",
      "fetchDetails",
      "normalize",
      "run",
      "healthCheck",
    ]) {
      assert.equal(typeof connector[method], "function");
    }
  }
  assert.equal(connectorByName("ministries").name, "ministry");
  assert.equal(
    connectorByName("state-legislatures").name,
    "state-legislature",
  );
  assert.equal(connectorByName("indiacode").name, "india-code");
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
