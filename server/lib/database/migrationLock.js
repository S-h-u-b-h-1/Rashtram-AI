// Provider-specific migration locking.
//
// PostgreSQL/Neon path is UNCHANGED: pg_advisory_xact_lock, held for the
// duration of the migration transaction and released automatically when
// that transaction ends (including on crash, because the session dies).
//
// CockroachDB does not offer an equivalent session/transaction-scoped
// advisory lock, so it needs an explicit lease row. The lease has to
// handle the case advisory locks got for free: a runner that dies
// mid-migration must not block every future deploy forever. That's what
// lease_expires_at is for — a dead owner's lease ages out and the next
// runner can take over.

const POSTGRES_MIGRATION_LOCK_KEY = 1_847_263_912;
const LOCK_NAME = "schema_migrations";
const DEFAULT_LEASE_SECONDS = 300;

const createLockTableSql = `
CREATE TABLE IF NOT EXISTS schema_migration_lock (
  lock_name TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL,
  lease_expires_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
)`;

// Single-statement conditional takeover. The ON CONFLICT ... WHERE clause
// makes acquisition atomic: either we insert (no holder), or we steal an
// expired lease, or we return zero rows (a live holder exists). There is
// no read-then-write window for a second runner to slip through.
const acquireLeaseSql = `
INSERT INTO schema_migration_lock (lock_name, owner_id, lease_expires_at)
VALUES ($1, $2, NOW() + ($3 || ' seconds')::INTERVAL)
ON CONFLICT (lock_name) DO UPDATE
  SET owner_id = EXCLUDED.owner_id,
      lease_expires_at = EXCLUDED.lease_expires_at,
      updated_at = NOW()
  WHERE schema_migration_lock.lease_expires_at < NOW()
RETURNING owner_id`;

const releaseLeaseSql = `
DELETE FROM schema_migration_lock
 WHERE lock_name = $1 AND owner_id = $2`;

const postgresAdapter = {
  name: "postgres",
  usesAdvisoryLock: true,
  // Runs INSIDE the caller's existing transaction. Nothing to release:
  // pg_advisory_xact_lock is bound to the transaction lifetime.
  withMigrationLock: async (client, run) => {
    await client.query("SELECT pg_advisory_xact_lock($1)", [
      POSTGRES_MIGRATION_LOCK_KEY,
    ]);
    return run();
  },
};

const cockroachAdapter = {
  name: "cockroach",
  usesAdvisoryLock: false,
  withMigrationLock: async (
    client,
    run,
    { ownerId, leaseSeconds = DEFAULT_LEASE_SECONDS } = {},
  ) => {
    if (!ownerId) {
      throw new Error("cockroach migration lock requires an ownerId");
    }
    await client.query(createLockTableSql);
    const acquired = await client.query(acquireLeaseSql, [
      LOCK_NAME,
      ownerId,
      String(leaseSeconds),
    ]);

    if (acquired.rowCount === 0) {
      const error = new Error(
        "Another migration runner currently holds the schema migration lease. " +
          "This runner is exiting without applying migrations; retry after the " +
          "in-flight run completes or its lease expires.",
      );
      error.migrationLockUnavailable = true;
      throw error;
    }

    try {
      return await run();
    } finally {
      // Best-effort: if release fails, the lease still expires on its own,
      // so a failed release degrades to a delay, never a permanent deadlock.
      await client
        .query(releaseLeaseSql, [LOCK_NAME, ownerId])
        .catch(() => undefined);
    }
  },
};

const adapterForDialect = (dialect) => {
  if (dialect === "postgres") return postgresAdapter;
  if (dialect === "cockroach") return cockroachAdapter;
  throw new Error(`No migration lock adapter for dialect: ${dialect}`);
};

module.exports = {
  DEFAULT_LEASE_SECONDS,
  LOCK_NAME,
  POSTGRES_MIGRATION_LOCK_KEY,
  acquireLeaseSql,
  adapterForDialect,
  cockroachAdapter,
  createLockTableSql,
  postgresAdapter,
  releaseLeaseSql,
};
