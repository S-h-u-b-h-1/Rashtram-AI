const test = require("node:test");
const assert = require("node:assert/strict");
const {
  evaluateCompliancePassage,
  metadataOnlyPassage,
  runComplianceCopilot,
} = require("../product/complianceCopilotService");

test("Compliance Copilot returns conditional, cited research and persists by account", async () => {
  let persisted;
  const result = await runComplianceCopilot(7, {
    problem: "An MSME battery recycler in Gujarat needs to understand licence and reporting duties.",
  }, {
    recommend: async () => ({ recommendations: [{
      id: "11", title: "Battery Recycling Rules", documentType: "rule",
      jurisdiction: "Gujarat", authority: "State Pollution Control Board",
      sourceUrl: "https://official.example/rules.pdf",
      relevanceTier: "HIGH_RELEVANCE", authorityClass: "PRIMARY_OFFICIAL",
      reason: "Matches battery recycling, Gujarat, and pollution-control regulation.",
    }] }),
    discover: async () => ({ concepts: [{ canonicalName: "Battery recycling" }] }),
    loadDocument: async () => ({ id: "11", title: "Battery Recycling Rules", type: "rule",
      documentType: "rule", sourceUrl: "https://official.example/rules.pdf" }),
    retrieve: async () => ({ retrievalVerified: true, passages: [{
      documentId: "11", chunkIndex: 2, content: "A battery recycling operator shall obtain registration and submit an annual report.",
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
  assert.match(result.relevantPrimaryDocuments[0].basis, /battery recycling/i);
  assert.match(persisted.sql, /user_id/);
  assert.equal(persisted.values[0], 7);
});

test("weak matches and metadata cannot become compliance obligations", async () => {
  const result = await runComplianceCopilot(9, {
    problem: "An NBFC offering digital loans across India needs RBI compliance requirements.",
  }, {
    recommend: async () => ({ recommendations: [{
      id: "22",
      title: "Parliament Session Productivity Report",
      documentType: "report",
      jurisdiction: "India",
      sourceUrl: "https://example.test/session",
      relevanceTier: "LOW_RELEVANCE",
      authorityClass: "PRIMARY_OFFICIAL",
    }] }),
    discover: async () => ({ concepts: [] }),
    loadDocument: async () => ({ id: "22", title: "Parliament Session Productivity Report" }),
    retrieve: async () => ({ retrievalVerified: true, passages: [{
      content: "Title: Parliament Session Productivity Report. Document type: report. Status: Published. Authority: Parliament.",
      authorityClass: "PRIMARY_OFFICIAL",
    }] }),
    persist: async () => ({ rows: [{ id: 2 }] }),
  });
  assert.equal(result.status, "insufficient_evidence");
  assert.equal(result.evidenceBackedObligations.length, 0);
  assert.equal(result.evidence.length, 0);
  assert.match(result.abstention, /insufficient relevant evidence/i);
});

test("passage gate requires relevance and a real normative statement", () => {
  const recommendation = {
    title: "Battery Waste Management Rules",
    relevanceTier: "HIGH_RELEVANCE",
  };
  const input = {
    problem: "I operate an EV battery recycling facility in Gujarat.",
  };
  const descriptive = evaluateCompliancePassage({
    content: "Battery recycling is an important part of the circular economy.",
  }, input, recommendation);
  const normative = evaluateCompliancePassage({
    content: "A battery recycling facility must obtain authorization before processing battery waste.",
  }, input, recommendation);
  assert.equal(descriptive.relevant, true);
  assert.equal(descriptive.normative, false);
  assert.equal(normative.normative, true);
  assert.equal(metadataOnlyPassage("Title: A. Document type: report. Status: Published. Source: X."), true);
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
