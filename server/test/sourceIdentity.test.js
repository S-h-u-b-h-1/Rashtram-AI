const test = require("node:test");
const assert = require("node:assert/strict");
const {
  SOURCE_ALIASES,
  canonicalSourceName,
  isRetiredSourceIdentity,
  sourceNameGroup,
} = require("../lib/ingestion/core/sourceIdentity");

// PolicyEdge exists under two source_names: "policyedge" (1,159 docs bulk
// imported 2026-07-03, slug identifiers) and "policy-edge" (the live
// connector, SHA-1 identifiers). Same upstream site, incompatible ID
// schemes. These tests pin the aliasing behaviour and, importantly, the
// decision NOT to rewrite historical rows.

test("a retired identity resolves to the active canonical name", () => {
  assert.equal(canonicalSourceName("policyedge"), "policy-edge");
});

test("the canonical name resolves to itself (idempotent)", () => {
  assert.equal(canonicalSourceName("policy-edge"), "policy-edge");
  assert.equal(
    canonicalSourceName(canonicalSourceName("policyedge")),
    "policy-edge",
    "resolving twice must not drift",
  );
});

test("unrelated sources are never rewritten", () => {
  for (const name of ["prs-india", "pib", "india-code", "regulator-sebi"]) {
    assert.equal(canonicalSourceName(name), name);
  }
});

test("the group covers canonical plus every retired alias", () => {
  const group = sourceNameGroup("policy-edge");
  assert.ok(group.includes("policy-edge"), "must include the active name");
  assert.ok(group.includes("policyedge"), "must include the retired name");
  assert.equal(group[0], "policy-edge", "canonical name comes first");
});

test("grouping by a retired name yields the same group", () => {
  assert.deepEqual(
    [...sourceNameGroup("policyedge")].sort(),
    [...sourceNameGroup("policy-edge")].sort(),
    "freshness must aggregate identically regardless of which name is asked for",
  );
});

test("a source with no aliases groups to just itself", () => {
  assert.deepEqual(sourceNameGroup("prs-india"), ["prs-india"]);
});

test("retired identities are identifiable", () => {
  assert.equal(isRetiredSourceIdentity("policyedge"), true);
  assert.equal(isRetiredSourceIdentity("policy-edge"), false);
  assert.equal(isRetiredSourceIdentity("prs-india"), false);
});

test("no alias points at another alias", () => {
  // A chain would make resolution order-dependent and non-idempotent.
  for (const target of Object.values(SOURCE_ALIASES)) {
    assert.ok(
      !Object.hasOwn(SOURCE_ALIASES, target),
      `alias target "${target}" must not itself be an alias`,
    );
  }
});

test("empty and blank names are handled without throwing", () => {
  assert.equal(canonicalSourceName(""), "");
  assert.equal(canonicalSourceName(null), "");
  assert.equal(canonicalSourceName(undefined), "");
});

test("aliasing is name-resolution only and prescribes no row rewrite", () => {
  // Guards the deliberate decision documented in sourceIdentity.js:
  // merging the two ID namespaces risks duplicating 1,004 research-ready
  // documents, so historical canonical_source values stay untouched.
  const source = require("node:fs").readFileSync(
    require("node:path").resolve(__dirname, "../lib/ingestion/core/sourceIdentity.js"),
    "utf8",
  );
  assert.ok(
    !/UPDATE\s+legislative_documents|UPDATE\s+document_sources/i.test(source),
    "source identity resolution must never rewrite document rows",
  );
});
