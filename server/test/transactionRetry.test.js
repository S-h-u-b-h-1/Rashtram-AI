const test = require("node:test");
const assert = require("node:assert/strict");
const {
  backoffDelayMs,
  isRetryableTransactionError,
  withTransactionRetry,
} = require("../lib/database/transactionRetry");

// Minimal pool/client double that records the exact statement sequence, so
// the tests assert real transaction-boundary behavior rather than just
// "the function returned".
const fakePool = (behaviors) => {
  const statements = [];
  let call = 0;
  return {
    statements,
    released: 0,
    connect: async function () {
      const pool = this;
      return {
        query: async (text) => {
          statements.push(text);
          return { rows: [] };
        },
        release: () => {
          pool.released += 1;
        },
      };
    },
    nextBehavior: () => behaviors[call++],
  };
};

test("commits and returns the result when work succeeds", async () => {
  const pool = fakePool([]);
  const result = await withTransactionRetry(pool, async () => "ok");
  assert.equal(result, "ok");
  assert.deepEqual(pool.statements, ["BEGIN", "COMMIT"]);
  assert.equal(pool.released, 1, "client must be released");
});

test("retries the whole transaction on a 40001 serialization failure", async () => {
  const pool = fakePool([]);
  let attempts = 0;
  const result = await withTransactionRetry(
    pool,
    async () => {
      attempts += 1;
      if (attempts < 3) {
        const error = new Error("restart transaction: TransactionRetryError");
        error.code = "40001";
        throw error;
      }
      return "recovered";
    },
    { baseDelayMs: 1, maxDelayMs: 2, onRetry: () => {} },
  );

  assert.equal(result, "recovered");
  assert.equal(attempts, 3);
  // Each failed attempt must ROLLBACK before the next BEGIN — otherwise a
  // retry would replay on top of dirty state.
  assert.deepEqual(pool.statements, [
    "BEGIN", "ROLLBACK",
    "BEGIN", "ROLLBACK",
    "BEGIN", "COMMIT",
  ]);
  assert.equal(pool.released, 3, "every attempt must release its client");
});

test("does NOT retry a permanent error such as a constraint violation", async () => {
  const pool = fakePool([]);
  let attempts = 0;
  await assert.rejects(
    () =>
      withTransactionRetry(pool, async () => {
        attempts += 1;
        const error = new Error("duplicate key value violates unique constraint");
        error.code = "23505";
        throw error;
      }),
    /duplicate key/,
  );
  assert.equal(attempts, 1, "a constraint violation must fail immediately");
  assert.deepEqual(pool.statements, ["BEGIN", "ROLLBACK"]);
});

test("gives up after maxAttempts and rethrows the last serialization error", async () => {
  const pool = fakePool([]);
  let attempts = 0;
  await assert.rejects(
    () =>
      withTransactionRetry(
        pool,
        async () => {
          attempts += 1;
          const error = new Error("restart transaction");
          error.code = "40001";
          throw error;
        },
        { maxAttempts: 3, baseDelayMs: 1, maxDelayMs: 2, onRetry: () => {} },
      ),
    /restart transaction/,
  );
  assert.equal(attempts, 3);
});

test("classifies retryable vs permanent errors correctly", () => {
  assert.equal(isRetryableTransactionError({ code: "40001" }), true);
  assert.equal(isRetryableTransactionError({ code: "40P01" }), true);
  assert.equal(isRetryableTransactionError({ code: "40003" }), true);
  assert.equal(
    isRetryableTransactionError({ message: "RETRY_SERIALIZABLE - failed" }),
    true,
    "message-based detection covers drivers that drop the SQLSTATE",
  );
  assert.equal(isRetryableTransactionError({ code: "23505" }), false);
  assert.equal(isRetryableTransactionError({ code: "42703" }), false);
  assert.equal(isRetryableTransactionError(null), false);
});

test("backoff uses full jitter and stays within the capped window", () => {
  // random()=1 yields the top of the window, proving the cap is applied.
  assert.equal(
    backoffDelayMs(1, { baseDelayMs: 50, maxDelayMs: 2000, random: () => 1 }),
    50,
  );
  assert.equal(
    backoffDelayMs(3, { baseDelayMs: 50, maxDelayMs: 2000, random: () => 1 }),
    200,
  );
  // Exponential growth must saturate at maxDelayMs, not run away.
  assert.equal(
    backoffDelayMs(20, { baseDelayMs: 50, maxDelayMs: 2000, random: () => 1 }),
    2000,
  );
  // Full jitter must be able to return 0 so competing workers de-sync.
  assert.equal(
    backoffDelayMs(5, { baseDelayMs: 50, maxDelayMs: 2000, random: () => 0 }),
    0,
  );
});
