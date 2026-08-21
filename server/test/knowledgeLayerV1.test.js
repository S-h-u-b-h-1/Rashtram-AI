const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const {
  buildPortableKnowledgeObject,
  canExposeAsLegalFact,
  canUseForDiscovery,
  deduplicateKnowledgeNodes,
  detectKnowledgeConflicts,
  discoverKnowledgeCandidates,
  eligibleForKnowledgeExtraction,
  extractKnowledgeCandidates,
  normalizeKnowledgeEdge,
  normalizeKnowledgeNode,
  traverseKnowledge,
  upsertKnowledgeEdge,
  upsertKnowledgeNode,
} = require("../graph/knowledgeLayerService");

const sourceEvidence = (overrides = {}) => ({
  documentId: 42,
  chunkId: 7,
  evidenceSpan: "Every producer shall register before placing batteries on the market.",
  sectionLabel: "Rule 4",
  sourceUrl: "https://moef.gov.in/battery-rules.pdf",
  ...overrides,
});

const node = (overrides = {}) => ({
  nodeType: "OBLIGATION",
  canonicalName: "Producer registration",
  jurisdiction: "India",
  verificationStatus: "SOURCE_VERIFIED",
  evidence: [sourceEvidence()],
  ...overrides,
});

test("a verified knowledge node requires original evidence", () => {
  assert.throws(
    () => normalizeKnowledgeNode(node({ evidence: [] })),
    /require original source evidence/i,
  );
  assert.equal(normalizeKnowledgeNode(node()).evidence[0].documentId, 42);
  assert.throws(
    () => normalizeKnowledgeNode(node({
      verificationStatus: "MODEL_EXTRACTED",
      generationMethod: "gemini_model_v1",
      evidence: [],
    })),
    /AI-extracted knowledge nodes require original source evidence/i,
  );
});

test("an unverified model node is never exposed as a legal fact", () => {
  assert.equal(canExposeAsLegalFact("MODEL_EXTRACTED"), false);
  assert.equal(canExposeAsLegalFact("MODEL_CHECKED"), false);
  assert.equal(canExposeAsLegalFact("SOURCE_VERIFIED"), true);
  assert.throws(
    () => buildPortableKnowledgeObject({
      nodeType: "OBLIGATION",
      canonicalName: "Unverified duty",
      verificationStatus: "MODEL_EXTRACTED",
    }, []),
    /only verified knowledge/i,
  );
});

test("a verified edge retains its source evidence", () => {
  const edge = normalizeKnowledgeEdge({
    sourceNodeId: 1,
    targetNodeId: 2,
    relationshipType: "REQUIRES",
    verificationStatus: "SOURCE_VERIFIED",
    evidence: [sourceEvidence()],
  });
  assert.equal(edge.evidence.length, 1);
  assert.equal(edge.evidence[0].documentId, 42);
  assert.match(edge.evidence[0].evidenceHash, /^[a-f0-9]{64}$/);
});

test("quarantined and disputed knowledge stay excluded from discovery", () => {
  assert.equal(canUseForDiscovery("QUARANTINED"), false);
  assert.equal(canUseForDiscovery("DISPUTED"), false);
  assert.equal(canUseForDiscovery("MODEL_CHECKED"), true);
});

test("knowledge discovery narrows retrieval to evidence-bearing documents", async () => {
  const result = await discoverKnowledgeCandidates("battery recycling Gujarat", {
    userId: 8,
    execute: async () => ({ rows: [{
      id: 11,
      node_type: "CONCEPT",
      canonical_name: "Battery recycling",
      jurisdiction: "gujarat",
      verification_status: "MODEL_CHECKED",
      document_id: 42,
      chunk_id: 7,
      evidence_span: "Battery recyclers require authorization.",
      section_label: "Rule 8",
      source_url: "https://example.gov.in/rules.pdf",
    }] }),
  });
  assert.deepEqual(result.documentIds, ["42"]);
  assert.equal(result.evidence[0].knowledgeDiscoveryOnly, true);
  assert.equal(result.evidence[0].documentId, "42");
});

test("knowledge discovery evidence always points back to original source coordinates", async () => {
  const result = await discoverKnowledgeCandidates("registration", {
    execute: async () => ({ rows: [{
      id: 2,
      node_type: "OBLIGATION",
      canonical_name: "Registration",
      jurisdiction: "india",
      verification_status: "SOURCE_VERIFIED",
      document_id: 99,
      chunk_id: 13,
      evidence_span: "The applicant shall register.",
      page_start: 4,
      clause_label: "4(2)",
    }] }),
  });
  assert.deepEqual(
    { documentId: result.evidence[0].documentId, chunkId: result.evidence[0].chunkId },
    { documentId: "99", chunkId: "13" },
  );
  assert.equal(result.concepts[0].legalFact, true);
});

