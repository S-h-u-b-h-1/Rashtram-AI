#!/usr/bin/env node

// CockroachDB migration compatibility audit.
//
// Runs every registered migration against the CockroachDB evaluation
// cluster, in order, and classifies each one. This is a READ-ONLY
// EXERCISE against a throwaway cluster — it must never be pointed at
// Neon, which is enforced by assertCockroachTarget() below.
//
// Design choice: each migration runs in its own transaction and a failure
// does NOT abort the run. The point of this audit is to surface the
// COMPLETE set of incompatibilities in one pass; stopping at the first
// failure would mean one round-trip per problem and a badly wrong effort
// estimate. Downstream migrations that depend on a failed one will
// cascade — those are reported as `blocked` rather than `failed`, so the
// summary distinguishes root causes from consequences.

const path = require("path");
require("dotenv").config({
  path: process.env.ENV_FILE || path.resolve(__dirname, "../.env.local"),
});

const { Client } = require("pg");
const registeredMigrations = require("../migrations");
const {
  assertCockroachTarget,
  getConnectionStringFor,
  maskConnectionString,
} = require("../lib/database/dialect");

const parseArgs = (argv) => ({
  dryRun: argv.includes("--dry-run"),
  reset: argv.includes("--reset"),
  json: argv.includes("--json"),
  stopOnFirstFailure: argv.includes("--stop-on-first-failure"),
});

// Classify a failure by SQLSTATE + message so the report says WHY, not
// just "failed". These are the categories that actually drive different
// remediation: an unsupported feature needs a compatibility layer, a
// syntax error needs a rewrite, a missing relation is usually a cascade.
const classifyFailure = (error) => {
  const code = String(error?.code || "");
  const message = String(error?.message || "");

  if (code === "0A000" || /not supported|unimplemented|unsupported/i.test(message)) {
    return {
      classification: "unsupported",
      remediation: "Requires a CockroachDB compatibility layer or application-level replacement.",
    };
  }
  if (code === "42601" || /syntax error/i.test(message)) {
    return {
      classification: "rewrite_required",
      remediation: "Dialect-specific syntax; needs a Cockroach variant of this statement.",
    };
  }
  if (code === "42P01" || code === "42703" || /does not exist/i.test(message)) {
    return {
      classification: "blocked",
      remediation: "Depends on an object an earlier failed migration should have created.",
    };
  }
  if (code === "42883") {
    return {
      classification: "unsupported",
      remediation: "Function/operator not available in CockroachDB; needs replacement.",
    };
  }
  return {
    classification: "failed",
    remediation: "Review the SQLSTATE and message; may need a rewrite or a compatibility shim.",
  };
};

const runAudit = async ({ dryRun, reset, json, stopOnFirstFailure }) => {
  // Fail closed. Without this, a mis-set env var could point a schema-
  // dropping audit at production.
  assertCockroachTarget("the CockroachDB migration audit");

  const connectionString = getConnectionStringFor("cockroach");
  const target = maskConnectionString(connectionString);

  if (dryRun) {
    return {
      mode: "dry_run",
      target,
      migrationCount: registeredMigrations.length,
      migrations: registeredMigrations.map(({ name }, index) => ({
        order: index + 1,
        name,
      })),
    };
  }

  const client = new Client({ connectionString });
  await client.connect();

  const results = [];
  try {
    if (reset) {
      // Only ever runs against an explicitly-confirmed cockroach target.
      await client.query("DROP SCHEMA IF EXISTS public CASCADE");
      await client.query("CREATE SCHEMA public");
    }

    for (const [index, { name, migration }] of registeredMigrations.entries()) {
      const startedAt = Date.now();
      let transactionOpen = false;
      try {
        await client.query("BEGIN");
        transactionOpen = true;
        await migration.up(client);
        await client.query("COMMIT");
        transactionOpen = false;
        results.push({
          order: index + 1,
          name,
          status: "passed",
          classification: "passes_unchanged",
          durationMs: Date.now() - startedAt,
        });
      } catch (error) {
        if (transactionOpen) {
          await client.query("ROLLBACK").catch(() => undefined);
        }
        const { classification, remediation } = classifyFailure(error);
        results.push({
          order: index + 1,
          name,
          status: "failed",
          classification,
          remediation,
          sqlState: error.code || null,
          // Message only — never the connection string or any parameter
          // values, which could carry data.
          error: String(error.message || "").split("\n")[0].slice(0, 400),
          durationMs: Date.now() - startedAt,
        });
        if (stopOnFirstFailure) break;
      }
    }
  } finally {
    await client.end().catch(() => undefined);
  }

  const byClassification = results.reduce((acc, row) => {
    acc[row.classification] = (acc[row.classification] || 0) + 1;
    return acc;
  }, {});

  return {
    mode: "audit",
    target,
    total: results.length,
    passed: results.filter((r) => r.status === "passed").length,
    failed: results.filter((r) => r.status === "failed").length,
    byClassification,
    results,
  };
};

const main = async () => {
  const options = parseArgs(process.argv.slice(2));
  try {
    const report = await runAudit(options);
    if (options.json || options.dryRun) {
      console.log(JSON.stringify(report, null, 2));
      return;
    }

    console.log(`\nCockroachDB migration audit — target: ${report.target}`);
    console.log(`${report.passed}/${report.total} migrations applied cleanly\n`);
    for (const row of report.results) {
      const mark = row.status === "passed" ? "PASS" : "FAIL";
      console.log(
        `[${mark}] ${String(row.order).padStart(3)} ${row.name} (${row.durationMs}ms)`,
      );
      if (row.status === "failed") {
        console.log(`        classification: ${row.classification}`);
        if (row.sqlState) console.log(`        sqlstate: ${row.sqlState}`);
        console.log(`        error: ${row.error}`);
        console.log(`        remediation: ${row.remediation}`);
      }
    }
    console.log("\nBy classification:");
    for (const [key, count] of Object.entries(report.byClassification)) {
      console.log(`  ${key}: ${count}`);
    }
    if (report.failed > 0) process.exitCode = 1;
  } catch (error) {
    // Never leak the connection string in an error path.
    console.error(`Migration audit failed: ${error.message}`);
    process.exitCode = 1;
  }
};

if (require.main === module) main();

module.exports = { classifyFailure, runAudit };
