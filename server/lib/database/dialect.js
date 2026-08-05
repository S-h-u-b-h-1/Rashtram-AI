// Central place for database-target selection. Postgres/Neon remains the
// default and only implicit target — Cockroach is opt-in only, and only
// for an explicitly separate connection, never a replacement for
// DATABASE_URL. This module never logs or returns raw connection strings;
// callers get a boolean/dialect name, not the secret.

const VALID_DIALECTS = new Set(["postgres", "cockroach"]);

const getDialect = () => {
  const raw = String(process.env.DATABASE_DIALECT || "postgres")
    .trim()
    .toLowerCase();
  if (!VALID_DIALECTS.has(raw)) {
    throw new Error(
      `Unknown DATABASE_DIALECT "${raw}". Expected "postgres" or "cockroach".`,
    );
  }
  return raw;
};

const isCockroachTarget = () => getDialect() === "cockroach";

// Every Cockroach-specific migration/destructive-test entry point must call
// this before doing anything. It fails closed: no dialect, or any dialect
// other than the literal string "cockroach", refuses to proceed. This is
// the guard against ever accidentally running Cockroach-only DDL/tests
// against the Postgres/Neon production connection.
const assertCockroachTarget = (actionDescription = "this action") => {
  const dialect = getDialect();
  if (dialect !== "cockroach") {
    throw new Error(
      `Refusing to run ${actionDescription}: DATABASE_DIALECT is "${dialect}", ` +
        `not "cockroach". Set DATABASE_DIALECT=cockroach explicitly to proceed. ` +
        `This guard exists so a Cockroach-only command can never accidentally ` +
        `target Neon production.`,
    );
  }
};

// Returns the connection string for the given dialect without ever having
// logged it. Throws with a message naming the missing env var, never the
// value of any other var.
const getConnectionStringFor = (dialect) => {
  if (dialect === "postgres") {
    const value = process.env.DATABASE_URL;
    if (!value) throw new Error("DATABASE_URL is required for dialect=postgres");
    return value;
  }
  if (dialect === "cockroach") {
    const value = process.env.COCKROACH_DATABASE_URL;
    if (!value) {
      throw new Error(
        "COCKROACH_DATABASE_URL is required for dialect=cockroach. " +
          "This is intentionally a separate variable from DATABASE_URL so " +
          "Cockroach can never be targeted by accident.",
      );
    }
    return value;
  }
  throw new Error(`Unknown dialect: ${dialect}`);
};

// Safe to log: hostname + database name only, credentials and full query
// string stripped. Use this instead of the raw connection string in any
// diagnostic output.
const maskConnectionString = (connectionString) => {
  try {
    const url = new URL(connectionString);
    return `${url.protocol}//${url.hostname}${url.pathname}`;
  } catch {
    return "[unparseable connection string, not logged]";
  }
};

module.exports = {
  getDialect,
  isCockroachTarget,
  assertCockroachTarget,
  getConnectionStringFor,
  maskConnectionString,
};
