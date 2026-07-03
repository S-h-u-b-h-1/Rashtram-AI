const fs = require("fs");
const path = require("path");
const { query } = require("../../db");

const repositoryRoot = path.resolve(__dirname, "../../..");
const serverRoot = path.resolve(__dirname, "../..");

const LEGACY_TABLES = new Set([
  "act_chats",
  "bill_chats",
  "contact_requests",
  "document_chats",
  "egazette_chats",
  "legislative_document_resources",
  "legislative_documents",
  "multi_document_chats",
  "related_bills",
]);

const TARGET_TABLES = new Set([
  "audit_logs",
  "bookmarks",
  "bug_reports",
  "contact_submissions",
  "dashboard_metrics",
  "dedupe_candidates",
  "document_comparisons",
  "document_metadata",
  "document_processing_state",
  "document_relationships",
  "document_resources",
  "document_sources",
  "document_text_chunks",
  "document_topics",
  "documents",
  "feedback_submissions",
  "ingestion_run_items",
  "ingestion_runs",
  "intelligence_events",
  "recommendations",
  "research_chats",
  "research_collection_items",
  "research_collections",
  "research_messages",
  "research_notes",
  "saved_searches",
  "source_connectors",
  "source_health",
  "source_registry",
  "system_events",
  "topic_taxonomy",
  "user_preferences",
  "user_profiles",
  "user_sessions",
  "users",
]);

const walkJavaScript = (directory) => {
  const files = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (["node_modules", "migrations"].includes(entry.name)) continue;
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...walkJavaScript(target));
    else if (entry.isFile() && /\.(js|cjs|mjs)$/.test(entry.name)) {
      files.push(target);
    }
  }
  return files;
};

const codeUsage = (tableNames) => {
  const files = walkJavaScript(serverRoot);
  const contents = files.map((file) => ({
    file: path.relative(repositoryRoot, file),
    text: fs.readFileSync(file, "utf8"),
  }));
  return Object.fromEntries(
    tableNames.map((table) => [
      table,
      contents
        .filter(({ text }) => new RegExp(`\\b${table}\\b`, "i").test(text))
        .map(({ file }) => file),
    ]),
  );
};

const quoteIdentifier = (identifier) =>
  `"${String(identifier).replaceAll('"', '""')}"`;

