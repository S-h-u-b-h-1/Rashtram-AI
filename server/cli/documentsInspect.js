require("dotenv").config({
  path: process.env.ENV_FILE || require("path").join(__dirname, "../.env.local"),
});
const { getPool, query } = require("../db");
const { getDocumentReadiness } = require("../document/readinessContract");

const ids = process.argv
  .slice(2)
  .flatMap((value) => String(value).split(","))
  .map((value) => value.trim())
  .filter(Boolean);

const inspectDocument = async (id) => {
  const [document, resources, chunks, jobs, comparisons, readiness] =
    await Promise.all([
      query(
        `SELECT document.id, document.document_type, document.title,
           document.visibility_status, document.research_ready,
           document.comparison_ready, legacy.pdf_url, legacy.canonical_url,
           legacy.source_url, legacy.processing_status,
           legacy.processing_error
         FROM documents document
         JOIN legislative_documents legacy ON legacy.id = document.id
         WHERE document.id::TEXT = $1
         LIMIT 1`,
        [String(id)],
      ),
      query(
        `SELECT resource_type, is_accessible, mime_type, COUNT(*)::INTEGER AS count
         FROM document_resources
         WHERE document_id::TEXT = $1
         GROUP BY resource_type, is_accessible, mime_type
         ORDER BY resource_type, is_accessible DESC`,
        [String(id)],
      ),
      query(
        `SELECT COUNT(*)::INTEGER AS chunks,
           COUNT(*) FILTER (
             WHERE LENGTH(TRIM(original_text)) > 0
           )::INTEGER AS text_chunks,
           COUNT(vector_reference)::INTEGER AS vector_refs
         FROM document_text_chunks
         WHERE document_id::TEXT = $1`,
        [String(id)],
      ),
      query(
        `SELECT status, attempt, max_attempts, failure_reason,
           queued_at, started_at, completed_at
         FROM document_processing_jobs
         WHERE document_id::TEXT = $1
         ORDER BY id DESC
         LIMIT 3`,
        [String(id)],
      ),
      query(
        `SELECT COUNT(*)::INTEGER AS comparisons
         FROM document_comparisons
         WHERE document_ids_json ? $1`,
        [String(id)],
      ),
      getDocumentReadiness(id),
    ]);
  const row = document.rows[0];
  return {
    documentId: String(id),
    exists: Boolean(row),
    document: row
      ? {
          id: String(row.id),
          type: row.document_type,
          title: row.title,
          visibilityStatus: row.visibility_status,
          researchReady: row.research_ready,
          comparisonReady: row.comparison_ready,
          hasPdfUrl: Boolean(row.pdf_url),
          hasCanonicalUrl: Boolean(row.canonical_url),
          hasSourceUrl: Boolean(row.source_url),
          legacyProcessingStatus: row.processing_status,
          legacyProcessingError: row.processing_error
            ? "Stored processing error present."
            : null,
        }
      : null,
    resources: resources.rows.map((resource) => ({
      resourceType: resource.resource_type,
      isAccessible: resource.is_accessible,
      mimeType: resource.mime_type,
      count: Number(resource.count || 0),
    })),
    chunks: {
      chunks: Number(chunks.rows[0]?.chunks || 0),
      textChunks: Number(chunks.rows[0]?.text_chunks || 0),
      vectorReferences: Number(chunks.rows[0]?.vector_refs || 0),
    },
    recentJobs: jobs.rows.map((job) => ({
      status: job.status,
      attempt: Number(job.attempt || 0),
      maxAttempts: Number(job.max_attempts || 0),
      failureReason: job.failure_reason
        ? "Stored failure reason present."
        : null,
      queuedAt: job.queued_at,
      startedAt: job.started_at,
      completedAt: job.completed_at,
    })),
    comparisons: Number(comparisons.rows[0]?.comparisons || 0),
    readiness: readiness
      ? {
          status: readiness.status,
          researchReady: readiness.researchReady,
          comparisonReady: readiness.comparisonReady,
          canPrepare: readiness.canPrepare,
          reasonCode: readiness.reasonCode,
          reason: readiness.reason,
          requirements: readiness.requirements,
          counts: readiness.counts,
          retrievalMode: readiness.retrievalMode,
          failureStage: readiness.failureStage,
          readinessClass: readiness.readinessClass,
        }
      : null,
  };
};

if (!ids.length) {
  console.error("Usage: npm run documents:inspect --prefix server -- 186 3646 20833");
  process.exitCode = 1;
} else {
  Promise.all(ids.map(inspectDocument))
    .then((result) => console.log(JSON.stringify(result, null, 2)))
    .catch((error) => {
      console.error("Document inspection failed:", {
        message: error.message,
        code: error.code || null,
      });
      process.exitCode = 1;
    })
    .finally(async () => {
      if (globalThis.__rashtramPostgresPool) await getPool().end();
    });
}
