const test = require("node:test");
const assert = require("node:assert/strict");

const {
  ALLOWED_DOCUMENT_TYPES,
  normalizeType,
} = require("../models/DocumentChat");
const {
  TYPE_CONFIG,
} = require("../document/documentResearchService");
const {
  buildFilters,
  mapDocument,
} = require("../document/DocumentRepository");
const {
  normalizeDocumentType,
  normalizeTypeList,
  retrievalFamilyForType,
} = require("../document/documentTypes");
const {
  resolveDocumentIdentity,
} = require("../document/documentChatRoute");
const {
  sanitizeList,
  sanitizeObject,
  sanitizeText,
} = require("../profile/profileService");

test("unified document chat supports current and future research types", () => {
  for (const type of [
    "bill",
    "act",
    "gazette",
    "policy",
    "committee_report",
    "rule",
    "notification",
    "circular",
    "debate",
    "strategy_paper",
    "white_paper",
    "manual",
    "report",
    "cabinet_decision",
    "press_release",
    "government_resolution",
    "recommendation",
    "discussion_paper",
  ]) {
    assert.equal(ALLOWED_DOCUMENT_TYPES.has(type), true);
    assert.equal(normalizeType(type.toUpperCase()), type);
  }
  assert.throws(() => normalizeType("password"), /Unsupported document type/);
});

test("RAG adapters share one contract for Bills, Acts, and Gazettes", () => {
  assert.deepEqual(Object.keys(TYPE_CONFIG), ["bill", "act", "gazette"]);
  for (const config of Object.values(TYPE_CONFIG)) {
    assert.equal(typeof config.index, "function");
    assert.equal(typeof config.check, "function");
    assert.equal(typeof config.generateSummary, "function");
    assert.equal(typeof config.search, "function");
    assert.equal(typeof config.store, "function");
    assert.match(config.idField, /^(bill|act|gazette)Id$/);
  }
});

test("document identity accepts bodyless GET requests", () => {
  assert.deepEqual(
    resolveDocumentIdentity({
      params: { documentType: "gazette", documentId: "20438" },
      query: {},
    }),
    {
      documentType: "gazette",
      documentId: "20438",
    },
  );
  assert.throws(
    () =>
      resolveDocumentIdentity({
        params: { documentType: "gazette" },
        query: {},
      }),
    /Document ID is required/,
  );
  assert.throws(
    () =>
      resolveDocumentIdentity({
        params: { documentType: "password", documentId: "20438" },
        query: {},
      }),
    /Unsupported document type/,
  );
});

test("universal document types use aliases and one retrieval mapping", () => {
  assert.equal(normalizeDocumentType("committee-report"), "committee_report");
  assert.equal(normalizeDocumentType("office-memoranda"), "office_memorandum");
  assert.deepEqual(normalizeTypeList("bill,act,rules"), [
    "bill",
    "act",
    "rule",
  ]);
  assert.equal(retrievalFamilyForType("bill"), "bill");
  assert.equal(retrievalFamilyForType("act"), "act");
  assert.equal(retrievalFamilyForType("policy"), "gazette");
});

test("universal repository filters remain parameterized across all fields", () => {
  const filters = buildFilters({
    type: "committee-report",
    search: "tax' OR TRUE --",
    ministry: "Finance",
    authority: "CBDT",
    hasPdf: "true",
    semanticIds: ["12", "13"],
  });
  assert.equal(filters.where.includes("tax' OR TRUE"), false);
  assert.match(filters.where, /document_type = ANY/);
  assert.match(filters.where, /search_vector/);
  assert.match(filters.where, /id::TEXT = ANY/);
  assert.match(filters.where, /pdf_url IS NOT NULL/);
  assert.deepEqual(filters.parameters[0], ["committee_report"]);
});

test("universal repository exposes the stable document contract", () => {
  const document = mapDocument({
    id: 42,
    canonical_id: "rashtram-42",
    title: "Sample Rule",
    document_type: "rule",
    category: "Tax",
    authority: "CBDT",
    jurisdiction: "India",
    jurisdiction_level: "parliament",
    ministry: "Finance",
    publication_date: "2026-06-29",
    status: "Published",
    canonical_source: "egazette",
    canonical_url: "https://example.invalid/source",
    pdf_url: "https://example.invalid/rule.pdf",
    metadata_json: { language: "English" },
  });
  assert.equal(document.id, "42");
  assert.equal(document.type, "rule");
  assert.equal(document.subtype, "Tax");
  assert.equal(document.source, "egazette");
  assert.equal(document.pdfUrl, "https://example.invalid/rule.pdf");
  assert.deepEqual(document.metadata, { language: "English" });
  assert.deepEqual(document.relationships, []);
});

test("profile input helpers bound and normalize user-controlled fields", () => {
  assert.equal(sanitizeText("  Researcher  ", 20), "Researcher");
  assert.equal(sanitizeText("x".repeat(50), 10), "x".repeat(10));
  assert.deepEqual(
    sanitizeList([" Tax ", "Tax", "", "Environment"]),
    ["Tax", "Environment"],
  );
  assert.deepEqual(sanitizeList("not-an-array"), []);
  assert.deepEqual(sanitizeObject({ email: true }), { email: true });
  assert.deepEqual(sanitizeObject(["not", "an", "object"]), {});
});
