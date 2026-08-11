// Proactive client-side pacing for provider request limits.
//
// The circuit breaker in circuitBreaker.js reacts AFTER failures; it stops
// hammering a provider that is already down. It cannot prevent the failure
// that trips it. Gemini's free tier enforces a short-window cap
// (generate_content_free_tier_requests, limit 20 for gemini-2.5-flash),
// so a burst of parallel calls fails even though the account has plenty of
// daily quota left. Retrying that burst just produces more failures and
// burns queue attempts.
//
// This paces requests so the limit is respected before it is hit, using a
// sliding window rather than a fixed one: a fixed window allows 2x the
// limit across a boundary (20 at 0:59, 20 more at 1:01), which is exactly
// the burst the provider rejects.

const createRateLimitedQueue = ({
  maxRequests = 20,
  windowMs = 60_000,
  // Safety margin: run slightly under the advertised limit, because the
  // provider's window and ours are not perfectly aligned.
  safetyFactor = 0.9,
  now = () => Date.now(),
  sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
} = {}) => {
  const effectiveMax = Math.max(1, Math.floor(maxRequests * safetyFactor));
  let timestamps = [];
  // Serialises admission so concurrent callers cannot all observe the same
  // free slot and overshoot together.
  let admission = Promise.resolve();
  let retryAfterUntil = 0;

  const prune = (t) => {
    const cutoff = t - windowMs;
    timestamps = timestamps.filter((stamp) => stamp > cutoff);
  };

  const waitForSlot = async () => {
    for (;;) {
      const t = now();

      // A provider-supplied Retry-After always wins over our own model of
      // the window — it reflects state we cannot see.
      if (retryAfterUntil > t) {
        await sleep(retryAfterUntil - t);
        continue;
      }

      prune(t);
      if (timestamps.length < effectiveMax) {
        timestamps.push(t);
        return;
      }

      // Wait until the oldest request leaves the sliding window.
      const oldest = timestamps[0];
      await sleep(Math.max(1, oldest + windowMs - t));
    }
  };

  /** Record a provider-supplied Retry-After (seconds) or explicit delay. */
  const noteRetryAfter = (seconds) => {
    const ms = Math.max(0, Number(seconds) || 0) * 1000;
    if (ms > 0) retryAfterUntil = Math.max(retryAfterUntil, now() + ms);
  };

  const schedule = async (fn) => {
    const ticket = admission.then(waitForSlot);
    // Keep the chain alive even if this admission rejects, so one failure
    // cannot wedge the queue for every later caller.
    admission = ticket.catch(() => undefined);
    await ticket;
    return fn();
  };

  const stats = () => {
    prune(now());
    return {
      inWindow: timestamps.length,
      effectiveMax,
      windowMs,
      throttledUntil: retryAfterUntil > now() ? retryAfterUntil : null,
    };
  };

  return { noteRetryAfter, schedule, stats };
};

// Parses the wait hint Gemini returns on 429 (RetryInfo.retryDelay, e.g.
// "17s"), falling back to a standard Retry-After header value.
const retryAfterSecondsFrom = (error) => {
  const header = error?.headers?.["retry-after"] ?? error?.retryAfter;
  if (header && Number.isFinite(Number(header))) return Number(header);
  const message = String(error?.message || "");
  const retryInfo = message.match(/retryDelay["':\s]+(\d+(?:\.\d+)?)s/i);
  if (retryInfo) return Number(retryInfo[1]);
  const retryIn = message.match(/retry\s+(?:in|after)\s+(\d+(?:\.\d+)?)s/i);
  if (retryIn) return Number(retryIn[1]);
  return 0;
};

const isRateLimitError = (error) => {
  const status = Number(error?.status || error?.code);
  const message = String(error?.message || "");
  return (
    status === 429 ||
    /rate limit|too many requests|quota|free_tier_requests/i.test(message)
  );
};

module.exports = {
  createRateLimitedQueue,
  isRateLimitError,
  retryAfterSecondsFrom,
};
