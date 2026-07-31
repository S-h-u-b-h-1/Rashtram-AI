// Minimal closed/open/half-open circuit breaker, no dependencies. Wraps a
// call so a downed provider fails fast instead of being hammered with
// retries on every request. Callers keep their own existing fallback
// behavior (local embedding, extractive chat fallback, etc.) — this module
// only decides when to skip the network call.

const createCircuitBreaker = (
  name,
  { failureThreshold = 5, cooldownMs = 30_000 } = {},
) => {
  let state = "closed"; // closed | open | half_open
  let consecutiveFailures = 0;
  let openedAt = 0;

  const exec = async (fn) => {
    if (state === "open") {
      if (Date.now() - openedAt < cooldownMs) {
        // Tried adding "provider unavailable" here to get better failure-
        // taxonomy classification (server/document/failureTaxonomy.js
        // pattern-matches error messages) — reverted: "unavailable" alone
        // matches the taxonomy's broader DOWNLOAD_SERVER_ERROR pattern
        // before it ever reaches the OCR/embedding-specific checks, so it
        // misclassified AI-provider circuit-open events as download
        // failures. Falling through to UNKNOWN_PROCESSING_ERROR (confirmed
        // retryable) is the honest outcome given the taxonomy's current
        // pattern ordering.
        const error = new Error(
          `Circuit "${name}" is open; failing fast without calling the provider.`,
        );
        error.circuitOpen = true;
        error.circuitName = name;
        throw error;
      }
      state = "half_open";
    }

    try {
      const result = await fn();
      state = "closed";
      consecutiveFailures = 0;
      return result;
    } catch (error) {
      consecutiveFailures += 1;
      if (state === "half_open" || consecutiveFailures >= failureThreshold) {
        state = "open";
        openedAt = Date.now();
      }
      throw error;
    }
  };

  const getState = () => ({ name, state, consecutiveFailures });

  const reset = () => {
    state = "closed";
    consecutiveFailures = 0;
    openedAt = 0;
  };

  return { exec, getState, reset };
};

module.exports = { createCircuitBreaker };
