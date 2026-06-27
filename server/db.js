const { Pool } = require("pg");
require("dotenv").config();

const globalForDatabase = globalThis;

const createPool = () => {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required");
  }

  return new Pool({
    connectionString: process.env.DATABASE_URL,
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
