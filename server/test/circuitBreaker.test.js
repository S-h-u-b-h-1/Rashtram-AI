const test = require("node:test");
const assert = require("node:assert/strict");
const { createCircuitBreaker } = require("../lib/circuitBreaker");

test("closes on success and stays closed", async () => {
  const breaker = createCircuitBreaker("t1", { failureThreshold: 3, cooldownMs: 1000 });
  const result = await breaker.exec(async () => "ok");
  assert.equal(result, "ok");
  assert.equal(breaker.getState().state, "closed");
});

test("opens after the failure threshold and fails fast without invoking fn", async () => {
  const breaker = createCircuitBreaker("t2", { failureThreshold: 3, cooldownMs: 60_000 });
  const failing = async () => {
    throw new Error("provider down");
  };

  for (let i = 0; i < 3; i += 1) {
    await assert.rejects(() => breaker.exec(failing));
  }
  assert.equal(breaker.getState().state, "open");

  let called = false;
  await assert.rejects(
    () =>
      breaker.exec(async () => {
        called = true;
        return "should not run";
      }),
    (error) => error.circuitOpen === true,
  );
  assert.equal(called, false, "fn must not be invoked while the circuit is open");
});

test("half-opens after cooldown and closes again on success", async () => {
  const breaker = createCircuitBreaker("t3", { failureThreshold: 1, cooldownMs: 20 });
  await assert.rejects(() =>
    breaker.exec(async () => {
      throw new Error("boom");
    }),
  );
  assert.equal(breaker.getState().state, "open");

  await new Promise((resolve) => setTimeout(resolve, 30));

  let invoked = 0;
  const result = await breaker.exec(async () => {
    invoked += 1;
    return "recovered";
  });
  assert.equal(result, "recovered");
  assert.equal(invoked, 1, "half-open probe should invoke fn exactly once");
  assert.equal(breaker.getState().state, "closed");
  assert.equal(breaker.getState().consecutiveFailures, 0);
});

test("a single failure during half-open re-opens the circuit", async () => {
  const breaker = createCircuitBreaker("t4", { failureThreshold: 1, cooldownMs: 10 });
  await assert.rejects(() =>
    breaker.exec(async () => {
      throw new Error("first failure");
    }),
  );
  await new Promise((resolve) => setTimeout(resolve, 15));

  await assert.rejects(() =>
    breaker.exec(async () => {
      throw new Error("probe failed too");
    }),
  );
  assert.equal(breaker.getState().state, "open");
});

test("circuit-open errors are never classified as a permanent processing failure", async () => {
  // Whatever specific code the taxonomy assigns a circuit-open error (it
  // varies by breaker name — see the comment in lib/circuitBreaker.js
  // about not over-fitting the message to the taxonomy's pattern order),
  // the one invariant that must always hold is that it's retryable: the
  // circuit will close again after its cooldown, so a job failing on an
  // open circuit must get another attempt, never a permanent failure.
  const { classifyFailureCode, isRetryableFailure } = require("../document/failureTaxonomy");

  const openErrorFor = async (name) => {
    const breaker = createCircuitBreaker(name, { failureThreshold: 1, cooldownMs: 60_000 });
    await assert.rejects(() => breaker.exec(async () => { throw new Error("down"); }));
    try {
      await breaker.exec(async () => "unreachable");
    } catch (error) {
      return error;
    }
    throw new Error("expected the second call to throw");
  };

  for (const name of ["ocr", "embedding:gemini", "generation:gemini"]) {
    const error = await openErrorFor(name);
    const code = classifyFailureCode({ error });
    assert.equal(
      isRetryableFailure(code), true,
      `circuit-open error for "${name}" classified as ${code}, which must be retryable`,
    );
  }
});
