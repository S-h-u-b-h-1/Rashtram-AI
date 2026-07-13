require("dotenv").config({
  path: process.env.ENV_FILE || require("path").join(__dirname, "../.env.local"),
});
const { getPool, query } = require("../db");
const { argumentFlag, argumentInteger, argumentValue } = require("./cliArgs");
const { runWorkerPool } = require("../document/processingWorkerService");
const { getDomainPolicy } = require("../document/sourceRetryPolicy");

const sqlArray = (values) => values.map((value) => Number(value)).filter(Number.isFinite);

const selectCandidates = async ({ limit, source }) => {
  const result = await query(
    `WITH base AS (
       SELECT
         document.id,
         document.document_type,
         document.title,
         document.year,
         document.jurisdiction,
         COALESCE(legacy.canonical_source, legacy.source_name, 'unknown') AS source,
         legacy.pdf_url,
         legacy.canonical_url,
         legacy.source_url,
         LOWER(SUBSTRING(COALESCE(legacy.pdf_url, legacy.canonical_url, legacy.source_url)
           FROM '^[a-z]+://([^/:]+)')) AS source_host,
         CASE
           WHEN legacy.pdf_url IS NULL THEN 'missing_direct_file_url'
           WHEN legacy.pdf_url ~* '/uploads/media/' THEN 'prs_uploads_media'
           WHEN legacy.pdf_url ~* '/billtrack/' THEN 'prs_billtrack'
           WHEN legacy.pdf_url ~* '\\.pdf(?:[?#].*)?$' THEN 'direct_pdf'
           ELSE 'other_url_pattern'
         END AS url_pattern,
         state.failure_code,
         state.retry_count,
         state.last_attempted_at,
         state.updated_at,
         ROW_NUMBER() OVER (
           PARTITION BY
             CASE
               WHEN legacy.pdf_url IS NULL THEN 'missing_direct_file_url'
               WHEN legacy.pdf_url ~* '/uploads/media/' THEN 'prs_uploads_media'
               WHEN legacy.pdf_url ~* '/billtrack/' THEN 'prs_billtrack'
               WHEN legacy.pdf_url ~* '\\.pdf(?:[?#].*)?$' THEN 'direct_pdf'
               ELSE 'other_url_pattern'
             END,
             COALESCE(document.year, 0),
             document.document_type,
             state.failure_code,
             LEAST(COALESCE(state.retry_count, 0), 4)
           ORDER BY state.updated_at ASC, document.id
         ) AS stratum_rank
       FROM documents document
       JOIN legislative_documents legacy ON legacy.id = document.id
       JOIN document_processing_state state ON state.document_id = document.id
       WHERE state.pipeline_stage = 'download'
         AND state.processing_status = 'failed'
         AND state.retry_eligible = TRUE
         AND state.failure_code IN (
           'DOWNLOAD_SERVER_ERROR',
           'DOWNLOAD_RATE_LIMITED',
           'DOWNLOAD_DNS_FAILED',
           'DOWNLOAD_TIMEOUT',
           'DOWNLOAD_UNKNOWN'
         )
         AND COALESCE(legacy.canonical_source, legacy.source_name, 'unknown') = $2
         AND NOT EXISTS (
           SELECT 1 FROM document_processing_jobs active
           WHERE active.document_id = document.id
             AND active.status IN ('queued', 'running')
         )
     )
     SELECT *
     FROM base
     ORDER BY stratum_rank ASC, updated_at ASC, id
     LIMIT $1`,
    [limit, source],
  );
  return result.rows;
};

const beforeAfter = async (ids) => {
  if (!ids.length) return [];
  const result = await query(
    `SELECT
       document.id,
       document.document_type,
       document.title,
       state.processing_status,
       state.failure_code,
       state.pipeline_stage,
       state.retry_eligible,
       state.readiness_class,
       state.chunks_count,
       state.embeddings_count,
       state.retrieval_verified,
       state.updated_at,
       latest.status AS latest_job_status,
       latest.retry_decision,
       latest.duration_ms,
       latest.stage_metrics_json,
       latest.failure_reason,
       EXISTS (
         SELECT 1
         FROM document_text_artifacts artifact
         WHERE artifact.document_id = document.id
           AND LENGTH(COALESCE(artifact.original_text, '')) > 0
       ) AS has_text_artifact,
       (
         SELECT COUNT(*)::INTEGER
         FROM document_text_chunks chunk
         WHERE chunk.document_id = document.id
       ) AS chunk_rows
     FROM documents document
     JOIN document_processing_state state ON state.document_id = document.id
     LEFT JOIN LATERAL (
       SELECT status, retry_decision, duration_ms, stage_metrics_json, failure_reason
       FROM document_processing_jobs job
       WHERE job.document_id = document.id
       ORDER BY job.updated_at DESC, job.id DESC
       LIMIT 1
     ) latest ON TRUE
     WHERE document.id = ANY($1::BIGINT[])
     ORDER BY document.id`,
    [ids],
  );
  return result.rows;
};

