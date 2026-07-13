require("dotenv").config({
  path: process.env.ENV_FILE || require("path").join(__dirname, "../.env.local"),
});
const { getPool, query } = require("../db");
const { argumentFlag, argumentInteger } = require("./cliArgs");
const DocumentRepository = require("../document/DocumentRepository");
const { pdfProcessor } = require("../lib/pdfProcessor");
const {
  saveNormalizedChunks,
} = require("../document/documentResearchService");
const {
  classifyFailure,
  FAILURE_CODES,
} = require("../document/failureTaxonomy");

const audit = async (documentId, action, previousState, newState, evidence) =>
  query(
    `INSERT INTO document_processing_audit_log (
       document_id, action, previous_state_json, new_state_json,
       evidence_json, performed_by
     )
     VALUES ($1, $2, $3::jsonb, $4::jsonb, $5::jsonb, 'repairProcessingConsistency')`,
    [
      documentId,
      action,
      JSON.stringify(previousState || {}),
      JSON.stringify(newState || {}),
      JSON.stringify(evidence || {}),
    ],
  );

const readyWithoutChunksRows = async (limit) =>
  (await query(
    `SELECT
       document.id, document.document_type, document.title,
       state.processing_status, state.extraction_status,
       state.chunking_status, state.embedding_status,
       state.summary_status, state.chunks_count, state.embeddings_count,
       state.retrieval_verified, state.retrieval_mode,
       state.readiness_class, state.readiness_reason,
       state.extraction_method,
       artifact.original_text, artifact.language_code,
       artifact.extraction_method AS artifact_extraction_method
     FROM documents document
     JOIN document_processing_state state ON state.document_id = document.id
     LEFT JOIN document_text_artifacts artifact ON artifact.document_id = document.id
     WHERE state.processing_status = 'ready'
       AND COALESCE(state.chunks_count, 0) = 0
     ORDER BY document.id
     LIMIT $1`,
    [limit],
  )).rows;

const retryPermanentRows = async (limit) =>
  (await query(
    `SELECT
       document.id, document.document_type, document.title,
       state.processing_status, state.failure_code, state.retry_eligible,
       state.readiness_class, state.failure_reason, state.readiness_reason,
       state.pipeline_stage, state.retry_count
     FROM documents document
     JOIN document_processing_state state ON state.document_id = document.id
     WHERE state.retry_eligible = TRUE
       AND state.readiness_class = 'processing_failed_permanent'
     ORDER BY document.id
     LIMIT $1`,
    [limit],
  )).rows;

const regenerateChunks = async (row, dryRun) => {
  const text = String(row.original_text || "").trim();
  const language = row.language_code || pdfProcessor.detectLanguage(text).languageCode;
  const chunkTexts = pdfProcessor.chunkText(text, undefined, undefined, language);
  const previous = {
    processingStatus: row.processing_status,
    chunksCount: Number(row.chunks_count || 0),
    embeddingsCount: Number(row.embeddings_count || 0),
    retrievalVerified: row.retrieval_verified,
    retrievalMode: row.retrieval_mode,
    readinessClass: row.readiness_class,
  };
  if (!text || !chunkTexts.length) {
    const next = {
      processingStatus: "failed",
      failureCode: FAILURE_CODES.TEXT_EXTRACTION_EMPTY,
      readinessClass: "processing_failed_permanent",
    };
    if (!dryRun) {
      await DocumentRepository.updateProcessingStatus(
        row.id,
        "failed",
        "Stored text artifact is empty; chunks cannot be regenerated.",
        {
          extractionStatus: text ? "ready" : "failed",
          chunkingStatus: "failed",
          embeddingStatus: "not_started",
          summaryStatus: row.summary_status || "not_started",
          chunksCount: 0,
          embeddingsCount: 0,
          retrievalVerified: false,
          retrievalMode: "none",
          failureCode: next.failureCode,
          retryEligible: false,
          pipelineStage: "chunking",
          readinessClass: next.readinessClass,
          readinessReason: "Stored text artifact is empty; chunks cannot be regenerated.",
        },
      );
      await audit(row.id, "ready_without_chunks_demoted", previous, next, {
        reason: "no_valid_text_artifact",
      });
    }
    return { documentId: String(row.id), action: "demote", chunks: 0 };
  }

  const chunks = chunkTexts.map((content, index) => ({
    id: `${row.document_type}-${row.id}-repaired-chunk-${index}`,
    content,
    chunkIndex: index,
    metadata: {
      source: "repairProcessingConsistency",
      documentType: row.document_type,
      title: row.title,
      chunkIndex: index,
      languageCode: language,
      extractionMethod: row.artifact_extraction_method || row.extraction_method,
      repairedAt: new Date().toISOString(),
      retrievalMode: "local_text",
    },
  }));
  const next = {
    processingStatus: "ready",
    chunksCount: chunks.length,
    embeddingStatus: "fallback",
    retrievalMode: "local_text",
    retrievalVerified: true,
  };
  if (!dryRun) {
    await saveNormalizedChunks(row.id, chunks, language);
    await DocumentRepository.updateProcessingStatus(row.id, "ready", null, {
      extractionStatus: "ready",
      chunkingStatus: "ready",
      embeddingStatus: "fallback",
      summaryStatus: row.summary_status || "deferred",
      chunksCount: chunks.length,
      embeddingsCount: 0,
      textLength: text.length,
      language,
      extractionMethod: row.artifact_extraction_method || row.extraction_method,
      retrievalVerified: true,
      retrievalMode: "local_text",
      readinessClass: "comparison_ready",
      readinessReason: null,
      failureCode: null,
      retryEligible: false,
      pipelineStage: "repair",
    });
    await audit(row.id, "ready_without_chunks_rechunked", previous, next, {
      source: "document_text_artifacts.original_text",
      originalTextLength: text.length,
      chunksCreated: chunks.length,
    });
  }
  return {
    documentId: String(row.id),
    action: "rechunk",
    chunks: chunks.length,
    textLength: text.length,
  };
};

