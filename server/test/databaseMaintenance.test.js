const test = require("node:test");
const assert = require("node:assert/strict");
const {
  classifyTable,
  RETENTION_POLICIES,
  runRetention,
} = require("../lib/database/maintenance");
const {
  isPooledConnectionString,
  normalizeConnectionString,
  poolConfig,
} = require("../lib/database/connectionConfig");

test("connection config preserves strict TLS and detects Neon pooled hosts", () => {
  const direct = "postgresql://user:secret@ep-example.neon.tech/db?sslmode=require";
  const pooled = "postgresql://user:secret@ep-example-pooler.neon.tech/db?sslmode=require";
  assert.equal(new URL(normalizeConnectionString(direct)).searchParams.get("sslmode"), "verify-full");
  assert.equal(isPooledConnectionString(direct), false);
  assert.equal(isPooledConnectionString(pooled), true);
  assert.deepEqual(
    { max: poolConfig(pooled).max, idle: poolConfig(pooled).idleTimeoutMillis, connect: poolConfig(pooled).connectionTimeoutMillis },
    { max: 5, idle: 30_000, connect: 10_000 },
  );
});

test("essential and compatibility tables are never automatically cleanup-safe", () => {
  assert.deepEqual(
    ["documents", "research_messages", "document_resources"].map((table) => classifyTable(table).cleanupSafe),
    [false, false, false],
  );
  assert.equal(classifyTable("document_text_chunks").category, "reproducible_derived");
  assert.equal(classifyTable("legislative_documents").category, "legacy_compatibility");
  assert.equal(classifyTable("document_relationship_quarantine").cleanupSafe, false);
});

test("retention predicates are explicit and exclude active production rows", () => {
  const policies = Object.fromEntries(RETENTION_POLICIES.map((policy) => [policy.name, policy]));
  assert.match(policies["expired sessions"].predicate, /expires_at < NOW\(\)/);
  assert.match(policies["completed processing jobs"].predicate, /completed|cancelled/);
  assert.doesNotMatch(policies["completed processing jobs"].predicate, /queued|running/);
  assert.match(policies["failed processing jobs"].predicate, /90 days/);
  assert.match(policies["successful ingestion details"].predicate, /status = 'stored'/);
});

test("retention dry-run counts candidates without issuing deletes", async () => {
  const queries = [];
  const client = {
    query: async (sql) => {
      queries.push(sql);
      return { rows: [{ rows: "2" }], rowCount: 0 };
    },
    release: () => {},
  };
  const result = await runRetention(
    { connect: async () => client },
    { dryRun: true, batchSize: 100, maxBatches: 2 },
  );
  assert.equal(result.results.every((item) => item.candidates === 2 && item.removed === 0), true);
  assert.equal(queries.some((sql) => /DELETE FROM/.test(sql)), false);
});

test("retention apply is bounded by batch size and batch count", async () => {
  const client = {
    query: async (sql) => {
      if (/SELECT COUNT/.test(sql)) return { rows: [{ rows: "99" }], rowCount: 1 };
      return { rows: [{ id: 1 }], rowCount: 1 };
    },
    release: () => {},
  };
  const result = await runRetention(
    { connect: async () => client },
    { dryRun: false, batchSize: 1, maxBatches: 2 },
  );
  assert.equal(result.results.every((item) => item.removed === 2 && item.capped), true);
});
