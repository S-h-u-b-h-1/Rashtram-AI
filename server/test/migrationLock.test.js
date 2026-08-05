const test = require("node:test");
const assert = require("node:assert/strict");
const {
  POSTGRES_MIGRATION_LOCK_KEY,
  adapterForDialect,
  cockroachAdapter,
  postgresAdapter,
} = require("../lib/database/migrationLock");

// A fake that models the ONE property the lease design depends on: the
// conditional ON CONFLICT ... WHERE lease_expires_at < NOW() is atomic, so
// exactly one of N concurrent acquirers can win while a lease is live.
const fakeCockroachCluster = () => {
  const rows = new Map(); // lock_name -> { owner_id, expiresAtMs }
  let now = 1_000_000;
  return {
    advanceMs: (ms) => {
      now += ms;
    },
    heldBy: (name) => rows.get(name)?.owner_id ?? null,
    client: {
      query: async (sql, params = []) => {
        if (sql.includes("CREATE TABLE")) return { rowCount: 0, rows: [] };

        if (sql.includes("INSERT INTO schema_migration_lock")) {
          const [lockName, ownerId, leaseSeconds] = params;
          const existing = rows.get(lockName);
          const leaseLive = existing && existing.expiresAtMs > now;
          if (leaseLive) return { rowCount: 0, rows: [] };
          rows.set(lockName, {
            owner_id: ownerId,
            expiresAtMs: now + Number(leaseSeconds) * 1000,
          });
          return { rowCount: 1, rows: [{ owner_id: ownerId }] };
        }

        if (sql.includes("DELETE FROM schema_migration_lock")) {
          const [lockName, ownerId] = params;
          const existing = rows.get(lockName);
          if (existing && existing.owner_id === ownerId) rows.delete(lockName);
          return { rowCount: 1, rows: [] };
        }
        return { rowCount: 0, rows: [] };
      },
    },
  };
};

test("postgres path still uses the advisory lock and does not create a lease table", async () => {
  const statements = [];
  const client = {
    query: async (sql, params) => {
      statements.push({ sql, params });
      return { rowCount: 1, rows: [] };
    },
  };

  const result = await postgresAdapter.withMigrationLock(client, async () => "done");

  assert.equal(result, "done");
  assert.equal(statements.length, 1, "postgres must issue exactly the advisory lock");
  assert.match(statements[0].sql, /pg_advisory_xact_lock/);
  assert.deepEqual(statements[0].params, [POSTGRES_MIGRATION_LOCK_KEY]);
  assert.ok(
    !statements.some((s) => /schema_migration_lock/.test(s.sql)),
    "the Neon/Postgres path must not touch the Cockroach lease table",
  );
});

test("exactly one of two concurrent cockroach runners applies migrations", async () => {
  const cluster = fakeCockroachCluster();
  let applied = 0;
  const runner = (ownerId) =>
    cockroachAdapter.withMigrationLock(
      cluster.client,
      async () => {
        applied += 1;
        return ownerId;
      },
      { ownerId, leaseSeconds: 300 },
    );

  // Runner A holds the lease for the duration of its work; B must be
  // rejected rather than racing into a parallel migration.
  let resolveA;
  const aWork = new Promise((resolve) => {
    resolveA = resolve;
  });
  const aPromise = cockroachAdapter.withMigrationLock(
    cluster.client,
    async () => {
      applied += 1;
      await aWork;
      return "A";
    },
    { ownerId: "runner-A", leaseSeconds: 300 },
  );

  await assert.rejects(
    () => runner("runner-B"),
    (error) => error.migrationLockUnavailable === true,
    "the second runner must fail safely, not apply migrations concurrently",
  );

  resolveA();
  assert.equal(await aPromise, "A");
  assert.equal(applied, 1, "migrations must be applied exactly once");
});

test("lease is released after a successful run so the next deploy can proceed", async () => {
  const cluster = fakeCockroachCluster();
  await cockroachAdapter.withMigrationLock(cluster.client, async () => "first", {
    ownerId: "runner-A",
  });
  assert.equal(cluster.heldBy("schema_migrations"), null, "lease must be released");

  const second = await cockroachAdapter.withMigrationLock(
    cluster.client,
    async () => "second",
    { ownerId: "runner-B" },
  );
  assert.equal(second, "second");
});

test("lease is released even when the migration throws", async () => {
  const cluster = fakeCockroachCluster();
  await assert.rejects(
    () =>
      cockroachAdapter.withMigrationLock(
        cluster.client,
        async () => {
          throw new Error("migration 007 failed");
        },
        { ownerId: "runner-A" },
      ),
    /migration 007 failed/,
  );
  assert.equal(
    cluster.heldBy("schema_migrations"),
    null,
    "a failed migration must not leave the lease held",
  );
});

test("an expired lease from a crashed runner can be taken over", async () => {
  const cluster = fakeCockroachCluster();
  // Simulate a crashed runner: acquire the lease, never release it.
  await cluster.client.query(
    "INSERT INTO schema_migration_lock (lock_name, owner_id, lease_expires_at) VALUES ($1,$2,$3)",
    ["schema_migrations", "crashed-runner", "60"],
  );
  assert.equal(cluster.heldBy("schema_migrations"), "crashed-runner");

  // Before expiry, takeover must be refused.
  await assert.rejects(
    () =>
      cockroachAdapter.withMigrationLock(cluster.client, async () => "x", {
        ownerId: "runner-B",
        leaseSeconds: 60,
      }),
    (error) => error.migrationLockUnavailable === true,
  );

  // After expiry, the next runner takes over — this is the property that
  // stops one crash from blocking every future deploy.
  cluster.advanceMs(61_000);
  const result = await cockroachAdapter.withMigrationLock(
    cluster.client,
    async () => "recovered",
    { ownerId: "runner-B", leaseSeconds: 60 },
  );
  assert.equal(result, "recovered");
});

test("cockroach lock refuses to run without an explicit ownerId", async () => {
  const cluster = fakeCockroachCluster();
  await assert.rejects(
    () => cockroachAdapter.withMigrationLock(cluster.client, async () => "x", {}),
    /requires an ownerId/,
  );
});

test("adapterForDialect selects the right adapter and rejects unknown dialects", () => {
  assert.equal(adapterForDialect("postgres").name, "postgres");
  assert.equal(adapterForDialect("cockroach").name, "cockroach");
  assert.equal(adapterForDialect("postgres").usesAdvisoryLock, true);
  assert.equal(adapterForDialect("cockroach").usesAdvisoryLock, false);
  assert.throws(() => adapterForDialect("mysql"), /No migration lock adapter/);
});
