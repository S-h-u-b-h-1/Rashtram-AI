#!/usr/bin/env node

const path = require("node:path");
require("dotenv").config({ path: process.env.ENV_FILE || path.resolve(__dirname, "../.env.local") });

const { getPool, query } = require("../db");
const { argumentFlag, argumentInteger, argumentValue } = require("./cliArgs");
const { prepareDocument } = require("../document/readinessService");
const { getDocumentReadiness } = require("../document/readinessContract");
const { retrieveDocumentContext } = require("../document/documentResearchService");

const main = async () => {
  const apply = argumentFlag("apply");
  const limit = argumentInteger("limit", 5, 1, 10);
  const requestedIds = String(argumentValue("document-ids", ""))
    .split(",").map((value) => value.trim()).filter((value) => /^\d+$/.test(value)).slice(0, 10);
  const before = await query("SELECT pg_database_size(current_database())::BIGINT AS bytes");
  const selected = await query(`
    SELECT d.id, d.document_type, d.title,
      COALESCE(s.search_ready, FALSE) AS search_ready,
      COALESCE(s.semantic_ready, FALSE) AS semantic_ready,
      COALESCE(l.source_url, l.canonical_url) AS source_url
    FROM documents d JOIN legislative_documents l ON l.id = d.id
    LEFT JOIN document_processing_state s ON s.document_id = d.id
    WHERE LOWER(COALESCE(l.canonical_source, '') || ' ' || COALESCE(l.source_name, '') || ' ' ||
                COALESCE(l.source_url, '') || ' ' || COALESCE(l.canonical_url, '')) LIKE '%policy%edge%'
      AND d.visibility_status <> 'hidden_invalid'
      AND COALESCE(l.source_url, l.canonical_url) IS NOT NULL
      AND ($2::BIGINT[] IS NULL OR d.id = ANY($2::BIGINT[]))
    ORDER BY COALESCE(s.search_ready, FALSE) ASC,
             COALESCE(s.semantic_ready, FALSE) ASC,
             d.updated_at DESC NULLS LAST
    LIMIT $1
  `, [requestedIds.length ? Math.min(limit, requestedIds.length) : limit,
      requestedIds.length ? requestedIds : null]);
  if (!apply) {
    console.log(JSON.stringify({ generatedAt: new Date().toISOString(), mode: "dry_run",
      limit, databaseBytesBefore: Number(before.rows[0].bytes), selected: selected.rows,
      next: "Repeat with --apply only after reviewing this bounded selection." }, null, 2));
    return;
  }
  const outcomes = [];
  for (const document of selected.rows) {
    const startedAt = Date.now();
    try {
      const processed = await prepareDocument(document.id, {
        reason: "policyedge_html_canary",
        discoverGraph: false,
        workerId: "policyedge-html-canary",
      });
      const readiness = await getDocumentReadiness(document.id);
      const retrieval = await retrieveDocumentContext(
        document.document_type,
        document.id,
        "What are the main objectives, implementation duties, affected institutions, and stated risks?",
        { topK: 6 },
      );
      outcomes.push({
        id: String(document.id), title: document.title, success: true,
        latencyMs: Date.now() - startedAt,
        chunks: readiness.counts?.chunks || processed.totalChunks || 0,
        searchReady: readiness.capabilities?.searchReady,
        semanticReady: readiness.capabilities?.semanticReady,
        researchReady: readiness.researchReady,
        comparisonReady: readiness.comparisonReady,
        retrievalMode: retrieval.retrievalMode,
        retrievalVerified: retrieval.retrievalVerified,
        evidenceCount: retrieval.passages.length,
        resourceTypes: [...new Set(retrieval.passages.map((item) => item.resourceType).filter(Boolean))],
        rawHtmlHash: processed.stageMetrics?.rawHtmlHash || null,
        cleanContentHash: processed.stageMetrics?.cleanContentHash || null,
        contentUnchanged: Boolean(processed.stageMetrics?.contentUnchanged),
      });
    } catch (error) {
      outcomes.push({ id: String(document.id), title: document.title, success: false,
        latencyMs: Date.now() - startedAt, failureCode: error.failureCode || error.code || "CANARY_FAILED",
        message: error.message });
    }
  }
  const after = await query("SELECT pg_database_size(current_database())::BIGINT AS bytes");
  console.log(JSON.stringify({
    generatedAt: new Date().toISOString(), mode: "apply", limit,
    databaseBytesBefore: Number(before.rows[0].bytes), databaseBytesAfter: Number(after.rows[0].bytes),
    databaseGrowthBytes: Number(after.rows[0].bytes) - Number(before.rows[0].bytes),
    outcomes,
    stoppedAfterBoundedBatch: true,
  }, null, 2));
};

main().catch((error) => { console.error(error); process.exitCode = 1; })
  .finally(async () => getPool().end());
