const assert = require("node:assert/strict");
const test = require("node:test");
const {
  NOT_FOUND, candidateBelongsToState, extractStateEvidence,
  runCrossStateComparison, validateCrossStateInput,
} = require("../product/crossStateComparisonService");

test("cross-state input requires two distinct states", () => {
  assert.deepEqual(validateCrossStateInput({ problem: "Battery recycling rules", states: ["Gujarat", "Odisha"] }),
    { problem: "Battery recycling rules", states: ["Gujarat", "Odisha"] });
  assert.throws(() => validateCrossStateInput({ problem: "Battery recycling rules", states: ["Gujarat"] }));
});

test("candidate identity cannot leak across state retrieval sets", () => {
  assert.equal(candidateBelongsToState({ state: "Gujarat", jurisdiction: "Gujarat" }, "Gujarat"), true);
  assert.equal(candidateBelongsToState({ state: "Odisha", jurisdiction: "Odisha" }, "Gujarat"), false);
  assert.equal(candidateBelongsToState({ jurisdiction: "India" }, "Gujarat"), false);
});

test("absence is labelled not found, never does not apply", () => {
  const state = extractStateEvidence("Gujarat", []);
  for (const key of ["registration", "licensing", "obligations", "prohibitions", "penalties"]) {
    assert.equal(state[key].status, NOT_FOUND);
    assert.notEqual(state[key].status, "does not apply");
  }
});

test("state runs preserve state, document, passage, and source identity", async () => {
  const documents = {
    1: { id: 1, title: "Gujarat Rules", documentType: "rule", jurisdiction: "Gujarat",
      authority: "Gujarat Board", sourceUrl: "https://gujarat.gov/rules" },
    2: { id: 2, title: "Odisha Rules", documentType: "rule", jurisdiction: "Odisha",
      authority: "Odisha Board", sourceUrl: "https://odisha.gov/rules" },
  };
  const inserted = [];
  const result = await runCrossStateComparison(8,
    { problem: "Waste processing licence obligations", states: ["Gujarat", "Odisha"] }, {
      recommend: async (_userId, input) => ({ recommendations: input.states[0] === "Gujarat"
        ? [{ id: "1", jurisdiction: "Gujarat" }, { id: "2", jurisdiction: "Odisha" }]
        : [{ id: "2", jurisdiction: "Odisha" }, { id: "1", jurisdiction: "Gujarat" }] }),
      loadDocument: async (id) => documents[id],
      retrieve: async (_type, id) => ({ retrievalVerified: true, passages: [{
        content: `The operator must obtain a licence for waste processing in ${documents[id].jurisdiction}.`,
        documentId: String(id), sourceUrl: documents[id].sourceUrl,
        authorityClass: "PRIMARY_OFFICIAL", ftsScore: 1, pageStart: 2,
      }] }),
      persist: async (_sql, values) => { inserted.push(values); return { rows: [{ id: 5, created_at: "now" }] }; },
    });
  assert.equal(result.states.length, 2);
  assert.equal(result.states[0].sourceDocuments.length, 1);
  assert.equal(result.states[0].sourceDocuments[0].documentId, "1");
  assert.equal(result.states[1].sourceDocuments[0].documentId, "2");
  assert.equal(result.states[0].licensing.status, "found");
  assert.equal(result.states[0].licensing.findings[0].state, "Gujarat");
  assert.equal(inserted.length, 1);
});
