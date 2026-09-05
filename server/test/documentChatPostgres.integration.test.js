const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const { Pool } = require("pg");
const {
  CHAT_STORAGE_LIMITS,
  CLAIM_CHAT_GENERATION_AT_EPOCH_SQL,
  CLEAR_CHAT_GENERATIONS_SQL,
  CLEANUP_CHAT_GENERATIONS_SQL,
  UPSERT_CHAT_MESSAGE_SQL,
} = require("../models/DocumentChat");

const integrationUrl = process.env.CHAT_PERSISTENCE_TEST_DATABASE_URL;

test(
  "PostgreSQL persists one idempotent cited turn under concurrent retries",
  { skip: integrationUrl ? false : "No disposable CHAT_PERSISTENCE_TEST_DATABASE_URL was provided." },
  async () => {
    const pool = new Pool({ connectionString: integrationUrl, max: 4 });
    const schema = `chat_persistence_${crypto.randomUUID().replaceAll("-", "")}`;
    const qualifiedSql = UPSERT_CHAT_MESSAGE_SQL.replaceAll(
      "document_chats",
      `${schema}.document_chats`,
    );
    try {
      await pool.query(`CREATE SCHEMA ${schema}`);
      await pool.query(`CREATE TABLE ${schema}.document_chats (
        id BIGSERIAL PRIMARY KEY,
        user_id BIGINT NOT NULL,
        document_type TEXT NOT NULL,
        document_id TEXT NOT NULL,
        document_title TEXT NOT NULL,
        messages JSONB NOT NULL DEFAULT '[]'::jsonb,
        conversation_epoch BIGINT NOT NULL DEFAULT 0,
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        last_message_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        last_accessed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE (user_id, document_type, document_id)
      )`);
      await pool.query(`CREATE TABLE ${schema}.document_chat_generations (
        user_id BIGINT NOT NULL,
        document_type TEXT NOT NULL,
        document_id TEXT NOT NULL,
        request_id TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'processing',
        owner_token TEXT NOT NULL,
        response_json JSONB,
        conversation_epoch BIGINT NOT NULL DEFAULT 0,
        started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        completed_at TIMESTAMPTZ,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        PRIMARY KEY (user_id, document_type, document_id, request_id)
      )`);
      await pool.query(
        `INSERT INTO ${schema}.document_chats
          (user_id, document_type, document_id, document_title)
         VALUES (8, 'bill', '3646', 'Persistence integration fixture')`,
      );

      const write = (id, message) => pool.query(qualifiedSql, [
        id,
        JSON.stringify([message]),
        8,
        "bill",
        "3646",
        CHAT_STORAGE_LIMITS.messagesPerChat,
        0,
      ]);
      const userMessage = {
        _id: "retry-1:user",
        sender: "user",
        text: "What changed?",
        sources: [],
        metadata: { requestId: "retry-1" },
      };
      const assistantMessage = {
        _id: "retry-1",
        sender: "assistant",
        text: "The cited provision changed.",
        sources: [{ id: "D3646-C1", content: "Verified passage" }],
        metadata: { requestId: "retry-1", generationMode: "ai_verified" },
      };
      await Promise.all([
        write(userMessage._id, userMessage),
        write(userMessage._id, userMessage),
      ]);
      await Promise.all([
        write(assistantMessage._id, assistantMessage),
        write(assistantMessage._id, assistantMessage),
      ]);

      // A separate checkout represents a refreshed or re-authenticated HTTP
      // request reading durable history from PostgreSQL.
      const history = await pool.query(
        `SELECT messages FROM ${schema}.document_chats
         WHERE user_id = 8 AND document_type = 'bill' AND document_id = '3646'`,
      );
      assert.equal(history.rows[0].messages.length, 2);
      assert.equal(history.rows[0].messages[0].sender, "user");
      assert.equal(history.rows[0].messages[1].sender, "assistant");
      assert.deepEqual(history.rows[0].messages[1].sources, assistantMessage.sources);

      for (let index = 0; index < CHAT_STORAGE_LIMITS.messagesPerChat + 5; index += 1) {
        await write(`bounded-${index}`, {
          _id: `bounded-${index}`,
          sender: "user",
          text: `Bounded history ${index}`,
          sources: [],
          metadata: {},
        });
      }
      const boundedHistory = await pool.query(
        `SELECT messages FROM ${schema}.document_chats
         WHERE user_id = 8 AND document_type = 'bill' AND document_id = '3646'`,
      );
      assert.equal(
        boundedHistory.rows[0].messages.length,
        CHAT_STORAGE_LIMITS.messagesPerChat,
      );
      assert.equal(
        boundedHistory.rows[0].messages.at(-1)._id,
        `bounded-${CHAT_STORAGE_LIMITS.messagesPerChat + 4}`,
      );

      const claimSql = CLAIM_CHAT_GENERATION_AT_EPOCH_SQL.replaceAll(
        "document_chat_generations",
        `${schema}.document_chat_generations`,
      );
      const claim = (owner) => pool.query(claimSql, [
        8,
        "bill",
        "3646",
        "concurrent-generation",
        owner,
        0,
      ]);
      const claims = await Promise.all([claim("owner-a"), claim("owner-b")]);
      assert.equal(
        claims.filter((result) => result.rowCount === 1).length,
        1,
        "only one concurrent request may own generation",
      );
      const durableClaim = await pool.query(
        `SELECT status, owner_token FROM ${schema}.document_chat_generations
          WHERE user_id = 8 AND document_type = 'bill'
            AND document_id = '3646' AND request_id = 'concurrent-generation'`,
      );
      assert.equal(durableClaim.rows[0].status, "processing");
      assert.ok(["owner-a", "owner-b"].includes(durableClaim.rows[0].owner_token));

      const terminalRows = Array.from({ length: 205 }, (_, index) => [
        8,
        "bill",
        "3646",
        `completed-${index}`,
        "completed",
        `completed-owner-${index}`,
        JSON.stringify({ text: `Answer ${index}` }),
      ]);
      for (const row of terminalRows) {
        await pool.query(
          `INSERT INTO ${schema}.document_chat_generations
            (user_id, document_type, document_id, request_id, status, owner_token, response_json)
           VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)`,
          row,
        );
      }
      const cleanupSql = CLEANUP_CHAT_GENERATIONS_SQL.replaceAll(
        "document_chat_generations",
        `${schema}.document_chat_generations`,
      );
      const cleaned = await pool.query(cleanupSql, [200, 30, 100]);
      assert.equal(cleaned.rowCount, 5);
      const retainedClaims = await pool.query(
        `SELECT status, COUNT(*)::integer AS count
           FROM ${schema}.document_chat_generations
          GROUP BY status`,
      );
      const counts = Object.fromEntries(
        retainedClaims.rows.map((row) => [row.status, row.count]),
      );
      assert.equal(counts.completed, 200);
      assert.equal(counts.processing, 1, "active generation must survive cleanup");

      const clearClient = await pool.connect();
      await clearClient.query("BEGIN");
      try {
        await clearClient.query(
          `UPDATE ${schema}.document_chats
              SET messages = '[]'::jsonb,
                  conversation_epoch = conversation_epoch + 1
            WHERE user_id = 8 AND document_type = 'bill' AND document_id = '3646'`,
        );
        await clearClient.query(
          CLEAR_CHAT_GENERATIONS_SQL.replaceAll(
            "document_chat_generations",
            `${schema}.document_chat_generations`,
          ),
          [8, "bill", "3646"],
        );
        await clearClient.query("COMMIT");
      } catch (error) {
        await clearClient.query("ROLLBACK");
        throw error;
      } finally {
        clearClient.release();
      }
      const cleared = await pool.query(
        `SELECT messages, conversation_epoch,
                (SELECT COUNT(*)::integer FROM ${schema}.document_chat_generations) AS generations
           FROM ${schema}.document_chats
          WHERE user_id = 8 AND document_type = 'bill' AND document_id = '3646'`,
      );
      assert.deepEqual(cleared.rows[0].messages, []);
      assert.equal(Number(cleared.rows[0].conversation_epoch), 1);
      assert.equal(cleared.rows[0].generations, 0);
    } finally {
      await pool.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`).catch(() => undefined);
      await pool.end();
    }
  },
);
