// Canonical source identity and alias resolution.
//
// The same upstream source can appear under more than one source_name
// when a connector is rewritten. PolicyEdge is the live example: 1,159
// documents were bulk-imported on 2026-07-03 under "policyedge" using
// slug identifiers (rbi-eases-forex-rules-to-facilitate), while the
// current connector writes "policy-edge" using SHA-1 identifiers. Both
// point at policyedge.in/p/<article>.
//
// Deliberately NOT solved by renaming rows:
//
//   * The two identifier schemes are incompatible. Collapsing them into
//     one source_name merges two ID namespaces, so the next time the
//     connector meets a legacy article it computes a SHA-1 that matches
//     no existing slug row and inserts a duplicate — of data that is 32%
//     of the entire research-ready corpus (1,004 of 3,107 ready docs).
//   * Rewriting canonical_source on historical rows destroys the
//     provenance record of how those documents actually arrived.
//
// Aliasing fixes what is actually broken — freshness and health metrics
// being split across two names — while leaving every document row, its
// identifiers, and its provenance untouched.

// alias -> canonical
const SOURCE_ALIASES = Object.freeze({
  // Retired bulk-import identity for PolicyEdge (2026-07-03). Retained
  // read-only; the active connector is "policy-edge".
  policyedge: "policy-edge",
});

const canonicalSourceName = (sourceName) => {
  const name = String(sourceName || "").trim();
  if (!name) return name;
  return SOURCE_ALIASES[name] || name;
};

// Every name that should roll up into one canonical source, canonical
// first. Use this when aggregating counts, freshness, or health so a
// retired identity's documents are not invisible.
const sourceNameGroup = (canonicalName) => {
  const canonical = canonicalSourceName(canonicalName);
  const aliases = Object.entries(SOURCE_ALIASES)
    .filter(([, target]) => target === canonical)
    .map(([alias]) => alias);
  return [canonical, ...aliases];
};

const isRetiredSourceIdentity = (sourceName) =>
  Object.hasOwn(SOURCE_ALIASES, String(sourceName || "").trim());

module.exports = {
  SOURCE_ALIASES,
  canonicalSourceName,
  isRetiredSourceIdentity,
  sourceNameGroup,
};
