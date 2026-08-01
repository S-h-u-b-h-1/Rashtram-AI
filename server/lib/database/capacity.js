const DEFAULT_STORAGE_THRESHOLDS = Object.freeze({
  warningPercent: 70,
  pausePercent: 82,
  criticalPercent: 90,
  minimumHeadroomBytes: 64 * 1024 * 1024,
});

const CAPACITY_CATEGORIES = Object.freeze({
  documents: new Set(["documents", "legislative_documents", "document_metadata"]),
  sourcesResources: new Set([
    "document_sources",
    "document_resources",
    "legislative_document_resources",
    "source_registry",
    "source_health",
    "source_connectors",
    "source_directory_entries",
    "source_snapshots",
    "source_collection_snapshots",
  ]),
  chunks: new Set(["document_text_chunks"]),
  summaries: new Set(["document_text_artifacts"]),
  processingState: new Set([
    "document_processing_state",
    "document_processing_jobs",
    "document_processing_attempts",
    "document_processing_workers",
    "document_processing_audit_log",
    "document_retry_domain_state",
  ]),
  graphRelationships: new Set([
    "document_relationships",
    "document_relationship_quarantine",
    "document_topics",
    "topic_taxonomy",
    "intelligence_events",
    "saved_graph_paths",
  ]),
  userData: new Set([
    "users",
    "user_sessions",
    "user_profiles",
    "user_preferences",
    "user_research_preferences",
    "user_activity_events",
    "user_document_interactions",
    "research_chats",
    "research_messages",
    "research_notes",
    "research_collections",
    "research_collection_items",
    "document_chats",
    "document_chat_feedback",
    "bill_chats",
    "act_chats",
    "egazette_chats",
    "multi_document_chats",
    "document_comparisons",
    "recommendations",
    "bookmarks",
    "saved_content",
    "saved_searches",
  ]),
  operationalLogs: new Set([
    "ingestion_runs",
    "ingestion_run_items",
    "audit_logs",
    "system_events",
    "dashboard_metrics",
    "schema_migrations",
    "application_schema_versions",
    "catalog_match_reviews",
    "document_catalogue_audit_checkpoints",
    "dedupe_candidates",
    "related_bills",
    "contact_requests",
    "contact_submissions",
    "feedback_submissions",
    "bug_reports",
  ]),
});

const boundedNumber = (value, fallback, minimum, maximum) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= minimum && parsed <= maximum
    ? parsed
    : fallback;
};

const storageThresholds = (env = process.env) => ({
  warningPercent: boundedNumber(
    env.DATABASE_STORAGE_WARNING_PERCENT,
    DEFAULT_STORAGE_THRESHOLDS.warningPercent,
    1,
    99,
  ),
  pausePercent: boundedNumber(
    env.DATABASE_STORAGE_PAUSE_PERCENT,
    DEFAULT_STORAGE_THRESHOLDS.pausePercent,
    1,
    99,
  ),
  criticalPercent: boundedNumber(
    env.DATABASE_STORAGE_CRITICAL_PERCENT,
    DEFAULT_STORAGE_THRESHOLDS.criticalPercent,
    1,
    100,
  ),
  minimumHeadroomBytes: boundedNumber(
    env.DATABASE_STORAGE_MIN_HEADROOM_BYTES,
    DEFAULT_STORAGE_THRESHOLDS.minimumHeadroomBytes,
    0,
    Number.MAX_SAFE_INTEGER,
  ),
});

