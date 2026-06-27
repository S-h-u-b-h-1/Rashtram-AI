const { Pool } = require("pg");
require("dotenv").config();

const globalForDatabase = globalThis;

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

  await pool.query(`
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
  `);
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
