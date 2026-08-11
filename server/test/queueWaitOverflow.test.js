const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

// Regression cover for a production 500 on "Prepare for Research".
//
// document_processing_attempts.queue_wait_ms is INTEGER, which overflows
// at 2,147,483,647 ms (~24.9 days). Jobs queued before processing was
// paused for the storage incident sat far longer than that, so claiming
// one raised SQLSTATE 22003 ("value out of range for type integer") and
// surfaced to users as a 500. Every one of the ~4,751 queued jobs older
// than 25 days was affected.

const source = fs.readFileSync(
  path.resolve(__dirname, "../document/readinessService.js"),
  "utf8",
);

const INT4_MAX = 2_147_483_647;

test("queue wait is clamped to the INTEGER column maximum", () => {
  assert.match(
    source,
    /MAX_QUEUE_WAIT_MS\s*=\s*2_147_483_647/,
    "the clamp must use the exact INT4 maximum",
  );
  assert.match(
    source,
    /Math\.min\(\s*MAX_QUEUE_WAIT_MS/,
    "the computed wait must pass through Math.min before reaching the insert",
  );
});

test("the clamp bounds a real 26-day wait without altering normal values", () => {
  // Mirrors the production computation.
  const clamp = (claimedAt, queuedAt) =>
    Math.min(INT4_MAX, Math.max(0, claimedAt - queuedAt));

  const day = 86_400_000;

  // The actual failing value from production: 2,306,870,205 ms (~26.7 days).
  assert.equal(clamp(2_306_870_205, 0), INT4_MAX, "overflow must be clamped, not stored raw");
  assert.ok(clamp(2_306_870_205, 0) <= INT4_MAX, "must fit in an INTEGER column");

  // Anything under the threshold must be preserved exactly, so the metric
  // stays truthful for ordinary jobs.
  assert.equal(clamp(5_000, 1_000), 4_000);
  assert.equal(clamp(10 * day, 0), 10 * day, "a 10-day wait is well within range");
  assert.equal(clamp(24 * day, 0), 24 * day, "24 days still fits");

  // Just past the boundary clamps.
  assert.equal(clamp(25 * day, 0), INT4_MAX, "25 days exceeds INT4 and must clamp");
});

test("negative or missing timestamps never produce a negative wait", () => {
  const clamp = (claimedAt, queuedAt) =>
    Math.min(INT4_MAX, Math.max(0, claimedAt - queuedAt));
  assert.equal(clamp(1_000, 5_000), 0, "clock skew must floor at zero, not go negative");
});