const domainSnapshot = async (host) => {
  const result = await query(
    `SELECT *
     FROM document_retry_domain_state
     WHERE source_host = $1`,
    [host],
  );
  return result.rows[0] || null;
};

const enqueueCandidates = async ({ candidates, batchName, maxAttempts, priority }) => {
  if (!candidates.length) return [];
  const ids = candidates.map((row) => row.id);
  const result = await query(
    `INSERT INTO document_processing_jobs (
       document_id, priority, metadata_json, source_host, max_attempts
     )
     SELECT
       document.id,
       $2,
       JSONB_BUILD_OBJECT(
         'reason', 'controlled_download_recovery',
         'batch', $3::TEXT,
         'selectedAt', NOW(),
         'previousFailureCode', state.failure_code,
         'previousRetryCount', state.retry_count
       ),
       NULLIF(LOWER(SUBSTRING((
         SELECT COALESCE(pdf_url, canonical_url, source_url)
         FROM legislative_documents WHERE id = document.id
       ) FROM '^[a-z]+://([^/:]+)')), ''),
       $4
     FROM documents document
     JOIN document_processing_state state ON state.document_id = document.id
     WHERE document.id = ANY($1::BIGINT[])
     ON CONFLICT (document_id)
       WHERE status IN ('queued', 'running')
     DO NOTHING
     RETURNING id, document_id, source_host`,
    [ids, priority, batchName, maxAttempts],
  );
  return result.rows;
};

const existingBatchJobs = async (batchName, limit) => {
  const result = await query(
    `SELECT id, document_id, source_host
     FROM document_processing_jobs
     WHERE status IN ('queued', 'running')
       AND metadata_json ->> 'reason' = 'controlled_download_recovery'
       AND metadata_json ->> 'batch' = $1
     ORDER BY queued_at ASC, id ASC
     LIMIT $2`,
    [batchName, limit],
  );
  return result.rows;
};

const aggregate = ({ candidates, before, after, workerResult, domainBefore, domainAfter }) => {
  const beforeById = new Map(before.map((row) => [String(row.id), row]));
  const attempted = after.filter((row) => beforeById.has(String(row.id)));
  const ready = attempted.filter((row) => row.processing_status === "ready");
  const stillFailed = attempted.filter((row) => row.processing_status === "failed");
  const partialRecovered = attempted.filter((row) =>
    row.has_text_artifact || Number(row.chunk_rows || 0) > 0,
  );
  const validated = ready.filter((row) => Number(row.chunks_count || 0) > 0);
  const embedded = ready.filter((row) => (
    Number(row.embeddings_count || 0) >= Number(row.chunks_count || 0) ||
    row.retrieval_verified
  ));
  const totalBytes = ready.reduce((sum, row) => {
    const metrics = row.stage_metrics_json || {};
    const size = Number(metrics.downloadValidation?.sizeBytes || 0);
    return sum + (Number.isFinite(size) ? size : 0);
  }, 0);
  return {
    selected: candidates.length,
    processed: workerResult.processed,
    downloadsRecovered: ready.length + partialRecovered.filter((row) => row.processing_status !== "ready").length,
    downloadsStillFailed: stillFailed.length,
    filesValidated: validated.length + partialRecovered.filter((row) => row.processing_status !== "ready").length,
    filesExtracted: ready.filter((row) => Number(row.chunks_count || 0) > 0).length +
      partialRecovered.filter((row) => row.has_text_artifact && row.processing_status !== "ready").length,
    filesChunked: ready.filter((row) => Number(row.chunks_count || 0) > 0).length +
      partialRecovered.filter((row) => Number(row.chunk_rows || 0) > 0 && row.processing_status !== "ready").length,
    filesEmbedded: embedded.length,
    newlyResearchReady: ready.filter((row) => row.readiness_class === "comparison_ready").length,
    totalBytesDownloaded: totalBytes,
    circuitBreakerActivations:
      Number(domainAfter?.circuit_activations || 0) -
      Number(domainBefore?.circuit_activations || 0),
    sourceFailureRate:
      workerResult.processed > 0
        ? Number((workerResult.failed / workerResult.processed).toFixed(3))
        : null,
    statusTransitions: attempted.map((row) => {
      const previous = beforeById.get(String(row.id));
      return {
        documentId: String(row.id),
        from: previous?.failure_code || previous?.processing_status,
        to: row.failure_code || row.processing_status,
        readinessClass: row.readiness_class,
        retryDecision: row.retry_decision || null,
        durationMs: Number(row.duration_ms || 0),
      };
    }),
  };
};

