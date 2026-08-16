const crypto = require("node:crypto");

const sql = `
CREATE TABLE IF NOT EXISTS research_sources (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  source_type TEXT NOT NULL CHECK (source_type IN ('external_url', 'pdf_upload')),
  source_url TEXT,
  file_name TEXT,
  mime_type TEXT,
  object_key TEXT,
  checksum_sha256 TEXT,
  size_bytes BIGINT,
  language_code TEXT,
  status TEXT NOT NULL DEFAULT 'ready' CHECK (status IN ('processing', 'ready', 'failed')),
  error_message TEXT,
  content_text TEXT NOT NULL DEFAULT '',
  metadata_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (source_type <> 'external_url' OR source_url IS NOT NULL),
  CHECK (source_type <> 'pdf_upload' OR file_name IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS research_sources_user_recent_idx
  ON research_sources (user_id, updated_at DESC, id DESC);

CREATE TABLE IF NOT EXISTS research_source_chunks (
  id BIGSERIAL PRIMARY KEY,
  source_id BIGINT NOT NULL REFERENCES research_sources(id) ON DELETE CASCADE,
  chunk_index INTEGER NOT NULL,
  content TEXT NOT NULL,
  metadata_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  search_vector TSVECTOR GENERATED ALWAYS AS (
    TO_TSVECTOR('simple', COALESCE(content, ''))
  ) STORED,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (source_id, chunk_index)
);

CREATE INDEX IF NOT EXISTS research_source_chunks_search_idx
  ON research_source_chunks USING GIN (search_vector);

CREATE INDEX IF NOT EXISTS research_source_chunks_source_idx
  ON research_source_chunks (source_id, chunk_index);
`;

module.exports = {
  checksum: crypto.createHash("sha256").update(sql).digest("hex"),
  up: (client) => client.query(sql),
};
