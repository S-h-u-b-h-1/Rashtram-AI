const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const jwt = require("jsonwebtoken");
const fetchuser = require("../middleware/fetchuser");

const {
  recordActivity,
  sanitizeJsonObject,
  sanitizePath,
  sanitizeReferrer,
  updateActivityPreferences,
  validateActivityPayload,
} = require("../activity/activityService");

test("activity validation accepts only the documented event allowlist", () => {
  const activity = validateActivityPayload({
    event_type: "document_opened",
    entity_type: "act",
    entity_id: "42",
    document_id: "42",
    page_path: "/app",
    metadata_json: { jurisdiction: "India" },
  });
  assert.equal(activity.eventType, "document_opened");
  assert.equal(activity.documentId, 42);
  assert.throws(
    () => validateActivityPayload({ event_type: "password_copied" }),
    /Unsupported activity event type/,
  );
});

test("activity paths and referrers never retain query secrets", () => {
  assert.equal(sanitizePath("/app?token=secret#section"), "/app");
  assert.equal(
    sanitizeReferrer("https://rashtram.example/app?token=secret"),
    "https://rashtram.example/app",
  );
});

test("activity metadata removes secret-like keys and bounds nested input", () => {
  const metadata = sanitizeJsonObject(
    {
      topic: "Environment",
      accessToken: "must-not-survive",
      nested: {
        api_key: "must-not-survive",
        jurisdiction: "India",
      },
    },
    "metadata_json",
  );
  assert.equal(metadata.topic, "Environment");
  assert.equal("accessToken" in metadata, false);
  assert.deepEqual(metadata.nested, { jurisdiction: "India" });
});

test("activity validation rejects invalid identifiers and JSON shapes", () => {
  assert.throws(
    () =>
      validateActivityPayload({
        event_type: "document_opened",
        document_id: "-1",
      }),
    /positive integer/,
  );
  assert.throws(
    () =>
      validateActivityPayload({
        event_type: "filter_used",
        filters_json: ["not", "an", "object"],
      }),
    /must be a JSON object/,
  );
});

test("personalization cannot be enabled without activity consent", async () => {
  await assert.rejects(
    updateActivityPreferences(
      1,
      {
        activityTrackingEnabled: false,
        personalizationEnabled: true,
      },
      async () => ({ rows: [] }),
    ),
    /requires research activity history/,
  );
});

test("activity and product routes reject unauthenticated requests", () => {
  let nextCalled = false;
  const response = {
    statusCode: null,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
  };
  fetchuser(
    { header: () => null },
    response,
    () => {
      nextCalled = true;
    },
  );
  assert.equal(response.statusCode, 401);
  assert.equal(nextCalled, false);
  assert.match(response.body.error, /No token provided/);
});

test("legacy JWTs remain valid while new session-aware tokens roll out", async () => {
  const previousSecret = process.env.JWT_SECRET;
  process.env.JWT_SECRET = "test-session-compatibility-secret";
  const token = jwt.sign(
    { user: { id: "7" } },
    process.env.JWT_SECRET,
    {
      issuer: "rashtram-ai",
      audience: "rashtram-ai-client",
      expiresIn: "5m",
    },
  );
  let nextCalled = false;
  const request = {
    user: null,
    header(name) {
      return name === "auth-token" ? token : null;
    },
  };
  const response = {
    status() {
      return this;
    },
    json() {
      return this;
    },
  };
  await fetchuser(request, response, () => {
    nextCalled = true;
  });
  assert.equal(nextCalled, true);
  assert.equal(request.user.id, "7");
  if (previousSecret === undefined) delete process.env.JWT_SECRET;
  else process.env.JWT_SECRET = previousSecret;
});

test(
  "consented activity writes to PostgreSQL without persisting the test fixture",
  { skip: process.env.RUN_ACTIVITY_DB_TEST !== "1" },
  async () => {
    require("dotenv").config({
      path: process.env.ENV_FILE || path.resolve(__dirname, "../.env.local"),
    });
    const { connectDB, getPool } = require("../db");
    await connectDB();
    const client = await getPool().connect();
    const execute = client.query.bind(client);
    try {
      await client.query("BEGIN");
      const user = await client.query(
        `INSERT INTO users (name, email, password)
         VALUES ('Activity Test', $1, NULL)
         RETURNING id`,
        [`activity-test-${Date.now()}@example.invalid`],
      );
      const userId = user.rows[0].id;
      await updateActivityPreferences(
        userId,
        {
          activityTrackingEnabled: true,
          personalizationEnabled: true,
        },
        execute,
      );
      const result = await recordActivity(
        userId,
        {
          event_type: "document_opened",
          entity_type: "act",
          entity_id: "1",
          document_id: "1",
          page_path: "/app?token=must-not-persist",
          metadata_json: {
            documentType: "act",
            jurisdiction: "India",
          },
        },
        { referrer: "https://rashtram.example/app?token=must-not-persist" },
        execute,
      );
      assert.equal(result.tracked, true);
      const stored = await client.query(
        `SELECT page_path, referrer
         FROM user_activity_events
         WHERE user_id = $1`,
        [userId],
      );
      assert.equal(stored.rowCount, 1);
      assert.equal(stored.rows[0].page_path, "/app");
      assert.equal(stored.rows[0].referrer, "https://rashtram.example/app");
    } finally {
      await client.query("ROLLBACK");
      client.release();
      await getPool().end();
    }
  },
);
