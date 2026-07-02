const { Pool } = require("pg");
require("dotenv").config();

const globalForDatabase = globalThis;
const SCHEMA_VERSION = 2026070201;
const SCHEMA_LOCK_KEY = 1_847_263_911;

const normalizeConnectionString = (connectionString) => {
  const url = new URL(connectionString);
  const sslMode = url.searchParams.get("sslmode");
  if (["prefer", "require", "verify-ca"].includes(sslMode)) {
    url.searchParams.set("sslmode", "verify-full");
  }
  return url.toString();
};

const createPool = () => {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required");
  }

  return new Pool({
    connectionString: normalizeConnectionString(process.env.DATABASE_URL),
    max: 5,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
  });
};

const getPool = () => {
  if (!globalForDatabase.__rashtramPostgresPool) {
    globalForDatabase.__rashtramPostgresPool = createPool();
  }
  return globalForDatabase.__rashtramPostgresPool;
};

const initializeSchema = async () => {
  const pool = getPool();
  const client = await pool.connect();

  try {
    await client.query("SELECT pg_advisory_lock($1)", [SCHEMA_LOCK_KEY]);
    await client.query(`
      CREATE TABLE IF NOT EXISTS application_schema_versions (
        id SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
        version BIGINT NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    const versionResult = await client.query(
      "SELECT version FROM application_schema_versions WHERE id = 1",
    );
    if (Number(versionResult.rows[0]?.version || 0) >= SCHEMA_VERSION) {
      return;
    }

    await client.query(`
    CREATE TABLE IF NOT EXISTS users (
      id BIGSERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      google_id TEXT UNIQUE,
      avatar TEXT,
      password TEXT,
      is_admin BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS bill_chats (
      id BIGSERIAL PRIMARY KEY,
      bill_id TEXT NOT NULL,
      user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      bill_title TEXT NOT NULL,
      bill_status TEXT,
      pdf_url TEXT,
      summary TEXT,
      messages JSONB NOT NULL DEFAULT '[]'::jsonb,
      last_message_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (user_id, bill_id)
    );

    CREATE INDEX IF NOT EXISTS bill_chats_user_recent_idx
      ON bill_chats (user_id, last_message_at DESC);

    CREATE TABLE IF NOT EXISTS act_chats (
      id BIGSERIAL PRIMARY KEY,
      act_id TEXT NOT NULL,
      user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      act_title TEXT NOT NULL,
      act_status TEXT,
      pdf_url TEXT,
      summary TEXT,
      messages JSONB NOT NULL DEFAULT '[]'::jsonb,
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (user_id, act_id)
    );

    CREATE INDEX IF NOT EXISTS act_chats_user_recent_idx
      ON act_chats (user_id, updated_at DESC);

    CREATE TABLE IF NOT EXISTS egazette_chats (
      id BIGSERIAL PRIMARY KEY,
      gazette_id TEXT NOT NULL,
      user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      gazette_title TEXT NOT NULL,
      gazette_number TEXT,
      notification_type TEXT,
      status TEXT,
      pdf_url TEXT,
      source_url TEXT,
      summary TEXT,
      messages JSONB NOT NULL DEFAULT '[]'::jsonb,
      metadata_json JSONB NOT NULL DEFAULT '{}'::jsonb,
      last_message_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      last_accessed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (user_id, gazette_id)
    );

    CREATE INDEX IF NOT EXISTS egazette_chats_user_recent_idx
      ON egazette_chats (
        user_id,
        last_accessed_at DESC,
        last_message_at DESC
      );

    CREATE TABLE IF NOT EXISTS document_chats (
      id BIGSERIAL PRIMARY KEY,
      user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      document_type TEXT NOT NULL,
      document_id TEXT NOT NULL,
      document_title TEXT NOT NULL,
      status TEXT,
      pdf_url TEXT,
      source_url TEXT,
      summary TEXT,
      messages JSONB NOT NULL DEFAULT '[]'::jsonb,
      metadata_json JSONB NOT NULL DEFAULT '{}'::jsonb,
      is_pinned BOOLEAN NOT NULL DEFAULT FALSE,
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      last_message_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      last_accessed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (user_id, document_type, document_id)
    );

    CREATE INDEX IF NOT EXISTS document_chats_user_recent_idx
      ON document_chats (
        user_id,
        last_accessed_at DESC,
        last_message_at DESC
      );

    CREATE INDEX IF NOT EXISTS document_chats_document_idx
      ON document_chats (document_type, document_id);

    CREATE TABLE IF NOT EXISTS document_comparisons (
      id BIGSERIAL PRIMARY KEY,
      user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      document_ids_json JSONB NOT NULL,
      mode TEXT NOT NULL DEFAULT 'comprehensive',
      language TEXT NOT NULL DEFAULT 'English',
      result_json JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CHECK (JSONB_TYPEOF(document_ids_json) = 'array')
    );

    CREATE INDEX IF NOT EXISTS document_comparisons_user_recent_idx
      ON document_comparisons (user_id, updated_at DESC);

    CREATE TABLE IF NOT EXISTS multi_document_chats (
      id BIGSERIAL PRIMARY KEY,
      user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      selection_key TEXT NOT NULL,
      document_ids_json JSONB NOT NULL,
      comparison_id BIGINT
        REFERENCES document_comparisons(id) ON DELETE SET NULL,
      messages JSONB NOT NULL DEFAULT '[]'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (user_id, selection_key),
      CHECK (JSONB_TYPEOF(document_ids_json) = 'array')
    );

    CREATE INDEX IF NOT EXISTS multi_document_chats_user_recent_idx
      ON multi_document_chats (user_id, updated_at DESC);

    CREATE TABLE IF NOT EXISTS research_notes (
      id BIGSERIAL PRIMARY KEY,
      user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      document_type TEXT NOT NULL,
      document_id TEXT NOT NULL,
      body TEXT NOT NULL,
      is_pinned BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS research_notes_document_idx
      ON research_notes (user_id, document_type, document_id, updated_at DESC);

    CREATE TABLE IF NOT EXISTS document_chat_feedback (
      id BIGSERIAL PRIMARY KEY,
      user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      document_type TEXT NOT NULL,
      document_id TEXT NOT NULL,
      message_id TEXT NOT NULL,
      rating SMALLINT NOT NULL CHECK (rating IN (-1, 1)),
      reason TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (user_id, document_type, document_id, message_id)
    );

    CREATE TABLE IF NOT EXISTS user_profiles (
      user_id BIGINT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      username TEXT UNIQUE,
      bio TEXT,
      organization TEXT,
      designation TEXT,
      location TEXT,
      phone TEXT,
      timezone TEXT NOT NULL DEFAULT 'Asia/Kolkata',
      language_preference TEXT NOT NULL DEFAULT 'English',
      theme_preference TEXT NOT NULL DEFAULT 'system',
      research_visibility TEXT NOT NULL DEFAULT 'private',
      notification_preferences JSONB NOT NULL DEFAULT '{}'::jsonb,
      research_interests JSONB NOT NULL DEFAULT '[]'::jsonb,
      preferred_ministries JSONB NOT NULL DEFAULT '[]'::jsonb,
      preferred_policy_areas JSONB NOT NULL DEFAULT '[]'::jsonb,
      preferred_jurisdictions JSONB NOT NULL DEFAULT '[]'::jsonb,
      preferred_document_types JSONB NOT NULL DEFAULT '[]'::jsonb,
      preferred_sources JSONB NOT NULL DEFAULT '[]'::jsonb,
      dashboard_widgets JSONB NOT NULL DEFAULT '[]'::jsonb,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS saved_content (
      id BIGSERIAL PRIMARY KEY,
      user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      item_type TEXT NOT NULL CHECK (
        item_type IN ('bookmark', 'pinned_document', 'pinned_chat')
      ),
      document_type TEXT,
      document_id TEXT,
      chat_id BIGINT REFERENCES document_chats(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      metadata_json JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE UNIQUE INDEX IF NOT EXISTS saved_content_document_unique_idx
      ON saved_content (
        user_id,
        item_type,
        COALESCE(document_type, ''),
        COALESCE(document_id, ''),
        COALESCE(chat_id, 0)
      );

    CREATE INDEX IF NOT EXISTS saved_content_user_recent_idx
      ON saved_content (user_id, created_at DESC);

    CREATE TABLE IF NOT EXISTS saved_searches (
      id BIGSERIAL PRIMARY KEY,
      user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      query_text TEXT,
      filters_json JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS saved_searches_user_recent_idx
      ON saved_searches (user_id, updated_at DESC);

    CREATE TABLE IF NOT EXISTS research_collections (
      id BIGSERIAL PRIMARY KEY,
      user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      description TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS research_collection_items (
      collection_id BIGINT NOT NULL
        REFERENCES research_collections(id) ON DELETE CASCADE,
      document_type TEXT NOT NULL,
      document_id TEXT NOT NULL,
      title TEXT NOT NULL,
      metadata_json JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (collection_id, document_type, document_id)
    );

    CREATE TABLE IF NOT EXISTS user_sessions (
      id TEXT PRIMARY KEY,
      user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      user_agent TEXT,
      ip_address TEXT,
      expires_at TIMESTAMPTZ NOT NULL,
      last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      revoked_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS user_sessions_user_active_idx
      ON user_sessions (user_id, revoked_at, last_seen_at DESC);

    CREATE TABLE IF NOT EXISTS related_bills (
      bill_id TEXT PRIMARY KEY,
      bill_title TEXT NOT NULL,
      related_bills JSONB NOT NULL DEFAULT '[]'::jsonb,
      last_updated TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS ingestion_runs (
      id BIGSERIAL PRIMARY KEY,
      source_name TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'running',
      options JSONB NOT NULL DEFAULT '{}'::jsonb,
      records_discovered INTEGER NOT NULL DEFAULT 0,
      records_stored INTEGER NOT NULL DEFAULT 0,
      resources_stored INTEGER NOT NULL DEFAULT 0,
      errors JSONB NOT NULL DEFAULT '[]'::jsonb,
      started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      completed_at TIMESTAMPTZ
    );

    CREATE INDEX IF NOT EXISTS ingestion_runs_source_recent_idx
      ON ingestion_runs (source_name, started_at DESC);

    CREATE TABLE IF NOT EXISTS legislative_documents (
      id BIGSERIAL PRIMARY KEY,
      source_name TEXT NOT NULL,
      source_document_id TEXT NOT NULL,
      document_type TEXT NOT NULL
        CHECK (document_type IN ('bill', 'act')),
      jurisdiction_level TEXT NOT NULL
        CHECK (jurisdiction_level IN ('parliament', 'state')),
      jurisdiction TEXT NOT NULL,
      title TEXT NOT NULL,
      year INTEGER,
      status TEXT,
      ministry TEXT,
      category TEXT,
      source_url TEXT NOT NULL,
      detail_url TEXT,
      pdf_url TEXT,
      source_page_url TEXT,
      source_metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
      first_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      content_fetched_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (source_name, source_document_id)
    );

    CREATE INDEX IF NOT EXISTS legislative_documents_scope_idx
      ON legislative_documents
        (document_type, jurisdiction_level, jurisdiction, year DESC);

    CREATE INDEX IF NOT EXISTS legislative_documents_status_idx
      ON legislative_documents (document_type, status);

    CREATE INDEX IF NOT EXISTS legislative_documents_title_idx
      ON legislative_documents (LOWER(title));

    CREATE TABLE IF NOT EXISTS legislative_document_resources (
      id BIGSERIAL PRIMARY KEY,
      document_id BIGINT NOT NULL
        REFERENCES legislative_documents(id) ON DELETE CASCADE,
      label TEXT,
      resource_type TEXT NOT NULL DEFAULT 'link',
      category TEXT,
      url TEXT NOT NULL,
      metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
      first_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (document_id, url)
    );

    CREATE INDEX IF NOT EXISTS legislative_resources_document_idx
      ON legislative_document_resources (document_id);

    CREATE TABLE IF NOT EXISTS document_text_artifacts (
      document_id BIGINT PRIMARY KEY
        REFERENCES legislative_documents(id) ON DELETE CASCADE,
      language_code TEXT NOT NULL DEFAULT 'und',
      script TEXT NOT NULL DEFAULT 'Unknown',
      language_confidence NUMERIC(5, 4),
      original_text TEXT NOT NULL,
      is_bilingual BOOLEAN NOT NULL DEFAULT FALSE,
      english_summary TEXT,
      extraction_method TEXT NOT NULL CHECK (
        extraction_method IN ('pdf_text', 'gemini_ocr', 'openai_ocr')
      ),
      ocr_used BOOLEAN NOT NULL DEFAULT FALSE,
      ocr_required BOOLEAN NOT NULL DEFAULT FALSE,
      metadata_json JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS document_text_artifacts_language_idx
      ON document_text_artifacts (language_code, updated_at DESC);

    ALTER TABLE document_text_artifacts
      ADD COLUMN IF NOT EXISTS is_bilingual BOOLEAN NOT NULL DEFAULT FALSE;
    ALTER TABLE document_text_artifacts
      ADD COLUMN IF NOT EXISTS ocr_required BOOLEAN NOT NULL DEFAULT FALSE;
    ALTER TABLE document_text_artifacts
      DROP CONSTRAINT IF EXISTS document_text_artifacts_extraction_method_check;
    ALTER TABLE document_text_artifacts
      ADD CONSTRAINT document_text_artifacts_extraction_method_check
      CHECK (
        extraction_method IN ('pdf_text', 'gemini_ocr', 'openai_ocr')
      );

    CREATE TABLE IF NOT EXISTS source_collection_snapshots (
      id BIGSERIAL PRIMARY KEY,
      source_name TEXT NOT NULL,
      source_url TEXT NOT NULL,
      content_sha256 TEXT NOT NULL,
      record_count INTEGER NOT NULL DEFAULT 0,
      metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
      fetched_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS source_snapshots_recent_idx
      ON source_collection_snapshots (source_name, fetched_at DESC);

    CREATE TABLE IF NOT EXISTS source_directory_entries (
      id BIGSERIAL PRIMARY KEY,
      source_name TEXT NOT NULL,
      entry_key TEXT NOT NULL,
      entity_type TEXT NOT NULL,
      name TEXT NOT NULL,
      jurisdiction TEXT,
      parent_name TEXT,
      official_url TEXT,
      directory_url TEXT NOT NULL,
      metadata_json JSONB NOT NULL DEFAULT '{}'::jsonb,
      first_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (source_name, entry_key)
    );

    CREATE INDEX IF NOT EXISTS source_directory_entries_scope_idx
      ON source_directory_entries (entity_type, jurisdiction, name);

    ALTER TABLE legislative_documents
      DROP CONSTRAINT IF EXISTS legislative_documents_document_type_check;

    ALTER TABLE legislative_documents
      DROP CONSTRAINT IF EXISTS legislative_documents_jurisdiction_level_check;

    ALTER TABLE legislative_documents
      ADD COLUMN IF NOT EXISTS processing_status TEXT,
      ADD COLUMN IF NOT EXISTS processing_error TEXT,
      ADD COLUMN IF NOT EXISTS processed_at TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS canonical_id TEXT,
      ADD COLUMN IF NOT EXISTS normalized_title TEXT,
      ADD COLUMN IF NOT EXISTS authority TEXT,
      ADD COLUMN IF NOT EXISTS department TEXT,
      ADD COLUMN IF NOT EXISTS legal_identifier TEXT,
      ADD COLUMN IF NOT EXISTS bill_number TEXT,
      ADD COLUMN IF NOT EXISTS act_number TEXT,
      ADD COLUMN IF NOT EXISTS gazette_identifier TEXT,
      ADD COLUMN IF NOT EXISTS gazette_id TEXT,
      ADD COLUMN IF NOT EXISTS introduced_date DATE,
      ADD COLUMN IF NOT EXISTS passed_date DATE,
      ADD COLUMN IF NOT EXISTS enacted_date DATE,
      ADD COLUMN IF NOT EXISTS assent_date DATE,
      ADD COLUMN IF NOT EXISTS publication_date DATE,
      ADD COLUMN IF NOT EXISTS effective_date DATE,
      ADD COLUMN IF NOT EXISTS commencement_date DATE,
      ADD COLUMN IF NOT EXISTS canonical_source TEXT,
      ADD COLUMN IF NOT EXISTS canonical_url TEXT,
      ADD COLUMN IF NOT EXISTS source_priority INTEGER NOT NULL DEFAULT 100,
      ADD COLUMN IF NOT EXISTS content_hash TEXT,
      ADD COLUMN IF NOT EXISTS file_hash TEXT,
      ADD COLUMN IF NOT EXISTS mime_type TEXT,
      ADD COLUMN IF NOT EXISTS file_size_bytes BIGINT,
      ADD COLUMN IF NOT EXISTS text_fingerprint TEXT,
      ADD COLUMN IF NOT EXISTS metadata_json JSONB NOT NULL DEFAULT '{}'::jsonb;

    CREATE INDEX IF NOT EXISTS legislative_documents_publication_idx
      ON legislative_documents (publication_date DESC NULLS LAST, id DESC);

    CREATE INDEX IF NOT EXISTS legislative_documents_ministry_idx
      ON legislative_documents (ministry, publication_date DESC NULLS LAST)
      WHERE ministry IS NOT NULL;

    CREATE INDEX IF NOT EXISTS legislative_documents_source_idx
      ON legislative_documents (
        (COALESCE(canonical_source, source_name)),
        updated_at DESC
      );

    ALTER TABLE legislative_documents
      ADD COLUMN IF NOT EXISTS search_vector TSVECTOR
      GENERATED ALWAYS AS (
        TO_TSVECTOR(
          'english',
          COALESCE(title, '') || ' ' ||
          COALESCE(legal_identifier, '') || ' ' ||
          COALESCE(bill_number, '') || ' ' ||
          COALESCE(act_number, '') || ' ' ||
          COALESCE(gazette_identifier, '') || ' ' ||
          COALESCE(ministry, '') || ' ' ||
          COALESCE(department, '') || ' ' ||
          COALESCE(authority, '') || ' ' ||
          COALESCE(category, '')
        )
      ) STORED;

    CREATE INDEX IF NOT EXISTS legislative_documents_search_idx
      ON legislative_documents USING GIN (search_vector);

    CREATE INDEX IF NOT EXISTS legislative_documents_type_date_idx
      ON legislative_documents (
        document_type,
        publication_date DESC NULLS LAST,
        id DESC
      );

    CREATE INDEX IF NOT EXISTS legislative_documents_authority_idx
      ON legislative_documents (authority, publication_date DESC NULLS LAST)
      WHERE authority IS NOT NULL;

    CREATE INDEX IF NOT EXISTS legislative_documents_metadata_idx
      ON legislative_documents USING GIN (metadata_json);

    UPDATE legislative_documents
       SET canonical_id = 'rashtram-' || id
     WHERE canonical_id IS NULL;

    UPDATE legislative_documents
       SET normalized_title = TRIM(
             LOWER(
               REGEXP_REPLACE(
                 REGEXP_REPLACE(
                   REGEXP_REPLACE(
                     REGEXP_REPLACE(
                       title,
                       '\\m(the|a|an|bill|act|rules?|regulations?|ordinance|notification)\\M',
                       ' ',
                       'gi'
                     ),
                     '\\m(19|20)[0-9]{2}\\M',
                     ' ',
                     'g'
                   ),
                   '[^[:alnum:][:space:]]',
                   ' ',
                   'g'
                 ),
                 '[[:space:]]+',
                 ' ',
                 'g'
               )
             )
           ),
           canonical_source = COALESCE(canonical_source, source_name),
           canonical_url = COALESCE(canonical_url, detail_url, source_url),
           gazette_id = COALESCE(gazette_id, gazette_identifier),
           assent_date = COALESCE(assent_date, enacted_date),
           commencement_date = COALESCE(
             commencement_date,
             effective_date
           ),
           source_priority = CASE
             WHEN LOWER(source_name) LIKE '%egazette%' THEN 10
             WHEN LOWER(source_name) LIKE '%indiacode%' THEN 20
             WHEN LOWER(source_name) LIKE '%sansad%'
               OR LOWER(source_name) LIKE '%lok-sabha%'
               OR LOWER(source_name) LIKE '%rajya-sabha%' THEN 30
             WHEN LOWER(source_name) LIKE '%ministry%'
               OR LOWER(source_name) LIKE '%regulator%' THEN 40
             WHEN LOWER(source_name) LIKE '%prs%' THEN 50
             ELSE source_priority
           END,
           metadata_json = metadata_json || source_metadata
     WHERE normalized_title IS NULL
        OR normalized_title ~* '\\m(the|a|an|bill|act|rules?|regulations?|ordinance|notification)\\M'
        OR normalized_title ~ '\\m(19|20)[0-9]{2}\\M'
        OR canonical_source IS NULL
        OR canonical_url IS NULL
        OR (gazette_identifier IS NOT NULL AND gazette_id IS NULL)
        OR (enacted_date IS NOT NULL AND assent_date IS NULL)
        OR (effective_date IS NOT NULL AND commencement_date IS NULL)
        OR metadata_json = '{}'::jsonb;

    ALTER TABLE legislative_documents
      ALTER COLUMN canonical_id SET NOT NULL,
      ALTER COLUMN canonical_id SET DEFAULT
        ('rashtram-' || MD5(RANDOM()::TEXT || CLOCK_TIMESTAMP()::TEXT));

    CREATE UNIQUE INDEX IF NOT EXISTS legislative_documents_canonical_id_idx
      ON legislative_documents (canonical_id);

    CREATE INDEX IF NOT EXISTS legislative_documents_legal_identifier_idx
      ON legislative_documents (legal_identifier)
      WHERE legal_identifier IS NOT NULL;

    CREATE INDEX IF NOT EXISTS legislative_documents_gazette_identifier_idx
      ON legislative_documents (gazette_identifier)
      WHERE gazette_identifier IS NOT NULL;

    CREATE INDEX IF NOT EXISTS legislative_documents_content_hash_idx
      ON legislative_documents (content_hash)
      WHERE content_hash IS NOT NULL;

    CREATE INDEX IF NOT EXISTS legislative_documents_text_fingerprint_idx
      ON legislative_documents (text_fingerprint)
      WHERE text_fingerprint IS NOT NULL;

    CREATE INDEX IF NOT EXISTS legislative_documents_normalized_title_idx
      ON legislative_documents (normalized_title, year);

    CREATE TABLE IF NOT EXISTS document_sources (
      id BIGSERIAL PRIMARY KEY,
      document_id BIGINT NOT NULL
        REFERENCES legislative_documents(id) ON DELETE CASCADE,
      source_name TEXT NOT NULL,
      source_record_id TEXT NOT NULL,
      source_url TEXT NOT NULL,
      detail_url TEXT,
      pdf_url TEXT,
      source_priority INTEGER NOT NULL DEFAULT 100,
      legal_identifier TEXT,
      content_hash TEXT,
      pdf_hash TEXT,
      html_hash TEXT,
      text_fingerprint TEXT,
      source_title TEXT,
      source_status TEXT,
      raw_metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
      source_metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
      first_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (source_name, source_record_id)
    );

    CREATE INDEX IF NOT EXISTS document_sources_document_idx
      ON document_sources (document_id);

    CREATE INDEX IF NOT EXISTS document_sources_content_hash_idx
      ON document_sources (content_hash)
      WHERE content_hash IS NOT NULL;

    ALTER TABLE document_sources
      ADD COLUMN IF NOT EXISTS pdf_hash TEXT,
      ADD COLUMN IF NOT EXISTS html_hash TEXT,
      ADD COLUMN IF NOT EXISTS file_hash TEXT,
      ADD COLUMN IF NOT EXISTS mime_type TEXT,
      ADD COLUMN IF NOT EXISTS file_size_bytes BIGINT,
      ADD COLUMN IF NOT EXISTS source_title TEXT,
      ADD COLUMN IF NOT EXISTS source_status TEXT,
      ADD COLUMN IF NOT EXISTS source_metadata JSONB NOT NULL DEFAULT '{}'::jsonb;

    CREATE INDEX IF NOT EXISTS document_sources_pdf_hash_idx
      ON document_sources (pdf_hash)
      WHERE pdf_hash IS NOT NULL;

    INSERT INTO document_sources (
      document_id,
      source_name,
      source_record_id,
      source_url,
      detail_url,
      pdf_url,
      source_priority,
      legal_identifier,
      content_hash,
      pdf_hash,
      text_fingerprint,
      source_title,
      source_status,
      raw_metadata,
      source_metadata,
      first_seen_at,
      last_seen_at
    )
    SELECT
      id,
      source_name,
      source_document_id,
      source_url,
      detail_url,
      pdf_url,
      source_priority,
      legal_identifier,
      content_hash,
      NULL::TEXT,
      text_fingerprint,
      title,
      status,
      source_metadata,
      source_metadata,
      first_seen_at,
      last_seen_at
    FROM legislative_documents
    ON CONFLICT (source_name, source_record_id) DO NOTHING;

    UPDATE document_sources s
       SET source_title = COALESCE(s.source_title, d.title),
           source_status = COALESCE(s.source_status, d.status),
           source_metadata = CASE
             WHEN s.source_metadata = '{}'::jsonb THEN s.raw_metadata
             ELSE s.source_metadata
           END
      FROM legislative_documents d
     WHERE d.id = s.document_id
       AND (
         s.source_title IS NULL
         OR (s.source_status IS NULL AND d.status IS NOT NULL)
         OR s.source_metadata = '{}'::jsonb
       );

    CREATE TABLE IF NOT EXISTS document_relationships (
      id BIGSERIAL PRIMARY KEY,
      from_document_id BIGINT NOT NULL
        REFERENCES legislative_documents(id) ON DELETE CASCADE,
      to_document_id BIGINT NOT NULL
        REFERENCES legislative_documents(id) ON DELETE CASCADE,
      relationship_type TEXT NOT NULL,
      source_name TEXT,
      source_url TEXT,
      confidence NUMERIC(5, 4),
      metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
      metadata_json JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (from_document_id, to_document_id, relationship_type)
    );

    CREATE INDEX IF NOT EXISTS document_relationships_from_idx
      ON document_relationships (from_document_id, relationship_type);

    CREATE INDEX IF NOT EXISTS document_relationships_to_idx
      ON document_relationships (to_document_id, relationship_type);

    ALTER TABLE document_relationships
      ADD COLUMN IF NOT EXISTS source_url TEXT,
      ADD COLUMN IF NOT EXISTS metadata_json JSONB NOT NULL DEFAULT '{}'::jsonb;

    UPDATE document_relationships
       SET metadata_json = metadata
     WHERE metadata_json = '{}'::jsonb
       AND metadata <> '{}'::jsonb;

    CREATE TABLE IF NOT EXISTS catalog_match_reviews (
      id BIGSERIAL PRIMARY KEY,
      incoming_source_name TEXT NOT NULL,
      incoming_source_record_id TEXT NOT NULL,
      candidate_document_id BIGINT NOT NULL
        REFERENCES legislative_documents(id) ON DELETE CASCADE,
      similarity NUMERIC(5, 4) NOT NULL,
      incoming_record JSONB NOT NULL DEFAULT '{}'::jsonb,
      status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'accepted', 'rejected')),
      reviewed_by TEXT,
      reviewed_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (
        incoming_source_name,
        incoming_source_record_id,
        candidate_document_id
      )
    );

    CREATE INDEX IF NOT EXISTS catalog_match_reviews_pending_idx
      ON catalog_match_reviews (status, similarity DESC);

    CREATE TABLE IF NOT EXISTS intelligence_events (
      id BIGSERIAL PRIMARY KEY,
      event_key TEXT UNIQUE,
      event_type TEXT NOT NULL,
      title TEXT NOT NULL,
      summary TEXT,
      document_id BIGINT
        REFERENCES legislative_documents(id) ON DELETE SET NULL,
      source_name TEXT NOT NULL,
      source_url TEXT,
      document_type TEXT,
      jurisdiction TEXT,
      authority TEXT,
      ministry TEXT,
      category TEXT,
      status TEXT,
      event_date DATE,
      importance_score NUMERIC(6, 2) NOT NULL DEFAULT 50,
      metadata_json JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      first_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS intelligence_events_feed_idx
      ON intelligence_events (
        importance_score DESC,
        event_date DESC NULLS LAST,
        created_at DESC
      );

    CREATE INDEX IF NOT EXISTS intelligence_events_document_idx
      ON intelligence_events (document_id, event_type);

    CREATE TABLE IF NOT EXISTS user_activity_events (
      id BIGSERIAL PRIMARY KEY,
      user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      event_type TEXT NOT NULL CHECK (
        event_type IN (
          'login',
          'logout',
          'dashboard_viewed',
          'document_opened',
          'bill_opened',
          'act_opened',
          'search_performed',
          'filter_used',
          'chat_started',
          'chat_message_sent',
          'summary_viewed',
          'source_opened',
          'profile_viewed',
          'research_continued',
          'export_clicked'
        )
      ),
      entity_type TEXT,
      entity_id TEXT,
      document_id BIGINT
        REFERENCES legislative_documents(id) ON DELETE SET NULL,
      session_id TEXT,
      page_path TEXT,
      referrer TEXT,
      search_query TEXT,
      filters_json JSONB NOT NULL DEFAULT '{}'::jsonb,
      metadata_json JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS user_activity_events_user_recent_idx
      ON user_activity_events (user_id, created_at DESC);

    CREATE INDEX IF NOT EXISTS user_activity_events_document_idx
      ON user_activity_events (document_id, created_at DESC)
      WHERE document_id IS NOT NULL;

    DELETE FROM user_activity_events
      WHERE event_type = 'watchlist_placeholder_clicked';

    ALTER TABLE user_activity_events
      DROP CONSTRAINT IF EXISTS user_activity_events_event_type_check;

    ALTER TABLE user_activity_events
      ADD CONSTRAINT user_activity_events_event_type_check CHECK (
        event_type IN (
          'login',
          'logout',
          'dashboard_viewed',
          'document_opened',
          'bill_opened',
          'act_opened',
          'search_performed',
          'filter_used',
          'chat_started',
          'chat_message_sent',
          'summary_viewed',
          'source_opened',
          'profile_viewed',
          'research_continued',
          'export_clicked'
        )
      );

    CREATE TABLE IF NOT EXISTS contact_requests (
      id BIGSERIAL PRIMARY KEY,
      first_name TEXT NOT NULL,
      last_name TEXT,
      organization TEXT,
      email TEXT NOT NULL,
      phone TEXT,
      message TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'new' CHECK (
        status IN ('new', 'reviewed', 'closed')
      ),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS contact_requests_recent_idx
      ON contact_requests (created_at DESC);

    CREATE INDEX IF NOT EXISTS user_activity_events_type_idx
      ON user_activity_events (event_type, created_at DESC);

    CREATE TABLE IF NOT EXISTS user_research_preferences (
      user_id BIGINT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      preferred_topics_json JSONB NOT NULL DEFAULT '[]'::jsonb,
      preferred_jurisdictions_json JSONB NOT NULL DEFAULT '[]'::jsonb,
      preferred_document_types_json JSONB NOT NULL DEFAULT '[]'::jsonb,
      frequently_viewed_ministries_json JSONB NOT NULL DEFAULT '[]'::jsonb,
      activity_tracking_enabled BOOLEAN NOT NULL DEFAULT FALSE,
      personalization_enabled BOOLEAN NOT NULL DEFAULT FALSE,
      consented_at TIMESTAMPTZ,
      revoked_at TIMESTAMPTZ,
      last_active_at TIMESTAMPTZ,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    INSERT INTO document_chats (
      user_id, document_type, document_id, document_title, status, pdf_url,
      summary, messages, last_message_at, last_accessed_at, is_active,
      created_at, updated_at
    )
    SELECT
      user_id, 'bill', bill_id, bill_title, bill_status, pdf_url,
      summary, messages, last_message_at, updated_at, is_active,
      created_at, updated_at
    FROM bill_chats
    ON CONFLICT (user_id, document_type, document_id) DO NOTHING;

    INSERT INTO document_chats (
      user_id, document_type, document_id, document_title, status, pdf_url,
      summary, messages, last_message_at, last_accessed_at, is_active,
      created_at, updated_at
    )
    SELECT
      user_id, 'act', act_id, act_title, act_status, pdf_url,
      summary, messages, updated_at, updated_at, is_active,
      created_at, updated_at
    FROM act_chats
    ON CONFLICT (user_id, document_type, document_id) DO NOTHING;

    INSERT INTO document_chats (
      user_id, document_type, document_id, document_title, status, pdf_url,
      source_url, summary, messages, metadata_json, last_message_at,
      last_accessed_at, is_active, created_at, updated_at
    )
    SELECT
      user_id, 'gazette', gazette_id, gazette_title, status, pdf_url,
      source_url, summary, messages, metadata_json, last_message_at,
      last_accessed_at, is_active, created_at, updated_at
    FROM egazette_chats
    ON CONFLICT (user_id, document_type, document_id) DO NOTHING;

    CREATE TABLE IF NOT EXISTS user_document_interactions (
      id BIGSERIAL PRIMARY KEY,
      user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      document_id BIGINT NOT NULL
        REFERENCES legislative_documents(id) ON DELETE CASCADE,
      interaction_type TEXT NOT NULL,
      count INTEGER NOT NULL DEFAULT 1 CHECK (count > 0),
      last_interacted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      metadata_json JSONB NOT NULL DEFAULT '{}'::jsonb,
      UNIQUE (user_id, document_id, interaction_type)
    );

    CREATE INDEX IF NOT EXISTS user_document_interactions_user_recent_idx
      ON user_document_interactions (user_id, last_interacted_at DESC);

    CREATE INDEX IF NOT EXISTS user_document_interactions_document_idx
      ON user_document_interactions (document_id, last_interacted_at DESC);

    INSERT INTO intelligence_events (
      event_key,
      event_type,
      title,
      document_id,
      source_name,
      source_url,
      document_type,
      jurisdiction,
      authority,
      ministry,
      category,
      status,
      event_date,
      importance_score,
      metadata_json,
      first_seen_at,
      last_seen_at
    )
    SELECT
      'catalog:' || d.canonical_id || ':' ||
        CASE
          WHEN d.canonical_source = 'egazette'
            THEN 'gazette_notification'
          WHEN d.document_type = 'act'
            THEN 'act_published'
          ELSE 'document_added'
        END,
      CASE
        WHEN d.canonical_source = 'egazette'
          THEN 'gazette_notification'
        WHEN d.document_type = 'act'
          THEN 'act_published'
        ELSE 'document_added'
      END,
      d.title,
      d.id,
      d.canonical_source,
      COALESCE(d.canonical_url, d.detail_url, d.source_url),
      d.document_type,
      d.jurisdiction,
      d.authority,
      d.ministry,
      d.category,
      d.status,
      COALESCE(
        d.publication_date,
        d.enacted_date,
        d.introduced_date,
        d.first_seen_at::DATE
      ),
      CASE
        WHEN d.canonical_source = 'egazette' THEN 90
        WHEN d.canonical_source = 'india-code' THEN 80
        ELSE 50
      END,
      JSONB_BUILD_OBJECT('origin', 'canonical-catalog-backfill'),
      d.first_seen_at,
      d.last_seen_at
    FROM legislative_documents d
    WHERE d.canonical_source IN ('egazette', 'india-code')
    ON CONFLICT (event_key) DO NOTHING;

    ALTER TABLE ingestion_runs
      ADD COLUMN IF NOT EXISTS collection_name TEXT,
      ADD COLUMN IF NOT EXISTS counters_json JSONB NOT NULL DEFAULT '{}'::jsonb,
      ADD COLUMN IF NOT EXISTS errors_json JSONB NOT NULL DEFAULT '[]'::jsonb;

    ALTER TABLE source_collection_snapshots
      ADD COLUMN IF NOT EXISTS html_hash TEXT,
      ADD COLUMN IF NOT EXISTS response_status INTEGER,
      ADD COLUMN IF NOT EXISTS collected_at TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS metadata_json JSONB NOT NULL DEFAULT '{}'::jsonb;

    UPDATE source_collection_snapshots
       SET html_hash = COALESCE(html_hash, content_sha256),
           collected_at = COALESCE(collected_at, fetched_at),
           metadata_json = metadata_json || metadata
     WHERE html_hash IS NULL
        OR collected_at IS NULL
        OR metadata_json = '{}'::jsonb;
    `);
    await client.query(
      `INSERT INTO application_schema_versions (id, version)
       VALUES (1, $1)
       ON CONFLICT (id) DO UPDATE SET
         version = EXCLUDED.version,
         updated_at = NOW()`,
      [SCHEMA_VERSION],
    );
  } finally {
    await client
      .query("SELECT pg_advisory_unlock($1)", [SCHEMA_LOCK_KEY])
      .catch(() => undefined);
    client.release();
  }
};

const connectDB = async () => {
  if (!globalForDatabase.__rashtramSchemaPromise) {
    globalForDatabase.__rashtramSchemaPromise = initializeSchema().catch((error) => {
      globalForDatabase.__rashtramSchemaPromise = null;
      throw error;
    });
  }

  return globalForDatabase.__rashtramSchemaPromise;
};

const query = async (text, params = []) => {
  await connectDB();
  return getPool().query(text, params);
};

module.exports = {
  connectDB,
  getPool,
  query,
};
