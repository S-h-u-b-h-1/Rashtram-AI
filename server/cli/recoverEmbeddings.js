#!/usr/bin/env node

// Compatibility entrypoint. Semantic recovery now uses the same bounded,
// capability-aware, retrieval-verified path as Semantic Coverage V1.
// Provider/model overrides are intentionally unsupported: changing either
// would silently select a different vector space and orphan active vectors.
if (process.argv.some((value) => /^--(?:provider|model)(?:=|$)/.test(value))) {
  console.error(
    "Provider/model overrides are disabled. Configure and audit one versioned embedding namespace before recovery.",
  );
  process.exitCode = 1;
} else {
  require("./backfillSemanticCoverage");
}
