const fs = require("node:fs");
const path = require("node:path");
const { Pool } = require("pg");
const { isPooledConnectionString, poolConfig } = require("./connectionConfig");

const ESSENTIAL_TABLES = new Set([
  "users",
  "documents",
  "document_resources",
  "document_sources",
  "document_metadata",
  "research_chats",
  "research_messages",
  "research_notes",
  "research_collections",
  "research_collection_items",
  "document_comparisons",
  "bookmarks",
  "saved_searches",
  "user_profiles",
  "user_preferences",
  "knowledge_nodes",
  "knowledge_edges",
  "knowledge_evidence",
]);

const DERIVED_TABLES = new Set([
  "dashboard_metrics",
  "document_processing_state",
  "document_text_artifacts",
  "document_text_chunks",
  "recommendations",
]);

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

const OPERATIONAL_TABLES = new Set([
  "audit_logs",
  "document_processing_attempts",
  "document_processing_audit_log",
  "document_processing_jobs",
  "ingestion_run_items",
  "ingestion_runs",
  "user_sessions",
]);

const RETENTION_POLICIES = Object.freeze([
  {
    name: "expired sessions",
    table: "user_sessions",
    idColumn: "id",
    orderColumn: "expires_at",
    predicate: "expires_at < NOW()",
    retention: "delete only after expiry",
  },
  {
    name: "revoked sessions",
    table: "user_sessions",
    idColumn: "id",
    orderColumn: "revoked_at",
    predicate: "revoked_at IS NOT NULL AND revoked_at < NOW() - INTERVAL '7 days'",
    retention: "7 days after revocation",
  },
  {
    name: "expired recommendations",
    table: "recommendations",
    idColumn: "id",
    orderColumn: "expires_at",
    predicate: "expires_at IS NOT NULL AND expires_at < NOW()",
    retention: "delete only after explicit expiry",
  },
  {
    name: "successful ingestion details",
    table: "ingestion_run_items",
    idColumn: "id",
    orderColumn: "created_at",
    predicate: "status = 'stored' AND created_at < NOW() - INTERVAL '30 days'",
    retention: "30 days; run summaries and canonical provenance remain",
  },
  {
    name: "completed processing jobs",
    table: "document_processing_jobs",
    idColumn: "id",
    orderColumn: "completed_at",
    predicate: "status IN ('completed', 'cancelled') AND completed_at < NOW() - INTERVAL '30 days'",
    retention: "30 days; attempts cascade with their parent job",
  },
  {
    name: "failed processing jobs",
    table: "document_processing_jobs",
    idColumn: "id",
    orderColumn: "completed_at",
    predicate: "status IN ('failed', 'dead_letter') AND completed_at < NOW() - INTERVAL '90 days'",
    retention: "90 days for failure diagnosis; attempts cascade",
  },
]);

const MAINTENANCE_TABLES = Object.freeze([
  "document_processing_attempts",
  "document_processing_jobs",
  "ingestion_run_items",
  "recommendations",
  "user_sessions",
]);

const quoteIdentifier = (value) => `"${String(value).replaceAll('"', '""')}"`;

const createMaintenancePool = (connectionString = process.env.DATABASE_URL) => {
  if (!connectionString) throw new Error("DATABASE_URL is required");
  return new Pool(poolConfig(connectionString, { max: 1 }));
};

const classifyTable = (tableName) => {
  if (ESSENTIAL_TABLES.has(tableName)) {
    return {
      category: "essential_production",
      reproducible: false,
      cleanupSafe: false,
      rationale: "Canonical or user-owned production data; never removed by maintenance.",
    };
  }
  if (DERIVED_TABLES.has(tableName)) {
    return {
      category: "reproducible_derived",
      reproducible: true,
      cleanupSafe: false,
      rationale: "Rebuildable, but removal can interrupt research or recommendations and requires explicit recovery approval.",
    };
  }
  if (OPERATIONAL_TABLES.has(tableName)) {
    return {
      category: "expired_operational",
      reproducible: false,
      cleanupSafe: true,
      rationale: "Only rows matching the documented retention predicates are eligible.",
    };
  }
  if (LEGACY_TABLES.has(tableName)) {
    return {
      category: "legacy_compatibility",
      reproducible: false,
      cleanupSafe: false,
      rationale: "Still referenced by compatibility paths; do not remove without a separate migration.",
    };
  }
  if (tableName === "document_relationship_quarantine") {
    return {
      category: "quarantined_audit_data",
      reproducible: false,
      cleanupSafe: false,
      rationale: "Not used at runtime, but preserve unless a verified external snapshot exists.",
    };
  }
  return {
    category: "unsafe_without_review",
    reproducible: false,
    cleanupSafe: false,
    rationale: "No automatic cleanup policy; requires explicit review.",
  };
};

