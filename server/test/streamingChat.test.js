const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const {
  completeSSE,
  errorSSE,
  sendSSE,
  startSSE,
} = require("../lib/sse");

const responseFixture = () => ({
  destroyed: false,
  writableEnded: false,
  headers: {},
  writes: [],
  statusCode: null,
  flushed: false,
  status(value) {
    this.statusCode = value;
    return this;
  },
  setHeader(name, value) {
    this.headers[name] = value;
  },
  flushHeaders() {
    this.flushed = true;
  },
  write(value) {
    this.writes.push(value);
    return true;
  },
  end() {
    this.writableEnded = true;
  },
});

test("SSE responses disable buffering and flush headers immediately", () => {
  const response = responseFixture();
  startSSE(response);
  assert.equal(response.statusCode, 200);
  assert.equal(response.headers["Content-Type"], "text/event-stream; charset=utf-8");
  assert.equal(response.headers["Cache-Control"], "no-cache, no-transform");
  assert.equal(response.headers.Connection, "keep-alive");
  assert.equal(response.headers["X-Accel-Buffering"], "no");
  assert.equal(response.flushed, true);
});

test("SSE streams emit progressive content and an explicit done event", () => {
  const response = responseFixture();
  startSSE(response);
  sendSSE(response, { type: "content", content: "Hello" });
  completeSSE(response, { persisted: true });
  assert.match(response.writes[0], /"type":"content"/);
  assert.match(response.writes[1], /"type":"done"/);
  assert.match(response.writes[1], /"persisted":true/);
  assert.equal(response.writes[2], "data: [DONE]\n\n");
  assert.equal(response.writableEnded, true);
});

test("SSE failures terminate with a structured error event", () => {
  const response = responseFixture();
  startSSE(response);
  errorSSE(response, new Error("stream interrupted"));
  assert.match(response.writes[0], /"type":"error"/);
  assert.match(response.writes[0], /stream interrupted/);
  assert.equal(response.writableEnded, true);
});

test("serverless schema initialization is serialized and versioned", () => {
  const databaseSource = fs.readFileSync(
    path.join(__dirname, "..", "db.js"),
    "utf8",
  );
  assert.match(databaseSource, /pg_advisory_xact_lock/);
  assert.match(databaseSource, /BEGIN/);
  assert.match(databaseSource, /COMMIT/);
  assert.match(databaseSource, /application_schema_versions/);
  assert.match(databaseSource, /SCHEMA_VERSION/);
});
