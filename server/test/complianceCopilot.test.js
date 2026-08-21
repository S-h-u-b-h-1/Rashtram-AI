const test = require("node:test");
const assert = require("node:assert/strict");
const { runComplianceCopilot } = require("../product/complianceCopilotService");

test("Compliance Copilot returns conditional, cited research and persists by account", async () => {
  let persisted;
  const result = await runComplianceCopilot(7, {
    problem: "An MSME battery recycler in Gujarat needs to understand licence and reporting duties.",
  }, {
    recommend: async () => ({ recommendations: [{
      id: "11", title: "Battery Recycling Rules", documentType: "rule",
      jurisdiction: "Gujarat", authority: "State Pollution Control Board",
      sourceUrl: "https://official.example/rules.pdf",
    }] }),
    discover: async () => ({ concepts: [{ canonicalName: "Battery recycling" }] }),
    loadDocument: async () => ({ id: "11", title: "Battery Recycling Rules", type: "rule",
      documentType: "rule", sourceUrl: "https://official.example/rules.pdf" }),
    retrieve: async () => ({ retrievalVerified: true, passages: [{
      documentId: "11", chunkIndex: 2, content: "An operator shall obtain registration and submit an annual report.",
      ftsScore: 1, authorityClass: "PRIMARY_OFFICIAL", sourceUrl: "https://official.example/rules.pdf",
    }] }),
    persist: async (sql, values) => {
      persisted = { sql, values };
      return { rows: [{ id: 99, created_at: "2026-08-21T00:00:00Z" }] };
    },
  });
  assert.equal(result.id, "99");
  assert.match(result.disclaimer, /not legal advice/i);
  assert.equal(result.evidenceBackedObligations.length, 1);
  assert.equal(result.evidenceBackedRegistrationsPermissions.length, 1);
  assert.deepEqual(result.evidenceBackedObligations[0].citations, ["D1-C1"]);
  assert.match(result.relevantPrimaryDocuments[0].basis, /Potentially relevant/);
  assert.match(persisted.sql, /user_id/);
  assert.equal(persisted.values[0], 7);
});

test("Compliance Copilot does not turn missing penalty evidence into no-penalty advice", async () => {
  const result = await runComplianceCopilot(8, {
    problem: "A logistics company needs to understand regulatory requirements for interstate operations.",
  }, {
    recommend: async () => ({ recommendations: [] }),
    discover: async () => ({ concepts: [] }),
    persist: async () => ({ rows: [{ id: 1 }] }),
  });
  assert.equal(result.potentialPenalties.length, 0);
  assert.ok(result.missingEvidence.some((item) => /not evidence that no penalty exists/i.test(item)));
  assert.equal(result.status, "insufficient_evidence");
});
