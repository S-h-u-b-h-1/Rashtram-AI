// Serializable-transaction retry support.
//
// CockroachDB runs every transaction at SERIALIZABLE isolation and pushes
// conflict resolution to the client: a contended transaction is aborted
// with SQLSTATE 40001 and the client is expected to retry the whole
// transaction. PostgreSQL at READ COMMITTED (our Neon default) rarely
// raises this, so the retry loop is a no-op there — which is why this
// helper is safe to use on both dialects rather than only on Cockroach.
//
// It deliberately retries ONLY serialization/deadlock failures. A
// constraint violation, a bad column, or a validation error is permanent:
// retrying it would just burn attempts and hide the real bug.

// 40001 serialization_failure  — the Cockroach retry signal
// 40P01 deadlock_detected      — Postgres deadlock, also safe to retry
// 40003 statement_completion_unknown — ambiguous result, retryable per
//                                      Cockroach's own guidance
const RETRYABLE_SQL_STATES = new Set(["40001", "40003", "40P01"]);

const isRetryableTransactionError = (error) => {
  if (!error) return false;
  if (RETRYABLE_SQL_STATES.has(String(error.code))) return true;
  // Cockroach surfaces the retry hint in the message for some driver paths
  // where the SQLSTATE is not propagated cleanly.
  return /restart transaction|retry transaction|RETRY_SERIALIZABLE/i.test(
    String(error.message || ""),
  );
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Full jitter backoff: random between 0 and the capped exponential window.
// Full jitter (rather than fixed or equal jitter) is the right choice for
// write contention — it maximally spreads competing workers that all
// aborted at the same instant, which is exactly the queue-claim scenario.
const backoffDelayMs = (attempt, { baseDelayMs, maxDelayMs, random }) => {
  const exponential = Math.min(maxDelayMs, baseDelayMs * 2 ** (attempt - 1));
  return Math.floor(random() * exponential);
};

/**
 * Run `work` inside a transaction, retrying the WHOLE transaction on
 * serialization failure.
 *
 * `work` receives the client and must not commit/rollback itself — this
 * helper owns the transaction boundary, because a retry has to be able to
 * roll back and replay from a clean state.
 *
 * IMPORTANT: `work` must be idempotent with respect to anything outside
 * the transaction (no sending emails, no Pinecone writes, no counters in
 * module scope), since it can legitimately run more than once.
 */
const withTransactionRetry = async (
  pool,
  work,
  {
    maxAttempts = 5,
    baseDelayMs = 50,
    maxDelayMs = 2_000,
    label = "transaction",
    random = Math.random,
    onRetry = null,
  } = {},
) => {
  let lastError;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const client = await pool.connect();
    let transactionOpen = false;
    try {
      await client.query("BEGIN");
      transactionOpen = true;
      const result = await work(client);
      await client.query("COMMIT");
      transactionOpen = false;
      return result;
    } catch (error) {
      if (transactionOpen) {
        await client.query("ROLLBACK").catch(() => undefined);
      }
      lastError = error;

      if (!isRetryableTransactionError(error) || attempt === maxAttempts) {
        throw error;
      }

      const delay = backoffDelayMs(attempt, { baseDelayMs, maxDelayMs, random });
      if (onRetry) onRetry({ attempt, delay, error });
      else {
        console.warn(
          `${label} hit a serialization conflict (attempt ${attempt}/${maxAttempts}); retrying in ${delay}ms`,
        );
      }
      await sleep(delay);
    } finally {
      client.release();
    }
  }

  throw lastError;
};

module.exports = {
  RETRYABLE_SQL_STATES,
  backoffDelayMs,
  isRetryableTransactionError,
  withTransactionRetry,
};