const storageReport = async (pool) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN READ ONLY");
    const database = await client.query(
      `SELECT pg_database_size(current_database())::bigint AS bytes,
              CASE
                WHEN current_setting('neon.max_cluster_size', true) IS NULL THEN NULL
                ELSE pg_size_bytes(current_setting('neon.max_cluster_size', true))::bigint
              END AS max_cluster_size_bytes`,
    );
    const relations = await client.query(`
      SELECT c.relname AS table_name,
             COALESCE(s.n_live_tup, 0)::bigint AS estimated_rows,
             COALESCE(s.n_dead_tup, 0)::bigint AS estimated_dead_tuples,
             COALESCE(s.seq_scan, 0)::bigint AS seq_scans,
             COALESCE(s.idx_scan, 0)::bigint AS index_scans,
             pg_relation_size(c.oid)::bigint AS table_bytes,
             pg_indexes_size(c.oid)::bigint AS index_bytes,
             (pg_total_relation_size(c.oid) - pg_relation_size(c.oid) - pg_indexes_size(c.oid))::bigint AS toast_bytes,
             pg_total_relation_size(c.oid)::bigint AS total_bytes
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      LEFT JOIN pg_stat_user_tables s ON s.relid = c.oid
      WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p')
      ORDER BY total_bytes DESC, c.relname
    `);
    const tables = [];
    for (const relation of relations.rows) {
      const count = await client.query(
        `SELECT COUNT(*)::bigint AS rows FROM ${quoteIdentifier(relation.table_name)}`,
      );
      tables.push({
        ...relation,
        rows: count.rows[0].rows,
        activelyUsed:
          Number(relation.seq_scans) + Number(relation.index_scans) > 0,
        ...classifyTable(relation.table_name),
      });
    }
    const indexes = await client.query(`
      SELECT i.relname AS index_name,
             t.relname AS table_name,
             pg_relation_size(i.oid)::bigint AS bytes,
             COALESCE(s.idx_scan, 0)::bigint AS scans,
             ix.indisunique AS unique,
             ix.indisprimary AS primary,
             pg_get_indexdef(i.oid) AS definition
      FROM pg_index ix
      JOIN pg_class i ON i.oid = ix.indexrelid
      JOIN pg_class t ON t.oid = ix.indrelid
      JOIN pg_namespace n ON n.oid = t.relnamespace
      LEFT JOIN pg_stat_user_indexes s ON s.indexrelid = i.oid
      WHERE n.nspname = 'public'
      ORDER BY bytes DESC, i.relname
    `);
    const migrationTable = await client.query(
      `SELECT TO_REGCLASS('public.schema_migrations') IS NOT NULL AS exists`,
    );
    const migrations = migrationTable.rows[0]?.exists
      ? await client.query(
          `SELECT migration_name, applied_at
           FROM schema_migrations ORDER BY applied_at, migration_name`,
        )
      : { rows: [] };
    await client.query("COMMIT");
    const databaseBytes = Number(database.rows[0].bytes);
    const maxBytes = Number(database.rows[0].max_cluster_size_bytes || 0);
    return {
      generatedAt: new Date().toISOString(),
      database: {
        bytes: databaseBytes,
        maxBytes: maxBytes || null,
        headroomBytes: maxBytes ? Math.max(0, maxBytes - databaseBytes) : null,
        usagePercent: maxBytes ? Number(((databaseBytes / maxBytes) * 100).toFixed(2)) : null,
        pooledConnection: isPooledConnectionString(process.env.DATABASE_URL || ""),
      },
      migrations: migrations.rows,
      migrationTrackingPresent: Boolean(migrationTable.rows[0]?.exists),
      tables,
      indexes: indexes.rows.map((index) => ({
        ...index,
        activelyUsed: Number(index.scans) > 0,
        reproducible: true,
        cleanupSafe: false,
        rationale:
          index.primary || index.unique
            ? "Constraint-backed index; never remove automatically."
            : Number(index.scans) > 0
              ? "Observed in PostgreSQL index statistics; retain."
              : "Zero recorded scans is only a review signal; require EXPLAIN and workload validation before removal.",
      })),
    };
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
};

