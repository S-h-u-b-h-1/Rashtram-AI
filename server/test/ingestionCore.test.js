const test = require("node:test");
const assert = require("node:assert/strict");

const {
  generateSourceStableId,
  normalizeFingerprintText,
  sha256,
  stableRecordHash,
  textFingerprint,
} = require("../lib/ingestion/core/hashing");
const {
  normalizeDate,
  normalizeDocumentType,
  normalizeJurisdiction,
  normalizeRecord,
  normalizeTitle,
  sourcePriorityFor,
} = require("../lib/ingestion/core/normalizer");
const {
  chooseBestCandidate,
  evaluateCandidate,
  titleSimilarity,
} = require("../lib/ingestion/core/dedupe");
const {
  isPathAllowed,
  parseRobots,
} = require("../lib/ingestion/core/fetcher");
const {
  countPdfUrls,
} = require("../lib/ingestion/core/ingestionRunner");
const { parseArguments } = require("../cli/ingestSources");

test("hashing is stable and normalizes text fingerprints", () => {
  assert.equal(sha256("rashtram"), sha256("rashtram"));
  assert.equal(
    stableRecordHash({ b: 2, a: 1 }),
    stableRecordHash({ a: 1, b: 2 }),
  );
  assert.equal(
    textFingerprint("The   Public-Safety Act"),
    textFingerprint("the public safety act"),
  );
  assert.equal(
    normalizeFingerprintText("Public Safety\nPage 2 of 8\nSection 4"),
    "public safety section 4",
  );
  assert.equal(
    generateSourceStableId("india-code", "22148"),
    generateSourceStableId(["india-code", "22148"]),
  );
});

test("normalization creates a universal record without losing source metadata", () => {
  const record = normalizeRecord({
    sourceName: "india-code",
    sourceRecordId: "22148",
    sourceUrl: "https://www.indiacode.nic.in/handle/123456789/22148",
    title: "The Public Safety Act, 2025",
    documentType: "Act",
    enactedDate: "22-Aug-2025",
    actNumber: "32",
    metadata: { official: true },
  });

  assert.equal(record.documentType, "act");
  assert.equal(record.normalizedTitle, "public safety");
  assert.equal(record.enactedDate, "2025-08-22");
  assert.equal(record.year, 2025);
  assert.equal(record.legalIdentifier, null);
  assert.equal(record.sourcePriority, 20);
  assert.deepEqual(record.metadata, { official: true });
});

test("normalization accepts universal schema aliases", () => {
  const record = normalizeRecord({
    sourceName: "egazette",
    sourceRecordId: "CG-DL-E-1",
    sourceUrl: "https://egazette.gov.in/example.pdf",
    sourceTitle: "Public Safety Notification",
    sourceStatus: "Published",
    documentType: "Notification",
    gazetteId: "CG-DL-E-1",
    assentDate: "2025-08-22",
    commencementDate: "2025-09-01",
    pdfHash: "abc123",
    htmlHash: "def456",
  });
  assert.equal(record.gazetteIdentifier, "CG-DL-E-1");
  assert.equal(record.enactedDate, "2025-08-22");
  assert.equal(record.effectiveDate, "2025-09-01");
  assert.equal(record.pdfHash, "abc123");
  assert.equal(record.htmlHash, "def456");
  assert.equal(record.status, "Published");
});

test("normalization handles Indian numeric dates and source priority", () => {
  assert.equal(normalizeDate("22-08-2025"), "2025-08-22");
  assert.equal(normalizeTitle("The Companies (Amendment) Bill, 2025"), "companies amendment");
  assert.equal(sourcePriorityFor("egazette"), 10);
  assert.equal(sourcePriorityFor("prs-india"), 50);
  assert.equal(normalizeDocumentType("Office Memorandum"), "office_memorandum");
  assert.equal(normalizeJurisdiction(null, "union"), "India");
  assert.equal(normalizeJurisdiction(null, "state"), "Unknown");
});

