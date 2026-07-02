const crypto = require("crypto");

const sql = `
CREATE TABLE IF NOT EXISTS bookmarks (
  id BIGSERIAL PRIMARY KEY,
  legacy_saved_content_id BIGINT UNIQUE,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  document_id BIGINT REFERENCES documents(id) ON DELETE CASCADE,
  external_document_id TEXT,
  title TEXT NOT NULL,
  metadata_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, document_id)
);
CREATE INDEX IF NOT EXISTS bookmarks_user_idx ON bookmarks (user_id, created_at DESC);

INSERT INTO bookmarks (
  legacy_saved_content_id, user_id, document_id, external_document_id,
  title, metadata_json, created_at
)
SELECT
  saved.id,
  saved.user_id,
  CASE
    WHEN saved.document_id ~ '^[0-9]+$'
      AND EXISTS (SELECT 1 FROM documents d WHERE d.id = saved.document_id::BIGINT)
      THEN saved.document_id::BIGINT
  END,
  saved.document_id,
  saved.title,
  saved.metadata_json,
  saved.created_at
FROM saved_content saved
WHERE saved.item_type IN ('bookmark', 'pinned_document')
ON CONFLICT (legacy_saved_content_id) DO UPDATE SET
  title = EXCLUDED.title,
  metadata_json = EXCLUDED.metadata_json;

CREATE TABLE IF NOT EXISTS source_snapshots (
  id BIGINT PRIMARY KEY,
  source_name TEXT NOT NULL,
  source_url TEXT NOT NULL,
  content_sha256 TEXT NOT NULL,
  html_hash TEXT,
  response_status INTEGER,
  record_count INTEGER NOT NULL DEFAULT 0,
  metadata_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  collected_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS source_snapshots_source_idx
  ON source_snapshots (source_name, collected_at DESC);
CREATE INDEX IF NOT EXISTS source_snapshots_hash_idx
  ON source_snapshots (content_sha256);

INSERT INTO source_snapshots (
  id, source_name, source_url, content_sha256, html_hash,
  response_status, record_count, metadata_json, collected_at, created_at
)
SELECT
  id, source_name, source_url, content_sha256,
  COALESCE(html_hash, content_sha256), response_status, record_count,
  metadata_json || metadata, COALESCE(collected_at, fetched_at), fetched_at
FROM source_collection_snapshots
ON CONFLICT (id) DO UPDATE SET
  html_hash = EXCLUDED.html_hash,
  response_status = EXCLUDED.response_status,
  record_count = EXCLUDED.record_count,
  metadata_json = EXCLUDED.metadata_json,
  collected_at = EXCLUDED.collected_at;

CREATE OR REPLACE FUNCTION sync_source_snapshot_v2()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO source_snapshots (
    id, source_name, source_url, content_sha256, html_hash,
    response_status, record_count, metadata_json, collected_at, created_at
  ) VALUES (
    NEW.id, NEW.source_name, NEW.source_url, NEW.content_sha256,
    COALESCE(NEW.html_hash, NEW.content_sha256), NEW.response_status,
    NEW.record_count, NEW.metadata_json || NEW.metadata,
    COALESCE(NEW.collected_at, NEW.fetched_at), NEW.fetched_at
  )
  ON CONFLICT (id) DO UPDATE SET
    html_hash = EXCLUDED.html_hash,
    response_status = EXCLUDED.response_status,
    record_count = EXCLUDED.record_count,
    metadata_json = EXCLUDED.metadata_json,
    collected_at = EXCLUDED.collected_at;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS source_collection_snapshots_sync_v2
  ON source_collection_snapshots;
CREATE TRIGGER source_collection_snapshots_sync_v2
AFTER INSERT OR UPDATE ON source_collection_snapshots
FOR EACH ROW EXECUTE FUNCTION sync_source_snapshot_v2();

UPDATE document_processing_state ps
SET chunks_count = 1,
    extraction_status = 'ready',
    embedding_status = 'ready',
    summary_status = CASE
      WHEN artifact.english_summary IS NOT NULL THEN 'ready'
      ELSE ps.summary_status
    END,
    embedding_provider = COALESCE(ps.embedding_provider, 'openai'),
    ai_provider = COALESCE(ps.ai_provider, 'openai'),
    updated_at = NOW()
FROM legislative_documents legacy
JOIN document_text_artifacts artifact ON artifact.document_id = legacy.id
WHERE ps.document_id = legacy.id
  AND legacy.processing_status = 'ready'
  AND ps.chunks_count = 0;

UPDATE documents d
SET research_ready = (
  d.canonical_url IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM document_resources r
    WHERE r.document_id = d.id
      AND r.resource_type IN ('pdf', 'text', 'html')
      AND r.is_accessible
  )
  AND EXISTS (
    SELECT 1 FROM document_processing_state ps
    WHERE ps.document_id = d.id
      AND ps.processing_status = 'ready'
      AND ps.extraction_status = 'ready'
      AND ps.embedding_status = 'ready'
      AND ps.chunks_count > 0
      AND ps.error_message IS NULL
  )
),
updated_at = NOW();

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'document_sources_documents_v2_fk'
  ) THEN
    ALTER TABLE document_sources
      ADD CONSTRAINT document_sources_documents_v2_fk
      FOREIGN KEY (document_id) REFERENCES documents(id)
      ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;
  END IF;
END $$;
`;

module.exports = {
  checksum: crypto.createHash("sha256").update(sql).digest("hex"),
  up: (client) => client.query(sql),
};