const evaluateStorageStatus = (
  { databaseBytes, maxBytes },
  thresholds = storageThresholds(),
) => {
  const usagePercent = maxBytes
    ? Number(((databaseBytes / maxBytes) * 100).toFixed(2))
    : null;
  const headroomBytes = maxBytes ? Math.max(0, maxBytes - databaseBytes) : null;
  const alerts = [];
  if (usagePercent != null && usagePercent >= thresholds.warningPercent) {
    alerts.push("warning_70_percent");
  }
  if (usagePercent != null && usagePercent >= 80) alerts.push("warning_80_percent");
  if (usagePercent != null && usagePercent >= thresholds.criticalPercent) {
    alerts.push("critical_90_percent");
  }
  const belowHeadroomFloor =
    headroomBytes != null && headroomBytes < thresholds.minimumHeadroomBytes;
  const paused =
    maxBytes == null ||
    usagePercent >= thresholds.pausePercent ||
    belowHeadroomFloor;
  const level =
    usagePercent == null
      ? "unknown"
      : usagePercent >= thresholds.criticalPercent
        ? "critical"
        : paused
          ? "paused"
          : usagePercent >= thresholds.warningPercent
            ? "warning"
            : "ok";
  return {
    level,
    databaseBytes,
    maxBytes,
    headroomBytes,
    usagePercent,
    thresholds,
    alerts,
    bulkProcessingAllowed: !paused,
    reason: maxBytes == null
      ? "Database storage limit is unavailable; bulk processing fails closed."
      : usagePercent >= thresholds.pausePercent
        ? `Database storage usage is ${usagePercent}%, at or above the ${thresholds.pausePercent}% pause threshold.`
        : belowHeadroomFloor
          ? `Database headroom is below the configured ${thresholds.minimumHeadroomBytes}-byte floor.`
          : null,
  };
};

const readStorageStatus = async (pool, { env = process.env } = {}) => {
  const result = await pool.query(
    `SELECT pg_database_size(current_database())::bigint AS database_bytes,
            COALESCE(
              CASE
                WHEN current_setting('neon.max_cluster_size', true) IS NULL THEN NULL
                ELSE pg_size_bytes(current_setting('neon.max_cluster_size', true))::bigint
              END,
              NULLIF($1, '')::bigint
            ) AS max_bytes`,
    [env.DATABASE_STORAGE_MAX_BYTES || ""],
  );
  return evaluateStorageStatus(
    {
      databaseBytes: Number(result.rows[0].database_bytes),
      maxBytes: result.rows[0].max_bytes == null ? null : Number(result.rows[0].max_bytes),
    },
    storageThresholds(env),
  );
};

const assertBulkProcessingSafe = async (pool, options = {}) => {
  const status = await readStorageStatus(pool, options);
  if (!status.bulkProcessingAllowed) {
    const error = new Error(
      `Bulk processing blocked by database storage guard. ${status.reason}`,
    );
    error.code = "DATABASE_STORAGE_HEADROOM_LOW";
    error.status = 503;
    error.storage = status;
    throw error;
  }
  return status;
};

const categoryForTable = (tableName) =>
  Object.entries(CAPACITY_CATEGORIES).find(([, tables]) => tables.has(tableName))?.[0] ||
  "unclassified";

const sumCategoryBytes = (relations) => {
  const categories = {};
  for (const relation of relations) {
    const category = categoryForTable(relation.table_name);
    const entry = categories[category] || { bytes: 0, rows: 0, tables: [] };
    entry.bytes += Number(relation.total_bytes);
    entry.rows += Number(relation.rows);
    entry.tables.push({
      table: relation.table_name,
      rows: Number(relation.rows),
      bytes: Number(relation.total_bytes),
    });
    categories[category] = entry;
  }
  return categories;
};

const buildProjections = ({
  databaseBytes,
  catalogueDocuments,
  researchReadyDocuments,
  artifactDocuments,
  chunkDocuments,
  categories,
  targets = [2500, 5000, 10000, 20000],
}) => {
  const categoryBytes = (name) => categories[name]?.bytes || 0;
  const readyDenominator = Math.max(
    1,
    researchReadyDocuments,
    artifactDocuments,
    chunkDocuments,
  );
  const scalableReady = new Set(["chunks", "summaries", "graphRelationships"]);
  const scalableCatalogue = new Set(["documents", "sourcesResources", "processingState"]);
  return targets.map((target) => {
    const breakdown = {};
    for (const name of Object.keys(categories)) {
      const currentBytes = categoryBytes(name);
      if (scalableReady.has(name)) {
        breakdown[name] = Math.round((currentBytes / readyDenominator) * target);
      } else if (scalableCatalogue.has(name)) {
        breakdown[name] = Math.round(
          currentBytes * (Math.max(catalogueDocuments, target) / Math.max(1, catalogueDocuments)),
        );
      } else {
        breakdown[name] = currentBytes;
      }
    }
    const projectedBytes = Object.values(breakdown).reduce((sum, bytes) => sum + bytes, 0);
    return {
      researchReadyDocuments: target,
      projectedBytes,
      deltaFromCurrentBytes: projectedBytes - databaseBytes,
      breakdown,
    };
  });
};

