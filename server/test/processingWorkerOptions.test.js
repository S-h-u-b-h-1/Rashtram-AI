const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const { preparationOptions } = require("../document/processingWorkerService");

test("recovery worker forwards deferred semantic and summary flags", () => {
  const job = { id: 12, document_id: 34 };
  assert.deepEqual(preparationOptions({
    job,
    workerId: "release-b-worker",
    discoverGraph: false,
    skipSemantic: true,
    skipSummary: true,
  }), {
    job,
    workerId: "release-b-worker",
    reason: "worker_pool",
    discoverGraph: false,
    skipSemantic: true,
    skipSummary: true,
  });
});

test("bulk recovery does not exclude documents whose readiness class is not assigned yet", () => {
  const workerSource = fs.readFileSync(
    path.join(__dirname, "..", "document", "processingWorkerService.js"),
    "utf8",
  );

  assert.match(
    workerSource,
    /COALESCE\(state\.readiness_class, ''\) NOT IN \([\s\S]*?'processing_failed_permanent'/,
  );
});