const inventoryDatabase = async () => {
  const tablesResult = await query(`
    SELECT tablename AS table_name
    FROM pg_tables
    WHERE schemaname = 'public'
    ORDER BY tablename
  `);
  const tableNames = tablesResult.rows.map((row) => row.table_name);
  const usage = codeUsage(tableNames);
  const tables = [];

  for (const tableName of tableNames) {
    const [count, columns, indexes, constraints] = await Promise.all([
      query(`SELECT COUNT(*)::BIGINT AS count FROM ${quoteIdentifier(tableName)}`),
      query(
        `SELECT column_name, data_type, udt_name, is_nullable, column_default
         FROM information_schema.columns
         WHERE table_schema = 'public' AND table_name = $1
         ORDER BY ordinal_position`,
        [tableName],
      ),
      query(
        `SELECT indexname, indexdef
         FROM pg_indexes
         WHERE schemaname = 'public' AND tablename = $1
         ORDER BY indexname`,
        [tableName],
      ),
      query(
        `SELECT
           c.conname AS name,
           c.contype AS type,
           pg_get_constraintdef(c.oid) AS definition
         FROM pg_constraint c
         JOIN pg_class t ON t.oid = c.conrelid
         JOIN pg_namespace n ON n.oid = t.relnamespace
         WHERE n.nspname = 'public' AND t.relname = $1
         ORDER BY c.conname`,
        [tableName],
      ),
    ]);

    const lastUpdatedColumn = [
      "updated_at",
      "last_seen_at",
      "completed_at",
      "created_at",
      "fetched_at",
      "applied_at",
    ].find((candidate) =>
      columns.rows.some((column) => column.column_name === candidate),
    );
    const lastUpdated = lastUpdatedColumn
      ? (
          await query(
            `SELECT MAX(${quoteIdentifier(lastUpdatedColumn)}) AS value
             FROM ${quoteIdentifier(tableName)}`,
          )
        ).rows[0]?.value || null
      : null;
    const rows = Number(count.rows[0].count);
    const usedBy = usage[tableName];
    let disposition = "keep";
    let rationale = "Active application or infrastructure table.";
    if (LEGACY_TABLES.has(tableName)) {
      disposition = "legacy_archive";
      rationale =
        "Preserved for backward compatibility while additive triggers mirror data into schema v2.";
    } else if (!usedBy.length && rows === 0 && !TARGET_TABLES.has(tableName)) {
      disposition = "future_drop_candidate";
      rationale =
        "Empty and not referenced outside schema setup; requires explicit approval before removal.";
    } else if (rows === 0 && TARGET_TABLES.has(tableName)) {
      disposition = "keep";
      rationale = "Normalized schema-v2 feature table; empty until the feature produces data.";
    }

    tables.push({
      tableName,
      rows,
      empty: rows === 0,
      columns: columns.rows,
      indexes: indexes.rows,
      constraints: constraints.rows,
      foreignKeys: constraints.rows.filter((item) => item.type === "f"),
      nullableColumns: columns.rows
        .filter((column) => column.is_nullable === "YES")
        .map((column) => column.column_name),
      lastUpdatedColumn,
      lastUpdated,
      usedBy,
      legacy: LEGACY_TABLES.has(tableName),
      disposition,
      rationale,
    });
  }

  const quality = await query(`
    SELECT
      (SELECT COUNT(*)::INTEGER FROM documents) AS documents,
      (SELECT COUNT(*)::INTEGER FROM documents WHERE research_ready) AS research_ready,
      (SELECT COUNT(*)::INTEGER FROM documents WHERE quality_score < 40) AS low_quality,
      (SELECT COUNT(*)::INTEGER FROM documents WHERE canonical_url IS NULL) AS missing_source,
      (SELECT COUNT(*)::INTEGER FROM documents WHERE primary_pdf_resource_id IS NULL) AS missing_primary_pdf,
      (SELECT COUNT(*)::INTEGER FROM document_resources WHERE NULLIF(TRIM(url), '') IS NULL) AS broken_resource_rows,
      (SELECT COUNT(*)::INTEGER FROM document_sources ds LEFT JOIN documents d ON d.id = ds.document_id WHERE d.id IS NULL) AS orphan_sources,
      (SELECT COUNT(*)::INTEGER FROM document_resources dr LEFT JOIN documents d ON d.id = dr.document_id WHERE d.id IS NULL) AS orphan_resources,
      (SELECT COUNT(*)::INTEGER FROM research_messages rm LEFT JOIN research_chats rc ON rc.id = rm.chat_id WHERE rc.id IS NULL) AS orphan_messages,
      (SELECT COUNT(*)::INTEGER FROM (
        SELECT canonical_id FROM documents GROUP BY canonical_id HAVING COUNT(*) > 1
      ) duplicates) AS duplicate_canonical_ids,
      (SELECT COUNT(*)::INTEGER FROM documents d
       WHERE d.research_ready AND NOT EXISTS (
         SELECT 1 FROM document_processing_state ps
         WHERE ps.document_id = d.id
           AND ps.processing_status = 'ready'
           AND ps.extraction_status = 'ready'
           AND ps.embedding_status = 'ready'
           AND ps.chunks_count > 0
       )) AS invalid_research_ready
  `);

  return {
    generatedAt: new Date().toISOString(),
    database: {
      tables: tables.length,
      emptyTables: tables.filter((table) => table.empty).length,
      legacyTables: tables.filter((table) => table.legacy).length,
    },
    quality: quality.rows[0],
    tables,
  };
};

