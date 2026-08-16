const crypto = require("node:crypto");
const { query } = require("../db");

const PROCESSING_STAGES = Object.freeze([
  "DISCOVERED",
  "RESOURCE_VERIFIED",
  "FETCH",
  "EXTRACT",
  "OCR",
  "NORMALIZE",
  "CHUNK",
  "FTS_INDEX",
  "EMBED",
  "VECTOR_INDEX",
  "RETRIEVAL_VERIFY",
  "READY",
]);

const PROCESSOR_VERSION =
  process.env.PROCESSING_PIPELINE_VERSION ||
  process.env.VERCEL_GIT_COMMIT_SHA ||
  "research-engine-v3-phase-1";

const sha256 = (value) => crypto
  .createHash("sha256")
  .update(Buffer.isBuffer(value) ? value : String(value || ""))
  .digest("hex");

const shouldReuseStage = (stageState, inputHash, processorVersion = PROCESSOR_VERSION) =>
  Boolean(
    stageState &&
    ["completed", "skipped"].includes(stageState.status) &&
    stageState.input_hash === (inputHash || null) &&
    stageState.processor_version === processorVersion,
  );

const pendingStages = (
  stageStates,
  stageInputs = {},
  processorVersion = PROCESSOR_VERSION,
) => {
  const byStage = new Map((stageStates || []).map((item) => [item.stage, item]));
  return PROCESSING_STAGES.filter((stage) =>
    !shouldReuseStage(byStage.get(stage), stageInputs[stage] || null, processorVersion));
};

const deriveCapabilities = ({
  catalogued = true,
  resourceReady = false,
  textReady = false,
  chunksCount = 0,
  lexicalReady = false,
  semanticReady = false,
  retrievalVerified = false,
  comparisonEligible = true,
} = {}) => {
  const hasChunks = Number(chunksCount || 0) > 0;
  const searchReady = Boolean(textReady && hasChunks && lexicalReady);
  const chatReady = Boolean(searchReady && retrievalVerified);
  return {
    catalogued: Boolean(catalogued),
    resourceReady: Boolean(resourceReady),
    textReady: Boolean(textReady),
    searchReady,
    semanticReady: Boolean(semanticReady && hasChunks),
    chatReady,
    comparisonReady: Boolean(chatReady && comparisonEligible),
  };
};

const stageForPipelineFailure = (value) => {
  const stage = String(value || "processing").toLowerCase();
  if (/source|resource/.test(stage)) return "RESOURCE_VERIFIED";
  if (/download|fetch|pdf/.test(stage)) return "FETCH";
  if (/ocr/.test(stage)) return "OCR";
  if (/extract/.test(stage)) return "EXTRACT";
  if (/normal/.test(stage)) return "NORMALIZE";
  if (/chunk/.test(stage)) return "CHUNK";
  if (/fts|lexical/.test(stage)) return "FTS_INDEX";
  if (/embed/.test(stage)) return "EMBED";
  if (/vector|pinecone/.test(stage)) return "VECTOR_INDEX";
  if (/retriev/.test(stage)) return "RETRIEVAL_VERIFY";
  return "READY";
};

const recordStage = async ({
  documentId,
  jobId = null,
  stage,
  status,
  inputHash = null,
  outputHash = null,
  processorVersion = PROCESSOR_VERSION,
  durationMs = null,
  failureCategory = null,
  failureReason = null,
  retryable = true,
  metadata = {},
}) => {
  if (!PROCESSING_STAGES.includes(stage)) {
    throw new Error(`Unknown document processing stage: ${stage}`);
  }
  const result = await query(
    `INSERT INTO document_processing_stages (
       document_id, job_id, stage, status, attempt_count,
       failure_category, failure_reason, retryable,
       input_hash, output_hash, processor_version, duration_ms,
       metadata_json, started_at, completed_at
     ) VALUES (
       $1, $2, $3, $4, CASE WHEN $4 = 'running' THEN 1 ELSE 0 END,
       $5, $6, $7, $8, $9, $10, $11, $12::jsonb,
       CASE WHEN $4 = 'running' THEN NOW() END,
       CASE WHEN $4 IN ('completed', 'skipped', 'failed') THEN NOW() END
     )
     ON CONFLICT (document_id, stage) DO UPDATE SET
       job_id = COALESCE(EXCLUDED.job_id, document_processing_stages.job_id),
       status = EXCLUDED.status,
       attempt_count = document_processing_stages.attempt_count +
         CASE WHEN EXCLUDED.status = 'running' THEN 1 ELSE 0 END,
       failure_category = EXCLUDED.failure_category,
       failure_reason = EXCLUDED.failure_reason,
       retryable = EXCLUDED.retryable,
       input_hash = EXCLUDED.input_hash,
       output_hash = EXCLUDED.output_hash,
       processor_version = EXCLUDED.processor_version,
       duration_ms = EXCLUDED.duration_ms,
       metadata_json = document_processing_stages.metadata_json || EXCLUDED.metadata_json,
       started_at = CASE
         WHEN EXCLUDED.status = 'running' THEN NOW()
         ELSE document_processing_stages.started_at
       END,
       completed_at = CASE
         WHEN EXCLUDED.status IN ('completed', 'skipped', 'failed') THEN NOW()
         ELSE NULL
       END,
       updated_at = NOW()
     RETURNING *`,
    [
      documentId,
      jobId,
      stage,
      status,
      failureCategory,
      failureReason,
      Boolean(retryable),
      inputHash,
      outputHash,
      processorVersion,
      durationMs == null ? null : Math.max(0, Math.round(durationMs)),
      JSON.stringify(metadata || {}),
    ],
  );
  return result.rows[0];
};

