const os = require("node:os");
const crypto = require("node:crypto");
const { query } = require("../db");
const {
  enqueueProcessing,
  normalizeBatchType,
  prepareDocument,
} = require("./readinessService");
const {
  getDomainPolicy,
  recordDomainAttempt,
  recordDomainResult,
} = require("./sourceRetryPolicy");

const clamp = (value, fallback, minimum, maximum) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed)
    ? Math.min(Math.max(parsed, minimum), maximum)
    : fallback;
};

const isTransientDatabaseError = (error) =>
  /connection terminated|timeout|econnreset|enotfound|terminating connection|connection refused|socket hang up/i
    .test(String(error?.message || error || ""));

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const workerIdentifier = (index = 0) =>
  `${os.hostname()}:${process.pid}:${index}:${crypto
    .randomBytes(4)
    .toString("hex")}`;

const recoverStaleJobs = async (staleMinutes = 15) => {
  const result = await query(
    `UPDATE document_processing_jobs
     SET status = CASE
           WHEN attempt >= max_attempts THEN 'dead_letter'
           ELSE 'queued'
         END,
         worker_id = NULL,
         next_attempt_at = NOW(),
         failure_reason = COALESCE(
           failure_reason,
           'Worker heartbeat expired before completion.'
         ),
         updated_at = NOW()
     WHERE status = 'running'
       AND COALESCE(heartbeat_at, claimed_at, started_at, updated_at)
         < NOW() - ($1 * INTERVAL '1 minute')
     RETURNING id`,
    [clamp(staleMinutes, 15, 2, 120)],
  );
  return result.rows.length;
};

const claimNextJob = async (
  workerId,
  sourceConcurrency = 2,
  allowedDocumentIds = null,
) => {
  if (Array.isArray(allowedDocumentIds) && allowedDocumentIds.length === 0) {
    return null;
  }
  const result = await query(
    `UPDATE document_processing_jobs job
     SET status = 'running',
         worker_id = $1,
         attempt = attempt + 1,
         claimed_at = NOW(),
         heartbeat_at = NOW(),
         started_at = COALESCE(started_at, NOW()),
         updated_at = NOW()
     WHERE job.id = (
       SELECT queued.id
       FROM document_processing_jobs queued
       LEFT JOIN document_retry_domain_state domain_state
         ON domain_state.source_host = queued.source_host
       WHERE queued.status = 'queued'
         AND queued.next_attempt_at <= NOW()
         AND (
           $3::BIGINT[] IS NULL
           OR queued.document_id = ANY($3::BIGINT[])
         )
         AND (
           queued.source_host IS NULL
           OR COALESCE(domain_state.cooldown_until, '-infinity'::TIMESTAMPTZ) <= NOW()
         )
         AND (
           queued.source_host IS NULL
           OR domain_state.last_request_at IS NULL
           OR domain_state.last_request_at <= NOW() - (
             (
               CASE
                 WHEN queued.source_host ~* '(^|\\.)prsindia\\.org$' THEN $4
                 ELSE $5
               END
             )::TEXT || ' milliseconds'
           )::INTERVAL
         )
         AND (
           queued.source_host IS NULL
           OR domain_state.window_started_at IS NULL
           OR domain_state.window_started_at < NOW() - (
             (
               CASE
                 WHEN queued.source_host ~* '(^|\\.)prsindia\\.org$' THEN $6
                 ELSE $7
               END
             )::TEXT || ' minutes'
           )::INTERVAL
           OR domain_state.window_attempts < CASE
             WHEN queued.source_host ~* '(^|\\.)prsindia\\.org$' THEN $8
             ELSE $9
           END::INTEGER
         )
         AND (
           SELECT COUNT(*)
           FROM document_processing_jobs active
           WHERE active.status = 'running'
             AND active.source_host IS NOT DISTINCT FROM queued.source_host
         ) < CASE
           WHEN queued.source_host ~* '(^|\\.)prsindia\\.org$' THEN $10
           ELSE $2
         END::INTEGER
       ORDER BY queued.priority DESC, queued.queued_at ASC, queued.id ASC
       FOR UPDATE OF queued SKIP LOCKED
       LIMIT 1
     )
     RETURNING job.*`,
    [
      workerId,
      clamp(sourceConcurrency, 2, 1, 4),
      allowedDocumentIds,
      getDomainPolicy("prsindia.org").minIntervalMs,
      getDomainPolicy("default").minIntervalMs,
      getDomainPolicy("prsindia.org").windowMinutes,
      getDomainPolicy("default").windowMinutes,
      getDomainPolicy("prsindia.org").maxAttemptsPerWindow,
      getDomainPolicy("default").maxAttemptsPerWindow,
      getDomainPolicy("prsindia.org").concurrency,
    ],
  );
  const job = result.rows[0] || null;
  if (job?.source_host) {
    await recordDomainAttempt(job.source_host, {
      jobId: String(job.id),
      documentId: String(job.document_id),
      workerId,
    });
  }
  return job;
};

