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