const retentionCandidates = async (client, policy) => {
  const result = await client.query(
    `SELECT COUNT(*)::bigint AS rows
     FROM ${quoteIdentifier(policy.table)} WHERE ${policy.predicate}`,
  );
  return Number(result.rows[0].rows);
};

const runRetention = async (
  pool,
  { dryRun = false, batchSize = 500, maxBatches = 10, onProgress } = {},
) => {
  if (!Number.isInteger(batchSize) || batchSize < 1 || batchSize > 5000) {
    throw new Error("batchSize must be an integer between 1 and 5000");
  }
  if (!Number.isInteger(maxBatches) || maxBatches < 1 || maxBatches > 100) {
    throw new Error("maxBatches must be an integer between 1 and 100");
  }
  const client = await pool.connect();
  const results = [];
  try {
    for (const policy of RETENTION_POLICIES) {
      const candidates = await retentionCandidates(client, policy);
      let removed = 0;
      if (!dryRun) {
        for (let batch = 0; batch < maxBatches; batch += 1) {
          const result = await client.query(
            `WITH candidates AS (
               SELECT ${quoteIdentifier(policy.idColumn)} AS id
               FROM ${quoteIdentifier(policy.table)}
               WHERE ${policy.predicate}
               ORDER BY ${quoteIdentifier(policy.orderColumn)}, ${quoteIdentifier(policy.idColumn)}
               LIMIT $1
             )
             DELETE FROM ${quoteIdentifier(policy.table)} target
             USING candidates
             WHERE target.${quoteIdentifier(policy.idColumn)} = candidates.id
             RETURNING target.${quoteIdentifier(policy.idColumn)}`,
            [batchSize],
          );
          removed += result.rowCount;
          if (result.rowCount < batchSize) break;
        }
      }
      const summary = {
        name: policy.name,
        table: policy.table,
        retention: policy.retention,
        candidates,
        removed,
        capped: !dryRun && removed === batchSize * maxBatches,
      };
      results.push(summary);
      onProgress?.(summary);
    }
    return { dryRun, batchSize, maxBatches, results };
  } finally {
    client.release();
  }
};

const runMaintenance = async (
  pool,
  { dryRun = false, maxTables = 6, onProgress } = {},
) => {
  if (!Number.isInteger(maxTables) || maxTables < 1 || maxTables > MAINTENANCE_TABLES.length) {
    throw new Error(`maxTables must be between 1 and ${MAINTENANCE_TABLES.length}`);
  }
  const client = await pool.connect();
  try {
    const stats = await client.query(
      `SELECT relname AS table_name, n_live_tup::bigint, n_dead_tup::bigint,
              last_autovacuum, last_autoanalyze
       FROM pg_stat_user_tables
       WHERE relname = ANY($1)
       ORDER BY n_dead_tup DESC, relname
       LIMIT $2`,
      [MAINTENANCE_TABLES, maxTables],
    );
    const results = [];
    for (const row of stats.rows) {
      if (!dryRun) {
        await client.query(`VACUUM (ANALYZE) ${quoteIdentifier(row.table_name)}`);
      }
      const summary = {
        ...row,
        action: dryRun ? "would_vacuum_analyze" : "vacuumed_analyzed",
      };
      results.push(summary);
      onProgress?.(summary);
    }
    return { dryRun, maxTables, results };
  } finally {
    client.release();
  }
};

const writeStorageReport = (report, outputPath) => {
  const target = path.resolve(outputPath);
  fs.writeFileSync(target, `${JSON.stringify(report, null, 2)}\n`, { mode: 0o600 });
  return target;
};

module.exports = {
  MAINTENANCE_TABLES,
  RETENTION_POLICIES,
  classifyTable,
  createMaintenancePool,
  runMaintenance,
  runRetention,
  storageReport,
  writeStorageReport,
};