const updateWorker = async (
  workerId,
  {
    status,
    concurrency,
    documentId = null,
    processedDelta = 0,
    failedDelta = 0,
    metadata = {},
  },
) => {
  await query(
    `INSERT INTO document_processing_workers (
       worker_id, status, concurrency, current_document_id, metadata_json
     )
     VALUES ($1, $2, $3, $4, $5::jsonb)
     ON CONFLICT (worker_id) DO UPDATE SET
       status = EXCLUDED.status,
       concurrency = EXCLUDED.concurrency,
       current_document_id = EXCLUDED.current_document_id,
       processed_count =
         document_processing_workers.processed_count + $6,
       failed_count =
         document_processing_workers.failed_count + $7,
       heartbeat_at = NOW(),
       metadata_json =
         document_processing_workers.metadata_json || EXCLUDED.metadata_json`,
    [
      workerId,
      status,
      concurrency,
      documentId,
      JSON.stringify(metadata),
      processedDelta,
      failedDelta,
    ],
  );
};

const enqueueCandidateBatch = async (options = {}) => {
  const limit = clamp(options.limit, 100, 1, 5_000);
  const requestedType = normalizeBatchType(options.type);
  const retryFailed = Boolean(options.retryFailed);
  const onlyUnprocessed = Boolean(options.onlyUnprocessed);
  const candidates = await query(
    `SELECT document.id, document.document_type,
       LEAST(
         100,
         25
         + LEAST(COALESCE(interactions.views, 0), 20)
         + CASE WHEN comparisons.selected THEN 20 ELSE 0 END
         + LEAST(COALESCE(recommendations.recommended, 0), 10)
         + LEAST(COALESCE(graph.degree, 0), 15)
         + CASE document.document_type
             WHEN 'policy' THEN 12
             WHEN 'bill' THEN 10
             WHEN 'act' THEN 8
             WHEN 'gazette' THEN 6
             WHEN 'notification' THEN 5
             ELSE 3
           END
         + CASE
             WHEN document.year >= EXTRACT(YEAR FROM CURRENT_DATE) - 3 THEN 10
             WHEN document.year >= EXTRACT(YEAR FROM CURRENT_DATE) - 8 THEN 5
             ELSE 0
           END
         + CASE
             WHEN legacy.file_size_bytes IS NULL THEN 0
             WHEN legacy.file_size_bytes <= 500000 THEN 10
             WHEN legacy.file_size_bytes <= 2000000 THEN 5
             WHEN legacy.file_size_bytes >= 10000000 THEN -10
             ELSE 0
           END
         + ROUND(document.quality_score / 10)
       )::INTEGER AS processing_priority
     FROM documents document
     JOIN legislative_documents legacy ON legacy.id = document.id
     LEFT JOIN document_processing_state state
       ON state.document_id = document.id
     LEFT JOIN LATERAL (
       SELECT COALESCE(SUM(interaction.count), 0)::INTEGER AS views
       FROM user_document_interactions interaction
       WHERE interaction.document_id = document.id
     ) interactions ON TRUE
     LEFT JOIN LATERAL (
       SELECT EXISTS (
         SELECT 1 FROM document_comparisons comparison
         WHERE comparison.document_ids_json ? document.id::TEXT
       ) AS selected
     ) comparisons ON TRUE
     LEFT JOIN LATERAL (
       SELECT COUNT(*)::INTEGER AS recommended
       FROM recommendations recommendation
       WHERE recommendation.document_id = document.id
     ) recommendations ON TRUE
     LEFT JOIN LATERAL (
       SELECT COUNT(*)::INTEGER AS degree
       FROM document_relationships relationship
       WHERE relationship.from_document_id = document.id
          OR relationship.to_document_id = document.id
     ) graph ON TRUE
     WHERE document.visibility_status = 'public'
       AND (
         legacy.pdf_url IS NOT NULL
         OR (
           document.document_type = 'policy'
           AND COALESCE(legacy.canonical_source, legacy.source_name) = 'policyedge'
           AND legacy.canonical_url IS NOT NULL
         )
       )
       AND (
         $1::TEXT[] IS NULL
         OR document.document_type = ANY($1::TEXT[])
       )
       AND (NOT $2::BOOLEAN OR document.jurisdiction_level = 'state')
       AND (
         ($3::BOOLEAN AND state.readiness_class = 'processing_failed_retriable')
         OR ($4::BOOLEAN AND state.processing_status IN ('not_started', 'pending'))
         OR (
           NOT $3::BOOLEAN AND NOT $4::BOOLEAN
           AND NOT document.research_ready
           AND state.readiness_class NOT IN (
             'processing_failed_permanent',
             'invalid_or_quarantined',
             'unsupported_file_type'
           )
         )
       )
       AND NOT EXISTS (
         SELECT 1 FROM document_processing_jobs active
         WHERE active.document_id = document.id
           AND active.status IN ('queued', 'running')
       )
     ORDER BY processing_priority DESC,
       document.quality_score DESC,
       document.updated_at DESC,
       document.id
     LIMIT $5`,
    [
      requestedType.types,
      requestedType.stateOnly,
      retryFailed,
      onlyUnprocessed,
      limit,
    ],
  );
  const jobs = [];
  for (const candidate of candidates.rows) {
    jobs.push(
      await enqueueProcessing(candidate.id, null, {
        priority: candidate.processing_priority,
        reason: "mass_corpus_backfill",
        maxAttempts: options.maxAttempts,
      }),
    );
  }
  return {
    selected: candidates.rows.length,
    jobs,
  };
};

