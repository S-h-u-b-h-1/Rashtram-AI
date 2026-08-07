const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const source = fs.readFileSync(
  path.resolve(__dirname, "../lib/ingestion/core/catalogRepository.js"),
  "utf8",
);

// completeRun() only runs on the happy path, so a killed worker leaves a
// run stuck in 'running'. Source health reads the latest run per source,
// so a single orphan makes that source report as perpetually "running"
// with a frozen refresh age — masking a source that has actually stopped
// ingesting. These tests pin the reaper's safety properties.

test("the reaper only targets runs that are both running and past the threshold", () => {
  const reaper = source.slice(
    source.indexOf("const reapStaleRuns"),
    source.indexOf("const createRun"),
  );
  assert.match(reaper, /WHERE status = 'running'/, "must not touch finished runs");
  assert.match(
    reaper,
    /started_at < NOW\(\) - \(\$1 \|\| ' hours'\)::INTERVAL/,
    "must be time-bounded so a slow-but-alive run is never reaped",
  );
  assert.ok(
    !/DELETE\s+FROM\s+ingestion_runs/i.test(reaper),
    "must mark runs failed for auditability, never delete the history",
  );
});

test("the stale threshold exceeds the longest legitimate run", () => {
  const match = source.match(/const STALE_RUN_HOURS = (\d+)/);
  assert.ok(match, "threshold must be a named constant, not a magic number");
  // The corpus-processing workflow allows 330 minutes (5.5h); reaping at
  // or below that could kill a healthy long run mid-flight.
  assert.ok(
    Number(match[1]) >= 6,
    `threshold ${match[1]}h must exceed the 5.5h corpus-processing ceiling`,
  );
});

test("reaped runs are annotated with a diagnosable cause", () => {
  const reaper = source.slice(
    source.indexOf("const reapStaleRuns"),
    source.indexOf("const createRun"),
  );
  assert.match(reaper, /RUN_ABANDONED/, "must record a machine-readable code");
  assert.match(
    reaper,
    /COALESCE\(errors, '\[\]'::jsonb\) \|\| \$2::jsonb/,
    "must append to existing errors rather than overwrite prior diagnostics",
  );
});

test("reaping never blocks a new ingestion run from starting", () => {
  const createRun = source.slice(
    source.indexOf("const createRun"),
    source.indexOf("const completeRun"),
  );
  assert.match(createRun, /reapStaleRuns\(\)/, "cleanup runs on run creation");
  assert.match(
    createRun,
    /\.catch\(/,
    "cleanup must be best-effort; a reap failure must not stop ingestion",
  );
});

test("the reaper is exported so it can be invoked operationally", () => {
  assert.match(source, /^\s{2}reapStaleRuns,$/m);
});
