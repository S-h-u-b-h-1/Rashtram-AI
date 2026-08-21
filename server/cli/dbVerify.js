#!/usr/bin/env node

const path = require("path");
require("dotenv").config({
  path: process.env.ENV_FILE || path.resolve(__dirname, "../.env.local"),
});
const { getPool, query } = require("../db");
const { refreshDataQuality } = require("../lib/database/quality");
const migrations = require("../migrations");

const expectedLatestMigration = migrations.at(-1)?.name;

const checks = [
  {
    name: "document row parity",
    sql: `SELECT
      (SELECT COUNT(*) FROM legislative_documents) =
      (SELECT COUNT(*) FROM documents) AS passed`,
  },
  {
    name: "document ID parity",
    sql: `SELECT NOT EXISTS (
      SELECT id FROM legislative_documents
      EXCEPT SELECT id FROM documents
    ) AND NOT EXISTS (
      SELECT id FROM documents
      EXCEPT SELECT id FROM legislative_documents
    ) AS passed`,
  },
  {
    name: "source registry populated",
    sql: `SELECT COUNT(*) >= 25 AS passed FROM source_registry`,
  },
  {
    name: "no orphan normalized sources",
    sql: `SELECT NOT EXISTS (
      SELECT 1 FROM document_sources s
      LEFT JOIN documents d ON d.id = s.document_id
      WHERE d.id IS NULL
    ) AS passed`,
  },
  {
    name: "no orphan normalized resources",
    sql: `SELECT NOT EXISTS (
      SELECT 1 FROM document_resources r
      LEFT JOIN documents d ON d.id = r.document_id
      WHERE d.id IS NULL
    ) AS passed`,
  },
  {
    name: "no orphan normalized messages",
    sql: `SELECT NOT EXISTS (
      SELECT 1 FROM research_messages m
      LEFT JOIN research_chats c ON c.id = m.chat_id
      WHERE c.id IS NULL
    ) AS passed`,
  },
  {
    name: "quality score bounds",
    sql: `SELECT NOT EXISTS (
      SELECT 1 FROM documents WHERE quality_score < 0 OR quality_score > 100
    ) AS passed`,
  },
  {
    name: "strict research-ready invariant",
    sql: `SELECT NOT EXISTS (
      SELECT 1
      FROM documents d
      LEFT JOIN document_processing_state ps ON ps.document_id = d.id
      WHERE d.research_ready
        AND (
          d.canonical_url IS NULL
          OR ps.processing_status <> 'ready'
          OR ps.extraction_status <> 'ready'
          OR NOT (
            (
              ps.embedding_status = 'ready'
              AND ps.embeddings_count >= ps.chunks_count
            )
            OR (
              ps.embedding_status = 'fallback'
              AND ps.retrieval_mode IN ('local_text', 'hybrid')
            )
          )
          OR ps.chunks_count <= 0
          OR NOT ps.retrieval_verified
          OR ps.error_message IS NOT NULL
          OR NOT EXISTS (
            SELECT 1 FROM document_resources r
            WHERE r.document_id = d.id
              AND r.resource_type IN ('pdf', 'text', 'html')
              AND r.is_accessible
          )
        )
    ) AS passed`,
  },
  {
    name: "canonical IDs unique",
    sql: `SELECT NOT EXISTS (
      SELECT canonical_id FROM documents
      GROUP BY canonical_id HAVING COUNT(*) > 1
    ) AS passed`,
  },
  {
    name: "migration recorded",
    sql: `SELECT EXISTS (
      SELECT 1 FROM schema_migrations
      WHERE migration_name = '001_database_v2.js'
    ) AS passed`,
  },
  {
    name: `latest migration is ${expectedLatestMigration}`,
    sql: `SELECT (
      SELECT migration_name FROM schema_migrations
      ORDER BY applied_at DESC, migration_name DESC LIMIT 1
    ) = '${expectedLatestMigration}' AS passed`,
  },
  {
    name: "migration 022 columns complete",
    sql: `SELECT
      EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'document_text_chunks'
          AND column_name = 'content_hash'
      ) AND EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'document_text_chunks'
          AND column_name = 'embedding_namespace'
      ) AS passed`,
  },
  {
    name: "migration 022 content hash index complete",
    sql: `SELECT EXISTS (
      SELECT 1 FROM pg_indexes
      WHERE schemaname = 'public'
        AND tablename = 'document_text_chunks'
        AND indexname = 'document_text_chunks_content_hash_idx'
        AND indexdef ILIKE '%(document_id, content_hash)%'
        AND indexdef ILIKE '%WHERE (content_hash IS NOT NULL)%'
    ) AS passed`,
  },
  {
    name: "migration 023 object references complete",
    sql: `SELECT
      TO_REGCLASS('public.document_artifact_objects') IS NOT NULL
      AND TO_REGCLASS('public.artifact_storage_migration_runs') IS NOT NULL
      AND TO_REGCLASS('public.artifact_storage_migration_items') IS NOT NULL
      AS passed`,
  },
  {
    name: "migration 024 shared object-key index complete",
    sql: `SELECT EXISTS (
      SELECT 1 FROM pg_indexes
      WHERE schemaname = 'public'
        AND tablename = 'document_artifact_objects'
        AND indexname = 'document_artifact_objects_object_key_idx'
    ) AS passed`,
  },
  {
    name: "migration 025 unused schema removed",
    sql: `SELECT NOT EXISTS (
      SELECT 1
      FROM UNNEST(ARRAY[
        'source_snapshots',
        'source_connectors',
        'contact_submissions',
        'topic_taxonomy',
        'document_topics',
        'document_relationship_quarantine',
        'system_events'
      ]) AS removed(table_name)
      WHERE TO_REGCLASS('public.' || removed.table_name) IS NOT NULL
    ) AS passed`,
  },
  {
    name: "migration 026 dedupe review queue restored",
    sql: `SELECT TO_REGCLASS('public.dedupe_candidates') IS NOT NULL AS passed`,
  },
  {
    name: "migration 027 research sources complete",
    sql: `SELECT
      TO_REGCLASS('public.research_sources') IS NOT NULL
      AND TO_REGCLASS('public.research_source_chunks') IS NOT NULL
      AS passed`,
  },
  {
    name: "migration 028 policy drafts complete",
    sql: `SELECT TO_REGCLASS('public.policy_drafts') IS NOT NULL AS passed`,
  },
  {
    name: "migration 029 processing stages complete",
    sql: `SELECT
      TO_REGCLASS('public.document_processing_stages') IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'document_processing_state'
          AND column_name = 'search_ready'
      )
      AND EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'document_processing_state'
          AND column_name = 'semantic_ready'
      )
      AND EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'document_text_artifacts'
          AND column_name = 'extracted_text_sha256'
      )
      AND EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'document_text_chunks'
          AND column_name = 'embedding_input_sha256'
      ) AS passed`,
  },
  {
    name: "migration 030 knowledge layer complete",
    sql: `SELECT
      TO_REGCLASS('public.knowledge_nodes') IS NOT NULL
      AND TO_REGCLASS('public.knowledge_edges') IS NOT NULL
      AND TO_REGCLASS('public.knowledge_evidence') IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM schema_migrations
        WHERE migration_name = '030_knowledge_layer_v1.js'
      ) AS passed`,
  },
  {
    name: "migration 031 research observability complete",
    sql: `SELECT
      TO_REGCLASS('public.research_query_telemetry') IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM schema_migrations
        WHERE migration_name = '031_research_query_observability.js'
      ) AS passed`,
  },
  {
    name: "migration 032 semantic coverage complete",
    sql: `SELECT
      EXISTS (
        SELECT 1 FROM pg_indexes
        WHERE schemaname = 'public'
          AND indexname = 'document_processing_state_semantic_backlog_idx'
      )
      AND EXISTS (
        SELECT 1 FROM pg_indexes
        WHERE schemaname = 'public'
          AND indexname = 'document_text_chunks_namespace_document_idx'
      )
      AND EXISTS (
        SELECT 1 FROM schema_migrations
        WHERE migration_name = '032_semantic_coverage_v1.js'
      ) AS passed`,
  },
  {
    name: "migration 033 large-document intelligence complete",
    sql: `SELECT
      TO_REGCLASS('public.document_chunk_groups') IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM schema_migrations
        WHERE migration_name = '033_large_document_intelligence.js'
      ) AS passed`,
  },
  {
    name: "migration 034 temporal legal intelligence complete",
    sql: `SELECT
      EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'documents'
          AND column_name = 'temporal_metadata_json'
      )
      AND EXISTS (
        SELECT 1 FROM schema_migrations
        WHERE migration_name = '034_temporal_legal_intelligence_v1.js'
      ) AS passed`,
  },
  {
    name: "migration 035 compliance copilot complete",
    sql: `SELECT
      TO_REGCLASS('public.compliance_research_runs') IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'compliance_research_runs'
          AND column_name = 'evidence_refs_json'
      )
      AND EXISTS (
        SELECT 1 FROM schema_migrations
        WHERE migration_name = '035_compliance_copilot_v1.js'
      ) AS passed`,
  },
  {
    name: "migration 036 regulatory watchlists complete",
    sql: `SELECT
      TO_REGCLASS('public.research_watchlists') IS NOT NULL
      AND TO_REGCLASS('public.regulatory_alerts') IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM schema_migrations
        WHERE migration_name = '036_regulatory_watchlists_v1.js'
      ) AS passed`,
  },
  {
    name: "migration 037 cross-state comparisons complete",
    sql: `SELECT
      TO_REGCLASS('public.cross_state_comparisons') IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM schema_migrations
        WHERE migration_name = '037_cross_state_comparisons_v1.js'
      ) AS passed`,
  },
];

const main = async () => {
  const quality = await refreshDataQuality();
  const results = [];
  for (const check of checks) {
    const result = await query(check.sql);
    results.push({ name: check.name, passed: result.rows[0]?.passed === true });
  }
  const failed = results.filter((result) => !result.passed);
  console.log(
    JSON.stringify(
      { ok: !failed.length, quality, checks: results, failed: failed.length },
      null,
      2,
    ),
  );
  if (failed.length) process.exitCode = 1;
};

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    if (globalThis.__rashtramPostgresPool) await getPool().end();
  });
