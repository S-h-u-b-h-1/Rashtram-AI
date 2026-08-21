const DEFAULT_STORAGE_THRESHOLDS = Object.freeze({
  warningPercent: 70,
  pausePercent: 82,
  criticalPercent: 90,
  minimumHeadroomBytes: 64 * 1024 * 1024,
  highGrowthBytesPerReadyDocument: 128 * 1024,
});

const CAPACITY_CATEGORIES = Object.freeze({
  documents: new Set(["documents", "document_metadata"]),
  sourcesResources: new Set([
    "document_sources",
    "document_resources",
    "source_registry",
    "source_health",
    "source_directory_entries",
    "source_collection_snapshots",
    "document_artifact_objects",
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
    "intelligence_events",
    "knowledge_nodes",
    "knowledge_edges",
    "knowledge_evidence",
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
    "dashboard_metrics",
    "schema_migrations",
    "application_schema_versions",
    "catalog_match_reviews",
    "document_catalogue_audit_checkpoints",
    "dedupe_candidates",
    "related_bills",
    "contact_requests",
    "feedback_submissions",
    "bug_reports",
    "artifact_storage_migration_runs",
    "artifact_storage_migration_items",
  ]),
  legacyMirror: new Set([
    "legislative_documents",
    "legislative_document_resources",
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
  highGrowthBytesPerReadyDocument: boundedNumber(
    env.DATABASE_STORAGE_HIGH_GROWTH_BYTES_PER_READY_DOCUMENT,
    DEFAULT_STORAGE_THRESHOLDS.highGrowthBytesPerReadyDocument,
    1,
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
  const bytesUntilPause = maxBytes == null
    ? 0
    : Math.max(
      0,
      Math.min(
        Math.floor((maxBytes * thresholds.pausePercent) / 100) - databaseBytes,
        headroomBytes - thresholds.minimumHeadroomBytes,
      ),
    );
  const safeBatchSize = paused
    ? 0
    : Math.min(
      25,
      Math.floor(bytesUntilPause / thresholds.highGrowthBytesPerReadyDocument),
    );
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
    state: paused
      ? "Processing Paused"
      : usagePercent >= thresholds.criticalPercent
        ? "Critical"
        : usagePercent >= thresholds.warningPercent
          ? "Warning"
          : "Healthy",
    databaseBytes,
    maxBytes,
    headroomBytes,
    usagePercent,
    safeBatchSize,
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

const measuredRange = (physicalBytes, documents, distribution = {}) => {
  const expected = physicalBytes / Math.max(1, documents);
  const logicalExpected = Number(distribution.expected || 0);
  const ratio = (value, fallback) => logicalExpected > 0
    ? Number(value || logicalExpected) / logicalExpected
    : fallback;
  return {
    low: expected * Math.max(0, ratio(distribution.low, 0.75)),
    expected,
    high: expected * Math.max(1, ratio(distribution.high, 1.25)),
  };
};

const addRanges = (...ranges) => Object.fromEntries(
  ["low", "expected", "high"].map((name) => [
    name,
    ranges.reduce((sum, range) => sum + Number(range?.[name] || 0), 0),
  ]),
);

const subtractRanges = (range, savings) => ({
  low: Math.max(0, range.low - Number(savings?.high || 0)),
  expected: Math.max(0, range.expected - Number(savings?.expected || 0)),
  high: Math.max(0, range.high - Number(savings?.low || 0)),
});

const buildProjectionModels = ({
  databaseBytes,
  catalogueDocuments = Number.MAX_SAFE_INTEGER,
  researchReadyDocuments,
  artifactDocuments,
  chunkDocuments,
  categories,
  growthMeasurements = {},
  targets = [2500, 5000, 10000, 20000],
}) => {
  const categoryBytes = (name) => categories[name]?.bytes || 0;
  const preparedDocuments = Math.max(
    1,
    researchReadyDocuments,
    artifactDocuments,
    chunkDocuments,
  );
  const currentVariableBytes = categoryBytes("chunks") +
    categoryBytes("summaries") + categoryBytes("graphRelationships");
  const fixedBaselineBytes = databaseBytes - currentVariableBytes;
  const chunkRange = measuredRange(
    categoryBytes("chunks"),
    chunkDocuments,
    growthMeasurements.chunks,
  );
  const artifactRange = measuredRange(
    categoryBytes("summaries"),
    artifactDocuments,
    growthMeasurements.artifacts,
  );
  const graphRange = measuredRange(
    categoryBytes("graphRelationships"),
    researchReadyDocuments,
    growthMeasurements.graph,
  );
  const duplicateMetadataRange = growthMeasurements.chunkDuplicateMetadata || {
    low: 0,
    expected: 0,
    high: 0,
  };
  const optimizedChunkRange = subtractRanges(chunkRange, duplicateMetadataRange);
  const artifactOffloadRange = growthMeasurements.artifactOriginalPhysical || {
    low: 0,
    expected: 0,
    high: 0,
  };
  const retainedArtifactRange = subtractRanges(artifactRange, artifactOffloadRange);
  const legacyMirrorBytes = categoryBytes("legacyMirror");
  const catalogueGrowthBytesPerDocument = (
    categoryBytes("documents") +
    categoryBytes("sourcesResources") +
    categoryBytes("processingState")
  ) / Math.max(1, catalogueDocuments);
  const models = [
    {
      key: "currentArchitecture",
      label: "Current architecture (no optimization)",
      completedMigrationAssumed: false,
      baselineBytes: databaseBytes,
      perDocument: addRanges(chunkRange, artifactRange, graphRange),
    },
    {
      key: "optimizedChunkWrites",
      label: "New chunk-write optimization",
      completedMigrationAssumed: false,
      baselineBytes: databaseBytes,
      perDocument: addRanges(optimizedChunkRange, artifactRange, graphRange),
    },
    {
      key: "objectStorageAndLegacyDeprecation",
      label: "Object storage plus legacy-deprecation target",
      completedMigrationAssumed: true,
      baselineBytes: fixedBaselineBytes - legacyMirrorBytes,
      perDocument: addRanges(optimizedChunkRange, retainedArtifactRange, graphRange),
    },
  ];

  return {
    currentPreparedDocuments: preparedDocuments,
    fixedBaselineBytes,
    variablePreparedBytes: currentVariableBytes,
    legacyMirrorBytes,
    catalogueGrowthBytesPerDocument,
    ranges: {
      chunks: chunkRange,
      artifacts: artifactRange,
      graph: graphRange,
      optimizedChunks: optimizedChunkRange,
      retainedArtifacts: retainedArtifactRange,
    },
    models: models.map((model) => ({
      ...model,
      projections: targets.map((target) => {
        const incrementalDocuments = model.completedMigrationAssumed
          ? target
          : Math.max(0, target - preparedDocuments);
        const estimate = Object.fromEntries(
          ["low", "expected", "high"].map((name) => {
            const catalogueGrowth = Math.max(0, target - catalogueDocuments) *
              catalogueGrowthBytesPerDocument;
            const projected = model.baselineBytes +
              incrementalDocuments * model.perDocument[name] + catalogueGrowth;
            return [name, Math.max(0, Math.round(projected))];
          }),
        );
        return {
          researchReadyDocuments: target,
          incrementalDocuments,
          ...estimate,
          deltaFromCurrentBytes: estimate.expected - databaseBytes,
        };
      }),
    })),
    formula: {
      existingArchitectures:
        "current_database_bytes + max(0, target - current_prepared_documents) * measured_bytes_per_prepared_document + max(0, target - current_catalogue_documents) * measured_catalogue_bytes_per_document",
      targetArchitecture:
        "(fixed_baseline_bytes - legacy_mirror_bytes) + target * (optimized_chunks + retained_artifacts + graph)_bytes_per_document + max(0, target - current_catalogue_documents) * measured_catalogue_bytes_per_document",
      ranges:
        "Expected uses current physical relation bytes/document. Low and high apply measured per-document P25 and P90 logical-size ratios; optimization savings use the inverse conservative bounds.",
    },
  };
};

const buildProjections = (input) => buildProjectionModels(input).models[0].projections;

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
      legacyViews,
      chunkGrowthDistribution,
      artifactGrowthDistribution,
      graphGrowthDistribution,
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
           AND ccu.table_name IN ('legislative_documents', 'legislative_document_resources')
         ORDER BY tc.table_name, kcu.column_name`,
      ),
      pool.query(
        `SELECT trigger_name, event_manipulation, action_timing
         FROM information_schema.triggers
         WHERE event_object_schema = 'public'
           AND event_object_table IN ('legislative_documents', 'legislative_document_resources')
         ORDER BY trigger_name, event_manipulation`,
      ),
      pool.query(
        `SELECT schemaname, viewname
         FROM pg_views
         WHERE schemaname = 'public'
           AND (definition ILIKE '%legislative_documents%'
             OR definition ILIKE '%legislative_document_resources%')
         ORDER BY viewname`,
      ),
      pool.query(
        `WITH per_document AS (
           SELECT document_id,
                  SUM(pg_column_size(chunk))::numeric AS logical_bytes,
                  SUM(
                    COALESCE(pg_column_size(metadata_json -> 'summary'), 0) +
                    COALESCE(pg_column_size(metadata_json -> 'content'), 0)
                  )::numeric AS duplicate_metadata_bytes
           FROM document_text_chunks chunk
           GROUP BY document_id
         )
         SELECT
           PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY logical_bytes)::numeric(16,2) AS low_bytes,
           AVG(logical_bytes)::numeric(16,2) AS expected_bytes,
           PERCENTILE_CONT(0.90) WITHIN GROUP (ORDER BY logical_bytes)::numeric(16,2) AS high_bytes,
           PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY duplicate_metadata_bytes)::numeric(16,2) AS duplicate_low_bytes,
           AVG(duplicate_metadata_bytes)::numeric(16,2) AS duplicate_expected_bytes,
           PERCENTILE_CONT(0.90) WITHIN GROUP (ORDER BY duplicate_metadata_bytes)::numeric(16,2) AS duplicate_high_bytes
         FROM per_document`,
      ),
      pool.query(
        `WITH per_document AS (
           SELECT document_id,
                  pg_column_size(artifact)::numeric AS logical_bytes,
                  pg_column_size(original_text)::numeric AS original_bytes
           FROM document_text_artifacts artifact
         )
         SELECT
           PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY logical_bytes)::numeric(16,2) AS low_bytes,
           AVG(logical_bytes)::numeric(16,2) AS expected_bytes,
           PERCENTILE_CONT(0.90) WITHIN GROUP (ORDER BY logical_bytes)::numeric(16,2) AS high_bytes,
           PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY original_bytes)::numeric(16,2) AS original_low_bytes,
           AVG(original_bytes)::numeric(16,2) AS original_expected_bytes,
           PERCENTILE_CONT(0.90) WITHIN GROUP (ORDER BY original_bytes)::numeric(16,2) AS original_high_bytes
         FROM per_document`,
      ),
      pool.query(
        `WITH per_document AS (
           SELECT from_document_id AS document_id,
                  SUM(pg_column_size(relationship))::numeric AS logical_bytes
           FROM document_relationships relationship
           GROUP BY from_document_id
         )
         SELECT
           PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY logical_bytes)::numeric(16,2) AS low_bytes,
           AVG(logical_bytes)::numeric(16,2) AS expected_bytes,
           PERCENTILE_CONT(0.90) WITHIN GROUP (ORDER BY logical_bytes)::numeric(16,2) AS high_bytes
         FROM per_document`,
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
    const numericRange = (row, prefix = "") => ({
      low: Number(row[`${prefix}low_bytes`] || 0),
      expected: Number(row[`${prefix}expected_bytes`] || 0),
      high: Number(row[`${prefix}high_bytes`] || 0),
    });
    const chunkDistribution = numericRange(chunkGrowthDistribution.rows[0]);
    const artifactDistribution = numericRange(artifactGrowthDistribution.rows[0]);
    const graphDistribution = numericRange(graphGrowthDistribution.rows[0]);
    const duplicateLogical = numericRange(chunkGrowthDistribution.rows[0], "duplicate_");
    const artifactOriginalLogical = numericRange(
      artifactGrowthDistribution.rows[0],
      "original_",
    );
    const physicalSavings = (logicalSavings, logicalTotal, physicalTotal, documents) => {
      const physicalPerDocument = physicalTotal / Math.max(1, documents);
      const expectedRatio = logicalTotal.expected > 0
        ? logicalSavings.expected / logicalTotal.expected
        : 0;
      const expected = physicalPerDocument * Math.min(1, Math.max(0, expectedRatio));
      return {
        low: expected * (logicalSavings.expected > 0
          ? logicalSavings.low / logicalSavings.expected
          : 0),
        expected,
        high: expected * (logicalSavings.expected > 0
          ? logicalSavings.high / logicalSavings.expected
          : 0),
      };
    };
    const growthMeasurements = {
      chunks: chunkDistribution,
      artifacts: artifactDistribution,
      graph: graphDistribution,
      chunkDuplicateMetadata: physicalSavings(
        duplicateLogical,
        chunkDistribution,
        categories.chunks?.bytes || 0,
        Number(countRow.chunk_documents),
      ),
      artifactOriginalPhysical: physicalSavings(
        artifactOriginalLogical,
        artifactDistribution,
        categories.summaries?.bytes || 0,
        Number(countRow.artifact_documents),
      ),
    };
    return {
      generatedAt: new Date().toISOString(),
      storage: evaluateStorageStatus({ databaseBytes, maxBytes }),
      migration022: migration.rows[0],
      counts: Object.fromEntries(Object.entries(countRow).map(([key, value]) => [key, Number(value)])),
      categories,
      projections: buildProjectionModels({
        databaseBytes,
        catalogueDocuments: Number(countRow.catalogue_documents),
        researchReadyDocuments: Number(countRow.research_ready_documents),
        artifactDocuments: Number(countRow.artifact_documents),
        chunkDocuments: Number(countRow.chunk_documents),
        categories,
        growthMeasurements,
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
        compatibilityViews: legacyViews.rows,
      },
      methodology: {
        catalogueBaseline:
          "Canonical catalogue tables remain at their measured current size while existing documents are made research-ready; they scale only above the current catalogue count.",
        readyDocumentGrowth:
          "Expected growth uses measured physical relation bytes per prepared document. Low and high bounds use the observed P25 and P90 per-document logical-size ratios from the current corpus.",
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
  buildProjectionModels,
  buildProjections,
  categoryForTable,
  evaluateStorageStatus,
  readStorageStatus,
  storageThresholds,
  sumCategoryBytes,
};