const workerLoop = async ({
  workerId,
  concurrency,
  jobLimit,
  discoverGraph,
  sourceConcurrency,
  allowedDocumentIds = null,
}) => {
  const results = [];
  await updateWorker(workerId, {
    status: "starting",
    concurrency,
    metadata: { pid: process.pid, hostname: os.hostname() },
  });
  let claimFailures = 0;
  let idlePolls = 0;
  while (results.length < jobLimit) {
    let job;
    try {
      job = await claimNextJob(
        workerId,
        sourceConcurrency,
        allowedDocumentIds,
      );
      claimFailures = 0;
      if (job) idlePolls = 0;
    } catch (error) {
      if (!isTransientDatabaseError(error) || claimFailures >= 3) {
        console.warn(
          `Worker ${workerId} stopped after job claim failure: ${error.message}`,
        );
        break;
      }
      claimFailures += 1;
      console.warn(
        `Worker ${workerId} transient claim failure ${claimFailures}/3: ${error.message}`,
      );
      await wait(1_000 * claimFailures);
      continue;
    }
    if (!job) {
      let queued;
      try {
        queued = await query(
          `SELECT COUNT(*)::INTEGER AS jobs
           FROM document_processing_jobs
           WHERE status = 'queued'
             AND next_attempt_at <= NOW()
             AND (
               $1::BIGINT[] IS NULL
               OR document_id = ANY($1::BIGINT[])
             )`,
          [allowedDocumentIds],
        );
      } catch (error) {
        if (!isTransientDatabaseError(error) || claimFailures >= 3) {
          console.warn(
            `Worker ${workerId} stopped after queue count failure: ${error.message}`,
          );
          break;
        }
        claimFailures += 1;
        console.warn(
          `Worker ${workerId} transient queue count failure ${claimFailures}/3: ${error.message}`,
        );
        await wait(1_000 * claimFailures);
        continue;
      }
      if (Number(queued.rows[0]?.jobs || 0) <= 0) break;
      idlePolls += 1;
      if (idlePolls >= 5) {
        results.push({
          status: "paused",
          reason: "No eligible jobs could be claimed; source cooldown or rate controls may be active.",
        });
        break;
      }
      await wait(1_000);
      continue;
    }
    await updateWorker(workerId, {
      status: "running",
      concurrency,
      documentId: job.document_id,
    });
    const heartbeat = setInterval(() => {
      Promise.all([
        query(
          `UPDATE document_processing_jobs
           SET heartbeat_at = NOW(), updated_at = NOW()
           WHERE id = $1 AND status = 'running'`,
          [job.id],
        ),
        updateWorker(workerId, {
          status: "running",
          concurrency,
          documentId: job.document_id,
        }),
      ]).catch((error) => {
        console.warn(`Worker heartbeat failed for ${workerId}:`, error.message);
      });
    }, 30_000);
    heartbeat.unref();
    try {
      const result = await prepareDocument(job.document_id, {
        job,
        workerId,
        reason: "worker_pool",
        discoverGraph,
      });
      results.push({
        documentId: String(job.document_id),
        status: "ready",
        chunks: Number(result.chunksStored || 0),
        durationMs: Number(result.stageMetrics?.totalMs || 0),
      });
      if (job.source_host) {
        await recordDomainResult(job.source_host, {
          success: true,
          metadata: {
            jobId: String(job.id),
            documentId: String(job.document_id),
            workerId,
            status: "ready",
          },
        });
      }
      await updateWorker(workerId, {
        status: "idle",
        concurrency,
        processedDelta: 1,
      });
    } catch (error) {
      results.push({
        documentId: String(job.document_id),
        status: error.processingFailure?.permanent
          ? "dead_letter"
          : "failed",
        error: String(error.message || error).slice(0, 500),
        classification:
          error.processingFailure?.readinessClass ||
          "processing_failed_retriable",
      });
      if (job.source_host) {
        await recordDomainResult(job.source_host, {
          success: false,
          failure: error.processingFailure,
          metadata: {
            jobId: String(job.id),
            documentId: String(job.document_id),
            workerId,
          },
        });
      }
      await updateWorker(workerId, {
        status: "idle",
        concurrency,
        failedDelta: 1,
      });
    } finally {
      clearInterval(heartbeat);
    }
  }
  await updateWorker(workerId, {
    status: "stopped",
    concurrency,
  });
  return results;
};

