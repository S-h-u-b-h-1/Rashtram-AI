const test = require("node:test");
const assert = require("node:assert/strict");
const { sendError } = require("../lib/httpResponse");

const responseFixture = () => ({
  statusCode: null,
  body: null,
  status(code) {
    this.statusCode = code;
    return this;
  },
  json(payload) {
    this.body = payload;
    return this;
  },
});

test("5xx errors never leak the raw error message, but include a request ID", () => {
  const res = responseFixture();
  const error = new Error("password=hunter2 leaked in a stack trace");
  sendError(res, error, "context");
  assert.equal(res.statusCode, 500);
  assert.equal(res.body.error, "Internal server error.");
  assert.ok(res.body.requestId, "a request id should be present for tracing");
  assert.ok(!JSON.stringify(res.body).includes("hunter2"));
});

test("4xx errors pass the message through since it's meant for the client", () => {
  const res = responseFixture();
  const error = new Error("Document not found.");
  error.status = 404;
  sendError(res, error, "context");
  assert.equal(res.statusCode, 404);
  assert.equal(res.body.error, "Document not found.");
  assert.equal(res.body.requestId, undefined);
});

test("4xx errors include details when the error carries them", () => {
  const res = responseFixture();
  const error = new Error("Invalid input.");
  error.status = 422;
  error.details = { field: "email" };
  sendError(res, error, "context");
  assert.deepEqual(res.body.details, { field: "email" });
});

test("defaults to 500 when the error has no explicit status", () => {
  const res = responseFixture();
  sendError(res, new Error("boom"), "context");
  assert.equal(res.statusCode, 500);
});
