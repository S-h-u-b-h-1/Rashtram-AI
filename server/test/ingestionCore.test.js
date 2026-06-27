const test = require("node:test");
const assert = require("node:assert/strict");

const {
  sha256,
  stableRecordHash,
  textFingerprint,
} = require("../lib/ingestion/core/hashing");
const {
  normalizeDate,
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

test("normalization handles Indian numeric dates and source priority", () => {
  assert.equal(normalizeDate("22-08-2025"), "2025-08-22");
  assert.equal(normalizeTitle("The Companies (Amendment) Bill, 2025"), "companies amendment");
  assert.equal(sourcePriorityFor("egazette"), 10);
  assert.equal(sourcePriorityFor("prs-india"), 50);
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
      normalizedTitle: "national public safety amendment",
      jurisdiction: "India",
      year: 2025,
    },
    [
      {
        id: 2,
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
      normalizedTitle: "national public safety amendment framework",
      jurisdiction: "India",
      year: 2025,
    },
    {
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
