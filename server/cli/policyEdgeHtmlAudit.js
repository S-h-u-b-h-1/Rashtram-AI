#!/usr/bin/env node

const path = require("node:path");
require("dotenv").config({ path: process.env.ENV_FILE || path.resolve(__dirname, "../.env.local") });

const { getPool, query } = require("../db");
const { argumentInteger } = require("./cliArgs");
const { fetchArticle } = require("../lib/ingestion/connectors/policyedgeConnector");
const { extractStructuredHtml } = require("../document/htmlResourceService");

const main = async () => {
  const probeLimit = argumentInteger("probe", 0, 0, 10);
  const result = await query(`
    WITH policyedge AS (
      SELECT d.id, d.document_type, d.title, d.research_ready, d.comparison_ready,
             COALESCE(s.search_ready, FALSE) AS search_ready,
             COALESCE(s.semantic_ready, FALSE) AS semantic_ready,
             d.visibility_status,
             l.source_url, l.canonical_url, l.pdf_url,
             COALESCE(l.canonical_source, l.source_name, '') AS source_name,
             s.processing_status, s.failure_code, s.retrieval_mode,
             COALESCE(s.chunks_count, 0) AS chunks_count
      FROM documents d
      JOIN legislative_documents l ON l.id = d.id
      LEFT JOIN document_processing_state s ON s.document_id = d.id
      WHERE LOWER(COALESCE(l.canonical_source, '') || ' ' || COALESCE(l.source_name, '') || ' ' ||
                  COALESCE(l.source_url, '') || ' ' || COALESCE(l.canonical_url, ''))
            LIKE '%policy%edge%'
    )
    SELECT COUNT(*)::INTEGER AS catalogue,
      COUNT(*) FILTER (WHERE pdf_url IS NOT NULL)::INTEGER AS with_pdf,
      COUNT(*) FILTER (WHERE source_url IS NOT NULL OR canonical_url IS NOT NULL)::INTEGER AS with_source_url,
      COUNT(*) FILTER (WHERE search_ready)::INTEGER AS search_ready,
      COUNT(*) FILTER (WHERE semantic_ready)::INTEGER AS semantic_ready,
      COUNT(*) FILTER (WHERE research_ready)::INTEGER AS research_ready,
      COUNT(*) FILTER (WHERE comparison_ready)::INTEGER AS comparison_ready,
      COUNT(*) FILTER (WHERE chunks_count > 0)::INTEGER AS chunked,
      COUNT(*) FILTER (WHERE retrieval_mode = 'local_text')::INTEGER AS lexical_fallback,
      COUNT(*) FILTER (WHERE failure_code IS NOT NULL)::INTEGER AS failed,
      COUNT(*) FILTER (WHERE visibility_status = 'hidden_invalid')::INTEGER AS hidden
    FROM policyedge
  `);
  const sample = probeLimit ? await query(`
    SELECT d.id, d.document_type, d.title,
      COALESCE(l.source_url, l.canonical_url) AS source_url,
      COALESCE(l.metadata_json->>'slug', substring(COALESCE(l.source_url, l.canonical_url) from '/p/([^?#]+)')) AS slug
    FROM documents d JOIN legislative_documents l ON l.id = d.id
    WHERE LOWER(COALESCE(l.canonical_source, '') || ' ' || COALESCE(l.source_name, '') || ' ' ||
                COALESCE(l.source_url, '') || ' ' || COALESCE(l.canonical_url, '')) LIKE '%policy%edge%'
      AND COALESCE(l.source_url, l.canonical_url) IS NOT NULL
    ORDER BY d.updated_at DESC NULLS LAST, d.id DESC LIMIT $1
  `, [probeLimit]) : { rows: [] };
  const probes = [];
  for (const row of sample.rows) {
    const startedAt = Date.now();
    try {
      const article = await fetchArticle(row.slug, { title: row.title });
      const extracted = extractStructuredHtml({
        html: article.rawHtml || article.bodyText,
        url: article.url || row.source_url,
        preferredTitle: article.title || row.title,
        description: article.description,
      });
      probes.push({
        id: String(row.id), slug: row.slug, fetchable: true,
        extractable: extracted.quality.valid,
        characters: extracted.text.length,
        headings: extracted.quality.headingCount,
        tableRows: extracted.quality.tableRowCount,
        failureReasons: extracted.quality.reasons,
        latencyMs: Date.now() - startedAt,
      });
    } catch (error) {
      probes.push({ id: String(row.id), slug: row.slug, fetchable: false, extractable: false,
        failureCode: error.failureCode || error.code || "HTML_FETCH_FAILED",
        message: error.message, latencyMs: Date.now() - startedAt });
    }
  }
  console.log(JSON.stringify({
    generatedAt: new Date().toISOString(),
    mode: "read_only",
    counts: result.rows[0],
    probes,
    note: "Parse quality and source authority are reported separately; PolicyEdge remains a research source.",
  }, null, 2));
};

main().catch((error) => { console.error(error); process.exitCode = 1; })
  .finally(async () => getPool().end());
