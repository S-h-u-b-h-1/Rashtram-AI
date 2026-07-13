const crypto = require("crypto");

const sql = `
ALTER TABLE documents
  ADD COLUMN IF NOT EXISTS source_specific_id TEXT,
  ADD COLUMN IF NOT EXISTS alternate_title TEXT,
  ADD COLUMN IF NOT EXISTS source_authority_tier TEXT
    CHECK (
      source_authority_tier IS NULL
      OR source_authority_tier IN ('A', 'B', 'C', 'D')
    ),
  ADD COLUMN IF NOT EXISTS original_source_page TEXT,
  ADD COLUMN IF NOT EXISTS original_file_url TEXT,
  ADD COLUMN IF NOT EXISTS object_storage_path TEXT,
  ADD COLUMN IF NOT EXISTS file_checksum_sha256 TEXT,
  ADD COLUMN IF NOT EXISTS retrieval_date TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_source_update_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS expiry_date DATE,
  ADD COLUMN IF NOT EXISTS regulator TEXT,
  ADD COLUMN IF NOT EXISTS sector TEXT,
  ADD COLUMN IF NOT EXISTS topic TEXT,
  ADD COLUMN IF NOT EXISTS legislative_status TEXT,
  ADD COLUMN IF NOT EXISTS notification_number TEXT,
  ADD COLUMN IF NOT EXISTS gazette_number TEXT,
  ADD COLUMN IF NOT EXISTS session TEXT,
  ADD COLUMN IF NOT EXISTS version TEXT,
  ADD COLUMN IF NOT EXISTS parent_document_id BIGINT
    REFERENCES documents(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS validation_status TEXT NOT NULL DEFAULT 'unverified',
  ADD COLUMN IF NOT EXISTS extraction_version TEXT;

CREATE INDEX IF NOT EXISTS documents_source_specific_idx
  ON documents (canonical_source_id, source_specific_id)
  WHERE source_specific_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS documents_authority_tier_idx
  ON documents (source_authority_tier, quality_score DESC)
  WHERE source_authority_tier IS NOT NULL;

CREATE INDEX IF NOT EXISTS documents_regulator_idx
  ON documents (regulator)
  WHERE regulator IS NOT NULL;

CREATE INDEX IF NOT EXISTS documents_sector_topic_idx
  ON documents (sector, topic)
  WHERE sector IS NOT NULL OR topic IS NOT NULL;

UPDATE documents document
SET source_authority_tier = CASE
      WHEN registry.reliability_tier = 1
        AND registry.source_type IN (
          'Gazette Source',
          'Official Government Source',
          'Official Regulator Source',
          'Parliamentary Source',
          'State Government Source'
        )
        THEN 'A'
      WHEN registry.reliability_tier <= 2 THEN 'B'
      WHEN registry.reliability_tier = 3 THEN 'C'
      ELSE 'D'
    END,
    original_source_page = COALESCE(document.original_source_page, document.canonical_url),
    retrieval_date = COALESCE(document.retrieval_date, document.first_seen_at),
    last_source_update_at = COALESCE(document.last_source_update_at, document.last_seen_at),
    original_file_url = COALESCE(
      document.original_file_url,
      (
        SELECT resource.url
        FROM document_resources resource
        WHERE resource.document_id = document.id
          AND resource.resource_type = 'pdf'
        ORDER BY resource.is_primary DESC, resource.created_at ASC
        LIMIT 1
      )
    ),
    file_checksum_sha256 = COALESCE(
      document.file_checksum_sha256,
      (
        SELECT resource.hash_sha256
        FROM document_resources resource
        WHERE resource.document_id = document.id
          AND resource.hash_sha256 IS NOT NULL
        ORDER BY resource.is_primary DESC, resource.created_at ASC
        LIMIT 1
      )
    ),
    legislative_status = COALESCE(document.legislative_status, document.status),
    notification_number = COALESCE(
      document.notification_number,
      document.metadata_json ->> 'notificationNumber',
      document.metadata_json ->> 'notification_number'
    ),
    gazette_number = COALESCE(document.gazette_number, document.gazette_identifier),
    regulator = COALESCE(
      document.regulator,
      CASE
        WHEN registry.source_name LIKE 'regulator-%' THEN registry.authority
        ELSE NULL
      END
    ),
    topic = COALESCE(document.topic, document.category),
    validation_status = CASE
      WHEN document.research_ready THEN 'validated'
      WHEN document.visibility_status = 'hidden_invalid' THEN 'invalid'
      ELSE document.validation_status
    END
FROM source_registry registry
WHERE registry.id = document.canonical_source_id;

ALTER TABLE source_registry
  ADD COLUMN IF NOT EXISTS source_domain TEXT,
  ADD COLUMN IF NOT EXISTS authority_tier TEXT
    CHECK (
      authority_tier IS NULL
      OR authority_tier IN ('A', 'B', 'C', 'D')
    ),
  ADD COLUMN IF NOT EXISTS supported_document_types JSONB
    NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS refresh_schedule TEXT,
  ADD COLUMN IF NOT EXISTS last_attempted_refresh_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS documents_discovered INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS documents_added INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS documents_updated INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS failure_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS health_status TEXT NOT NULL DEFAULT 'not_run',
  ADD COLUMN IF NOT EXISTS parser_version TEXT,
  ADD COLUMN IF NOT EXISTS source_terms_or_usage_notes TEXT;

UPDATE source_registry
SET source_domain = COALESCE(
      source_domain,
      NULLIF(REGEXP_REPLACE(COALESCE(base_url, ''), '^https?://([^/]+).*$','\\1'), '')
    ),
    authority_tier = COALESCE(
      authority_tier,
      CASE
        WHEN reliability_tier = 1
          AND source_type IN (
            'Gazette Source',
            'Official Government Source',
            'Official Regulator Source',
            'Parliamentary Source',
            'State Government Source'
          )
          THEN 'A'
        WHEN reliability_tier <= 2 THEN 'B'
        WHEN reliability_tier = 3 THEN 'C'
        ELSE 'D'
      END
    ),
    refresh_schedule = COALESCE(refresh_schedule, ingestion_frequency),
    health_status = COALESCE(NULLIF(status, ''), health_status),
    parser_version = COALESCE(parser_version, 'v1'),
    source_terms_or_usage_notes = COALESCE(source_terms_or_usage_notes, notes),
    supported_document_types = CASE
      WHEN supported_document_types <> '[]'::jsonb THEN supported_document_types
      WHEN source_name = 'prs-india' THEN '["bill", "act"]'::jsonb
      WHEN source_name = 'india-code' THEN '["act", "rule", "regulation"]'::jsonb
      WHEN source_name = 'egazette' THEN '["gazette", "notification", "rule", "order"]'::jsonb
      WHEN source_name IN ('lok-sabha', 'rajya-sabha', 'digital-sansad') THEN
        '["bill", "parliamentary_record", "committee_report"]'::jsonb
      WHEN source_name = 'pib' THEN '["press_release", "policy", "notification"]'::jsonb
      WHEN source_name IN ('niti-aayog', 'mygov') THEN
        '["policy", "report", "consultation_paper"]'::jsonb
      WHEN source_name LIKE 'regulator-%' THEN
        '["circular", "notification", "regulation", "order", "consultation_paper", "press_release"]'::jsonb
      WHEN source_name LIKE 'state-%' THEN
        '["bill", "act", "gazette", "policy", "notification", "order"]'::jsonb
      ELSE supported_document_types
    END;

WITH latest_runs AS (
  SELECT DISTINCT ON (source_name)
    source_name,
    status,
    records_discovered,
    records_stored,
    counters_json,
    started_at,
    completed_at
  FROM ingestion_runs
  ORDER BY source_name, started_at DESC NULLS LAST, id DESC
)
UPDATE source_registry source
SET last_attempted_refresh_at = COALESCE(source.last_attempted_refresh_at, run.started_at),
    last_successful_run_at = COALESCE(source.last_successful_run_at, run.completed_at),
    documents_discovered = GREATEST(
      source.documents_discovered,
      COALESCE(run.records_discovered, 0)
    ),
    documents_added = GREATEST(
      source.documents_added,
      COALESCE(run.records_stored, 0)
    ),
    documents_updated = GREATEST(
      source.documents_updated,
      COALESCE((run.counters_json ->> 'updated')::INTEGER, 0)
    ),
    failure_count = CASE
      WHEN run.status = 'failed' THEN source.failure_count + 1
      ELSE source.failure_count
    END
FROM latest_runs run
WHERE run.source_name = source.source_name;

CREATE OR REPLACE VIEW source_registry_operations AS
SELECT
  source.id,
  source.source_name,
  source.display_name,
  source.source_type,
  source.source_domain,
  source.authority_tier,
  source.supported_document_types,
  source.jurisdiction,
  source.connector_name,
  source.refresh_schedule,
  source.enabled,
  source.health_status,
  source.status AS legacy_status,
  source.last_attempted_refresh_at,
  source.last_successful_run_at,
  source.last_failed_run_at,
  source.documents_discovered,
  source.documents_added,
  source.documents_updated,
  source.failure_count,
  source.parser_version,
  source.source_terms_or_usage_notes,
  COALESCE(document_counts.total_documents, 0)::INTEGER AS total_documents,
  COALESCE(document_counts.research_ready_documents, 0)::INTEGER AS research_ready_documents,
  COALESCE(document_counts.comparison_ready_documents, 0)::INTEGER AS comparison_ready_documents,
  COALESCE(document_counts.average_quality_score, 0)::NUMERIC(5, 2) AS average_quality_score
FROM source_registry source
LEFT JOIN LATERAL (
  SELECT
    COUNT(*) AS total_documents,
    COUNT(*) FILTER (WHERE document.research_ready) AS research_ready_documents,
    COUNT(*) FILTER (WHERE document.comparison_ready) AS comparison_ready_documents,
    ROUND(AVG(document.quality_score), 2) AS average_quality_score
  FROM documents document
  WHERE document.canonical_source_id = source.id
) document_counts ON TRUE;
`;

module.exports = {
  checksum: crypto.createHash("sha256").update(sql).digest("hex"),
  up: (client) => client.query(sql),
};
