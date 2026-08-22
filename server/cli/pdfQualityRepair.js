#!/usr/bin/env node

const path = require("node:path");
require("dotenv").config({ path: process.env.ENV_FILE || path.resolve(__dirname, "../.env.local") });
const { getPool, query } = require("../db");
const { argumentFlag, argumentInteger, argumentValue } = require("./cliArgs");
const { prepareDocument } = require("../document/readinessService");
const { getDocumentReadiness } = require("../document/readinessContract");
const { retrieveDocumentContext } = require("../document/documentResearchService");
const { summarizeDocuments } = require("../document/pdfCorpusQualityService");

const candidateRows = async (requestedIds = []) => (await query(`
  SELECT d.id, d.document_type, d.title, d.year,
    COALESCE(l.canonical_source, l.source_name, 'unknown') AS source_name,
    COALESCE(l.source_url, l.canonical_url) AS source_url, l.pdf_url,
    COALESCE(a.language_code, d.language, 'und') AS language, a.extraction_method, a.ocr_used,
    FALSE AS user_used, FALSE AS comparison_used,
    chunk.document_id, chunk.chunk_index, chunk.original_text, chunk.translated_text, chunk.metadata_json
  FROM documents d JOIN legislative_documents l ON l.id = d.id
  JOIN document_processing_state state ON state.document_id = d.id
  LEFT JOIN document_text_artifacts a ON a.document_id = d.id
  JOIN document_text_chunks chunk ON chunk.document_id = d.id
  WHERE state.search_ready = TRUE AND l.pdf_url IS NOT NULL
    AND d.visibility_status <> 'hidden_invalid'
    AND COALESCE(a.extraction_method, '') <> 'source_html'
    AND ($1::BIGINT[] IS NULL OR d.id = ANY($1::BIGINT[]))
  ORDER BY d.id, chunk.chunk_index
`, [requestedIds.length ? requestedIds : null])).rows;

const providerFailure = (error) => /429|quota|provider|gemini|embedding|pinecone|timeout|unavailable/i
  .test(String(error?.message || error));

const main = async () => {
  const apply = argumentFlag("apply") && !argumentFlag("dry-run");
  const limit = argumentInteger("limit", 5, 1, 10);
  const requestedIds = String(argumentValue("document-ids", ""))
    .split(",").map((value) => value.trim()).filter((value) => /^\d+$/.test(value)).slice(0, 10);
  const documents = summarizeDocuments(await candidateRows(requestedIds));
  const selected = documents.filter((document) => document.severity !== "GOOD").slice(0, limit);
  const before = await query("SELECT pg_database_size(current_database())::BIGINT AS bytes");
  if (!apply) {
    console.log(JSON.stringify({ generatedAt: new Date().toISOString(), mode: "dry_run", limit,
      databaseBytesBefore: Number(before.rows[0].bytes), selected,
      next: "Review this bounded selection, then repeat with --apply." }, null, 2));
    return;
  }
  const outcomes = [];
  let consecutiveProviderFailures = 0;
  for (const document of selected) {
    const startedAt = Date.now();
    try {
      const result = await prepareDocument(document.id, {
        reason: "pdf_text_quality_repair", workerId: "pdf-quality-repair",
        discoverGraph: false, forcePdfReextract: true,
      });
      const readiness = await getDocumentReadiness(document.id);
      const retrieval = await retrieveDocumentContext(document.type, document.id, document.title, { topK: 3 });
      outcomes.push({ id: document.id, title: document.title, success: true,
        before: { severity: document.severity, score: document.averageScore },
        after: result.pdfQuality?.documentTextQuality || null,
        nativePagesReused: result.pdfQuality?.nativePages || 0,
        ocrPagesProcessed: result.pdfQuality?.ocrPages || 0,
        unrecoverablePages: result.pdfQuality?.failedPages || [],
        chunks: result.totalChunks || result.chunksStored || 0,
        chunksInvalidated: result.stageMetrics?.chunksInvalidated || 0,
        embeddingsReused: result.stageMetrics?.embeddingsReused || 0,
        embeddingsRegenerated: result.stageMetrics?.embeddingsRegenerated || 0,
        searchReady: readiness.capabilities?.searchReady,
        semanticReady: readiness.capabilities?.semanticReady,
        retrievalVerified: retrieval.retrievalVerified,
        citationPages: [...new Set(retrieval.passages.map((item) => item.pageStart).filter(Boolean))],
        latencyMs: Date.now() - startedAt });
      consecutiveProviderFailures = 0;
    } catch (error) {
      consecutiveProviderFailures = providerFailure(error) ? consecutiveProviderFailures + 1 : 0;
      outcomes.push({ id: document.id, title: document.title, success: false,
        code: error.failureCode || error.code || "PDF_REPAIR_FAILED", message: error.message,
        latencyMs: Date.now() - startedAt });
      if (consecutiveProviderFailures >= 3) break;
    }
  }
  const after = await query("SELECT pg_database_size(current_database())::BIGINT AS bytes");
  console.log(JSON.stringify({ generatedAt: new Date().toISOString(), mode: "apply", limit,
    databaseBytesBefore: Number(before.rows[0].bytes), databaseBytesAfter: Number(after.rows[0].bytes),
    databaseGrowthBytes: Number(after.rows[0].bytes) - Number(before.rows[0].bytes), outcomes,
    stoppedAfterBoundedBatch: true, providerCircuitBreaker: consecutiveProviderFailures >= 3 }, null, 2));
};

main().catch((error) => { console.error(error); process.exitCode = 1; })
  .finally(async () => getPool().end());
