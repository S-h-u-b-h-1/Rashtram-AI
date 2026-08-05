#!/usr/bin/env node

// CockroachDB compatibility audit for the server/db.js bootstrap schema.
//
// This is a SEPARATE audit from the migration audit, because the two are
// separate schema systems: initializeSchema() in db.js runs FIRST and
// creates the base tables (users, legislative_documents, ...) that
// migration 001 onward depend on. Auditing migrations alone gives a
// misleading result — every migration reports "relation does not exist"
// against a truly empty database.
//
// The bootstrap SQL is extracted by reading db.js rather than by importing
// it, deliberately: importing db.js would construct a pool from
// DATABASE_URL, which points at Neon production. Extraction keeps this
// audit physically incapable of touching production.

const fs = require("fs");
const path = require("path");
require("dotenv").config({
  path: process.env.ENV_FILE || path.resolve(__dirname, "../.env.local"),
});

const { Client } = require("pg");
const {
  assertCockroachTarget,
  getConnectionStringFor,
  maskConnectionString,
} = require("../lib/database/dialect");
const { toCockroachSql } = require("../lib/database/cockroachSqlCompat");

// Pull the large template literal passed to client.query(`...`) inside
// initializeSchema. Anchored on the first CREATE TABLE of the bootstrap.
const extractBootstrapSql = () => {
  const source = fs.readFileSync(path.resolve(__dirname, "../db.js"), "utf8");
  const start = source.indexOf("CREATE TABLE IF NOT EXISTS users (");
  if (start === -1) throw new Error("Could not locate the bootstrap schema in db.js");
  // The literal ends at the closing backtick of the query call.
  const end = source.indexOf("`);", start);
  if (end === -1) throw new Error("Could not locate the end of the bootstrap literal");
  return source.slice(start, end);
};

// Split on semicolons while respecting dollar-quoted bodies ($$ ... $$),
// which contain their own semicolons. A naive split would shred every
// PL/pgSQL function into invalid fragments and produce fake failures.
const splitStatements = (sql) => {
  const statements = [];
  let current = "";
  let inDollar = false;
  for (let i = 0; i < sql.length; i += 1) {
    const two = sql.slice(i, i + 2);
    if (two === "$$") {
      inDollar = !inDollar;
      current += two;
      i += 1;
      continue;
    }
    const char = sql[i];
    if (char === ";" && !inDollar) {
      const trimmed = current.trim();
      if (trimmed) statements.push(trimmed);
      current = "";
      continue;
    }
    current += char;
  }
  const tail = current.trim();
  if (tail) statements.push(tail);
  return statements;
};

// Label a statement by what it is, so the report groups findings by
// feature rather than by line number.
const featureOf = (sql) => {
  const s = sql.toUpperCase();
  if (/CREATE\s+(OR\s+REPLACE\s+)?FUNCTION/.test(s)) return "plpgsql_function";
  if (/CREATE\s+TRIGGER/.test(s)) return "trigger";
  if (/GENERATED\s+ALWAYS\s+AS/.test(s) && /TSVECTOR/.test(s)) return "generated_tsvector";
  if (/GENERATED\s+ALWAYS\s+AS/.test(s)) return "generated_column";
  if (/USING\s+GIN/.test(s)) return "gin_index";
  if (/CREATE\s+(UNIQUE\s+)?INDEX/.test(s) && /\sWHERE\s/.test(s)) return "partial_index";
  if (/CREATE\s+(UNIQUE\s+)?INDEX/.test(s) && /\(\s*(LOWER|COALESCE)/.test(s)) return "expression_index";
  if (/CREATE\s+INDEX|CREATE\s+UNIQUE\s+INDEX/.test(s)) return "index";
  if (/CREATE\s+TABLE/.test(s)) return "create_table";
  if (/CREATE\s+OR\s+REPLACE\s+VIEW|CREATE\s+VIEW/.test(s)) return "view";
  if (/ALTER\s+TABLE/.test(s)) return "alter_table";
  if (/\\M|\\M/.test(sql) || /REGEXP_REPLACE/.test(s)) return "regex_backfill";
  if (/^UPDATE/.test(s.trim())) return "data_backfill";
  if (/^INSERT/.test(s.trim())) return "data_backfill";
  if (/^DELETE/.test(s.trim())) return "data_backfill";
  if (/^DO\s/.test(s.trim())) return "anonymous_plpgsql_block";
  return "other";
};

const classifyFailure = (error) => {
  const code = String(error?.code || "");
  const message = String(error?.message || "");
  if (code === "0A000" || /unimplemented|not supported|unsupported/i.test(message)) {
    return "unsupported";
  }
  if (code === "42601" || /syntax error/i.test(message)) return "rewrite_required";
  if (code === "42P01" || code === "42703" || /does not exist/i.test(message)) {
    return "blocked";
  }
  if (code === "42883") return "unsupported";
  return "failed";
};

const runBootstrapAudit = async ({ compat = false } = {}) => {
  assertCockroachTarget("the CockroachDB bootstrap audit");
  const connectionString = getConnectionStringFor("cockroach");

  const statements = splitStatements(extractBootstrapSql());
  const client = new Client({ connectionString });
  await client.connect();

  const results = [];
  try {
    for (const [index, raw] of statements.entries()) {
      const feature = featureOf(raw);
      const { sql, applied } = compat ? toCockroachSql(raw) : { sql: raw, applied: [] };
      const startedAt = Date.now();
      try {
        await client.query(sql);
        results.push({
          order: index + 1,
          feature,
          status: "passed",
          rewritten: applied.length > 0,
          durationMs: Date.now() - startedAt,
        });
      } catch (error) {
        results.push({
          order: index + 1,
          feature,
          status: "failed",
          classification: classifyFailure(error),
          sqlState: error.code || null,
          error: String(error.message || "").split("\n")[0].slice(0, 300),
          snippet: raw.replace(/\s+/g, " ").slice(0, 120),
          durationMs: Date.now() - startedAt,
        });
      }
    }
  } finally {
    await client.end().catch(() => undefined);
  }

  // Group by feature so the output answers "which PostgreSQL features
  // does this schema depend on that CockroachDB rejects", which is the
  // actual decision input — not a list of 200 line numbers.
  const byFeature = {};
  for (const row of results) {
    const bucket = (byFeature[row.feature] ||= { total: 0, passed: 0, failed: 0, classifications: {} });
    bucket.total += 1;
    if (row.status === "passed") bucket.passed += 1;
    else {
      bucket.failed += 1;
      bucket.classifications[row.classification] =
        (bucket.classifications[row.classification] || 0) + 1;
    }
  }

  return {
    target: maskConnectionString(connectionString),
    totalStatements: results.length,
    passed: results.filter((r) => r.status === "passed").length,
    failed: results.filter((r) => r.status === "failed").length,
    byFeature,
    results,
  };
};

const main = async () => {
  const compat = process.argv.includes("--compat");
  try {
    const report = await runBootstrapAudit({ compat });
    console.log(JSON.stringify(report, null, 2));
    if (report.failed > 0) process.exitCode = 1;
  } catch (error) {
    console.error(`Bootstrap audit failed: ${error.message}`);
    process.exitCode = 1;
  }
};

if (require.main === module) main();

module.exports = { extractBootstrapSql, featureOf, runBootstrapAudit, splitStatements };
