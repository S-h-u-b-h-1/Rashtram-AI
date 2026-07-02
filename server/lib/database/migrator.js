const registeredMigrations = require("../../migrations");

const MIGRATION_LOCK_KEY = 1_847_263_912;

const migrationFiles = () =>
  registeredMigrations.map(({ name }) => name);

const runMigrations = async (pool) => {
  const client = await pool.connect();
  const applied = [];

  try {
    await client.query("SELECT pg_advisory_lock($1)", [MIGRATION_LOCK_KEY]);
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        migration_name TEXT PRIMARY KEY,
        checksum TEXT NOT NULL,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    for (const { name: file, migration } of registeredMigrations) {
      if (!migration?.checksum || typeof migration.up !== "function") {
        throw new Error(`Invalid migration module: ${file}`);
      }

      const existing = await client.query(
        `SELECT checksum FROM schema_migrations WHERE migration_name = $1`,
        [file],
      );
      if (existing.rows[0]) {
        if (existing.rows[0].checksum !== migration.checksum) {
          throw new Error(
            `Applied migration checksum changed: ${file}. Add a new migration instead.`,
          );
        }
        continue;
      }

      await client.query("BEGIN");
      try {
        await migration.up(client);
        await client.query(
          `INSERT INTO schema_migrations (migration_name, checksum)
           VALUES ($1, $2)`,
          [file, migration.checksum],
        );
        await client.query("COMMIT");
        applied.push(file);
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      }
    }

    return { applied, available: migrationFiles() };
  } finally {
    await client
      .query("SELECT pg_advisory_unlock($1)", [MIGRATION_LOCK_KEY])
      .catch(() => undefined);
    client.release();
  }
};

module.exports = {
  migrationFiles,
  runMigrations,
};