const renderAuditMarkdown = (audit) => {
  const lines = [
    "# Database Audit Report",
    "",
    `Generated from the configured PostgreSQL database at ${audit.generatedAt}.`,
    "",
    "No tables were deleted during this audit. Legacy tables remain available while schema-v2 mirrors preserve backward compatibility.",
    "",
    "## Inventory summary",
    "",
    `- Tables: ${audit.database.tables}`,
    `- Empty tables: ${audit.database.emptyTables}`,
    `- Legacy compatibility tables: ${audit.database.legacyTables}`,
    `- Universal documents: ${audit.quality.documents}`,
    `- Strictly research-ready documents: ${audit.quality.research_ready}`,
    `- Low-quality records (score below 40): ${audit.quality.low_quality}`,
    `- Missing canonical source URL: ${audit.quality.missing_source}`,
    `- Missing primary PDF resource: ${audit.quality.missing_primary_pdf}`,
    `- Broken resource rows: ${audit.quality.broken_resource_rows}`,
    `- Orphan sources/resources/messages: ${audit.quality.orphan_sources}/${audit.quality.orphan_resources}/${audit.quality.orphan_messages}`,
    `- Duplicate canonical IDs: ${audit.quality.duplicate_canonical_ids}`,
    `- Invalid research-ready flags: ${audit.quality.invalid_research_ready}`,
    "",
    "## Table inventory",
    "",
    "| Table | Rows | Code references | Classification | Last update |",
    "|---|---:|---:|---|---|",
  ];
  for (const table of audit.tables) {
    lines.push(
      `| \`${table.tableName}\` | ${table.rows} | ${table.usedBy.length} | ${table.disposition} | ${table.lastUpdated ? new Date(table.lastUpdated).toISOString() : "n/a"} |`,
    );
  }
  lines.push("", "## Detailed table findings", "");
  for (const table of audit.tables) {
    lines.push(
      `### ${table.tableName}`,
      "",
      `- Rows: ${table.rows}${table.empty ? " (empty)" : ""}`,
      `- Decision: **${table.disposition}** — ${table.rationale}`,
      `- Active code references: ${table.usedBy.length ? table.usedBy.map((file) => `\`${file}\``).join(", ") : "none outside schema/migrations"}`,
      `- Nullable fields: ${table.nullableColumns.length ? table.nullableColumns.join(", ") : "none"}`,
      `- Last-update signal: ${table.lastUpdatedColumn || "none"}${table.lastUpdated ? ` = ${new Date(table.lastUpdated).toISOString()}` : ""}`,
      `- Indexes: ${table.indexes.length ? table.indexes.map((index) => `\`${index.indexname}\``).join(", ") : "none"}`,
      `- Foreign keys: ${table.foreignKeys.length ? table.foreignKeys.map((key) => `\`${key.name}\`: ${key.definition}`).join("; ") : "none"}`,
      "",
      "| Column | Type | Nullable | Default |",
      "|---|---|---|---|",
      ...table.columns.map(
        (column) =>
          `| \`${column.column_name}\` | ${column.data_type === "USER-DEFINED" ? column.udt_name : column.data_type} | ${column.is_nullable} | ${column.column_default || ""} |`,
      ),
      "",
    );
  }
  lines.push(
    "## Conclusions",
    "",
    "- `legislative_documents` and its resource/chat companions are compatibility archives, not deletion candidates in this sprint.",
    "- `documents`, normalized research tables, source registry/health, processing state, ingestion items, and audit tables are the long-term schema.",
    "- Empty normalized feature tables are intentional capacity, not dead schema.",
    "- Any future destructive cleanup requires a separate approved migration after a measured compatibility window.",
    "",
  );
  return lines.join("\n");
};

const writeAuditReport = (audit) => {
  const outputPath = path.join(repositoryRoot, "docs/DATABASE_AUDIT_REPORT.md");
  fs.writeFileSync(outputPath, renderAuditMarkdown(audit));
  return outputPath;
};

module.exports = {
  LEGACY_TABLES,
  TARGET_TABLES,
  inventoryDatabase,
  renderAuditMarkdown,
  writeAuditReport,
};
