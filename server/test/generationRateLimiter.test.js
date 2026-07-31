const test = require("node:test");
const assert = require("node:assert/strict");
const express = require("express");
const { generationLimiter, generalLimiter } = require("../middleware/security");

const withServer = async (app, run) => {
  const server = app.listen(0);
  await new Promise((resolve) => server.once("listening", resolve));
  const { port } = server.address();
  try {
    await run(`http://127.0.0.1:${port}`);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
};

test("generationLimiter blocks after the configured max within the window", async () => {
  const app = express();
  app.post("/generate", generationLimiter, (req, res) => res.json({ ok: true }));
  app.get("/cheap", (req, res) => res.json({ ok: true }));

  await withServer(app, async (base) => {
    let lastStatus = null;
    for (let i = 0; i < 31; i += 1) {
      const response = await fetch(`${base}/generate`, { method: "POST" });
      lastStatus = response.status;
      if (i < 30) {
        assert.equal(response.status, 200, `request ${i + 1} should succeed`);
      }
    }
    assert.equal(lastStatus, 429, "31st request in-window should be rate limited");

    const cheapResponse = await fetch(`${base}/cheap`);
    assert.equal(
      cheapResponse.status,
      200,
      "a route without generationLimiter must be unaffected",
    );
  });
});

test("generationLimiter keys by authenticated user id, not just IP", async () => {
  const app = express();
  app.use((req, res, next) => {
    const userId = req.header("x-test-user-id");
    if (userId) req.user = { id: userId };
    next();
  });
  app.post("/generate", generationLimiter, (req, res) => res.json({ ok: true }));

  await withServer(app, async (base) => {
    for (let i = 0; i < 30; i += 1) {
      const response = await fetch(`${base}/generate`, {
        method: "POST",
        headers: { "x-test-user-id": "user-a" },
      });
      assert.equal(response.status, 200);
    }
    const blocked = await fetch(`${base}/generate`, {
      method: "POST",
      headers: { "x-test-user-id": "user-a" },
    });
    assert.equal(blocked.status, 429, "user-a should now be limited");

    const otherUser = await fetch(`${base}/generate`, {
      method: "POST",
      headers: { "x-test-user-id": "user-b" },
    });
    assert.equal(
      otherUser.status,
      200,
      "a different authenticated user must have their own budget",
    );
  });
});

test("generalLimiter and generationLimiter remain distinct middleware exports", () => {
  assert.notEqual(generalLimiter, generationLimiter);
});
