const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const routeSource = fs.readFileSync(
  path.join(__dirname, "../policy/draftRoute.js"),
  "utf8",
);
const vectorSource = fs.readFileSync(
  path.join(__dirname, "../lib/vectordb.js"),
  "utf8",
);

test("policy drafting reads readiness from the canonical document schema", () => {
  assert.match(
    routeSource,
    /JOIN documents catalogue_document ON catalogue_document\.id = d\.id/,
  );
  assert.doesNotMatch(routeSource, /AND d\.research_ready = TRUE/);
});

test("policy drafting can use a stored executive summary without claiming full-text evidence", () => {
  assert.match(routeSource, /LENGTH\(BTRIM\(COALESCE\(a\.english_summary/);
  assert.match(routeSource, /\[Catalogue summary:/);
  assert.match(vectorSource, /catalogue summary is secondary\s+context/i);
});

test("policy drafting bypasses unrelated generation circuit failures", () => {
  const policyDraftBlock = vectorSource.slice(
    vectorSource.indexOf("const generatePolicyDraft"),
    vectorSource.indexOf("const SUMMARY_GUIDANCE"),
  );
  assert.match(policyDraftBlock, /useCircuitBreaker: false/);
});