const buildCapacityReport = async (pool) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN READ ONLY");
    const [
      storage,
      relations,
      counts,
      migration,
      chunkMetrics,
      chunkDuplicates,
      chunkMetadataKeys,
      chunkIndexes,
      artifactMetrics,
      artifactDuplicates,
      artifactStaleness,
      legacyDependencies,
      legacyTriggers,
    ] = await Promise.all([
      pool.query(
        `SELECT pg_database_size(current_database())::bigint AS database_bytes,
                CASE WHEN current_setting('neon.max_cluster_size', true) IS NULL
                  THEN NULL
                  ELSE pg_size_bytes(current_setting('neon.max_cluster_size', true))::bigint
                END AS max_bytes`,
      ),
      pool.query(
        `SELECT c.relname AS table_name,
                pg_relation_size(c.oid)::bigint AS table_bytes,
                pg_indexes_size(c.oid)::bigint AS index_bytes,
                (pg_total_relation_size(c.oid) - pg_relation_size(c.oid) - pg_indexes_size(c.oid))::bigint AS toast_bytes,
                pg_total_relation_size(c.oid)::bigint AS total_bytes,
                (SELECT COUNT(*)::bigint FROM pg_catalog.pg_class counted WHERE counted.oid = c.oid) AS relation_exists,
                COALESCE(s.n_live_tup, 0)::bigint AS estimated_rows
         FROM pg_class c
         JOIN pg_namespace n ON n.oid = c.relnamespace
         LEFT JOIN pg_stat_user_tables s ON s.relid = c.oid
         WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p')`,
      ),
      pool.query(
        `SELECT
           (SELECT COUNT(*) FROM documents)::bigint AS catalogue_documents,
           (SELECT COUNT(*) FROM documents WHERE research_ready)::bigint AS research_ready_documents,
           (SELECT COUNT(DISTINCT document_id) FROM document_text_artifacts)::bigint AS artifact_documents,
           (SELECT COUNT(DISTINCT document_id) FROM document_text_chunks)::bigint AS chunk_documents`,
      ),
      pool.query(
        `SELECT
           (SELECT migration_name FROM schema_migrations ORDER BY applied_at DESC, migration_name DESC LIMIT 1) AS latest_migration,
           EXISTS (SELECT 1 FROM schema_migrations WHERE migration_name = '022_document_text_chunks_content_hash.js') AS migration_022_recorded,
           EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'document_text_chunks' AND column_name = 'content_hash') AS content_hash_column,
           EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'document_text_chunks' AND column_name = 'embedding_namespace') AS embedding_namespace_column,
           EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND tablename = 'document_text_chunks' AND indexname = 'document_text_chunks_content_hash_idx' AND indexdef ILIKE '%(document_id, content_hash)%' AND indexdef ILIKE '%WHERE (content_hash IS NOT NULL)%') AS content_hash_index`,
      ),
      pool.query(
        `SELECT COUNT(*)::bigint AS chunks,
                COUNT(DISTINCT document_id)::bigint AS documents,
                AVG(octet_length(original_text))::numeric(14,2) AS average_original_bytes,
                AVG(octet_length(COALESCE(translated_text, '')))::numeric(14,2) AS average_translated_bytes,
                AVG(pg_column_size(metadata_json))::numeric(14,2) AS average_metadata_bytes,
                AVG(token_count)::numeric(14,2) AS average_tokens,
                COUNT(*) FILTER (WHERE content_hash IS NOT NULL)::bigint AS content_hash_populated,
                COUNT(*) FILTER (WHERE embedding_namespace IS NOT NULL)::bigint AS embedding_namespace_populated,
                COUNT(*) FILTER (WHERE translated_text = original_text)::bigint AS identical_original_translation,
                COUNT(*) FILTER (WHERE translated_text IS NOT NULL)::bigint AS translated_chunks
         FROM document_text_chunks`,
      ),
      pool.query(
        `WITH duplicates AS (
           SELECT md5(original_text) AS text_hash, COUNT(*)::bigint AS copies
           FROM document_text_chunks GROUP BY md5(original_text) HAVING COUNT(*) > 1
         )
         SELECT COALESCE(SUM(copies - 1), 0)::bigint AS duplicate_payload_rows,
                COUNT(*)::bigint AS duplicate_payload_groups
         FROM duplicates`,
      ),
      pool.query(
        `SELECT entry.key,
                COUNT(*)::bigint AS chunks,
                SUM(pg_column_size(entry.value))::bigint AS value_bytes
         FROM document_text_chunks chunk
         CROSS JOIN LATERAL jsonb_each(chunk.metadata_json) entry
         GROUP BY entry.key
         ORDER BY value_bytes DESC, entry.key`,
      ),
      pool.query(
        `SELECT indexrelname AS index_name,
                pg_relation_size(indexrelid)::bigint AS bytes,
                idx_scan::bigint AS scans
         FROM pg_stat_user_indexes
         WHERE relname = 'document_text_chunks'
         ORDER BY bytes DESC`,
      ),
      pool.query(
        `SELECT COUNT(*)::bigint AS artifacts,
                COUNT(*) FILTER (WHERE btrim(original_text) = '')::bigint AS empty_original_text,
                COUNT(*) FILTER (WHERE english_summary IS NULL OR btrim(english_summary) = '')::bigint AS missing_summary,
                AVG(octet_length(original_text))::numeric(14,2) AS average_original_bytes,
                AVG(octet_length(COALESCE(english_summary, '')))::numeric(14,2) AS average_summary_bytes,
                AVG(pg_column_size(metadata_json))::numeric(14,2) AS average_metadata_bytes,
                AVG(pg_column_size(summary_json))::numeric(14,2) AS average_summary_json_bytes
         FROM document_text_artifacts`,
      ),
      pool.query(
        `WITH duplicates AS (
           SELECT md5(original_text) AS text_hash, COUNT(*)::bigint AS copies
           FROM document_text_artifacts
           WHERE btrim(original_text) <> ''
           GROUP BY md5(original_text) HAVING COUNT(*) > 1
         )
         SELECT COALESCE(SUM(copies - 1), 0)::bigint AS duplicate_original_rows,
                COUNT(*)::bigint AS duplicate_original_groups
         FROM duplicates`,
      ),
      pool.query(
        `SELECT
           COUNT(*) FILTER (
             WHERE document.content_fingerprint_sha256 IS NOT NULL
               AND artifact.metadata_json ->> 'textSha256' IS NOT NULL
               AND document.content_fingerprint_sha256 IS DISTINCT FROM artifact.metadata_json ->> 'textSha256'
           )::bigint AS content_hash_mismatches,
           COUNT(*) FILTER (WHERE artifact.updated_at < document.updated_at)::bigint AS artifact_older_than_document
         FROM document_text_artifacts artifact
         JOIN documents document ON document.id = artifact.document_id`,
      ),
      pool.query(
        `SELECT tc.table_name AS dependent_table,
                kcu.column_name,
                rc.delete_rule
         FROM information_schema.table_constraints tc
         JOIN information_schema.key_column_usage kcu
           ON kcu.constraint_name = tc.constraint_name AND kcu.constraint_schema = tc.constraint_schema
         JOIN information_schema.referential_constraints rc
           ON rc.constraint_name = tc.constraint_name AND rc.constraint_schema = tc.constraint_schema
         JOIN information_schema.constraint_column_usage ccu
           ON ccu.constraint_name = tc.constraint_name AND ccu.constraint_schema = tc.constraint_schema
         WHERE tc.constraint_type = 'FOREIGN KEY'
           AND ccu.table_schema = 'public'
           AND ccu.table_name = 'legislative_documents'
         ORDER BY tc.table_name, kcu.column_name`,
      ),
      pool.query(
        `SELECT trigger_name, event_manipulation, action_timing
         FROM information_schema.triggers
         WHERE event_object_schema = 'public'
           AND event_object_table = 'legislative_documents'
         ORDER BY trigger_name, event_manipulation`,
      ),
    ]);

    const exactRelations = [];
    for (const relation of relations.rows) {
      const rowCount = await client.query(
        `SELECT COUNT(*)::bigint AS rows FROM "${String(relation.table_name).replaceAll('"', '""')}"`,
      );
      exactRelations.push({ ...relation, rows: rowCount.rows[0].rows });
    }
    await client.query("COMMIT");

    const categories = sumCategoryBytes(exactRelations);
    const countRow = counts.rows[0];
    const databaseBytes = Number(storage.rows[0].database_bytes);
    const maxBytes = storage.rows[0].max_bytes == null ? null : Number(storage.rows[0].max_bytes);
    const classifiedBytes = Object.values(categories).reduce(
      (sum, category) => sum + category.bytes,
      0,
    );
    categories.databaseOverhead = {
      bytes: Math.max(0, databaseBytes - classifiedBytes),
      rows: 0,
      tables: [],
      rationale:
        "Database-level allocation and catalog overhead not attributed to public relation totals.",
    };
    return {
      generatedAt: new Date().toISOString(),
      storage: evaluateStorageStatus({ databaseBytes, maxBytes }),
      migration022: migration.rows[0],
      counts: Object.fromEntries(Object.entries(countRow).map(([key, value]) => [key, Number(value)])),
      categories,
      projections: buildProjections({
        databaseBytes,
        catalogueDocuments: Number(countRow.catalogue_documents),
        researchReadyDocuments: Number(countRow.research_ready_documents),
        artifactDocuments: Number(countRow.artifact_documents),
        chunkDocuments: Number(countRow.chunk_documents),
        categories,
      }),
      chunks: {
        ...chunkMetrics.rows[0],
        averageChunksPerDocument: Number(chunkMetrics.rows[0].chunks) /
          Math.max(1, Number(chunkMetrics.rows[0].documents)),
        ...chunkDuplicates.rows[0],
        metadataKeys: chunkMetadataKeys.rows,
        indexes: chunkIndexes.rows,
        toastBytes: Number(
          exactRelations.find((relation) => relation.table_name === "document_text_chunks")?.toast_bytes || 0,
        ),
      },
      artifacts: {
        ...artifactMetrics.rows[0],
        ...artifactDuplicates.rows[0],
        ...artifactStaleness.rows[0],
        deletionCandidates: 0,
        deletionRationale:
          "The table is one-row-per-document. Cross-document duplicate text can represent legitimate versions, so no row is automatically deletion-safe.",
      },
      legacyTable: {
        table: exactRelations.find((relation) => relation.table_name === "legislative_documents") || null,
        foreignKeys: legacyDependencies.rows,
        triggers: legacyTriggers.rows,
      },
      methodology: {
        catalogueBaseline:
          "Canonical catalogue tables remain at their measured current size while existing documents are made research-ready; they scale only above the current catalogue count.",
        readyDocumentGrowth:
          "Chunks, artifacts, and graph relations scale from their measured current bytes per research-ready/artifact-bearing document.",
        fixedGrowth:
          "User data and retention-bounded operational logs are held at current measured bytes; their growth depends on traffic, not processing target.",
        limitation:
          "PostgreSQL relation allocation is page-granular and future document mix may differ, so projections are capacity estimates rather than byte-exact forecasts.",
      },
    };
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
};

module.exports = {
  CAPACITY_CATEGORIES,
  DEFAULT_STORAGE_THRESHOLDS,
  assertBulkProcessingSafe,
  buildCapacityReport,
  buildProjections,
  categoryForTable,
  evaluateStorageStatus,
  readStorageStatus,
  storageThresholds,
  sumCategoryBytes,
};
