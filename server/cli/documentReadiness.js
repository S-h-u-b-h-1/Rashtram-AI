require("dotenv").config({
  path: process.env.ENV_FILE || require("path").join(__dirname, "../.env.local"),
});
const { getPool, query } = require("../db");
const { argumentValue } = require("./cliArgs");
const { getDocumentReadiness } = require("../document/readinessContract");

const explainRequirement = (name, passed, detail) => ({
  name,
  passed: Boolean(passed),
  detail,
});

const buildReport = async () => {
  const documentId = argumentValue("document-id") || argumentValue("id");
  if (!documentId) {
    const error = new Error(
      "Usage: npm run document:readiness --prefix server -- --document-id=<id>",
    );
    error.status = 2;
    throw error;
  }

  const [readiness, raw] = await Promise.all([
    getDocumentReadiness(documentId),
    query(
      `SELECT
         document.id,
         document.document_type,
         document.title,
         document.visibility_status,
         document.research_ready,
         document.comparison_ready,
         document.source_authority_tier,
         document.file_checksum_sha256,
         document.content_fingerprint_sha256,
         legacy.pdf_url,
         legacy.canonical_url,
         legacy.source_url,
         COALESCE(legacy.canonical_source, legacy.source_name) AS source_name,
         state.processing_status,
         state.extraction_status,
         state.chunking_status,
         state.embedding_status,
         state.summary_status,
         state.ocr_status,
         state.pdf_status,
         state.chunks_count,
         state.embeddings_count,
         state.retrieval_mode,
         state.retrieval_verified,
         state.failure_code,
         state.retry_eligible,
         state.pipeline_stage,
         state.failure_stage,
         state.failure_reason,
         state.readiness_class,
         state.readiness_reason,
         state.input_checksum_sha256,
         state.output_checksum_sha256,
         state.extraction_method,
         state.extraction_quality_json,
         state.last_attempted_at,
         state.last_processed_at,
         state.updated_at
       FROM documents document
       JOIN legislative_documents legacy ON legacy.id = document.id
       LEFT JOIN document_processing_state state ON state.document_id = document.id
       WHERE document.id::TEXT = $1
       LIMIT 1`,
      [String(documentId)],
    ),
  ]);

  if (!readiness || !raw.rows[0]) {
    return {
      generatedAt: new Date().toISOString(),
      documentId: String(documentId),
      exists: false,
      status: "not_found",
    };
  }

  const row = raw.rows[0];
  const [resources, chunks, recentJobs] = await Promise.all([
    query(
      `SELECT resource_type, is_accessible, mime_type, file_size,
         hash_sha256, is_primary, url
       FROM document_resources
       WHERE document_id::TEXT = $1
       ORDER BY is_primary DESC, resource_type, id
       LIMIT 20`,
      [String(documentId)],
    ),
    query(
      `SELECT
         COUNT(*)::INTEGER AS chunks,
         COUNT(*) FILTER (WHERE LENGTH(TRIM(original_text)) > 0)::INTEGER AS text_chunks,
         COUNT(vector_reference)::INTEGER AS vector_refs,
         COALESCE(SUM(LENGTH(original_text)), 0)::INTEGER AS text_chars
       FROM document_text_chunks
       WHERE document_id::TEXT = $1`,
      [String(documentId)],
    ),
    query(
      `SELECT id, status, attempt, max_attempts, failure_code,
         retry_eligible, pipeline_stage, failure_reason,
         queued_at, started_at, completed_at, updated_at
       FROM document_processing_jobs
       WHERE document_id::TEXT = $1
       ORDER BY id DESC
       LIMIT 5`,
      [String(documentId)],
    ),
  ]);

  const requirements = [
    explainRequirement(
      "public catalogue record",
      row.visibility_status !== "hidden_invalid",
      `visibility_status=${row.visibility_status || "unknown"}`,
    ),
    explainRequirement(
      "official source or resource exists",
      readiness.requirements.hasSource || readiness.requirements.hasAccessibleResource,
      `pdf=${Boolean(row.pdf_url)}, canonical=${Boolean(row.canonical_url)}, source=${Boolean(row.source_url)}`,
    ),
    explainRequirement(
      "accessible PDF/text/html resource",
      readiness.requirements.hasAccessibleResource,
      `resources=${readiness.counts.resources}`,
    ),
    explainRequirement(
      "processing completed",
      row.processing_status === "ready",
      `processing_status=${row.processing_status || "not_started"}`,
    ),
    explainRequirement(
      "text extraction completed",
      row.extraction_status === "ready" && readiness.requirements.hasExtractedText,
      `extraction_status=${row.extraction_status || "not_started"}, text_chunks=${readiness.counts.chunks}`,
    ),
    explainRequirement(
      "chunks available",
      readiness.requirements.hasChunks,
      `chunks=${readiness.counts.chunks}`,
    ),
    explainRequirement(
      "retrieval path available",
      readiness.requirements.hasRetrieval,
      `retrieval_mode=${readiness.retrievalMode || "none"}, vectors=${readiness.counts.vectorReferences}`,
    ),
    explainRequirement(
      "retrieval verified",
      readiness.requirements.retrievalVerified,
      `retrieval_verified=${Boolean(row.retrieval_verified)}`,
    ),
    explainRequirement(
      "no active processing failure",
      !row.failure_code && !row.failure_reason,
      row.failure_code
        ? `failure_code=${row.failure_code}, retry_eligible=${row.retry_eligible}`
        : "no structured failure code",
    ),
  ];

  return {
    generatedAt: new Date().toISOString(),
    documentId: String(documentId),
    exists: true,
    status: readiness.status,
    researchReady: readiness.researchReady,
    comparisonReady: readiness.comparisonReady,
    canPrepare: readiness.canPrepare,
    reasonCode: readiness.reasonCode,
    reason: readiness.reason,
    readinessClass: row.readiness_class,
    readinessReason: row.readiness_reason,
    failure: {
      code: row.failure_code,
      retryEligible: row.retry_eligible,
      pipelineStage: row.pipeline_stage,
      stage: row.failure_stage,
      reason: row.failure_reason ? "Stored failure reason present." : null,
    },
    traceability: {
      sourceAuthorityTier: row.source_authority_tier,
      fileChecksumSha256: row.file_checksum_sha256,
      contentFingerprintSha256: row.content_fingerprint_sha256,
      inputChecksumSha256: row.input_checksum_sha256,
      outputChecksumSha256: row.output_checksum_sha256,
      extractionMethod: row.extraction_method,
      extractionQuality: row.extraction_quality_json,
      lastAttemptedAt: row.last_attempted_at,
      lastProcessedAt: row.last_processed_at,
      updatedAt: row.updated_at,
    },
    document: {
      id: String(row.id),
      type: row.document_type,
      title: row.title,
      source: row.source_name,
      hasPdfUrl: Boolean(row.pdf_url),
      hasCanonicalUrl: Boolean(row.canonical_url),
      hasSourceUrl: Boolean(row.source_url),
    },
    requirements,
    counts: {
      ...readiness.counts,
      textChunks: Number(chunks.rows[0]?.text_chunks || 0),
      textCharacters: Number(chunks.rows[0]?.text_chars || 0),
    },
    resources: resources.rows.map((resource) => ({
      ...resource,
      url: resource.url ? "Stored resource URL present." : null,
      hash_sha256: resource.hash_sha256 || null,
    })),
    recentJobs: recentJobs.rows.map((job) => ({
      ...job,
      id: String(job.id),
      failure_reason: job.failure_reason ? "Stored failure reason present." : null,
    })),
  };
};

buildReport()
  .then((report) => console.log(JSON.stringify(report, null, 2)))
  .catch((error) => {
    console.error("Document readiness explanation failed:", {
      message: error.message,
      code: error.code || null,
    });
    process.exitCode = error.status === 2 ? 2 : 1;
  })
  .finally(async () => {
    if (globalThis.__rashtramPostgresPool) await getPool().end();
  });
