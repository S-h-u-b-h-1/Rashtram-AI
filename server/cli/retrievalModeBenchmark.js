#!/usr/bin/env node

const fs = require("node:fs");
const path = require("node:path");
require("dotenv").config({
  path: process.env.ENV_FILE || path.resolve(__dirname, "../.env.local"),
});

const { getPool, query } = require("../db");
const { argumentInteger, argumentValue } = require("./cliArgs");
const { retrieveDocumentContext } = require("../document/documentResearchService");

const benchmarkQueries = (document) => {
  const phrase = String(document.first_chunk_text || "")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/u)
    .filter((token) => token.length >= 4)
    .slice(0, 8)
    .join(" ");
  return [
    { kind: "conceptual", text: `What is the main purpose and policy approach of ${document.title}?` },
    { kind: "exact_legal_reference", text: phrase || document.title, expectedChunk: Number(document.first_chunk_index) },
    { kind: "related_document", text: "Which related legal instruments, amendments, or documents are referenced?" },
    { kind: "regulator_topic", text: "Which authority or regulator is responsible, and what subject does this address?" },
    { kind: "cross_document_similarity", text: "Which issues, obligations, and institutional themes make this comparable to other documents?" },
  ];
};

const plans = {
  fts: { useMetadata: false, useLexical: true, useVector: false, useGraph: false },
  semantic: { useMetadata: false, useLexical: false, useVector: true, useGraph: false },
  hybrid: { useMetadata: false, useLexical: true, useVector: true, useGraph: false },
};

const main = async () => {
  const limit = argumentInteger("documents", 5, 1, 10);
  const selected = await query(`
    WITH eligible AS (
      SELECT document.id, document.title, document.document_type,
        chunk.chunk_index AS first_chunk_index, chunk.original_text AS first_chunk_text,
        CASE
          WHEN document.document_type = 'bill' THEN 'bill'
          WHEN document.document_type IN ('rule', 'regulation') THEN 'rule_regulation'
          WHEN document.document_type IN ('notification', 'circular') THEN 'notification_circular'
          WHEN document.document_type IN ('gazette', 'policy') THEN 'gazette_policy'
          ELSE 'act_other'
        END AS family,
        ROW_NUMBER() OVER (
          PARTITION BY CASE
            WHEN document.document_type = 'bill' THEN 'bill'
            WHEN document.document_type IN ('rule', 'regulation') THEN 'rule_regulation'
            WHEN document.document_type IN ('notification', 'circular') THEN 'notification_circular'
            WHEN document.document_type IN ('gazette', 'policy') THEN 'gazette_policy'
            ELSE 'act_other'
          END
          ORDER BY state.capabilities_updated_at DESC NULLS LAST, document.id DESC
        ) AS family_rank
      FROM documents document
      JOIN document_processing_state state ON state.document_id = document.id
      JOIN LATERAL (
        SELECT chunk_index, original_text
        FROM document_text_chunks
        WHERE document_id = document.id AND LENGTH(TRIM(original_text)) >= 80
        ORDER BY chunk_index
        LIMIT 1
      ) chunk ON TRUE
      WHERE document.visibility_status = 'public'
        AND state.search_ready AND state.semantic_ready AND state.retrieval_verified
    )
    SELECT * FROM eligible
    ORDER BY family_rank, family, id DESC
    LIMIT $1
  `, [limit]);
  const cases = [];
  for (const document of selected.rows) {
    for (const item of benchmarkQueries(document)) {
      for (const [mode, basePlan] of Object.entries(plans)) {
        const startedAt = Date.now();
        const result = await retrieveDocumentContext(
          document.document_type,
          document.id,
          item.text,
          {
            topK: 6,
            plan: {
              queryType: item.kind === "exact_legal_reference" ? "EXACT_REFERENCE" : "SEMANTIC",
              ...basePlan,
              comparisonIsolation: false,
              plannerVersion: "retrieval-mode-benchmark-v1",
            },
            adapters: { localSearch: async () => [] },
          },
        );
        const chunks = result.passages
          .map((passage) => Number(passage.chunkIndex))
          .filter(Number.isFinite);
        cases.push({
          documentId: String(document.id),
          documentType: document.document_type,
          family: document.family,
          queryKind: item.kind,
          mode,
          returned: result.passages.length,
          distinctChunks: new Set(chunks).size,
          exactChunkHit: item.expectedChunk == null
            ? null : chunks.includes(item.expectedChunk),
          retrievalVerified: result.retrievalVerified,
          vectorDegraded: result.diagnostics.vectorDegraded,
          latencyMs: Date.now() - startedAt,
        });
      }
    }
  }
  const modeSummary = Object.fromEntries(Object.keys(plans).map((mode) => {
    const values = cases.filter((item) => item.mode === mode);
    const exact = values.filter((item) => item.exactChunkHit != null);
    return [mode, {
      cases: values.length,
      successful: values.filter((item) => item.retrievalVerified).length,
      averagePassages: values.length
        ? Number((values.reduce((sum, item) => sum + item.returned, 0) / values.length).toFixed(2)) : 0,
      averageLatencyMs: values.length
        ? Math.round(values.reduce((sum, item) => sum + item.latencyMs, 0) / values.length) : 0,
      exactChunkHits: exact.filter((item) => item.exactChunkHit).length,
      exactChunkCases: exact.length,
      vectorDegraded: values.filter((item) => item.vectorDegraded).length,
    }];
  }));
  const report = {
    generatedAt: new Date().toISOString(),
    benchmarkVersion: "release-b-retrieval-modes-v1",
    documents: selected.rows.map((item) => ({
      documentId: String(item.id), title: item.title,
      documentType: item.document_type, family: item.family,
    })),
    modeSummary,
    exactRetrievalNotDamaged: modeSummary.hybrid.exactChunkHits >= modeSummary.fts.exactChunkHits,
    conceptualRecallImproved: modeSummary.hybrid.averagePassages >= modeSummary.fts.averagePassages,
    cases,
  };
  const output = argumentValue("output");
  if (output) fs.writeFileSync(path.resolve(output), `${JSON.stringify(report, null, 2)}\n`, { mode: 0o600 });
  console.log(JSON.stringify({
    generatedAt: report.generatedAt,
    benchmarkVersion: report.benchmarkVersion,
    documents: report.documents,
    modeSummary: report.modeSummary,
    exactRetrievalNotDamaged: report.exactRetrievalNotDamaged,
    conceptualRecallImproved: report.conceptualRecallImproved,
    outputPath: output ? path.resolve(output) : null,
  }, null, 2));
};

main().catch((error) => {
  console.error("Retrieval mode benchmark failed:", { message: error.message, code: error.code || null });
  process.exitCode = 1;
}).finally(async () => getPool().end());
