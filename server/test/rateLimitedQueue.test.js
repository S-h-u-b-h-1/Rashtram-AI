const test = require("node:test");
const assert = require("node:assert/strict");
const {
  createRateLimitedQueue,
  isRateLimitError,
  retryAfterSecondsFrom,
} = require("../lib/rateLimitedQueue");

// Gemini's free tier caps generate_content at 20 requests in a short
// window. The circuit breaker only reacts after failures; it cannot stop
// the burst that trips the limit. These tests pin the proactive pacing.

// Virtual clock so the tests assert scheduling behaviour, not wall time.
const harness = () => {
  let clock = 0;
  const sleeps = [];
  return {
    now: () => clock,
    sleep: async (ms) => {
      sleeps.push(ms);
      clock += ms;
    },
    advance: (ms) => {
      clock += ms;
    },
    sleeps,
    get clock() {
      return clock;
    },
  };
};

test("requests below the limit are not delayed", async () => {
  const h = harness();
  const q = createRateLimitedQueue({ maxRequests: 20, windowMs: 60_000, now: h.now, sleep: h.sleep });
  for (let i = 0; i < 18; i += 1) await q.schedule(async () => i);
  assert.equal(h.sleeps.length, 0, "no pacing needed under the cap");
});

test("a burst beyond the effective cap is paced, not rejected", async () => {
  const h = harness();
  const q = createRateLimitedQueue({ maxRequests: 20, windowMs: 60_000, now: h.now, sleep: h.sleep });
  let completed = 0;
  for (let i = 0; i < 25; i += 1) await q.schedule(async () => (completed += 1));
  assert.equal(completed, 25, "every request must still run — pacing, not dropping");
  assert.ok(h.sleeps.length > 0, "the excess must have waited");
});

test("the safety margin keeps us under the advertised limit", () => {
  const q = createRateLimitedQueue({ maxRequests: 20, safetyFactor: 0.9 });
  assert.equal(q.stats().effectiveMax, 18, "20 * 0.9 -> 18, deliberately under the cap");
});

test("uses a sliding window so a boundary cannot allow a double burst", async () => {
  // A fixed window would permit 18 at t=59s and 18 more at t=61s — 36 in
  // ~2 seconds, exactly the burst the provider rejects.
  const h = harness();
  const q = createRateLimitedQueue({ maxRequests: 20, windowMs: 60_000, now: h.now, sleep: h.sleep });
  for (let i = 0; i < 18; i += 1) await q.schedule(async () => i);
  assert.equal(h.sleeps.length, 0);

  h.advance(59_000);
  await q.schedule(async () => "boundary");
  assert.ok(
    h.sleeps.length > 0,
    "the 19th request inside the sliding window must wait, not slip through a boundary",
  );
});

test("a provider Retry-After overrides our own window model", async () => {
  const h = harness();
  const q = createRateLimitedQueue({ maxRequests: 20, windowMs: 60_000, now: h.now, sleep: h.sleep });
  q.noteRetryAfter(17);
  await q.schedule(async () => "after-backoff");
  assert.ok(
    h.sleeps.some((ms) => ms >= 17_000),
    "must honour the provider's stated wait even when our window looks free",
  );
});

test("a bounded queue wait fails fast instead of hanging callers", async () => {
  const h = harness();
  const q = createRateLimitedQueue({ maxRequests: 20, windowMs: 60_000, now: h.now, sleep: h.sleep });
  q.noteRetryAfter(17);
  await assert.rejects(
    () => q.schedule(async () => "too-late", { maxWaitMs: 5_000 }),
    /queue wait exceeded 5000ms/,
  );
  assert.equal(h.sleeps.length, 0, "bounded callers should fail before sleeping");
});

test("parses Gemini's retryDelay and standard Retry-After", () => {
  assert.equal(
    retryAfterSecondsFrom({ message: 'RESOURCE_EXHAUSTED ... "retryDelay":"17s"' }),
    17,
  );
  assert.equal(retryAfterSecondsFrom({ headers: { "retry-after": "30" } }), 30);
  assert.equal(
    retryAfterSecondsFrom({ message: "Please retry in 54.74512636s." }),
    54.74512636,
  );
  assert.equal(retryAfterSecondsFrom({ message: "unrelated failure" }), 0);
});

test("recognises the exact free-tier throttle signature", () => {
  assert.equal(
    isRateLimitError({ message: "generate_content_free_tier_requests, limit: 20" }),
    true,
  );
  assert.equal(isRateLimitError({ status: 429 }), true);
  assert.equal(isRateLimitError({ message: "You exceeded your current quota" }), true);
  assert.equal(isRateLimitError({ status: 500, message: "internal" }), false);
});

test("one failing request does not wedge the queue for later callers", async () => {
  const h = harness();
  const q = createRateLimitedQueue({ maxRequests: 20, windowMs: 60_000, now: h.now, sleep: h.sleep });
  await assert.rejects(() => q.schedule(async () => { throw new Error("boom"); }));
  assert.equal(await q.schedule(async () => "still works"), "still works");
});
