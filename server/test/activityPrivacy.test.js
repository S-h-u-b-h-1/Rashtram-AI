const test = require("node:test");
const assert = require("node:assert/strict");

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

test(
  "consented activity writes to PostgreSQL without persisting the test fixture",
  { skip: process.env.RUN_ACTIVITY_DB_TEST !== "1" },
  async () => {
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
