const assert = require("node:assert/strict");
const test = require("node:test");
const {
  HISTORY_UNAVAILABLE, assembleAmendmentTracker, getAmendmentTracker,
} = require("../product/amendmentTrackerService");

const document = { id: 4, title: "Current Act", documentType: "act", sourceUrl: "https://gov/current" };
const context = {
  events: [{ kind: "published", date: "2026-01-01", verificationStatus: "catalogue_recorded" }],
  relationships: [{
    type: "AMENDS", documentId: "3", title: "Earlier Act", sourceUrl: "https://gov/earlier",
    verificationStatus: "source_verified",
    events: [{ kind: "published", date: "2020-01-01", verificationStatus: "catalogue_recorded" }],
  }],
};

test("amendment tracker preserves verified before and after source identity", () => {
  const result = assembleAmendmentTracker({
    document, context,
    historicalPassages: [{ temporalRole: "previous_version", content: "Old section text",
      documentId: "3", sectionTitle: "Section 7", sourceUrl: "https://gov/earlier" }],
    currentPassages: [{ content: "New section text", documentId: "4",
      sectionTitle: "Section 7", sourceUrl: "https://gov/current" }],
  });
  assert.equal(result.verificationStatus, "source_text_verified");
  assert.equal(result.beforeText[0].text, "Old section text");
  assert.equal(result.afterText[0].text, "New section text");
  assert.deepEqual(result.affectedSections, ["Section 7"]);
  assert.equal(result.limitation, null);
});

test("amendment tracker never synthesizes unavailable historical text", async () => {
  const result = await getAmendmentTracker(4, {
    loadDocument: async () => document,
    loadContext: async () => context,
    loadHistory: async () => [],
    retrieve: async () => ({ passages: [{ content: "Current provision", documentId: "4" }] }),
  });
  assert.deepEqual(result.beforeText, []);
  assert.equal(result.limitation, HISTORY_UNAVAILABLE);
  assert.equal(result.verificationStatus, "relationship_verified_text_incomplete");
});

test("an unverified or absent relationship chain is reported, not inferred", () => {
  const result = assembleAmendmentTracker({ document,
    context: { events: [], relationships: [] }, historicalPassages: [], currentPassages: [] });
  assert.equal(result.verificationStatus, "no_verified_amendment_chain");
  assert.equal(result.limitation, HISTORY_UNAVAILABLE);
});
