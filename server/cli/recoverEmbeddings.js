#!/usr/bin/env node

const path = require("node:path");
require("dotenv").config({
  path: process.env.ENV_FILE || path.resolve(__dirname, "../.env.local"),
});

const { argumentFlag, argumentInteger, argumentValue } = require("./cliArgs");

const providerOverride = argumentValue("provider");
const modelOverride = argumentValue("model");
if (providerOverride) process.env.EMBEDDING_PROVIDER = String(providerOverride);
if (modelOverride) {
  const provider = String(providerOverride || process.env.EMBEDDING_PROVIDER || "")
    .trim()
    .toLowerCase();
  if (provider === "gemini" || process.env.AI_PROVIDER === "gemini") {
    process.env.GEMINI_EMBEDDING_MODEL = String(modelOverride);
  } else if (provider === "local") {
    process.env.EMBEDDING_PROVIDER = "local";
  } else {
    process.env.OPENAI_EMBEDDING_MODEL = String(modelOverride);
  }
}

const { getPool, query } = require("../db");
const {
  estimateEmbeddingTokens,
  providerConfig,
  storeActContentInChunks,
  storeBillContentInChunks,
  storeEGazetteContentInChunks,
  storePolicyContentInChunks,
} = require("../lib/vectordb");
const {
  normalizeDocumentType,
  retrievalFamilyForType,
} = require("../document/documentTypes");

const storeByFamily = {
  act: storeActContentInChunks,
  bill: storeBillContentInChunks,
  gazette: storeEGazetteContentInChunks,
  policy: storePolicyContentInChunks,
};

const idKeyByFamily = {
  act: "actId",
  bill: "billId",
  gazette: "gazetteId",
  policy: "policyId",
};

const usage = () => {
  console.log(`Usage:
  npm run embeddings:recover -- --limit=25 [--document-id=123] [--source=prsindia]
    [--provider=gemini|openai|local] [--model=...] [--only-missing]
    [--only-stale] [--all] [--dry-run] [--time-limit=600] [--cost-limit=0.25]

Notes:
  --limit counts documents, not chunks.
  By default, recovery targets chunks with missing or stale embedding metadata.
  Remote provider fallback is controlled by EMBEDDING_FALLBACK_PROVIDER, not this command.`);
};

const escapeLike = (value) => String(value).replace(/[\\%_]/g, "\\$&");

const buildDocumentWhere = ({ documentId, source, documentType, all, onlyMissing, onlyStale, config }) => {
  const clauses = [
    "document.visibility_status = 'public'",
    "EXISTS (SELECT 1 FROM document_text_chunks chunk WHERE chunk.document_id = document.id)",
  ];
  const params = [];
  const add = (value) => {
    params.push(value);
    return `$${params.length}`;
  };

  if (documentId) clauses.push(`document.id = ${add(String(documentId))}`);
  if (documentType) clauses.push(`document.document_type = ${add(String(documentType))}`);
  if (source) {
    const pattern = `%${escapeLike(source)}%`;
    clauses.push(`(
      COALESCE(legacy.canonical_source, '') ILIKE ${add(pattern)} ESCAPE '\\'
      OR COALESCE(legacy.source_name, '') ILIKE ${add(pattern)} ESCAPE '\\'
      OR COALESCE(legacy.canonical_url, '') ILIKE ${add(pattern)} ESCAPE '\\'
      OR COALESCE(legacy.pdf_url, '') ILIKE ${add(pattern)} ESCAPE '\\'
    )`);
  }

  if (!all) {
    const chunkPredicates = [];
    if (onlyMissing || (!onlyMissing && !onlyStale)) {
      chunkPredicates.push("(chunk.vector_reference IS NULL OR chunk.vector_reference = '')");
    }
    if (onlyStale || (!onlyMissing && !onlyStale)) {
      chunkPredicates.push(`(
        COALESCE(chunk.metadata_json->>'embeddingProvider', '') <> ${add(config.embeddingProvider)}
        OR COALESCE(chunk.metadata_json->>'embeddingModel', '') <> ${add(config.embeddingModel)}
        OR COALESCE(chunk.metadata_json->>'embeddingDimension', '') <> ${add(String(config.embeddingDimension))}
      )`);
    }
    clauses.push(`EXISTS (
      SELECT 1
      FROM document_text_chunks chunk
      WHERE chunk.document_id = document.id
        AND (${chunkPredicates.join(" OR ")})
    )`);
  }

  return { where: clauses.join("\n    AND "), params };
};

const loadCandidateDocuments = async (options) => {
  const config = providerConfig();
  const { where, params } = buildDocumentWhere({ ...options, config });
  params.push(options.limit);
  const result = await query(
    `SELECT
       document.id,
       document.document_type,
       document.title,
       COALESCE(legacy.canonical_source, legacy.source_name, 'unknown') AS source,
       COUNT(chunk.id)::INTEGER AS chunks_count,
       COALESCE(SUM(chunk.token_count), 0)::INTEGER AS stored_tokens
     FROM documents document
     JOIN legislative_documents legacy ON legacy.id = document.id
     JOIN document_text_chunks chunk ON chunk.document_id = document.id
     WHERE ${where}
     GROUP BY document.id, document.document_type, document.title, source
     ORDER BY document.source_authority_tier ASC NULLS LAST, document.id
     LIMIT $${params.length}`,
    params,
  );
  return result.rows;
};

const loadChunks = async (documentId) => {
  const result = await query(
    `SELECT chunk_index, original_text, translated_text, language, vector_reference, metadata_json
     FROM document_text_chunks
     WHERE document_id = $1
     ORDER BY chunk_index ASC`,
    [documentId],
  );
  return result.rows;
};

