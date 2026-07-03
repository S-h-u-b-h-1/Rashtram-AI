#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
require("dotenv").config({
  path: process.env.ENV_FILE || path.resolve(__dirname, "../.env.local"),
});
const { getPool } = require("../db");
const { inventoryDatabase } = require("../lib/database/audit");

const repositoryRoot = path.resolve(__dirname, "../..");

inventoryDatabase()
  .then((audit) => {
    const empty = audit.tables.filter((table) => table.empty);
    const legacy = audit.tables.filter((table) => table.legacy);
    const candidates = audit.tables.filter(
      (table) => table.disposition === "future_drop_candidate",
    );
    const lines = [
      "# Database Cleanup Plan",
      "",
      `Generated from the configured PostgreSQL database at ${audit.generatedAt}.`,
      "",
      "## Safety policy",
      "",
      "- No table is dropped by this sprint.",
      "- Schema-v2 tables are additive and existing records are mirrored through compatibility triggers.",
      "- A future destructive migration requires explicit approval, a backup, a compatibility-window report, and verified zero reads/writes.",
      "",
      "## Legacy compatibility tables",
      "",
      ...legacy.map(
        (table) =>
          `- \`${table.tableName}\` (${table.rows} rows): retain as legacy archive; current compatibility code references: ${table.usedBy.length}.`,
      ),
      "",
      "## Empty tables",
      "",
      ...empty.map(
        (table) =>
          `- \`${table.tableName}\`: **${table.disposition}** — ${table.rationale}`,
      ),
      "",
      "## Future drop candidates",
      "",
      ...(candidates.length
        ? candidates.map(
            (table) =>
              `- \`${table.tableName}\`: empty, no active code reference, but retained pending explicit approval.`,
          )
        : [
            "- None. Empty tables currently represent normalized feature capacity or migration infrastructure.",
          ]),
      "",
      "## Proposed future sequence",
      "",
      "1. Observe schema-v2 in production for at least one full ingestion and research cycle.",
      "2. Confirm all normalized row-count and orphan checks remain green.",
      "3. Switch remaining read paths from legacy compatibility tables.",
      "4. Freeze legacy writes and verify mirror parity.",
      "5. Archive legacy tables in a dedicated schema.",
      "6. Drop only in a separately approved migration.",
      "",
    ];
    const outputPath = path.join(repositoryRoot, "docs/DATABASE_CLEANUP_PLAN.md");
    fs.writeFileSync(outputPath, lines.join("\n"));
    console.log(
      JSON.stringify(
        {
          ok: true,
          report: outputPath,
          emptyTables: empty.length,
          legacyTables: legacy.length,
          futureDropCandidates: candidates.length,
        },
        null,
        2,
      ),
    );
  })
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    if (globalThis.__rashtramPostgresPool) await getPool().end();
  });