test("ingestion counters count distinct PDF URLs and parse operational flags", () => {
  assert.equal(
    countPdfUrls({
      pdfUrl: "https://example.gov.in/a.pdf",
      resources: [
        {
          resourceType: "pdf",
          url: "https://example.gov.in/a.pdf",
        },
        {
          resourceType: "pdf",
          url: "https://example.gov.in/b.pdf",
        },
      ],
    }),
    2,
  );
  assert.deepEqual(
    parseArguments([
      "--sources=prs-india,india-code",
      "--download-pdfs=false",
      "--detail-concurrency=4",
    ]).sources,
    ["prs-india", "india-code"],
  );
  assert.equal(
    parseArguments(["--download-pdfs=false"]).downloadPdfs,
    false,
  );
  assert.equal(
    parseArguments(["--detail-concurrency=4"]).detailConcurrency,
    4,
  );
});

test("dedupe applies exact layers before fuzzy matching", () => {
  const record = {
    sourceName: "india-code",
    sourceRecordId: "42",
    legalIdentifier: "2025-32",
    normalizedTitle: "public safety",
    jurisdiction: "India",
    year: 2025,
  };
  assert.equal(
    evaluateCandidate(record, {
      source_name: "india-code",
      source_record_id: "42",
    }).reason,
    "exact-source",
  );
  assert.equal(
    evaluateCandidate(record, {
      legal_identifier: "2025-32",
      jurisdiction: "India",
    }).reason,
    "legal-identifier",
  );
});

test("dedupe never merges repeated act numbers across years", () => {
  const result = evaluateCandidate(
    {
      sourceName: "state-a",
      sourceRecordId: "new",
      actNumber: "1",
      normalizedTitle: "finance",
      jurisdiction: "Karnataka",
      year: 2025,
    },
    {
      act_number: "1",
      normalized_title: "finance",
      jurisdiction: "Karnataka",
      year: 2024,
    },
  );
  assert.equal(result.action, "create");
});

test("dedupe keeps a bill and its enacted act as separate documents", () => {
  const result = evaluateCandidate(
    {
      sourceName: "india-code",
      sourceRecordId: "act-1",
      documentType: "act",
      normalizedTitle: "public safety",
      jurisdiction: "India",
      year: 2025,
    },
    {
      source_name: "prs-india",
      source_record_id: "bill-1",
      document_type: "bill",
      normalized_title: "public safety",
      jurisdiction: "India",
      year: 2025,
    },
  );
  assert.equal(result.action, "create");
});

test("dedupe merges high-confidence titles and queues ambiguous ones", () => {
  assert.equal(
    titleSimilarity(
      "national public safety amendment",
      "national public safety amendment",
    ),
    1,
  );
  const high = chooseBestCandidate(
    {
      sourceName: "a",
      sourceRecordId: "1",
      documentType: "act",
      normalizedTitle: "national public safety amendment",
      jurisdiction: "India",
      year: 2025,
    },
    [
      {
        id: 2,
        document_type: "act",
        normalized_title: "national public safety amendment",
        jurisdiction: "India",
        year: 2025,
      },
    ],
  );
  assert.equal(high.action, "merge");

  const review = evaluateCandidate(
    {
      sourceName: "a",
      sourceRecordId: "1",
      documentType: "act",
      normalizedTitle: "national public safety amendment framework",
      jurisdiction: "India",
      year: 2025,
    },
    {
      document_type: "act",
      normalized_title: "national public safety amendment",
      jurisdiction: "India",
      year: 2025,
    },
  );
  assert.equal(review.action, "review");
  assert.ok(review.similarity >= 0.8 && review.similarity < 0.92);
});

test("robots parser honors the longest matching allow/disallow rule", () => {
  const rules = parseRobots(`
    User-agent: *
    Disallow: /simple-search
    Allow: /simple-search/public
  `);
  assert.equal(isPathAllowed("/browse", rules), true);
  assert.equal(isPathAllowed("/simple-search?q=x", rules), false);
  assert.equal(isPathAllowed("/simple-search/public/item", rules), true);
});
