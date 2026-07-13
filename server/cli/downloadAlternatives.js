require("dotenv").config({
  path: process.env.ENV_FILE || require("path").join(__dirname, "../.env.local"),
});
const { getPool, query } = require("../db");
const { argumentInteger } = require("./cliArgs");

const buildReport = async () => {
  const limit = argumentInteger("limit", 100, 1, 1_000);
  const result = await query(
    `WITH failed AS (
       SELECT
         document.id,
         document.document_type,
         document.title,
         document.normalized_title,
         document.year,
         document.jurisdiction,
         document.source_authority_tier,
         document.file_checksum_sha256,
         legacy.bill_number,
         legacy.act_number,
         legacy.legal_identifier,
         legacy.gazette_identifier,
         COALESCE(legacy.canonical_source, legacy.source_name) AS source,
         state.failure_code,
         state.retry_count
       FROM documents document
       JOIN legislative_documents legacy ON legacy.id = document.id
       JOIN document_processing_state state ON state.document_id = document.id
       WHERE state.pipeline_stage = 'download'
         AND state.processing_status = 'failed'
       ORDER BY state.retry_eligible DESC, state.updated_at ASC
       LIMIT $1
     )
     SELECT
       failed.*,
       alternative.id AS alternative_document_id,
       alternative.document_type AS alternative_document_type,
       alternative.title AS alternative_title,
       alternative.source_authority_tier AS alternative_authority_tier,
       alternative.research_ready AS alternative_research_ready,
       alternative.comparison_ready AS alternative_comparison_ready,
       alternative.file_checksum_sha256 AS alternative_file_checksum_sha256,
       alternative_resource.url AS alternative_url,
       alternative_resource.hash_sha256 AS alternative_resource_hash,
       CASE
         WHEN failed.file_checksum_sha256 IS NOT NULL
           AND failed.file_checksum_sha256 = alternative.file_checksum_sha256
           THEN 'exact_file_checksum'
         WHEN failed.legal_identifier IS NOT NULL
           AND failed.legal_identifier = alternative_legacy.legal_identifier
           THEN 'exact_legal_identifier'
         WHEN failed.bill_number IS NOT NULL
           AND failed.bill_number = alternative_legacy.bill_number
           AND failed.year = alternative.year
           AND failed.jurisdiction IS NOT DISTINCT FROM alternative.jurisdiction
           THEN 'exact_bill_number_year_jurisdiction'
         WHEN failed.act_number IS NOT NULL
           AND failed.act_number = alternative_legacy.act_number
           AND failed.year = alternative.year
           AND failed.jurisdiction IS NOT DISTINCT FROM alternative.jurisdiction
           THEN 'exact_act_number_year_jurisdiction'
         ELSE 'none'
       END AS evidence,
       CASE
         WHEN alternative.research_ready
           AND alternative_resource.hash_sha256 IS NOT NULL
           AND (
             failed.file_checksum_sha256 IS NOT NULL
             AND failed.file_checksum_sha256 = alternative.file_checksum_sha256
           )
           THEN 1.0
         WHEN alternative.research_ready
           AND failed.legal_identifier IS NOT NULL
           AND failed.legal_identifier = alternative_legacy.legal_identifier
           THEN 0.95
         WHEN alternative.research_ready
           AND failed.bill_number IS NOT NULL
           AND failed.bill_number = alternative_legacy.bill_number
           AND failed.year = alternative.year
           AND failed.jurisdiction IS NOT DISTINCT FROM alternative.jurisdiction
           THEN 0.9
         WHEN alternative.research_ready
           AND failed.act_number IS NOT NULL
           AND failed.act_number = alternative_legacy.act_number
           AND failed.year = alternative.year
           AND failed.jurisdiction IS NOT DISTINCT FROM alternative.jurisdiction
           THEN 0.9
         ELSE 0
       END AS confidence
     FROM failed
     JOIN documents alternative ON alternative.id <> failed.id
     JOIN legislative_documents alternative_legacy ON alternative_legacy.id = alternative.id
     JOIN LATERAL (
       SELECT url, hash_sha256
       FROM document_resources resource
       WHERE resource.document_id = alternative.id
         AND resource.resource_type = 'pdf'
         AND resource.is_accessible
       ORDER BY resource.is_primary DESC, resource.id
       LIMIT 1
     ) alternative_resource ON TRUE
     WHERE alternative.visibility_status = 'public'
       AND alternative.research_ready
       AND (
         (
           failed.file_checksum_sha256 IS NOT NULL
           AND failed.file_checksum_sha256 = alternative.file_checksum_sha256
         )
         OR (
           failed.legal_identifier IS NOT NULL
           AND failed.legal_identifier = alternative_legacy.legal_identifier
         )
         OR (
           failed.bill_number IS NOT NULL
           AND failed.bill_number = alternative_legacy.bill_number
           AND failed.year = alternative.year
           AND failed.jurisdiction IS NOT DISTINCT FROM alternative.jurisdiction
         )
         OR (
           failed.act_number IS NOT NULL
           AND failed.act_number = alternative_legacy.act_number
           AND failed.year = alternative.year
           AND failed.jurisdiction IS NOT DISTINCT FROM alternative.jurisdiction
         )
       )
     ORDER BY confidence DESC, failed.id
     LIMIT $1`,
    [limit],
  );

  return {
    generatedAt: new Date().toISOString(),
    mode: "dry_run",
    recommendations: result.rows.map((row) => ({
      failedDocument: {
        id: String(row.id),
        type: row.document_type,
        title: row.title,
        source: row.source,
        failureCode: row.failure_code,
        retryCount: Number(row.retry_count || 0),
      },
      proposedAlternative: {
        id: String(row.alternative_document_id),
        type: row.alternative_document_type,
        title: row.alternative_title,
        authorityTier: row.alternative_authority_tier,
        researchReady: row.alternative_research_ready,
        comparisonReady: row.alternative_comparison_ready,
        hasValidFile: Boolean(row.alternative_resource_hash),
      },
      matchingEvidence: row.evidence,
      confidence: Number(row.confidence || 0),
      reason:
        Number(row.confidence || 0) >= 0.95
          ? "Deterministic identifier or checksum match to a ready canonical record."
          : "Candidate requires manual review before reuse.",
    })),
    note: "Dry run only. No source URLs or canonical files were linked automatically.",
  };
};

buildReport()
  .then((result) => console.log(JSON.stringify(result, null, 2)))
  .catch((error) => {
    console.error("Download alternatives report failed:", {
      message: error.message,
      code: error.code || null,
    });
    process.exitCode = 1;
  })
  .finally(async () => {
    if (globalThis.__rashtramPostgresPool) await getPool().end();
  });
