const test = require("node:test");
const assert = require("node:assert/strict");
const {
  deterministicProfile,
  normalizeResearchProfile,
  parseJsonObject,
} = require("../document/researchProfileService");

test("research profiles retain purpose and structured discovery fields", () => {
  const profile = normalizeResearchProfile({
    executiveSummary: "The Bill regulates digital lending disclosures.",
    documentPurpose: "Protect borrowers using digital lending services.",
    topics: ["digital lending", "borrower protection"],
    regulators: ["RBI"],
  });
  assert.equal(profile.documentPurpose, "Protect borrowers using digital lending services.");
  assert.deepEqual(profile.topics, ["digital lending", "borrower protection"]);
  assert.deepEqual(profile.regulators, ["RBI"]);
});

test("profile JSON parser rejects non-JSON provider output", () => {
  assert.equal(parseJsonObject('```json\n{"topics":["tax"]}\n```').topics[0], "tax");
  assert.throws(() => parseJsonObject("not json"), /valid JSON/i);
});

test("deterministic profile is a safe fallback without invented legal fields", () => {
  const profile = deterministicProfile({
    title: "Research Report", document_type: "report", category: "Education",
    authority: "University Grants Commission", jurisdiction: "India",
  }, "The report examines research funding and institutional capacity.");
  assert.match(profile.documentPurpose, /research funding/i);
  assert.deepEqual(profile.penalties, []);
  assert.deepEqual(profile.legalInstruments, []);
});