const run = async () => {
  const batchName = String(argumentValue("batch", "A")).toUpperCase();
  const limit = argumentInteger("limit", batchName === "A" ? 25 : 100, 1, 250);
  const source = argumentValue("source", "prs-india");
  const dryRun = argumentFlag("dry-run");
  const concurrency = argumentInteger("concurrency", 1, 1, 2);
  const maxAttempts = argumentInteger("max-attempts", 4, 1, 8);
  const priority = argumentInteger("priority", 65, 1, 100);
  let candidates = await selectCandidates({ limit, source });
  let existingJobs = [];
  if (!candidates.length || argumentFlag("resume-existing")) {
    existingJobs = await existingBatchJobs(batchName, limit);
    if (existingJobs.length) {
      const existingIds = existingJobs.map((row) => Number(row.document_id));
      const result = await query(
        `SELECT
           document.id,
           document.document_type,
           document.title,
           document.year,
           document.jurisdiction,
           COALESCE(legacy.canonical_source, legacy.source_name, 'unknown') AS source,
           legacy.pdf_url,
           legacy.canonical_url,
           legacy.source_url,
           LOWER(SUBSTRING(COALESCE(legacy.pdf_url, legacy.canonical_url, legacy.source_url)
             FROM '^[a-z]+://([^/:]+)')) AS source_host,
           'existing_controlled_batch_job' AS url_pattern,
           state.failure_code,
           state.retry_count,
           state.last_attempted_at,
           state.updated_at
         FROM documents document
         JOIN legislative_documents legacy ON legacy.id = document.id
         JOIN document_processing_state state ON state.document_id = document.id
         WHERE document.id = ANY($1::BIGINT[])
         ORDER BY document.id`,
        [existingIds],
      );
      candidates = result.rows;
    }
  }
  const ids = sqlArray(candidates.map((row) => row.id));
  const primaryHost = candidates[0]?.source_host || "prsindia.org";
  const policy = getDomainPolicy(primaryHost);
  const before = await beforeAfter(ids);
  const domainBefore = await domainSnapshot(primaryHost);

  if (dryRun) {
    return {
      generatedAt: new Date().toISOString(),
      mode: "dry_run",
      batch: batchName,
      source,
      policy,
      candidates: candidates.map((row) => ({
        documentId: String(row.id),
        type: row.document_type,
        year: row.year,
        title: row.title,
        sourceHost: row.source_host,
        urlPattern: row.url_pattern,
        failureCode: row.failure_code,
        retryCount: Number(row.retry_count || 0),
        lastAttemptedAt: row.last_attempted_at,
      })),
    };
  }

  const enqueued = existingJobs.length
    ? existingJobs
    : await enqueueCandidates({
        candidates,
        batchName,
        maxAttempts,
        priority,
      });
  const workerResult = await runWorkerPool({
    concurrency,
    sourceConcurrency: 1,
    maxJobs: enqueued.length,
    allowedDocumentIds: enqueued.map((row) => Number(row.document_id)),
    discoverGraph: false,
    staleMinutes: 15,
  });
  const after = await beforeAfter(ids);
  const domainAfter = await domainSnapshot(primaryHost);
  return {
    generatedAt: new Date().toISOString(),
    mode: "apply",
    batch: batchName,
    source,
    policy,
    selected: candidates.length,
    enqueued: enqueued.length,
    domainBefore,
    domainAfter,
    aggregate: aggregate({
      candidates,
      before,
      after,
      workerResult,
      domainBefore,
      domainAfter,
    }),
    workerResult,
  };
};

run()
  .then((result) => console.log(JSON.stringify(result, null, 2)))
  .catch((error) => {
    console.error("Download recovery batch failed:", {
      message: error.message,
      code: error.code || null,
      stack: error.stack,
    });
    process.exitCode = 1;
  })
  .finally(async () => {
    if (globalThis.__rashtramPostgresPool) await getPool().end();
  });
