// Read-only audit: deliberately uses a direct pool and bypasses app startup
// migrations. No ingestion, user impersonation, paid generation or persistence.
const fs = require("node:fs");
const { Pool } = require("pg");
const { poolConfig } = require("../lib/database/connectionConfig");
const envPath = process.argv[2];
if (envPath) Object.assign(process.env, require("dotenv").parse(fs.readFileSync(envPath)));
const pool = new Pool(poolConfig(process.env.DATABASE_URL));
require.cache[require.resolve("../db")] = { exports: { getPool: () => pool, query: (sql, params) => pool.query(sql, params), connectDB: async () => {} } };
const { getProblemRecommendations } = require("../document/recommendationService");
const cases = [
  "Start a digital lending platform in India",
  "Battery recycling manufacturing in Gujarat",
  "SaaS business data protection compliance in India",
  "Food manufacturing and packaging business in Maharashtra",
  "Start a manufacturing factory in Tamil Nadu",
];
(async () => {
  const catalogue = (await pool.query("SELECT COUNT(*)::int AS total, COUNT(*) FILTER (WHERE research_ready)::int AS ready FROM documents")).rows[0];
  const results = [];
  for (const problem of cases) {
    const result = await getProblemRecommendations(null, { problem, limit: 20 });
    results.push({ problem, timings: result.timings, coverageClass: result.coverageClass,
      sources: result.discoveryCandidates.map(({ id, title, score, authorityClass, researchReady, priority }) => ({ id, title, score, authorityClass, researchReady, priority })) });
  }
  console.log(JSON.stringify({ auditedAt: new Date().toISOString(), catalogue, results }, null, 2));
})().catch((error) => { console.error(error.message); process.exitCode = 1; }).finally(() => pool.end());
