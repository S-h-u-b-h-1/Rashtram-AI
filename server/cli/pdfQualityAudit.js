#!/usr/bin/env node

const path = require("node:path");
require("dotenv").config({ path: process.env.ENV_FILE || path.resolve(__dirname, "../.env.local") });
const { getPool, query } = require("../db");
const { argumentInteger } = require("./cliArgs");
const { aggregateAudit, summarizeDocuments } = require("../document/pdfCorpusQualityService");

const loadPdfChunkRows = async (limit = 0) => (await query(`
  WITH chat_usage AS (
    SELECT document_id, TRUE AS used FROM research_chats WHERE document_id IS NOT NULL GROUP BY document_id
  ), legacy_chat_usage AS (
    SELECT document_id::BIGINT AS document_id, TRUE AS used
    FROM document_chats WHERE document_id ~ '^\d+$' GROUP BY document_id
  ), comparison_usage AS (
    SELECT selected.id::BIGINT AS document_id, TRUE AS used
    FROM document_comparisons comparison,
      LATERAL jsonb_array_elements_text(comparison.document_ids_json) selected(id)
    WHERE selected.id ~ '^\d+$' GROUP BY selected.id
  ), eligible AS (
    SELECT d.id, d.document_type, d.title, d.year,
      COALESCE(l.canonical_source, l.source_name, 'unknown') AS source_name,
      COALESCE(l.source_url, l.canonical_url) AS source_url, l.pdf_url,
      COALESCE(a.language_code, d.language, 'und') AS language, a.extraction_method, a.ocr_used,
      COALESCE(chat_usage.used, FALSE) OR COALESCE(legacy_chat_usage.used, FALSE) AS user_used,
      COALESCE(comparison_usage.used, FALSE) AS comparison_used
    FROM documents d
    JOIN legislative_documents l ON l.id = d.id
    JOIN document_processing_state state ON state.document_id = d.id
    LEFT JOIN document_text_artifacts a ON a.document_id = d.id
    LEFT JOIN chat_usage ON chat_usage.document_id = d.id
    LEFT JOIN legacy_chat_usage ON legacy_chat_usage.document_id = d.id
    LEFT JOIN comparison_usage ON comparison_usage.document_id = d.id
    WHERE state.search_ready = TRUE AND d.visibility_status <> 'hidden_invalid'
      AND l.pdf_url IS NOT NULL
      AND COALESCE(a.extraction_method, '') <> 'source_html'
    ORDER BY d.id
    ${limit > 0 ? "LIMIT $1" : ""}
  )
  SELECT eligible.*, chunk.document_id, chunk.chunk_index, chunk.original_text,
    chunk.translated_text, chunk.metadata_json
  FROM eligible JOIN document_text_chunks chunk ON chunk.document_id = eligible.id
  ORDER BY eligible.id, chunk.chunk_index
`, limit > 0 ? [limit] : [])).rows;

const main = async () => {
  const limit = argumentInteger("limit", 0, 0, 100000);
  const candidateLimit = argumentInteger("candidate-limit", 20, 0, 100);
  const documents = summarizeDocuments(await loadPdfChunkRows(limit));
  const audit = aggregateAudit(documents);
  console.log(JSON.stringify({
    generatedAt: new Date().toISOString(), mode: "read_only",
    ...audit,
    candidates: documents.filter((document) => document.severity !== "GOOD").slice(0, candidateLimit),
    diagnosticsBounded: true,
  }, null, 2));
};

main().catch((error) => { console.error(error); process.exitCode = 1; })
  .finally(async () => getPool().end());

module.exports = { loadPdfChunkRows };
