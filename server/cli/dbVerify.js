#!/usr/bin/env node

const path = require("path");
require("dotenv").config({
  path: process.env.ENV_FILE || path.resolve(__dirname, "../.env.local"),
});
const { getPool, query } = require("../db");
const { refreshDataQuality } = require("../lib/database/quality");

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