test("duplicate concepts normalize without collapsing separate jurisdictions", () => {
  const result = deduplicateKnowledgeNodes([
    node({ canonicalName: " Producer  Registration ", verificationStatus: "MODEL_CHECKED" }),
    node({ canonicalName: "producer-registration", verificationStatus: "MODEL_CHECKED" }),
    node({ canonicalName: "Producer registration", jurisdiction: "Gujarat", verificationStatus: "MODEL_CHECKED" }),
  ]);
  assert.equal(result.length, 2);
  assert.deepEqual(result.map((item) => item.jurisdiction).sort(), ["gujarat", "india"]);
});

test("conflicting numeric knowledge evidence is surfaced as disputed", () => {
  const conflicts = detectKnowledgeConflicts([
    { nodeType: "PENALTY", canonicalName: "Late filing penalty", jurisdiction: "India", evidenceSpan: "The penalty is 10 percent." },
    { nodeType: "PENALTY", canonicalName: "Late filing penalty", jurisdiction: "India", evidenceSpan: "The penalty is 20 percent." },
  ]);
  assert.equal(conflicts.length, 1);
  assert.equal(conflicts[0].status, "DISPUTED");
});

test("private-source discovery remains account scoped in SQL and parameters", async () => {
  let captured;
  await discoverKnowledgeCandidates("private field study", {
    userId: 73,
    execute: async (sql, params) => {
      captured = { sql, params };
      return { rows: [] };
    },
  });
  assert.match(captured.sql, /node\.owner_user_id IS NULL OR node\.owner_user_id = \$2/);
  assert.match(captured.sql, /evidence\.owner_user_id IS NULL OR evidence\.owner_user_id = \$2/);
  assert.equal(captured.params[1], 73);
});

test("knowledge traversal clamps depth and result count", async () => {
  let captured;
  await traverseKnowledge(5, {
    maxDepth: 99,
    limit: 999,
    execute: async (sql, params) => {
      captured = { sql, params };
      return { rows: [] };
    },
  });
  assert.match(captured.sql, /LIMIT 20/);
  assert.deepEqual(captured.params, [5, 3, 100]);
});

test("extraction is bounded to high-value search-ready documents", () => {
  assert.equal(eligibleForKnowledgeExtraction({ searchReady: true, priority: "P0" }), true);
  assert.equal(eligibleForKnowledgeExtraction({ searchReady: true, priority: "P2" }), false);
  const extracted = extractKnowledgeCandidates({
    id: 42,
    type: "rule",
    jurisdiction: "India",
    searchReady: true,
    priority: "P1",
  }, [{
    chunkId: 7,
    sectionId: "4",
    content: "Every producer shall register before placing batteries on the market.",
  }]);
  assert.equal(extracted.length, 1);
  assert.equal(extracted[0].nodeType, "OBLIGATION");
  assert.equal(extracted[0].evidence[0].chunkId, 7);
});

test("node and edge persistence write evidence before promotion to verified", async () => {
  const calls = [];
  const execute = async (sql, params) => {
    calls.push({ sql, params });
    if (/INSERT INTO knowledge_nodes/.test(sql)) return { rows: [{ id: 10 }] };
    if (/INSERT INTO knowledge_edges/.test(sql)) return { rows: [{ id: 20 }] };
    return { rows: [] };
  };
  await upsertKnowledgeNode(node(), execute);
  await upsertKnowledgeEdge({
    sourceNodeId: 10,
    targetNodeId: 11,
    relationshipType: "REQUIRES",
    verificationStatus: "SOURCE_VERIFIED",
    evidence: [sourceEvidence()],
  }, execute);
  const nodeEvidence = calls.findIndex((call) => /INSERT INTO knowledge_evidence/.test(call.sql));
  const nodePromotion = calls.findIndex((call) => /UPDATE knowledge_nodes/.test(call.sql));
  const edgeInsert = calls.findIndex((call) => /INSERT INTO knowledge_edges/.test(call.sql));
  const edgeEvidence = calls.findIndex((call, index) => index > edgeInsert && /INSERT INTO knowledge_evidence/.test(call.sql));
  const edgePromotion = calls.findIndex((call) => /UPDATE knowledge_edges/.test(call.sql));
  assert.ok(nodeEvidence > 0 && nodePromotion > nodeEvidence);
  assert.ok(edgeEvidence > edgeInsert && edgePromotion > edgeEvidence);
});

test("Knowledge Layer V1 reuses rather than replaces the existing document graph", () => {
  const route = fs.readFileSync(path.join(__dirname, "../graph/route.js"), "utf8");
  const graph = fs.readFileSync(path.join(__dirname, "../graph/knowledgeGraphService.js"), "utf8");
  assert.match(route, /findPath/);
  assert.match(route, /knowledge\/search/);
  assert.match(graph, /document_relationships/);
});
