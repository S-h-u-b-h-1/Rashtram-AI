const crypto = require("crypto");

const sql = `
ALTER TABLE document_processing_jobs
  DROP CONSTRAINT IF EXISTS document_processing_jobs_status_check;

ALTER TABLE document_processing_jobs
  ADD CONSTRAINT document_processing_jobs_status_check
  CHECK (
    status IN (
      'queued', 'running', 'completed', 'failed', 'dead_letter', 'cancelled'
    )
  ),
  ADD COLUMN IF NOT EXISTS worker_id TEXT,
  ADD COLUMN IF NOT EXISTS source_host TEXT,
  ADD COLUMN IF NOT EXISTS max_attempts INTEGER NOT NULL DEFAULT 3,
  ADD COLUMN IF NOT EXISTS next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS claimed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS heartbeat_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS duration_ms INTEGER,
  ADD COLUMN IF NOT EXISTS queue_wait_ms INTEGER,
  ADD COLUMN IF NOT EXISTS stage_metrics_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS usage_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS memory_peak_bytes BIGINT;

CREATE INDEX IF NOT EXISTS document_processing_jobs_claim_idx
  ON document_processing_jobs (
    status,
    next_attempt_at,
    priority DESC,
    queued_at ASC
  );

CREATE INDEX IF NOT EXISTS document_processing_jobs_source_idx
  ON document_processing_jobs (source_host, status)
  WHERE source_host IS NOT NULL;

CREATE TABLE IF NOT EXISTS document_processing_attempts (
  id BIGSERIAL PRIMARY KEY,
  job_id BIGINT NOT NULL
    REFERENCES document_processing_jobs(id) ON DELETE CASCADE,
  document_id BIGINT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  worker_id TEXT,
  attempt INTEGER NOT NULL,
  status TEXT NOT NULL
    CHECK (status IN ('running', 'completed', 'failed', 'dead_letter')),
  failure_stage TEXT,
  failure_reason TEXT,
  stage_metrics_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  usage_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  memory_peak_bytes BIGINT,
  queue_wait_ms INTEGER,
  duration_ms INTEGER,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  UNIQUE (job_id, attempt)
);

CREATE INDEX IF NOT EXISTS document_processing_attempts_document_idx
  ON document_processing_attempts (document_id, started_at DESC);

CREATE INDEX IF NOT EXISTS document_processing_attempts_performance_idx
  ON document_processing_attempts (status, completed_at DESC);

CREATE TABLE IF NOT EXISTS document_processing_workers (
  worker_id TEXT PRIMARY KEY,
  status TEXT NOT NULL DEFAULT 'idle'
    CHECK (status IN ('starting', 'idle', 'running', 'stopping', 'stopped')),
  concurrency INTEGER NOT NULL DEFAULT 1,
  current_document_id BIGINT REFERENCES documents(id) ON DELETE SET NULL,
  processed_count INTEGER NOT NULL DEFAULT 0,
  failed_count INTEGER NOT NULL DEFAULT 0,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  heartbeat_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metadata_json JSONB NOT NULL DEFAULT '{}'::jsonb
);

ALTER TABLE document_text_artifacts
  ADD COLUMN IF NOT EXISTS summary_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS pdf_quality_class TEXT,
  ADD COLUMN IF NOT EXISTS pdf_quality_json JSONB NOT NULL DEFAULT '{}'::jsonb;
`;

module.exports = {
  checksum: crypto.createHash("sha256").update(sql).digest("hex"),
  up: (client) => client.query(sql),
};
