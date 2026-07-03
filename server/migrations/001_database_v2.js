const crypto = require("crypto");

const sql = `
CREATE TABLE IF NOT EXISTS source_registry (
  id BIGSERIAL PRIMARY KEY,
  source_name TEXT NOT NULL UNIQUE,
  normalized_source_name TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  source_type TEXT NOT NULL,
  base_url TEXT,
  country TEXT NOT NULL DEFAULT 'India',
  jurisdiction TEXT,
  authority TEXT,
  reliability_tier SMALLINT NOT NULL DEFAULT 3 CHECK (reliability_tier BETWEEN 1 AND 5),
  public_label TEXT,
  internal_label TEXT,
  robots_policy TEXT NOT NULL DEFAULT 'respect',
  connector_name TEXT,
  ingestion_frequency TEXT,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  last_successful_run_at TIMESTAMPTZ,
  last_failed_run_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'not_run',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO source_registry (
  source_name, normalized_source_name, display_name, source_type, base_url,
  authority, reliability_tier, public_label, connector_name,
  ingestion_frequency, enabled, notes
)
VALUES
  ('prs-india', 'prs_india', 'PRS Legislative Research', 'Parliamentary Source', 'https://prsindia.org', 'PRS Legislative Research', 3, 'PRS India', 'prs-india', 'daily', TRUE, 'Secondary legislative reference source.'),
  ('india-code', 'india_code', 'India Code', 'Official Government Source', 'https://www.indiacode.nic.in', 'Legislative Department', 1, 'India Code', 'india-code', 'daily', TRUE, NULL),
  ('egazette', 'egazette', 'eGazette of India', 'Gazette Source', 'https://egazette.gov.in', 'Department of Publication', 1, 'eGazette', 'egazette', 'daily', TRUE, NULL),
  ('digital-sansad', 'digital_sansad', 'Digital Sansad', 'Parliamentary Source', 'https://sansad.in', 'Parliament of India', 1, 'Digital Sansad', 'digital-sansad', 'daily', TRUE, 'Connector reports access restrictions without bypassing them.'),
  ('lok-sabha', 'lok_sabha', 'Lok Sabha', 'Parliamentary Source', 'https://sansad.in/ls', 'Lok Sabha Secretariat', 1, 'Lok Sabha', 'lok-sabha', 'daily', TRUE, NULL),
  ('rajya-sabha', 'rajya_sabha', 'Rajya Sabha', 'Parliamentary Source', 'https://sansad.in/rs', 'Rajya Sabha Secretariat', 1, 'Rajya Sabha', 'rajya-sabha', 'daily', TRUE, NULL),
  ('pib', 'pib', 'Press Information Bureau', 'Official Government Source', 'https://pib.gov.in', 'Press Information Bureau', 1, 'PIB', 'pib', '3-hourly', TRUE, NULL),
  ('ministry', 'ministries', 'Government Ministries Directory', 'Ministry Source', 'https://igod.gov.in', 'Government of India', 1, 'Ministries', 'ministry', 'weekly', TRUE, NULL),
  ('ministry-environment', 'ministry_environment', 'Ministry of Environment, Forest and Climate Change', 'Ministry Source', 'https://moef.gov.in', 'Ministry of Environment, Forest and Climate Change', 1, 'MoEFCC', 'ministry-environment', 'daily', TRUE, NULL),
  ('niti-aayog', 'niti_aayog', 'NITI Aayog', 'Official Government Source', 'https://www.niti.gov.in', 'NITI Aayog', 1, 'NITI Aayog', 'niti-aayog', 'daily', TRUE, NULL),
  ('mygov', 'mygov', 'MyGov', 'Official Government Source', 'https://www.mygov.in', 'MyGov', 1, 'MyGov', 'mygov', 'daily', TRUE, NULL),
  ('india-gov', 'india_gov', 'National Portal of India', 'Official Government Source', 'https://www.india.gov.in', 'Government of India', 1, 'India.gov', 'india-gov', 'weekly', TRUE, NULL),
  ('state-legislature', 'state_legislature', 'State Legislatures', 'State Government Source', NULL, 'State Legislatures', 1, 'State Legislatures', 'state-legislature', 'weekly', TRUE, NULL),
  ('state-gazette', 'state_gazette', 'State Gazettes', 'Gazette Source', NULL, 'State Governments', 1, 'State Gazettes', 'state-gazette', 'weekly', TRUE, NULL),
  ('state-policy', 'state_policy', 'State Policy Portals', 'State Government Source', NULL, 'State Governments', 1, 'State Policies', 'state-policy', 'weekly', TRUE, NULL),
  ('regulator-rbi', 'regulator_rbi', 'Reserve Bank of India', 'Official Regulator Source', 'https://www.rbi.org.in', 'Reserve Bank of India', 1, 'RBI', 'regulator-rbi', 'daily', TRUE, NULL),
  ('regulator-sebi', 'regulator_sebi', 'Securities and Exchange Board of India', 'Official Regulator Source', 'https://www.sebi.gov.in', 'SEBI', 1, 'SEBI', 'regulator-sebi', 'daily', TRUE, NULL),
  ('regulator-irdai', 'regulator_irdai', 'Insurance Regulatory and Development Authority of India', 'Official Regulator Source', 'https://irdai.gov.in', 'IRDAI', 1, 'IRDAI', 'regulator-irdai', 'weekly', TRUE, NULL),
  ('regulator-trai', 'regulator_trai', 'Telecom Regulatory Authority of India', 'Official Regulator Source', 'https://trai.gov.in', 'TRAI', 1, 'TRAI', 'regulator-trai', 'daily', TRUE, NULL),
  ('regulator-pfrda', 'regulator_pfrda', 'Pension Fund Regulatory and Development Authority', 'Official Regulator Source', 'https://www.pfrda.org.in', 'PFRDA', 1, 'PFRDA', 'regulator-pfrda', 'weekly', TRUE, NULL),
  ('regulator-cci', 'regulator_cci', 'Competition Commission of India', 'Official Regulator Source', 'https://www.cci.gov.in', 'CCI', 1, 'CCI', 'regulator-cci', 'weekly', TRUE, NULL),
  ('regulator-cerc', 'regulator_cerc', 'Central Electricity Regulatory Commission', 'Official Regulator Source', 'https://cercind.gov.in', 'CERC', 1, 'CERC', 'regulator-cerc', 'weekly', TRUE, NULL),
  ('regulator-cbdt', 'regulator_cbdt', 'Central Board of Direct Taxes', 'Official Regulator Source', 'https://incometaxindia.gov.in', 'CBDT', 1, 'CBDT', 'regulator-cbdt', 'weekly', TRUE, NULL),
  ('regulator-cbic', 'regulator_cbic', 'Central Board of Indirect Taxes and Customs', 'Official Regulator Source', 'https://www.cbic.gov.in', 'CBIC', 1, 'CBIC', 'regulator-cbic', 'weekly', TRUE, NULL),
  ('regulator-gst-council', 'regulator_gst_council', 'GST Council', 'Official Regulator Source', 'https://gstcouncil.gov.in', 'GST Council', 1, 'GST Council', 'regulator-gst-council', 'weekly', TRUE, NULL),
  ('regulator-ugc', 'regulator_ugc', 'University Grants Commission', 'Official Regulator Source', 'https://www.ugc.gov.in', 'UGC', 1, 'UGC', 'regulator-ugc', 'weekly', TRUE, NULL),
  ('regulator-aicte', 'regulator_aicte', 'All India Council for Technical Education', 'Official Regulator Source', 'https://www.aicte-india.org', 'AICTE', 1, 'AICTE', 'regulator-aicte', 'weekly', TRUE, NULL),
  ('policy-edge', 'policy_edge', 'The Policy Edge', 'Secondary Research Source', 'https://thepolicyedge.in', 'The Policy Edge', 4, 'The Policy Edge', 'policy-edge', 'weekly', TRUE, 'Secondary research source; attribution is mandatory.')
ON CONFLICT (source_name) DO UPDATE SET
  normalized_source_name = EXCLUDED.normalized_source_name,
  display_name = EXCLUDED.display_name,
  source_type = EXCLUDED.source_type,
  base_url = EXCLUDED.base_url,
  authority = EXCLUDED.authority,
  reliability_tier = EXCLUDED.reliability_tier,
  connector_name = EXCLUDED.connector_name,
  ingestion_frequency = EXCLUDED.ingestion_frequency,
  updated_at = NOW();

CREATE TABLE IF NOT EXISTS documents (
  id BIGINT PRIMARY KEY,
  canonical_id TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  normalized_title TEXT NOT NULL,
  document_type TEXT NOT NULL,
  document_subtype TEXT,
  jurisdiction_level TEXT,
  jurisdiction TEXT,
  state TEXT,
  country TEXT NOT NULL DEFAULT 'India',
  authority TEXT,
  ministry TEXT,
  department TEXT,
  category TEXT,
  status TEXT,
  language TEXT NOT NULL DEFAULT 'und',
  script TEXT NOT NULL DEFAULT 'Unknown',
  is_bilingual BOOLEAN NOT NULL DEFAULT FALSE,
  year INTEGER,
  publication_date DATE,
  introduced_date DATE,
  passed_date DATE,
  assent_date DATE,
  commencement_date DATE,
  effective_date DATE,
  legal_identifier TEXT,
  bill_number TEXT,
  act_number TEXT,
  gazette_identifier TEXT,
  source_priority INTEGER NOT NULL DEFAULT 100,
  canonical_source_id BIGINT REFERENCES source_registry(id) ON DELETE SET NULL,
  canonical_url TEXT,
  primary_pdf_resource_id BIGINT,
  research_ready BOOLEAN NOT NULL DEFAULT FALSE,
  visibility_status TEXT NOT NULL DEFAULT 'public',
  quality_score NUMERIC(5, 2) NOT NULL DEFAULT 0 CHECK (quality_score BETWEEN 0 AND 100),
  metadata_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  search_vector TSVECTOR GENERATED ALWAYS AS (
    TO_TSVECTOR(
      'simple',
      COALESCE(title, '') || ' ' || COALESCE(normalized_title, '') || ' ' ||
      COALESCE(legal_identifier, '') || ' ' || COALESCE(ministry, '') || ' ' ||
      COALESCE(authority, '') || ' ' || COALESCE(category, '')
    )
  ) STORED,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS documents_type_idx ON documents (document_type);
CREATE INDEX IF NOT EXISTS documents_jurisdiction_idx ON documents (jurisdiction);
CREATE INDEX IF NOT EXISTS documents_state_idx ON documents (state) WHERE state IS NOT NULL;
CREATE INDEX IF NOT EXISTS documents_ministry_idx ON documents (ministry) WHERE ministry IS NOT NULL;
CREATE INDEX IF NOT EXISTS documents_year_idx ON documents (year DESC);
CREATE INDEX IF NOT EXISTS documents_publication_idx ON documents (publication_date DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS documents_normalized_title_idx ON documents (normalized_title, year);
CREATE INDEX IF NOT EXISTS documents_research_ready_idx ON documents (research_ready, quality_score DESC);
CREATE INDEX IF NOT EXISTS documents_source_priority_idx ON documents (source_priority, updated_at DESC);
CREATE INDEX IF NOT EXISTS documents_first_seen_idx ON documents (first_seen_at DESC);
CREATE INDEX IF NOT EXISTS documents_updated_idx ON documents (updated_at DESC);
CREATE INDEX IF NOT EXISTS documents_quality_idx ON documents (quality_score DESC, publication_date DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS documents_search_idx ON documents USING GIN (search_vector);
CREATE INDEX IF NOT EXISTS documents_metadata_idx ON documents USING GIN (metadata_json);

INSERT INTO documents (
  id, canonical_id, title, normalized_title, document_type, document_subtype,
  jurisdiction_level, jurisdiction, state, country, authority, ministry,
  department, category, status, language, script, is_bilingual, year,
  publication_date, introduced_date, passed_date, assent_date,
  commencement_date, effective_date, legal_identifier, bill_number,
  act_number, gazette_identifier, source_priority, canonical_source_id,
  canonical_url, research_ready, visibility_status, quality_score,
  metadata_json, created_at, updated_at, first_seen_at, last_seen_at
)
SELECT
  d.id,
  d.canonical_id,
  d.title,
  COALESCE(NULLIF(d.normalized_title, ''), LOWER(d.title)),
  LOWER(REPLACE(d.document_type, '-', '_')),
  CASE
    WHEN d.jurisdiction_level = 'state' AND d.document_type = 'bill' THEN 'state_bill'
    WHEN d.jurisdiction_level = 'state' AND d.document_type = 'act' THEN 'state_act'
    ELSE NULL
  END,
  d.jurisdiction_level,
  d.jurisdiction,
  COALESCE(d.metadata_json ->> 'state', CASE WHEN d.jurisdiction_level = 'state' THEN d.jurisdiction END),
  COALESCE(d.metadata_json ->> 'country', 'India'),
  d.authority,
  d.ministry,
  d.department,
  d.category,
  d.status,
  COALESCE(a.language_code, d.metadata_json ->> 'languageCode', d.metadata_json ->> 'language', 'und'),
  COALESCE(a.script, d.metadata_json ->> 'script', 'Unknown'),
  COALESCE(a.is_bilingual, FALSE),
  d.year,
  d.publication_date,
  d.introduced_date,
  d.passed_date,
  COALESCE(d.assent_date, d.enacted_date),
  COALESCE(d.commencement_date, d.effective_date),
  d.effective_date,
  d.legal_identifier,
  d.bill_number,
  d.act_number,
  d.gazette_identifier,
  d.source_priority,
  sr.id,
  COALESCE(d.canonical_url, d.detail_url, d.source_url),
  COALESCE((
    d.processing_status = 'ready'
    AND a.document_id IS NOT NULL
    AND d.pdf_url IS NOT NULL
  ), FALSE),
  CASE WHEN COALESCE(d.canonical_url, d.source_url) IS NULL THEN 'internal_only' ELSE 'public' END,
  LEAST(
    100,
    (CASE WHEN NULLIF(TRIM(d.title), '') IS NOT NULL THEN 15 ELSE 0 END) +
    (CASE WHEN COALESCE(d.canonical_url, d.source_url) IS NOT NULL THEN 15 ELSE 0 END) +
    (CASE WHEN d.pdf_url IS NOT NULL THEN 15 ELSE 0 END) +
    (CASE WHEN d.publication_date IS NOT NULL OR d.year IS NOT NULL THEN 10 ELSE 0 END) +
    (CASE WHEN d.ministry IS NOT NULL OR d.authority IS NOT NULL THEN 10 ELSE 0 END) +
    (CASE WHEN d.jurisdiction IS NOT NULL THEN 10 ELSE 0 END) +
    (CASE WHEN d.processing_status = 'ready' THEN 15 ELSE 0 END) +
    (CASE WHEN a.document_id IS NOT NULL THEN 10 ELSE 0 END)
  ),
  d.metadata_json || d.source_metadata,
  d.created_at,
  d.updated_at,
  d.first_seen_at,
  d.last_seen_at
FROM legislative_documents d
LEFT JOIN document_text_artifacts a ON a.document_id = d.id
LEFT JOIN source_registry sr ON sr.source_name = COALESCE(d.canonical_source, d.source_name)
ON CONFLICT (id) DO UPDATE SET
  canonical_id = EXCLUDED.canonical_id,
  title = EXCLUDED.title,
  normalized_title = EXCLUDED.normalized_title,
  document_type = EXCLUDED.document_type,
  document_subtype = EXCLUDED.document_subtype,
  jurisdiction_level = EXCLUDED.jurisdiction_level,
  jurisdiction = EXCLUDED.jurisdiction,
  state = EXCLUDED.state,
  authority = EXCLUDED.authority,
  ministry = EXCLUDED.ministry,
  department = EXCLUDED.department,
  category = EXCLUDED.category,
  status = EXCLUDED.status,
  year = EXCLUDED.year,
  publication_date = EXCLUDED.publication_date,
  canonical_source_id = EXCLUDED.canonical_source_id,
  canonical_url = EXCLUDED.canonical_url,
  metadata_json = EXCLUDED.metadata_json,
  updated_at = EXCLUDED.updated_at,
  last_seen_at = EXCLUDED.last_seen_at;

ALTER TABLE document_sources
  ADD COLUMN IF NOT EXISTS source_type TEXT,
  ADD COLUMN IF NOT EXISTS normalized_source_name TEXT,
  ADD COLUMN IF NOT EXISTS canonical_url TEXT,
  ADD COLUMN IF NOT EXISTS raw_title TEXT,
  ADD COLUMN IF NOT EXISTS raw_status TEXT,
  ADD COLUMN IF NOT EXISTS raw_metadata_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS collected_at TIMESTAMPTZ;

UPDATE document_sources ds
SET source_type = COALESCE(ds.source_type, sr.source_type),
    normalized_source_name = COALESCE(ds.normalized_source_name, sr.normalized_source_name, REPLACE(ds.source_name, '-', '_')),
    canonical_url = COALESCE(ds.canonical_url, ds.detail_url, ds.source_url),
    raw_title = COALESCE(ds.raw_title, ds.source_title),
    raw_status = COALESCE(ds.raw_status, ds.source_status),
    raw_metadata_json = CASE WHEN ds.raw_metadata_json = '{}'::jsonb THEN ds.raw_metadata ELSE ds.raw_metadata_json END,
    collected_at = COALESCE(ds.collected_at, ds.last_seen_at)
FROM source_registry sr
WHERE sr.source_name = ds.source_name;

CREATE INDEX IF NOT EXISTS document_sources_source_name_idx ON document_sources (source_name);
CREATE INDEX IF NOT EXISTS document_sources_source_record_idx ON document_sources (source_record_id);
CREATE INDEX IF NOT EXISTS document_sources_source_url_idx ON document_sources (source_url);
CREATE INDEX IF NOT EXISTS document_sources_normalized_source_idx ON document_sources (normalized_source_name);

CREATE TABLE IF NOT EXISTS document_resources (
  id BIGINT PRIMARY KEY,
  document_id BIGINT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  source_id BIGINT REFERENCES document_sources(id) ON DELETE SET NULL,
  resource_type TEXT NOT NULL,
  label TEXT,
  url TEXT NOT NULL,
  mime_type TEXT,
  file_extension TEXT,
  file_size BIGINT,
  language TEXT,
  hash_sha256 TEXT,
  is_primary BOOLEAN NOT NULL DEFAULT FALSE,
  is_accessible BOOLEAN NOT NULL DEFAULT TRUE,
  last_checked_at TIMESTAMPTZ,
  metadata_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (document_id, url)
);

CREATE INDEX IF NOT EXISTS document_resources_document_idx ON document_resources (document_id);
CREATE INDEX IF NOT EXISTS document_resources_url_idx ON document_resources (url);
CREATE INDEX IF NOT EXISTS document_resources_hash_idx ON document_resources (hash_sha256) WHERE hash_sha256 IS NOT NULL;
CREATE INDEX IF NOT EXISTS document_resources_accessible_idx ON document_resources (is_accessible, document_id);

INSERT INTO document_resources (
  id, document_id, source_id, resource_type, label, url, mime_type,
  file_extension, file_size, language, hash_sha256, is_primary,
  is_accessible, metadata_json, created_at, updated_at
)
SELECT
  r.id,
  r.document_id,
  (
    SELECT s.id FROM document_sources s
    WHERE s.document_id = r.document_id
    ORDER BY s.source_priority, s.id
    LIMIT 1
  ),
  CASE WHEN r.url ~* '\\.pdf(?:$|[?#])' THEN 'pdf' ELSE COALESCE(r.resource_type, 'link') END,
  r.label,
  r.url,
  COALESCE(r.metadata ->> 'mimeType', CASE WHEN r.url ~* '\\.pdf(?:$|[?#])' THEN 'application/pdf' END),
  LOWER(NULLIF(SUBSTRING(r.url FROM '\\.([a-zA-Z0-9]+)(?:[?#].*)?$'), '')),
  NULLIF(r.metadata ->> 'fileSizeBytes', '')::BIGINT,
  r.metadata ->> 'language',
  COALESCE(r.metadata ->> 'hashSha256', r.metadata ->> 'fileHash'),
  COALESCE(r.url = d.pdf_url, FALSE),
  TRUE,
  r.metadata,
  r.created_at,
  r.updated_at
FROM legislative_document_resources r
JOIN legislative_documents d ON d.id = r.document_id
ON CONFLICT (id) DO UPDATE SET
  source_id = EXCLUDED.source_id,
  resource_type = EXCLUDED.resource_type,
  label = EXCLUDED.label,
  url = EXCLUDED.url,
  mime_type = EXCLUDED.mime_type,
  is_primary = EXCLUDED.is_primary,
  metadata_json = EXCLUDED.metadata_json,
  updated_at = EXCLUDED.updated_at;

INSERT INTO document_resources (
  id, document_id, source_id, resource_type, label, url, mime_type,
  file_extension, is_primary, is_accessible, metadata_json
)
SELECT
  -d.id,
  d.id,
  (
    SELECT s.id FROM document_sources s
    WHERE s.document_id = d.id
    ORDER BY s.source_priority, s.id
    LIMIT 1
  ),
  'pdf',
  'Official PDF',
  d.pdf_url,
  COALESCE(d.mime_type, 'application/pdf'),
  'pdf',
  TRUE,
  TRUE,
  JSONB_BUILD_OBJECT('origin', 'legacy-primary-pdf')
FROM legislative_documents d
WHERE d.pdf_url IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM document_resources r
    WHERE r.document_id = d.id AND r.url = d.pdf_url
  )
ON CONFLICT (id) DO NOTHING;

UPDATE documents d
SET primary_pdf_resource_id = (
  SELECT r.id
  FROM document_resources r
  WHERE r.document_id = d.id AND r.resource_type = 'pdf'
  ORDER BY r.is_primary DESC, r.id
  LIMIT 1
)
WHERE EXISTS (
  SELECT 1
  FROM document_resources r
  WHERE r.document_id = d.id AND r.resource_type = 'pdf'
)
AND d.primary_pdf_resource_id IS DISTINCT FROM (
  SELECT r.id
  FROM document_resources r
  WHERE r.document_id = d.id AND r.resource_type = 'pdf'
  ORDER BY r.is_primary DESC, r.id
  LIMIT 1
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'documents_primary_pdf_resource_fk'
  ) THEN
    ALTER TABLE documents
      ADD CONSTRAINT documents_primary_pdf_resource_fk
      FOREIGN KEY (primary_pdf_resource_id)
      REFERENCES document_resources(id) ON DELETE SET NULL
      DEFERRABLE INITIALLY DEFERRED;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS document_metadata (
  document_id BIGINT PRIMARY KEY REFERENCES documents(id) ON DELETE CASCADE,
  metadata_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  provenance_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO document_metadata (document_id, metadata_json, provenance_json, created_at, updated_at)
SELECT
  id,
  metadata_json || source_metadata,
  JSONB_BUILD_OBJECT(
    'canonicalSource', COALESCE(canonical_source, source_name),
    'sourceUrl', COALESCE(canonical_url, source_url),
    'legacyTable', 'legislative_documents'
  ),
  created_at,
  updated_at
FROM legislative_documents
ON CONFLICT (document_id) DO UPDATE SET
  metadata_json = EXCLUDED.metadata_json,
  provenance_json = EXCLUDED.provenance_json,
  updated_at = EXCLUDED.updated_at;

CREATE TABLE IF NOT EXISTS document_processing_state (
  document_id BIGINT PRIMARY KEY REFERENCES documents(id) ON DELETE CASCADE,
  processing_status TEXT NOT NULL DEFAULT 'not_started',
  extraction_status TEXT NOT NULL DEFAULT 'not_started',
  embedding_status TEXT NOT NULL DEFAULT 'not_started',
  summary_status TEXT NOT NULL DEFAULT 'not_started',
  ocr_status TEXT NOT NULL DEFAULT 'not_required',
  error_message TEXT,
  chunks_count INTEGER NOT NULL DEFAULT 0 CHECK (chunks_count >= 0),
  embedding_provider TEXT,
  ai_provider TEXT,
  last_processed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO document_processing_state (
  document_id, processing_status, extraction_status, embedding_status,
  summary_status, ocr_status, error_message, chunks_count,
  embedding_provider, ai_provider, last_processed_at, updated_at
)
SELECT
  d.id,
  COALESCE(d.processing_status, 'not_started'),
  CASE WHEN a.document_id IS NOT NULL THEN 'ready' WHEN d.processing_status = 'failed' THEN 'failed' ELSE 'not_started' END,
  CASE WHEN d.processing_status = 'ready' THEN 'ready' WHEN d.processing_status = 'failed' THEN 'failed' ELSE 'not_started' END,
  CASE WHEN a.english_summary IS NOT NULL THEN 'ready' WHEN d.processing_status = 'failed' THEN 'failed' ELSE 'not_started' END,
  CASE WHEN a.ocr_used THEN 'ready' WHEN a.ocr_required THEN 'pending' ELSE 'not_required' END,
  d.processing_error,
  COALESCE(NULLIF(a.metadata_json ->> 'chunks', '')::INTEGER, 0),
  CASE WHEN d.processing_status = 'ready' THEN 'openai' END,
  CASE WHEN d.processing_status = 'ready' THEN 'openai' END,
  d.processed_at,
  d.updated_at
FROM legislative_documents d
LEFT JOIN document_text_artifacts a ON a.document_id = d.id
ON CONFLICT (document_id) DO UPDATE SET
  processing_status = EXCLUDED.processing_status,
  extraction_status = EXCLUDED.extraction_status,
  embedding_status = EXCLUDED.embedding_status,
  summary_status = EXCLUDED.summary_status,
  ocr_status = EXCLUDED.ocr_status,
  error_message = EXCLUDED.error_message,
  chunks_count = GREATEST(document_processing_state.chunks_count, EXCLUDED.chunks_count),
  last_processed_at = EXCLUDED.last_processed_at,
  updated_at = EXCLUDED.updated_at;

CREATE TABLE IF NOT EXISTS document_text_chunks (
  id BIGSERIAL PRIMARY KEY,
  document_id BIGINT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  chunk_index INTEGER NOT NULL,
  original_text TEXT NOT NULL,
  translated_text TEXT,
  language TEXT NOT NULL DEFAULT 'und',
  token_count INTEGER,
  vector_reference TEXT,
  metadata_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (document_id, chunk_index)
);
CREATE INDEX IF NOT EXISTS document_text_chunks_document_idx ON document_text_chunks (document_id, chunk_index);

CREATE TABLE IF NOT EXISTS research_chats (
  id BIGSERIAL PRIMARY KEY,
  legacy_chat_id BIGINT UNIQUE,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  document_id BIGINT REFERENCES documents(id) ON DELETE SET NULL,
  document_type TEXT NOT NULL,
  external_document_id TEXT NOT NULL,
  title TEXT NOT NULL,
  summary TEXT,
  is_pinned BOOLEAN NOT NULL DEFAULT FALSE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS research_chats_user_document_idx
  ON research_chats (user_id, document_type, external_document_id);
CREATE INDEX IF NOT EXISTS research_chats_user_idx ON research_chats (user_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS research_chats_document_idx ON research_chats (document_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS research_messages (
  id BIGSERIAL PRIMARY KEY,
  chat_id BIGINT NOT NULL REFERENCES research_chats(id) ON DELETE CASCADE,
  external_message_id TEXT,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  sources_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  metadata_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_error BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (chat_id, external_message_id)
);
CREATE INDEX IF NOT EXISTS research_messages_chat_idx ON research_messages (chat_id, created_at);

INSERT INTO research_chats (
  legacy_chat_id, user_id, document_id, document_type, external_document_id,
  title, summary, is_pinned, is_active, created_at, updated_at
)
SELECT
  c.id,
  c.user_id,
  CASE WHEN c.document_id ~ '^[0-9]+$' AND EXISTS (
    SELECT 1 FROM documents d WHERE d.id = c.document_id::BIGINT
  ) THEN c.document_id::BIGINT END,
  LOWER(REPLACE(c.document_type, '-', '_')),
  c.document_id,
  c.document_title,
  c.summary,
  c.is_pinned,
  c.is_active,
  c.created_at,
  c.updated_at
FROM document_chats c
ON CONFLICT (legacy_chat_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  is_pinned = EXCLUDED.is_pinned,
  is_active = EXCLUDED.is_active,
  updated_at = EXCLUDED.updated_at;

INSERT INTO research_messages (
  chat_id, external_message_id, role, content, sources_json,
  metadata_json, is_error, created_at
)
SELECT
  rc.id,
  COALESCE(message ->> '_id', MD5(message::TEXT)),
  CASE WHEN message ->> 'sender' IN ('assistant', 'ai') THEN 'assistant' ELSE 'user' END,
  COALESCE(message ->> 'text', ''),
  CASE WHEN JSONB_TYPEOF(message -> 'sources') = 'array' THEN message -> 'sources' ELSE '[]'::jsonb END,
  CASE WHEN JSONB_TYPEOF(message -> 'metadata') = 'object' THEN message -> 'metadata' ELSE '{}'::jsonb END,
  COALESCE((message ->> 'isError')::BOOLEAN, FALSE),
  CASE
    WHEN message ->> 'timestamp' ~ '^\\d{4}-\\d{2}-\\d{2}T'
      THEN (message ->> 'timestamp')::TIMESTAMPTZ
    ELSE c.created_at
  END
FROM document_chats c
JOIN research_chats rc ON rc.legacy_chat_id = c.id
CROSS JOIN LATERAL JSONB_ARRAY_ELEMENTS(c.messages) message
WHERE COALESCE(message ->> 'text', '') <> ''
ON CONFLICT (chat_id, external_message_id) DO UPDATE SET
  content = EXCLUDED.content,
  sources_json = EXCLUDED.sources_json,
  metadata_json = EXCLUDED.metadata_json,
  is_error = EXCLUDED.is_error;

CREATE TABLE IF NOT EXISTS user_preferences (
  user_id BIGINT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  language TEXT NOT NULL DEFAULT 'English',
  theme TEXT NOT NULL DEFAULT 'system',
  timezone TEXT NOT NULL DEFAULT 'Asia/Kolkata',
  notification_preferences JSONB NOT NULL DEFAULT '{}'::jsonb,
  research_preferences JSONB NOT NULL DEFAULT '{}'::jsonb,
  personalization_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO user_preferences (
  user_id, language, theme, timezone, notification_preferences,
  research_preferences, personalization_enabled, updated_at
)
SELECT
  p.user_id,
  p.language_preference,
  p.theme_preference,
  p.timezone,
  p.notification_preferences,
  JSONB_BUILD_OBJECT(
    'interests', p.research_interests,
    'ministries', p.preferred_ministries,
    'policyAreas', p.preferred_policy_areas,
    'jurisdictions', p.preferred_jurisdictions,
    'documentTypes', p.preferred_document_types,
    'sources', p.preferred_sources
  ),
  COALESCE(r.personalization_enabled, FALSE),
  p.updated_at
FROM user_profiles p
LEFT JOIN user_research_preferences r ON r.user_id = p.user_id
ON CONFLICT (user_id) DO UPDATE SET
  language = EXCLUDED.language,
  theme = EXCLUDED.theme,
  timezone = EXCLUDED.timezone,
  notification_preferences = EXCLUDED.notification_preferences,
  research_preferences = EXCLUDED.research_preferences,
  personalization_enabled = EXCLUDED.personalization_enabled,
  updated_at = EXCLUDED.updated_at;

CREATE TABLE IF NOT EXISTS ingestion_run_items (
  id BIGSERIAL PRIMARY KEY,
  run_id BIGINT NOT NULL REFERENCES ingestion_runs(id) ON DELETE CASCADE,
  source_record_id TEXT,
  document_id BIGINT REFERENCES documents(id) ON DELETE SET NULL,
  status TEXT NOT NULL,
  action TEXT,
  error_message TEXT,
  metadata_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS ingestion_run_items_run_idx ON ingestion_run_items (run_id, status);
CREATE INDEX IF NOT EXISTS ingestion_run_items_document_idx ON ingestion_run_items (document_id);

CREATE TABLE IF NOT EXISTS source_health (
  source_name TEXT PRIMARY KEY REFERENCES source_registry(source_name) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'not_run',
  reachable BOOLEAN,
  parser_status TEXT,
  records_discovered INTEGER NOT NULL DEFAULT 0,
  records_stored INTEGER NOT NULL DEFAULT 0,
  resources_discovered INTEGER NOT NULL DEFAULT 0,
  last_checked_at TIMESTAMPTZ,
  last_successful_run_at TIMESTAMPTZ,
  last_failed_run_at TIMESTAMPTZ,
  consecutive_failures INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  metadata_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS dedupe_candidates (
  id BIGSERIAL PRIMARY KEY,
  document_id BIGINT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  candidate_document_id BIGINT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  match_type TEXT NOT NULL,
  confidence NUMERIC(5, 4),
  status TEXT NOT NULL DEFAULT 'pending',
  evidence_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reviewed_at TIMESTAMPTZ,
  CHECK (document_id <> candidate_document_id),
  UNIQUE (document_id, candidate_document_id, match_type)
);

CREATE TABLE IF NOT EXISTS source_connectors (
  id BIGSERIAL PRIMARY KEY,
  source_name TEXT NOT NULL REFERENCES source_registry(source_name) ON DELETE CASCADE,
  connector_name TEXT NOT NULL,
  configuration_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  last_validated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (source_name, connector_name)
);

INSERT INTO source_connectors (source_name, connector_name, enabled)
SELECT source_name, connector_name, enabled
FROM source_registry
WHERE connector_name IS NOT NULL
ON CONFLICT (source_name, connector_name) DO UPDATE SET
  enabled = EXCLUDED.enabled,
  updated_at = NOW();

CREATE TABLE IF NOT EXISTS dashboard_metrics (
  metric_key TEXT PRIMARY KEY,
  metric_value NUMERIC,
  dimensions_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  measured_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS recommendations (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT REFERENCES users(id) ON DELETE CASCADE,
  document_id BIGINT REFERENCES documents(id) ON DELETE CASCADE,
  recommendation_type TEXT NOT NULL,
  score NUMERIC(8, 4) NOT NULL DEFAULT 0,
  reason_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS topic_taxonomy (
  id BIGSERIAL PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  parent_id BIGINT REFERENCES topic_taxonomy(id) ON DELETE SET NULL,
  metadata_json JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS document_topics (
  document_id BIGINT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  topic_id BIGINT NOT NULL REFERENCES topic_taxonomy(id) ON DELETE CASCADE,
  confidence NUMERIC(5, 4),
  source TEXT,
  PRIMARY KEY (document_id, topic_id)
);

CREATE TABLE IF NOT EXISTS feedback_submissions (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
  feedback_type TEXT NOT NULL DEFAULT 'general',
  message TEXT NOT NULL,
  metadata_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS bug_reports (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'new',
  metadata_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  entity_type TEXT,
  entity_id TEXT,
  metadata_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS audit_logs_user_idx ON audit_logs (user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS system_events (
  id BIGSERIAL PRIMARY KEY,
  event_type TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'info',
  message TEXT NOT NULL,
  metadata_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS system_events_type_idx ON system_events (event_type, created_at DESC);

CREATE TABLE IF NOT EXISTS contact_submissions (
  id BIGSERIAL PRIMARY KEY,
  legacy_contact_request_id BIGINT UNIQUE,
  first_name TEXT NOT NULL,
  last_name TEXT,
  organization TEXT,
  email TEXT NOT NULL,
  phone TEXT,
  message TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'new',
  metadata_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO contact_submissions (
  legacy_contact_request_id, first_name, last_name, organization,
  email, phone, message, status, created_at
)
SELECT id, first_name, last_name, organization, email, phone, message, status, created_at
FROM contact_requests
ON CONFLICT (legacy_contact_request_id) DO NOTHING;

CREATE OR REPLACE FUNCTION sync_document_v2_from_legacy()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  registry_id BIGINT;
  artifact_record document_text_artifacts%ROWTYPE;
BEGIN
  SELECT id INTO registry_id
  FROM source_registry
  WHERE source_name = COALESCE(NEW.canonical_source, NEW.source_name);

  SELECT * INTO artifact_record
  FROM document_text_artifacts
  WHERE document_id = NEW.id;

  INSERT INTO documents (
    id, canonical_id, title, normalized_title, document_type, document_subtype,
    jurisdiction_level, jurisdiction, state, country, authority, ministry,
    department, category, status, language, script, is_bilingual, year,
    publication_date, introduced_date, passed_date, assent_date,
    commencement_date, effective_date, legal_identifier, bill_number,
    act_number, gazette_identifier, source_priority, canonical_source_id,
    canonical_url, research_ready, visibility_status, quality_score,
    metadata_json, created_at, updated_at, first_seen_at, last_seen_at
  ) VALUES (
    NEW.id, NEW.canonical_id, NEW.title,
    COALESCE(NULLIF(NEW.normalized_title, ''), LOWER(NEW.title)),
    LOWER(REPLACE(NEW.document_type, '-', '_')),
    CASE
      WHEN NEW.jurisdiction_level = 'state' AND NEW.document_type = 'bill' THEN 'state_bill'
      WHEN NEW.jurisdiction_level = 'state' AND NEW.document_type = 'act' THEN 'state_act'
    END,
    NEW.jurisdiction_level, NEW.jurisdiction,
    COALESCE(NEW.metadata_json ->> 'state', CASE WHEN NEW.jurisdiction_level = 'state' THEN NEW.jurisdiction END),
    COALESCE(NEW.metadata_json ->> 'country', 'India'),
    NEW.authority, NEW.ministry, NEW.department, NEW.category, NEW.status,
    COALESCE(artifact_record.language_code, NEW.metadata_json ->> 'languageCode', NEW.metadata_json ->> 'language', 'und'),
    COALESCE(artifact_record.script, NEW.metadata_json ->> 'script', 'Unknown'),
    COALESCE(artifact_record.is_bilingual, FALSE),
    NEW.year, NEW.publication_date, NEW.introduced_date, NEW.passed_date,
    COALESCE(NEW.assent_date, NEW.enacted_date),
    COALESCE(NEW.commencement_date, NEW.effective_date), NEW.effective_date,
    NEW.legal_identifier, NEW.bill_number, NEW.act_number,
    NEW.gazette_identifier, NEW.source_priority, registry_id,
    COALESCE(NEW.canonical_url, NEW.detail_url, NEW.source_url),
    COALESCE(
      NEW.processing_status = 'ready'
      AND artifact_record.document_id IS NOT NULL
      AND NEW.pdf_url IS NOT NULL,
      FALSE
    ),
    CASE WHEN COALESCE(NEW.canonical_url, NEW.source_url) IS NULL THEN 'internal_only' ELSE 'public' END,
    LEAST(
      100,
      (CASE WHEN NULLIF(TRIM(NEW.title), '') IS NOT NULL THEN 15 ELSE 0 END) +
      (CASE WHEN COALESCE(NEW.canonical_url, NEW.source_url) IS NOT NULL THEN 15 ELSE 0 END) +
      (CASE WHEN NEW.pdf_url IS NOT NULL THEN 15 ELSE 0 END) +
      (CASE WHEN NEW.publication_date IS NOT NULL OR NEW.year IS NOT NULL THEN 10 ELSE 0 END) +
      (CASE WHEN NEW.ministry IS NOT NULL OR NEW.authority IS NOT NULL THEN 10 ELSE 0 END) +
      (CASE WHEN NEW.jurisdiction IS NOT NULL THEN 10 ELSE 0 END) +
      (CASE WHEN NEW.processing_status = 'ready' THEN 15 ELSE 0 END) +
      (CASE WHEN artifact_record.document_id IS NOT NULL THEN 10 ELSE 0 END)
    ),
    NEW.metadata_json || NEW.source_metadata,
    NEW.created_at, NEW.updated_at, NEW.first_seen_at, NEW.last_seen_at
  )
  ON CONFLICT (id) DO UPDATE SET
    canonical_id = EXCLUDED.canonical_id,
    title = EXCLUDED.title,
    normalized_title = EXCLUDED.normalized_title,
    document_type = EXCLUDED.document_type,
    document_subtype = EXCLUDED.document_subtype,
    jurisdiction_level = EXCLUDED.jurisdiction_level,
    jurisdiction = EXCLUDED.jurisdiction,
    state = EXCLUDED.state,
    country = EXCLUDED.country,
    authority = EXCLUDED.authority,
    ministry = EXCLUDED.ministry,
    department = EXCLUDED.department,
    category = EXCLUDED.category,
    status = EXCLUDED.status,
    language = EXCLUDED.language,
    script = EXCLUDED.script,
    is_bilingual = EXCLUDED.is_bilingual,
    year = EXCLUDED.year,
    publication_date = EXCLUDED.publication_date,
    introduced_date = EXCLUDED.introduced_date,
    passed_date = EXCLUDED.passed_date,
    assent_date = EXCLUDED.assent_date,
    commencement_date = EXCLUDED.commencement_date,
    effective_date = EXCLUDED.effective_date,
    legal_identifier = EXCLUDED.legal_identifier,
    bill_number = EXCLUDED.bill_number,
    act_number = EXCLUDED.act_number,
    gazette_identifier = EXCLUDED.gazette_identifier,
    source_priority = EXCLUDED.source_priority,
    canonical_source_id = EXCLUDED.canonical_source_id,
    canonical_url = EXCLUDED.canonical_url,
    research_ready = EXCLUDED.research_ready,
    visibility_status = EXCLUDED.visibility_status,
    quality_score = EXCLUDED.quality_score,
    metadata_json = EXCLUDED.metadata_json,
    updated_at = EXCLUDED.updated_at,
    last_seen_at = EXCLUDED.last_seen_at;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS legislative_documents_sync_v2 ON legislative_documents;
CREATE TRIGGER legislative_documents_sync_v2
AFTER INSERT OR UPDATE ON legislative_documents
FOR EACH ROW EXECUTE FUNCTION sync_document_v2_from_legacy();

CREATE OR REPLACE FUNCTION sync_resource_v2_from_legacy()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO document_resources (
    id, document_id, source_id, resource_type, label, url, mime_type,
    file_extension, file_size, language, hash_sha256, is_primary,
    is_accessible, metadata_json, created_at, updated_at
  )
  SELECT
    NEW.id, NEW.document_id,
    (
      SELECT id FROM document_sources
      WHERE document_id = NEW.document_id
      ORDER BY source_priority, id LIMIT 1
    ),
    CASE WHEN NEW.url ~* '\\.pdf(?:$|[?#])' THEN 'pdf' ELSE COALESCE(NEW.resource_type, 'link') END,
    NEW.label, NEW.url,
    COALESCE(NEW.metadata ->> 'mimeType', CASE WHEN NEW.url ~* '\\.pdf(?:$|[?#])' THEN 'application/pdf' END),
    LOWER(NULLIF(SUBSTRING(NEW.url FROM '\\.([a-zA-Z0-9]+)(?:[?#].*)?$'), '')),
    NULLIF(NEW.metadata ->> 'fileSizeBytes', '')::BIGINT,
    NEW.metadata ->> 'language',
    COALESCE(NEW.metadata ->> 'hashSha256', NEW.metadata ->> 'fileHash'),
    EXISTS (
      SELECT 1 FROM legislative_documents
      WHERE id = NEW.document_id AND pdf_url = NEW.url
    ),
    TRUE, NEW.metadata, NEW.created_at, NEW.updated_at
  ON CONFLICT (id) DO UPDATE SET
    source_id = EXCLUDED.source_id,
    resource_type = EXCLUDED.resource_type,
    label = EXCLUDED.label,
    url = EXCLUDED.url,
    mime_type = EXCLUDED.mime_type,
    file_extension = EXCLUDED.file_extension,
    file_size = EXCLUDED.file_size,
    language = EXCLUDED.language,
    hash_sha256 = EXCLUDED.hash_sha256,
    is_primary = EXCLUDED.is_primary,
    metadata_json = EXCLUDED.metadata_json,
    updated_at = EXCLUDED.updated_at;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS legislative_resources_sync_v2 ON legislative_document_resources;
CREATE TRIGGER legislative_resources_sync_v2
AFTER INSERT OR UPDATE ON legislative_document_resources
FOR EACH ROW EXECUTE FUNCTION sync_resource_v2_from_legacy();

CREATE OR REPLACE FUNCTION sync_research_chat_v2()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  normalized_chat_id BIGINT;
BEGIN
  INSERT INTO research_chats (
    legacy_chat_id, user_id, document_id, document_type, external_document_id,
    title, summary, is_pinned, is_active, created_at, updated_at
  ) VALUES (
    NEW.id,
    NEW.user_id,
    CASE WHEN NEW.document_id ~ '^[0-9]+$' AND EXISTS (
      SELECT 1 FROM documents WHERE id = NEW.document_id::BIGINT
    ) THEN NEW.document_id::BIGINT END,
    LOWER(REPLACE(NEW.document_type, '-', '_')),
    NEW.document_id,
    NEW.document_title,
    NEW.summary,
    NEW.is_pinned,
    NEW.is_active,
    NEW.created_at,
    NEW.updated_at
  )
  ON CONFLICT (legacy_chat_id) DO UPDATE SET
    title = EXCLUDED.title,
    summary = EXCLUDED.summary,
    is_pinned = EXCLUDED.is_pinned,
    is_active = EXCLUDED.is_active,
    updated_at = EXCLUDED.updated_at
  RETURNING id INTO normalized_chat_id;

  INSERT INTO research_messages (
    chat_id, external_message_id, role, content, sources_json,
    metadata_json, is_error, created_at
  )
  SELECT
    normalized_chat_id,
    COALESCE(message ->> '_id', MD5(message::TEXT)),
    CASE WHEN message ->> 'sender' IN ('assistant', 'ai') THEN 'assistant' ELSE 'user' END,
    COALESCE(message ->> 'text', ''),
    CASE WHEN JSONB_TYPEOF(message -> 'sources') = 'array' THEN message -> 'sources' ELSE '[]'::jsonb END,
    CASE WHEN JSONB_TYPEOF(message -> 'metadata') = 'object' THEN message -> 'metadata' ELSE '{}'::jsonb END,
    COALESCE((message ->> 'isError')::BOOLEAN, FALSE),
    CASE
      WHEN message ->> 'timestamp' ~ '^\\d{4}-\\d{2}-\\d{2}T'
        THEN (message ->> 'timestamp')::TIMESTAMPTZ
      ELSE NEW.created_at
    END
  FROM JSONB_ARRAY_ELEMENTS(NEW.messages) message
  WHERE COALESCE(message ->> 'text', '') <> ''
  ON CONFLICT (chat_id, external_message_id) DO UPDATE SET
    content = EXCLUDED.content,
    sources_json = EXCLUDED.sources_json,
    metadata_json = EXCLUDED.metadata_json,
    is_error = EXCLUDED.is_error;

  DELETE FROM research_messages rm
  WHERE rm.chat_id = normalized_chat_id
    AND rm.external_message_id IS NOT NULL
    AND NOT EXISTS (
      SELECT 1
      FROM JSONB_ARRAY_ELEMENTS(NEW.messages) message
      WHERE COALESCE(message ->> '_id', MD5(message::TEXT)) = rm.external_message_id
    );
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS document_chats_sync_v2 ON document_chats;
CREATE TRIGGER document_chats_sync_v2
AFTER INSERT OR UPDATE ON document_chats
FOR EACH ROW EXECUTE FUNCTION sync_research_chat_v2();

CREATE OR REPLACE VIEW legacy_documents_compat AS
SELECT
  d.*,
  sr.source_name AS canonical_source,
  sr.display_name AS canonical_source_display_name
FROM documents d
LEFT JOIN source_registry sr ON sr.id = d.canonical_source_id;

INSERT INTO dashboard_metrics (metric_key, metric_value, measured_at)
VALUES
  ('documents.total', (SELECT COUNT(*) FROM documents), NOW()),
  ('documents.research_ready', (SELECT COUNT(*) FROM documents WHERE research_ready), NOW()),
  ('documents.with_pdf', (SELECT COUNT(DISTINCT document_id) FROM document_resources WHERE resource_type = 'pdf'), NOW()),
  ('sources.enabled', (SELECT COUNT(*) FROM source_registry WHERE enabled), NOW())
ON CONFLICT (metric_key) DO UPDATE SET
  metric_value = EXCLUDED.metric_value,
  measured_at = EXCLUDED.measured_at;
`;

module.exports = {
  checksum: crypto.createHash("sha256").update(sql).digest("hex"),
  up: (client) => client.query(sql),
};