const markRecovered = async ({ documentId, chunksCount, config }) => {
  const embeddingStatus = config.embeddingProvider === "local" ? "fallback" : "ready";
  const retrievalMode = config.embeddingProvider === "local" ? "hybrid" : "vector";
  await query(
    `UPDATE document_text_chunks
     SET metadata_json = metadata_json
       || jsonb_build_object(
         'embeddingProvider', $2::TEXT,
         'embeddingModel', $3::TEXT,
         'embeddingDimension', $4::TEXT,
         'vectorNamespace', $5::TEXT,
         'embeddingRecoveredAt', NOW()
       ),
       updated_at = NOW()
     WHERE document_id = $1`,
    [
      documentId,
      config.embeddingProvider,
      config.embeddingModel,
      String(config.embeddingDimension),
      process.env.PINECONE_NAMESPACE || "",
    ],
  );
  await query(
    `UPDATE document_processing_state
     SET embedding_status = $2,
         embeddings_count = $3,
         retrieval_mode = $4,
         retrieval_verified = TRUE,
         retrieval_verified_at = NOW(),
         last_processed_at = NOW(),
         updated_at = NOW()
     WHERE document_id = $1`,
    [documentId, embeddingStatus, chunksCount, retrievalMode],
  );
};

const recoverDocument = async ({ document, dryRun, config }) => {
  const family = retrievalFamilyForType(normalizeDocumentType(document.document_type));
  const store = storeByFamily[family];
  if (!store) {
    return {
      documentId: String(document.id),
      status: "skipped",
      reason: `Unsupported retrieval family: ${family}`,
    };
  }

  const rows = await loadChunks(document.id);
  const tokenEstimate = rows.reduce(
    (sum, row) => sum + estimateEmbeddingTokens(row.translated_text || row.original_text),
    0,
  );
  if (dryRun) {
    return {
      documentId: String(document.id),
      title: document.title,
      family,
      status: "dry_run",
      chunks: rows.length,
      estimatedTokens: tokenEstimate,
    };
  }

  const idKey = idKeyByFamily[family];
  const chunks = rows.map((row, index) => ({
    id:
      row.vector_reference ||
      `${family}-${document.id}-chunk-${row.chunk_index ?? index}`,
    [idKey]: document.id,
    documentId: document.id,
    title: document.title,
    content: row.original_text,
    translatedText: row.translated_text || null,
    embeddingText: row.translated_text || row.original_text,
    chunkIndex: Number(row.chunk_index ?? index),
    totalChunks: rows.length,
    metadata: {
      ...(row.metadata_json || {}),
      documentId: String(document.id),
      documentType: document.document_type,
      languageCode: row.language || "und",
      embeddingProvider: config.embeddingProvider,
      embeddingModel: config.embeddingModel,
      embeddingDimension: String(config.embeddingDimension),
    },
  }));
  const stored = await store(chunks);
  await markRecovered({
    documentId: document.id,
    chunksCount: rows.length,
    config,
  });
  return {
    documentId: String(document.id),
    title: document.title,
    family,
    status: "recovered",
    chunks: rows.length,
    estimatedTokens: tokenEstimate,
    metrics: stored.metrics,
  };
};

const main = async () => {
  if (argumentFlag("help")) {
    usage();
    return;
  }

  const options = {
    limit: argumentInteger("limit", 10, 1, 250),
    documentId: argumentValue("document-id"),
    source: argumentValue("source"),
    documentType: argumentValue("document-type"),
    onlyMissing: argumentFlag("only-missing"),
    onlyStale: argumentFlag("only-stale"),
    all: argumentFlag("all"),
  };
  const dryRun = argumentFlag("dry-run");
  const timeLimitSeconds = argumentInteger("time-limit", 0, 0, 86_400);
  const costLimit = Number(argumentValue("cost-limit", 0));
  const costPerThousandTokens = Number(
    process.env.EMBEDDING_RECOVERY_COST_PER_1K_TOKENS || 0,
  );
  const startedAt = Date.now();
  const config = providerConfig();
  const candidates = await loadCandidateDocuments(options);
  const results = [];
  let estimatedCostUsd = 0;

  for (const document of candidates) {
    if (
      timeLimitSeconds > 0 &&
      Date.now() - startedAt > timeLimitSeconds * 1000
    ) {
      results.push({ status: "stopped", reason: "time_limit_reached" });
      break;
    }
    const chunks = await loadChunks(document.id);
    const estimatedTokens = chunks.reduce(
      (sum, row) => sum + estimateEmbeddingTokens(row.translated_text || row.original_text),
      0,
    );
    const nextCost = costPerThousandTokens
      ? (estimatedTokens / 1000) * costPerThousandTokens
      : 0;
    if (costLimit > 0 && estimatedCostUsd + nextCost > costLimit) {
      results.push({
        documentId: String(document.id),
        status: "skipped",
        reason: "cost_limit_would_be_exceeded",
        estimatedCostUsd: Number(nextCost.toFixed(6)),
      });
      continue;
    }
    estimatedCostUsd += nextCost;
    results.push(await recoverDocument({ document, dryRun, config }));
  }

  console.log(JSON.stringify({
    generatedAt: new Date().toISOString(),
    dryRun,
    provider: config.embeddingProvider,
    model: config.embeddingModel,
    fallbackProvider: config.embeddingFallbackProvider,
    candidates: candidates.length,
    processed: results.filter((item) => ["recovered", "dry_run"].includes(item.status)).length,
    estimatedCostUsd: Number(estimatedCostUsd.toFixed(6)),
    results,
  }, null, 2));
};

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await getPool().end();
  });
