const test = require("node:test");
const assert = require("node:assert/strict");

const {
  canonicalRoutingVectorId,
  canonicalVectorId,
  parseVectorIdentity,
} = require("../document/vectorIdentity");

const config = {
  embeddingProvider: "gemini",
  embeddingModel: "gemini-embedding-001",
  embeddingDimension: 768,
  vectorNamespace: "gemini-embedding-001-768-v1",
};

test("canonical chunk identity changes with content or embedding contract", () => {
  const base = canonicalVectorId({ family: "act", documentId: 7, chunkIndex: 2,
    embeddingText: "Section 7 applies.", config });
  const changedContent = canonicalVectorId({ family: "act", documentId: 7, chunkIndex: 2,
    embeddingText: "Section 7 no longer applies.", config });
  const changedModel = canonicalVectorId({ family: "act", documentId: 7, chunkIndex: 2,
    embeddingText: "Section 7 applies.", config: { ...config, embeddingModel: "next-model" } });
  assert.notEqual(base, changedContent);
  assert.notEqual(base, changedModel);
  assert.deepEqual(parseVectorIdentity(base), {
    kind: "chunk", family: "act", documentId: "7", position: 2,
    contractHash: base.split("-").at(-1), canonical: true,
  });
});

test("legacy and canonical routing identities remain diagnosable", () => {
  assert.equal(parseVectorIdentity("bill-12-chunk-3").canonical, false);
  const id = canonicalRoutingVectorId({ family: "gazette", documentId: 8,
    groupIndex: 1, representationText: "Routing evidence", config });
  const parsed = parseVectorIdentity(id);
  assert.equal(parsed.kind, "routing");
  assert.equal(parsed.canonical, true);
  assert.equal(parsed.documentId, "8");
});
