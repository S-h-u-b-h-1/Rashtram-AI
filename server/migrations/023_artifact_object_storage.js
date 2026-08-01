const crypto = require("node:crypto");

const sql = `
CREATE TABLE IF NOT EXISTS artifact_storage_migration_runs (
  id BIGSERIAL PRIMARY KEY,
  mode TEXT NOT NULL CHECK (mode IN ('dry_run', 'migrate', 'rollback')),
  status TEXT NOT NULL CHECK (status IN ('running', 'completed', 'partial', 'failed', 'rolled_back')),
  requested_limit INTEGER NOT NULL CHECK (requested_limit BETWEEN 1 AND 25),
  checkpoint_document_id BIGINT,
  attempted_count INTEGER NOT NULL DEFAULT 0,
  verified_count INTEGER NOT NULL DEFAULT 0,
  failed_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS document_artifact_objects (
  id BIGSERIAL PRIMARY KEY,
  document_id BIGINT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  resource_id BIGINT REFERENCES document_resources(id) ON DELETE SET NULL,
  artifact_kind TEXT NOT NULL CHECK (artifact_kind IN (
    'pdf', 'source-html', 'extracted-text', 'ocr-text', 'snapshot',
    'processing-log', 'quarantine-archive'
  )),
  source_locator TEXT NOT NULL,
  object_key TEXT NOT NULL UNIQUE,
  sha256 TEXT NOT NULL CHECK (sha256 ~ '^[a-f0-9]{64}$'),
  mime_type TEXT NOT NULL,
  byte_size BIGINT NOT NULL CHECK (byte_size >= 0),
  processing_version TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'verified' CHECK (status IN ('verified', 'active', 'rolled_back')),
  original_retained BOOLEAN NOT NULL DEFAULT TRUE,
  verified_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (document_id, artifact_kind, sha256)
);

CREATE INDEX IF NOT EXISTS document_artifact_objects_document_idx
  ON document_artifact_objects (document_id, artifact_kind, status);
CREATE INDEX IF NOT EXISTS document_artifact_objects_resource_idx
  ON document_artifact_objects (resource_id)
  WHERE resource_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS artifact_storage_migration_items (
  id BIGSERIAL PRIMARY KEY,
  run_id BIGINT NOT NULL REFERENCES artifact_storage_migration_runs(id) ON DELETE CASCADE,
  document_id BIGINT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  artifact_kind TEXT NOT NULL,
  source_sha256 TEXT,
  object_key TEXT,
  status TEXT NOT NULL CHECK (status IN ('verified', 'failed', 'rolled_back')),
  error_code TEXT,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (run_id, document_id, artifact_kind)
);

CREATE INDEX IF NOT EXISTS artifact_storage_migration_items_status_idx
  ON artifact_storage_migration_items (run_id, status, document_id);
`;

module.exports = {
  checksum: crypto.createHash("sha256").update(sql).digest("hex"),
  up: (client) => client.query(sql),
};
