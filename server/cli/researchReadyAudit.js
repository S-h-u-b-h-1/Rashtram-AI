require("dotenv").config({
  path: process.env.ENV_FILE || require("path").join(__dirname, "../.env.local"),
});
const { getPool, query } = require("../db");
const { argumentInteger, argumentValue } = require("./cliArgs");

const run = async () => {
  const perType = argumentInteger("per-type", 3, 1, 20);
  const documentType = argumentValue("document-type");
  const params = [perType];
  const typeFilter = documentType
    ? "AND document.document_type = $2"
    : "";
  if (documentType) params.push(documentType);
  const result = await query(
    `WITH sampled AS (
       SELECT
         document.id,
         document.document_type,
         document.title,
         document.year,
         document.jurisdiction,
         document.jurisdiction_level,
         document.source_authority_tier,
         document.canonical_url,
         COALESCE(legacy.canonical_source, legacy.source_name, 'unknown') AS source,
         legacy.pdf_url,
         legacy.source_url,
         state.processing_status,
         state.extraction_status,
         state.chunking_status,
         state.embedding_status,
         state.summary_status,
         state.retrieval_mode,
         state.retrieval_verified,
         state.chunks_count,
         state.embeddings_count,
         state.text_length,
         state.language,
         state.extraction_method,
         ROW_NUMBER() OVER (
           PARTITION BY document.document_type
           ORDER BY
             CASE WHEN state.extraction_method ILIKE '%ocr%' THEN 0 ELSE 1 END,
             state.text_length DESC NULLS LAST,
             document.source_authority_tier ASC NULLS LAST,
             document.id
         ) AS type_rank
       FROM documents document
       JOIN legislative_documents legacy ON legacy.id = document.id
       JOIN document_processing_state state ON state.document_id = document.id
       WHERE document.research_ready
         AND document.comparison_ready
         AND document.visibility_status = 'public'
         ${typeFilter}
     )
     SELECT
       sampled.*,
       EXISTS (
         SELECT 1
         FROM document_resources resource
         WHERE resource.document_id = sampled.id
           AND resource.resource_type IN ('pdf', 'text', 'html')
           AND resource.is_accessible
       ) AS source_available,
       EXISTS (
         SELECT 1
         FROM document_text_chunks chunk
         WHERE chunk.document_id = sampled.id
           AND LENGTH(TRIM(chunk.original_text)) > 0
       ) AS non_empty_chunks,
       (
         SELECT MIN(LENGTH(chunk.original_text))
         FROM document_text_chunks chunk
         WHERE chunk.document_id = sampled.id
       ) AS min_chunk_chars,
       (
         SELECT MAX(LENGTH(chunk.original_text))
         FROM document_text_chunks chunk
         WHERE chunk.document_id = sampled.id
       ) AS max_chunk_chars
     FROM sampled
     WHERE sampled.type_rank <= $1
     ORDER BY sampled.document_type, sampled.type_rank, sampled.id`,
    params,
  );

  const audited = result.rows.map((row) => {
    const issues = [];
    if (!row.source_available) issues.push("missing_accessible_source");
    if (!row.title || !String(row.title).trim()) issues.push("missing_title");
    if (!row.non_empty_chunks) issues.push("missing_non_empty_chunks");
    if (!row.retrieval_verified) issues.push("retrieval_not_verified");
    if (Number(row.chunks_count || 0) <= 0) issues.push("zero_chunk_count");
    if (
      row.embedding_status !== "ready" &&
      !(row.embedding_status === "fallback" && ["local_text", "hybrid"].includes(row.retrieval_mode))
    ) {
      issues.push("embedding_or_fallback_not_valid");
    }
    return {
      documentId: String(row.id),
      type: row.document_type,
      title: row.title,
      source: row.source,
      authorityTier: row.source_authority_tier,
      year: row.year,
      jurisdiction: row.jurisdiction,
      extractionMethod: row.extraction_method,
      language: row.language,
      chunks: Number(row.chunks_count || 0),
      embeddings: Number(row.embeddings_count || 0),
      retrievalMode: row.retrieval_mode,
      retrievalVerified: row.retrieval_verified,
      sourceAvailable: row.source_available,
      minChunkChars: Number(row.min_chunk_chars || 0),
      maxChunkChars: Number(row.max_chunk_chars || 0),
      shouldRemainReady: issues.length === 0,
      issues,
    };
  });

  return {
    generatedAt: new Date().toISOString(),
    sampleSize: audited.length,
    falseReadyCases: audited.filter((item) => !item.shouldRemainReady).length,
    byType: audited.reduce((acc, item) => {
      acc[item.type] ||= { sampled: 0, falseReady: 0 };
      acc[item.type].sampled += 1;
      if (!item.shouldRemainReady) acc[item.type].falseReady += 1;
      return acc;
    }, {}),
    audited,
  };
};

run()
  .then((result) => console.log(JSON.stringify(result, null, 2)))
  .catch((error) => {
    console.error("Research-ready audit failed:", {
      message: error.message,
      code: error.code || null,
    });
    process.exitCode = 1;
  })
  .finally(async () => {
    if (globalThis.__rashtramPostgresPool) await getPool().end();
  });
