import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const source = fs.readFileSync(
  path.join(process.cwd(), "src/components/policy/PolicyDraftWorkspace.jsx"),
  "utf8",
);

test("policy drafter requests and displays draft-usable references only", () => {
  assert.match(source, /draftOnly:\s*true/);
  assert.match(source, /candidate\.draftUsable/);
  assert.match(source, />Ready to use</);
  assert.doesNotMatch(source, /preparationCandidates/);
  assert.doesNotMatch(source, /Prepared when drafting/);
});

test("policy drafting never starts preparation from the interactive UI", () => {
  assert.doesNotMatch(source, /prepareDocumentForComparison/);
  assert.match(source, /Preparing evidence…/);
  assert.match(source, /onStatus/);
});