const repairRetryPermanent = async (row, dryRun) => {
  const classified = classifyFailure({
    failureCode: row.failure_code,
    failureReason: row.failure_reason || row.readiness_reason,
    processingStatus: row.processing_status,
  });
  let failureCode = classified.failureCode;
  if (
    row.failure_code === FAILURE_CODES.UNKNOWN_PROCESSING_ERROR &&
    /unsupported unicode|unicode escape|invalid unicode|encoding/i.test(
      row.failure_reason || row.readiness_reason || "",
    )
  ) {
    failureCode = FAILURE_CODES.TEXT_ENCODING_UNSUPPORTED;
  }
  const retryEligible = false;
  const pipelineStage =
    failureCode === FAILURE_CODES.TEXT_ENCODING_UNSUPPORTED
      ? "chunking"
      : classified.pipelineStage;
  const previous = {
    failureCode: row.failure_code,
    retryEligible: row.retry_eligible,
    readinessClass: row.readiness_class,
    pipelineStage: row.pipeline_stage,
  };
  const next = {
    failureCode,
    retryEligible,
    readinessClass: "processing_failed_permanent",
    pipelineStage,
  };
  if (!dryRun) {
    await query(
      `UPDATE document_processing_state
       SET failure_code = $2,
           retry_eligible = FALSE,
           pipeline_stage = $3,
           readiness_class = 'processing_failed_permanent',
           updated_at = NOW()
       WHERE document_id = $1`,
      [row.id, failureCode, pipelineStage],
    );
    await query(
      `UPDATE document_processing_jobs
       SET failure_code = $2,
           retry_eligible = FALSE,
           pipeline_stage = $3,
           updated_at = NOW()
       WHERE document_id = $1
         AND status IN ('failed', 'dead_letter')`,
      [row.id, failureCode, pipelineStage],
    );
    await query(
      `UPDATE document_processing_attempts
       SET failure_code = $2,
           retry_eligible = FALSE,
           pipeline_stage = $3
       WHERE document_id = $1
         AND status IN ('failed', 'dead_letter')`,
      [row.id, failureCode, pipelineStage],
    );
    await audit(row.id, "retryable_permanent_corrected", previous, next, {
      reason: row.failure_reason || row.readiness_reason,
    });
  }
  return { documentId: String(row.id), action: "mark_non_retryable", ...next };
};

const run = async () => {
  const dryRun = argumentFlag("dry-run");
  const limit = argumentInteger("limit", 100, 1, 500);
  const readyRows = await readyWithoutChunksRows(limit);
  const retryRows = await retryPermanentRows(limit);
  const readyResults = [];
  for (const row of readyRows) {
    readyResults.push(await regenerateChunks(row, dryRun));
  }
  const retryResults = [];
  for (const row of retryRows) {
    retryResults.push(await repairRetryPermanent(row, dryRun));
  }
  return {
    generatedAt: new Date().toISOString(),
    mode: dryRun ? "dry_run" : "apply",
    readyWithoutChunks: {
      found: readyRows.length,
      results: readyResults,
    },
    retryableMarkedPermanent: {
      found: retryRows.length,
      results: retryResults,
    },
  };
};

run()
  .then((result) => console.log(JSON.stringify(result, null, 2)))
  .catch((error) => {
    console.error("Processing consistency repair failed:", {
      message: error.message,
      code: error.code || null,
    });
    process.exitCode = 1;
  })
  .finally(async () => {
    if (globalThis.__rashtramPostgresPool) await getPool().end();
  });
