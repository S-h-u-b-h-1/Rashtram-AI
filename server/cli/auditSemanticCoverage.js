#!/usr/bin/env node

const path = require("node:path");
require("dotenv").config({
  path: process.env.ENV_FILE || path.resolve(__dirname, "../.env.local"),
});

const { getPool } = require("../db");
const { getSemanticCoverageReport } = require("../document/semanticCoverageService");
const { getActIndex, getIndex, providerConfig } = require("../lib/vectordb");
const { checkVectorNamespaces } = require("../lib/vectorNamespaceHealth");

const main = async () => {
  const config = providerConfig();
  const [coverage, pinecone] = await Promise.all([
    getSemanticCoverageReport({ activeNamespace: config.vectorNamespace }),
    checkVectorNamespaces([
      { name: process.env.PINECONE_INDEX_NAME || "rashtram-bills", index: getIndex() },
      { name: process.env.PINECONE_ACT_INDEX_NAME || "rashtram-acts", index: getActIndex() },
    ], config.vectorNamespace),
  ]);
  const activeVectorChunks = Object.values(pinecone.indexes || {})
    .reduce((sum, index) => sum + Number(index.activeRecords || 0), 0);
  console.log(JSON.stringify({
    generatedAt: new Date().toISOString(),
    embedding: {
      provider: config.embeddingProvider,
      model: config.embeddingModel,
      dimension: config.embeddingDimension,
      activeNamespace: config.vectorNamespace,
    },
    coverage: { ...coverage, activeVectorChunks },
    namespaceConsistency: {
      postgresActiveVectorReferences: coverage.postgresActiveVectorChunks,
      pineconeActiveVectorRecords: activeVectorChunks,
      referenceDelta: coverage.postgresActiveVectorChunks - activeVectorChunks,
      healthy: pinecone.healthy && coverage.postgresActiveVectorChunks === activeVectorChunks,
    },
    pinecone,
  }, null, 2));
};

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
}).finally(async () => getPool().end());
