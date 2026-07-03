const assert = require("node:assert/strict");
const test = require("node:test");
const {
  INVERSE_RELATIONSHIPS,
  RELATIONSHIP_TYPES,
  inferRelationship,
  normalizedTokens,
  titleSimilarity,
} = require("../graph/relationshipEngine");
const {
  normalizeId,
} = require("../graph/knowledgeGraphService");

const document = (overrides = {}) => ({
  id: 1,
  title: "The Finance Bill, 2024",
  document_type: "bill",
  year: 2024,
  ministry: "Ministry of Finance",
  category: "Taxation",
  state: null,
  legal_identifier: null,
  metadata_json: {},
  original_text: "",
  ...overrides,
});

test("knowledge graph relationship vocabulary includes legal inverse pairs", () => {
  assert.equal(INVERSE_RELATIONSHIPS.AMENDS, "AMENDED_BY");
  assert.equal(INVERSE_RELATIONSHIPS.BECAME_ACT, "ENACTED_FROM");
  assert.ok(RELATIONSHIP_TYPES.has("UNDER_ACT"));
  assert.ok(RELATIONSHIP_TYPES.has("STATE_EQUIVALENT"));
});

test("bill-to-act lineage requires strong title evidence", () => {
  const relationship = inferRelationship(
    document(),
    document({
      id: 2,
      title: "The Finance Act, 2024",
      document_type: "act",
    }),
  );
  assert.equal(relationship.type, "BECAME_ACT");
  assert.ok(relationship.confidence >= 0.9);
  assert.equal(relationship.evidence.signal, "bill_act_title_lineage");
});

test("amendment inference requires an explicit target reference", () => {
  const relationship = inferRelationship(
    document({
      title: "Income-tax (Amendment) Act, 2025",
      document_type: "act",
      original_text:
        "This Act further amends the Income-tax Act, 1961.",
    }),
    document({
      id: 2,
      title: "Income-tax Act, 1961",
      document_type: "act",
      year: 1961,
      legal_identifier: "Income-tax Act, 1961",
    }),
  );
  assert.equal(relationship.type, "AMENDS");
  assert.ok(relationship.explanation.includes("explicitly identifies"));
});

test("similar titles alone never create an amendment relationship", () => {
  const relationship = inferRelationship(
    document({
      title: "Digital India Policy",
      document_type: "policy",
      original_text: "",
    }),
    document({
      id: 2,
      title: "Digital India Strategy",
      document_type: "policy",
    }),
  );
  assert.notEqual(relationship?.type, "AMENDS");
});

test("cross-state equivalents preserve jurisdiction evidence", () => {
  const relationship = inferRelationship(
    document({
      title: "Electric Vehicle Policy 2025",
      document_type: "policy",
      state: "Odisha",
    }),
    document({
      id: 2,
      title: "Electric Vehicle Policy 2025",
      document_type: "policy",
      state: "West Bengal",
    }),
  );
  assert.equal(relationship.type, "STATE_EQUIVALENT");
  assert.equal(relationship.evidence.sourceState, "Odisha");
});

test("title tokenization ignores generic legal words", () => {
  assert.deepEqual(
    normalizedTokens("The Finance (Amendment) Bill, 2024"),
    ["finance", "2024"],
  );
  assert.equal(titleSimilarity("The Finance Bill, 2024", "Finance Act 2024"), 1);
});

test("graph identifiers reject invalid traversal input", () => {
  assert.equal(normalizeId("42"), 42);
  assert.throws(() => normalizeId("../42"), /positive integer/);
  assert.throws(() => normalizeId("0"), /positive integer/);
});
