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
  assert.match(routeSource, /state\.search_ready = TRUE/);
  assert.match(routeSource, /state\.text_ready = TRUE/);
  assert.match(routeSource, /state\.chunks_count > 0/);
  assert.match(routeSource, /state\.failure_code IS NULL/);
  assert.match(routeSource, /EMBEDDING_PROVIDER_ERROR.*VECTOR_STORE_ERROR/s);
  assert.match(routeSource, /FROM document_text_chunks usable_chunk/);
});

test("policy drafting combines a stored summary with retrieved source passages", () => {
  assert.match(routeSource, /\[Catalogue summary:/);
  assert.match(routeSource, /retrieveDocumentContext/);
  assert.match(routeSource, /retrieveFtsPassages/);
  assert.match(routeSource, /retrieveLocalTextPassages/);
  assert.match(vectorSource, /catalogue summary is secondary\s+context/i);
});

test("policy drafting bypasses unrelated generation circuit failures", () => {
  const policyDraftBlock = vectorSource.slice(
    vectorSource.indexOf("const generatePolicyDraft"),
    vectorSource.indexOf("const SUMMARY_GUIDANCE"),
  );
  assert.match(policyDraftBlock, /useCircuitBreaker: false/);
});

test("policy drafting streams markdown, persists canonical JSON, and avoids object coercion", () => {
  assert.match(routeSource, /draft_json = \$2::jsonb/);
  assert.match(routeSource, /for await \(const chunk of stream\)/);
  assert.match(routeSource, /policyDraftMarkdownToCanonical/);
  assert.doesNotMatch(routeSource, /draftText \+= chunk/);
});

test("policy drafting never prepares documents in the generation request", () => {
  assert.doesNotMatch(routeSource, /prepareDocument|processDocument/);
  assert.match(routeSource, /no longer ready to use/);
});
