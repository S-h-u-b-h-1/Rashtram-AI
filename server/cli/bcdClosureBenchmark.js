// Bounded, read-only B/C/D closure benchmark. This intentionally bypasses app
// startup migrations and uses no authenticated user, so recommendation history
// cannot be persisted. Output contains catalogue metadata only.
const fs = require("node:fs");
const { Pool } = require("pg");
const { poolConfig } = require("../lib/database/connectionConfig");

const [envPath, casesPath, maximumRaw = "30", outputPath, selector = "all"] = process.argv.slice(2);
if (!envPath || !casesPath) throw new Error("Usage: node bcdClosureBenchmark.js ENV CASES [MAX]");
Object.assign(process.env, require("dotenv").parse(fs.readFileSync(envPath)));
const pool = new Pool(poolConfig(process.env.DATABASE_URL));
require.cache[require.resolve("../db")] = {
  exports: {
    getPool: () => pool,
    query: (sql, params) => pool.query(sql, params),
    connectDB: async () => {},
  },
};
const { getProblemRecommendations } = require("../document/recommendationService");

const maximum = Math.max(1, Math.min(60, Number.parseInt(maximumRaw, 10) || 30));
const allCases = JSON.parse(fs.readFileSync(casesPath, "utf8"));
const selectedCases = selector === "negative"
  ? allCases.filter((item) => String(item.id || "").startsWith("N"))
  : selector === "positive"
    ? allCases.filter((item) => String(item.id || "").startsWith("P"))
    : allCases;
const cases = selectedCases.slice(0, maximum);

(async () => {
  const results = [];
  for (const item of cases) {
    const result = await getProblemRecommendations(null, {
      problem: item.problem,
      limit: 10,
    });
    results.push({
      id: item.id,
      category: item.category,
      expectedAuthority: item.expectedAuthority || null,
      premise: result.premise,
      interpretation: result.interpretation,
      timings: result.timings,
      candidates: result.discoveryCandidates.slice(0, 5).map((candidate) => ({
        id: candidate.id,
        title: candidate.title,
        authority: candidate.authority || candidate.ministry || candidate.sourceName || null,
        authorityClass: candidate.authorityClass,
        jurisdiction: candidate.jurisdiction,
        researchReady: candidate.researchReady,
        canPrepare: candidate.canPrepare,
        relevanceTier: candidate.relevanceTier,
        score: candidate.score,
      })),
      abstention: result.abstention,
    });
  }
  const output = `${JSON.stringify({ auditedAt: new Date().toISOString(), results }, null, 2)}\n`;
  if (outputPath) fs.writeFileSync(outputPath, output, { mode: 0o600 });
  else process.stdout.write(output);
})().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
}).finally(() => pool.end());