const recordCompletedPipeline = async ({ documentId, jobId, result }) => {
  const metrics = result.stageMetrics || {};
  const artifact = result.textArtifact || {};
  const resourceHash = metrics.downloadChecksumSha256 || null;
  const textHash = artifact.extractedTextSha256 || result.extractedTextSha256 || null;
  const vectorFailed = Boolean(metrics.vectorStorageFailed);
  const ocrUsed = Boolean(artifact.ocrUsed || result.ocrUsed);
  const stages = [
    ["DISCOVERED", "completed", null, null],
    ["RESOURCE_VERIFIED", "completed", resourceHash, resourceHash],
    ["FETCH", "completed", resourceHash, resourceHash],
    ["EXTRACT", "completed", resourceHash, textHash],
    ["OCR", ocrUsed ? "completed" : "skipped", resourceHash, textHash],
    ["NORMALIZE", "completed", textHash, textHash],
    ["CHUNK", "completed", textHash, result.chunkSetSha256 || null],
    ["FTS_INDEX", "completed", result.chunkSetSha256 || textHash, result.chunkSetSha256 || textHash],
    ["EMBED", vectorFailed ? "failed" : "completed", result.embeddingInputSha256 || null, result.embeddingInputSha256 || null],
    ["VECTOR_INDEX", vectorFailed ? "failed" : "completed", result.embeddingInputSha256 || null, result.embeddingInputSha256 || null],
    ["RETRIEVAL_VERIFY", "completed", result.chunkSetSha256 || textHash, result.chunkSetSha256 || textHash],
    ["READY", "completed", result.chunkSetSha256 || textHash, result.chunkSetSha256 || textHash],
  ];
  for (const [stage, status, inputHash, outputHash] of stages) {
    await recordStage({
      documentId,
      jobId,
      stage,
      status,
      inputHash,
      outputHash,
      retryable: status === "failed",
      failureCategory: status === "failed" ? "semantic_retrieval_deferred" : null,
      failureReason: status === "failed"
        ? "Semantic indexing was unavailable; PostgreSQL lexical retrieval remains ready."
        : null,
      durationMs: metrics[`${stage.toLowerCase()}Ms`] || null,
      metadata: stage === "OCR" ? {
        pageLevel: Boolean(result.pdfQuality?.pageExtraction),
        pages: result.pdfQuality?.pageExtraction || [],
      } : {},
    });
  }
};

const syncCapabilities = async (documentId, capabilities = {}) => {
  const values = {
    catalogued: Boolean(capabilities.catalogued),
    resourceReady: Boolean(capabilities.resourceReady),
    textReady: Boolean(capabilities.textReady),
    searchReady: Boolean(capabilities.searchReady),
    semanticReady: Boolean(capabilities.semanticReady),
    chatReady: Boolean(capabilities.chatReady),
    comparisonReady: Boolean(capabilities.comparisonReady),
  };
  await query(
    `UPDATE document_processing_state SET
       catalogued = $2,
       resource_ready = $3,
       text_ready = $4,
       search_ready = $5,
       semantic_ready = $6,
       chat_ready = $7,
       capability_comparison_ready = $8,
       capabilities_updated_at = NOW(),
       updated_at = NOW()
     WHERE document_id = $1`,
    [
      documentId,
      values.catalogued,
      values.resourceReady,
      values.textReady,
      values.searchReady,
      values.semanticReady,
      values.chatReady,
      values.comparisonReady,
    ],
  );
  return values;
};

module.exports = {
  PROCESSING_STAGES,
  PROCESSOR_VERSION,
  deriveCapabilities,
  pendingStages,
  recordCompletedPipeline,
  recordStage,
  sha256,
  shouldReuseStage,
  stageForPipelineFailure,
  syncCapabilities,
};
