require("dotenv").config({
  path: process.env.ENV_FILE || require("path").join(__dirname, "../.env.local"),
});
const {
  discoverRelationshipBatch,
} = require("../graph/relationshipEngine");
const { getPool } = require("../db");

const value = (name, fallback) => {
  const argument = process.argv.find((item) => item.startsWith(`--${name}=`));
  return argument ? argument.slice(name.length + 3) : fallback;
};

const main = async () => {
  const result = await discoverRelationshipBatch({
    limit: value("limit", 100),
    offset: value("offset", 0),
    verifyWithAI: value("verify-ai", "true") !== "false",
    concurrency: value("concurrency", 5),
  });
  console.log(JSON.stringify({
    documentsProcessed: result.documentsProcessed,
    relationshipsStored: result.relationshipsStored,
  }, null, 2));
};

main()
  .catch((error) => {
    console.error("Relationship discovery failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    if (globalThis.__rashtramPostgresPool) await getPool().end();
  });
