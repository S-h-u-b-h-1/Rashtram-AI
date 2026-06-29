const test = require("node:test");
const assert = require("node:assert/strict");

const {
  displayStatusFor,
  probeConnector,
  validateCollectionShape,
} = require("../lib/ingestion/core/healthCheck");
const {
  downloadPdfForRecord,
  validatePdfStorageOptions,
} = require("../lib/ingestion/core/pdfDownload");
const {
  runIngestion,
} = require("../lib/ingestion/core/ingestionRunner");

test("connector health accepts the universal record shape", async () => {
  const connector = {
    name: "test-source",
    async collect() {
      return {
        records: [
          {
            sourceName: "test-source",
            sourceRecordId: "record-1",
            sourceUrl: "https://example.gov.in/record-1",
            pdfUrl: "https://example.gov.in/record-1.pdf",
            title: "Public Record",
          },
        ],
        snapshots: [{ sourceName: "test-source" }],
        errors: [],
      };
    },
  };
  const report = await probeConnector(
    connector,
    {},
    { fetcher: {}, history: {} },
  );
  assert.equal(report.status, "connected");
  assert.equal(report.displayStatus, "Connected");
  assert.equal(report.parserStatus, "Valid");
  assert.equal(report.pdfDiscoveryStatus, "Discovered");
  assert.equal(report.sampleRecordsDiscovered, 1);
  assert.equal(report.samplePdfLinksDiscovered, 1);
});

test("health display status reports freshness without hiding live failures", () => {
  assert.equal(
    displayStatusFor("connected", {
      lastSuccessfulAt: new Date(Date.now() - 60_000).toISOString(),
    }),
    "Fresh",
  );
  assert.equal(
    displayStatusFor("connected", {
      lastSuccessfulAt: new Date(Date.now() - 8 * 86_400_000).toISOString(),
    }),
    "Stale",
  );
  assert.equal(displayStatusFor("blocked", {}), "Blocked");
  assert.equal(displayStatusFor("parser changed", {}), "Degraded");
});

test("connector health identifies response-shape changes", async () => {
  assert.deepEqual(validateCollectionShape({ records: [] }), {
    valid: false,
    reason:
      "Connector response must contain records, snapshots, and errors arrays.",
  });
  const report = await probeConnector(
    {
      name: "test-source",
      async collect() {
        return { records: [] };
      },
    },
    {},
    { fetcher: {}, history: {} },
  );
  assert.equal(report.status, "parser changed");
});

test("connector health distinguishes an empty official index from parser failure", async () => {
  const report = await probeConnector(
    {
      name: "india-code",
      async collect() {
        return {
          records: [],
          snapshots: [{ sourceName: "india-code" }],
          errors: [],
          diagnostics: [{ type: "empty-source" }],
        };
      },
    },
    {},
    { fetcher: {}, history: {} },
  );
  assert.equal(report.status, "no data found");
  assert.equal(report.reachable, true);
  assert.equal(report.parserShapeValid, true);
});

test("connector health reports a collection-level network failure as unavailable", async () => {
  const report = await probeConnector(
    {
      name: "prs-india",
      async collect() {
        return {
          records: [],
          snapshots: [],
          errors: [{ message: "DNS lookup failed" }],
        };
      },
    },
    {},
    { fetcher: {}, history: {} },
  );
  assert.equal(report.status, "unavailable");
  assert.equal(report.reachable, false);
  assert.match(report.error, /DNS lookup failed/);
});

test("connector health reports interactive official catalogues as blocked", async () => {
  const report = await probeConnector(
    {
      name: "state-gazette",
      async collect() {
        return {
          records: [],
          snapshots: [{ sourceName: "state-gazette" }],
          errors: [],
          diagnostics: [
            {
              type: "blocked",
              message: "Interactive ASP.NET controls require a browser session.",
            },
          ],
        };
      },
    },
    {},
    { fetcher: {}, history: {} },
  );
  assert.equal(report.status, "blocked");
  assert.match(report.error, /Interactive ASP.NET/);
});

test("blocked diagnostics are retained in ingestion-run summaries", async () => {
  const summary = await runIngestion(
    {
      name: "blocked-source",
      defaultCollection: "official-directory",
      async collect() {
        return {
          records: [],
          snapshots: [],
          errors: [],
          diagnostics: [
            {
              type: "blocked",
              message: "Interactive source exposed no stable links.",
            },
          ],
        };
      },
    },
    { dryRun: true, fetcher: {} },
  );
  assert.equal(summary.status, "completed_with_errors");
  assert.equal(summary.errors[0].type, "blocked");
  assert.match(summary.errors[0].message, /no stable links/);
});

test("controlled PDF download verifies bytes and defaults to URL-only", async () => {
  const body = Buffer.from("%PDF-1.7\nsafe fixture");
  const result = await downloadPdfForRecord(
    {
      sourceName: "test-source",
      sourceRecordId: "record-1",
      pdfUrl: "https://example.gov.in/record-1.pdf",
      metadata: {},
    },
    {
      async getBuffer() {
        return { body, status: 200 };
      },
    },
    { downloadPdfs: true, pdfStorage: "url-only" },
  );
  assert.equal(result.downloaded, true);
  assert.equal(result.stored, false);
  assert.equal(result.record.pdfHash.length, 64);
  assert.equal(result.record.metadata.pdfAsset.storage, "url-only");
  assert.equal(validatePdfStorageOptions({}), "url-only");
  assert.throws(
    () =>
      validatePdfStorageOptions({
        downloadPdfs: true,
        pdfStorage: "object-storage",
      }),
    /not configured/,
  );
});