const runWorkerPool = async (options = {}) => {
  const concurrency = clamp(
    options.concurrency,
    Number(process.env.PROCESSING_CONCURRENCY) || 3,
    1,
    8,
  );
  const maxJobs = clamp(options.maxJobs, 100, 1, 5_000);
  const base = Math.floor(maxJobs / concurrency);
  const remainder = maxJobs % concurrency;
  const allocations = Array.from(
    { length: concurrency },
    (_, index) => base + (index < remainder ? 1 : 0),
  ).filter(Boolean);
  const recovered = await recoverStaleJobs(options.staleMinutes);
  const workerResults = await Promise.all(
    allocations.map((jobLimit, index) =>
      workerLoop({
        workerId: workerIdentifier(index),
        concurrency,
        jobLimit,
        discoverGraph: options.discoverGraph !== false,
        allowedDocumentIds: options.allowedDocumentIds || null,
        sourceConcurrency: clamp(
          options.sourceConcurrency,
          Number(process.env.PROCESSING_SOURCE_CONCURRENCY) || 2,
          1,
          4,
        ),
      }),
    ),
  );
  const results = workerResults.flat();
  const documentResults = results.filter((item) => item.documentId);
  return {
    concurrency,
    recovered,
    processed: documentResults.length,
    ready: documentResults.filter((item) => item.status === "ready").length,
    failed: documentResults.filter((item) => item.status !== "ready").length,
    paused: results.filter((item) => item.status === "paused").length,
    results,
  };
};

const runProcessingBatch = async (options = {}) => {
  const maxJobs = clamp(options.limit, 100, 1, 5_000);
  const enqueued = options.resume
    ? { selected: 0, jobs: [] }
    : await enqueueCandidateBatch({ ...options, limit: maxJobs });
  const allowedDocumentIds = options.resume
    ? null
    : enqueued.jobs.map((job) => Number(job.document_id)).filter(Boolean);
  if (options.enqueueOnly) {
    return {
      requested: maxJobs,
      enqueued: enqueued.selected,
      processed: 0,
      ready: 0,
      failed: 0,
      results: [],
    };
  }
  const processed = await runWorkerPool({
    ...options,
    maxJobs,
    allowedDocumentIds,
  });
  return {
    requested: maxJobs,
    enqueued: enqueued.selected,
    ...processed,
  };
};

module.exports = {
  claimNextJob,
  enqueueCandidateBatch,
  recoverStaleJobs,
  runProcessingBatch,
  runWorkerPool,
};
