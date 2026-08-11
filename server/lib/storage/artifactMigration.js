const { createObjectStorage, objectStorageConfig, sha256 } = require("./objectStorage");

const boundedLimit = (value, fallback = 10) => {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 25) return fallback;
  return parsed;
};

const artifactKindForRow = (row) => {
  if (row.extraction_method === "source_html") return "source-html";
  if (row.ocr_used || ["gemini_ocr", "openai_ocr"].includes(row.extraction_method)) {
    return "ocr-text";
  }
  return "extracted-text";
};

const auditArtifactStorage = async (pool, { env = process.env } = {}) => {
  const [eligible, references, failures] = await Promise.all([
    pool.query(
      `SELECT COUNT(*)::bigint AS artifacts,
              COALESCE(SUM(octet_length(original_text)), 0)::bigint AS bytes,
              COUNT(*) FILTER (WHERE extraction_method = 'source_html')::bigint AS source_html,
              COUNT(*) FILTER (WHERE ocr_used OR extraction_method IN ('gemini_ocr', 'openai_ocr'))::bigint AS ocr_text,
              COUNT(*) FILTER (WHERE extraction_method = 'pdf_text')::bigint AS extracted_text
       FROM document_text_artifacts
       WHERE btrim(original_text) <> ''`,
    ),
    pool.query(
      `SELECT status, COUNT(*)::bigint AS objects,
              COALESCE(SUM(byte_size), 0)::bigint AS bytes
       FROM document_artifact_objects
       GROUP BY status ORDER BY status`,
    ),
    pool.query(
      `SELECT COUNT(*)::bigint AS failed_items
       FROM artifact_storage_migration_items WHERE status = 'failed'`,
    ),
  ]);
  return {
    mode: "read-only",
    configured: objectStorageConfig(env).configured,
    eligible: Object.fromEntries(
      Object.entries(eligible.rows[0]).map(([key, value]) => [key, Number(value)]),
    ),
    references: references.rows.map((row) => ({
      status: row.status,
      objects: Number(row.objects),
      bytes: Number(row.bytes),
    })),
    failedItems: Number(failures.rows[0].failed_items),
    policy: {
      source: "document_text_artifacts.original_text",
      originalRetained: true,
      maximumBatchSize: 25,
      databaseReferenceAfterVerification: true,
    },
  };
};

const selectCandidates = async (pool, limit) => {
  const result = await pool.query(
    `SELECT artifact.document_id,
            artifact.original_text,
            artifact.extraction_method,
            artifact.ocr_used,
            artifact.metadata_json,
            artifact.updated_at,
            document.primary_pdf_resource_id AS resource_id
     FROM document_text_artifacts artifact
     JOIN documents document ON document.id = artifact.document_id
     WHERE btrim(artifact.original_text) <> ''
       AND NOT EXISTS (
         SELECT 1 FROM document_artifact_objects object
         WHERE object.document_id = artifact.document_id
           AND object.source_locator = 'document_text_artifacts.original_text'
           AND object.status IN ('verified', 'active')
       )
     ORDER BY artifact.document_id
     LIMIT $1`,
    [limit],
  );
  return result.rows;
};

const dryRunArtifactMigration = async (pool, { limit = 10 } = {}) => {
  const bounded = boundedLimit(limit);
  const candidates = await selectCandidates(pool, bounded);
  return {
    dryRun: true,
    limit: bounded,
    candidateCount: candidates.length,
    totalBytes: candidates.reduce(
      (sum, row) => sum + Buffer.byteLength(row.original_text, "utf8"),
      0,
    ),
    candidates: candidates.map((row) => ({
      documentId: Number(row.document_id),
      artifactKind: artifactKindForRow(row),
      bytes: Buffer.byteLength(row.original_text, "utf8"),
      sha256: sha256(Buffer.from(row.original_text, "utf8")),
      originalRetained: true,
    })),
  };
};

const migrateArtifacts = async (
  pool,
  { limit = 10, env = process.env, storage, trustUploadChecksum = false } = {},
) => {
  const bounded = boundedLimit(limit);
  if (!objectStorageConfig(env).configured && !storage) {
    const error = new Error("Object storage is disabled; no artifacts were moved.");
    error.code = "OBJECT_STORAGE_DISABLED";
    throw error;
  }
  const objectStorage = storage || createObjectStorage({ env });
  const candidates = await selectCandidates(pool, bounded);
  const runResult = await pool.query(
    `INSERT INTO artifact_storage_migration_runs (mode, status, requested_limit)
     VALUES ('migrate', 'running', $1) RETURNING id`,
    [bounded],
  );
  const runId = Number(runResult.rows[0].id);
  let verified = 0;
  let failed = 0;
  let checkpoint = null;
  for (const row of candidates) {
    const documentId = Number(row.document_id);
    const kind = artifactKindForRow(row);
    const body = Buffer.from(row.original_text, "utf8");
    const hash = sha256(body);
    const processingVersion = String(
      row.metadata_json?.processingVersion ||
      row.metadata_json?.pipelineVersion ||
      "legacy-artifact-v1",
    );
    let objectKey = null;
    checkpoint = documentId;
    try {
      const uploaded = await objectStorage.putArtifact({
        kind,
        body,
        contentType: "text/plain; charset=utf-8",
        extension: "txt",
        metadata: { processingVersion },
      });
      objectKey = uploaded.key;
      // Read-back verification costs two Class B (download) transactions
      // per artifact — a HEAD and a GET. On Backblaze's free tier that
      // allowance is the binding constraint: 1,326 artifacts exhausted the
      // daily cap and every subsequent read returned
      // "download bandwidth or transaction (Class B) cap exceeded".
      //
      // putArtifact already sends ChecksumSHA256, so B2 recomputes the
      // SHA-256 server-side during upload and REJECTS the write on
      // mismatch. A successful PUT is therefore already proof that the
      // stored bytes hash to `hash`. The read-back re-proves the same
      // fact at 2x the scarce quota.
      //
      // trustUploadChecksum skips the redundant reads. It is opt-in
      // because read-back additionally proves the object is *retrievable*,
      // not merely correct — worth keeping as the default.
      if (!trustUploadChecksum) {
        const head = await objectStorage.headArtifact(uploaded.key);
        const read = await objectStorage.getArtifact({
          key: uploaded.key,
          expectedHash: hash,
        });
        if (head.hash !== hash || head.bytes !== body.length || !read.body.equals(body)) {
          const error = new Error("Uploaded artifact failed byte/checksum verification.");
          error.code = "OBJECT_STORAGE_VERIFICATION_FAILED";
          throw error;
        }
      } else if (uploaded.hash !== hash || uploaded.bytes !== body.length) {
        // Defensive: the adapter must have hashed the same bytes we sent.
        const error = new Error("Upload checksum did not match the source artifact.");
        error.code = "OBJECT_STORAGE_VERIFICATION_FAILED";
        throw error;
      }
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        await client.query(
          `INSERT INTO document_artifact_objects (
             document_id, resource_id, artifact_kind, source_locator, object_key,
             sha256, mime_type, byte_size, processing_version, status,
             original_retained, verified_at
           ) VALUES ($1, $2, $3, 'document_text_artifacts.original_text', $4,
                     $5, 'text/plain; charset=utf-8', $6, $7, 'verified', TRUE, NOW())
           ON CONFLICT (document_id, artifact_kind, sha256) DO UPDATE SET
             resource_id = COALESCE(EXCLUDED.resource_id, document_artifact_objects.resource_id),
             object_key = EXCLUDED.object_key,
             byte_size = EXCLUDED.byte_size,
             processing_version = EXCLUDED.processing_version,
             status = 'verified', original_retained = TRUE,
             verified_at = NOW(), updated_at = NOW()`,
          [documentId, row.resource_id, kind, uploaded.key, hash, body.length, processingVersion],
        );
        await client.query(
          `INSERT INTO artifact_storage_migration_items (
             run_id, document_id, artifact_kind, source_sha256, object_key, status
           ) VALUES ($1, $2, $3, $4, $5, 'verified')`,
          [runId, documentId, kind, hash, uploaded.key],
        );
        await client.query("COMMIT");
        verified += 1;
      } catch (error) {
        await client.query("ROLLBACK").catch(() => undefined);
        throw error;
      } finally {
        client.release();
      }
    } catch (error) {
      failed += 1;
      await pool.query(
        `INSERT INTO artifact_storage_migration_items (
           run_id, document_id, artifact_kind, source_sha256, object_key,
           status, error_code, error_message
         ) VALUES ($1, $2, $3, $4, $5, 'failed', $6, $7)
         ON CONFLICT (run_id, document_id, artifact_kind) DO UPDATE SET
           object_key = EXCLUDED.object_key, status = 'failed',
           error_code = EXCLUDED.error_code,
           error_message = EXCLUDED.error_message, updated_at = NOW()`,
        [
          runId,
          documentId,
          kind,
          hash,
          objectKey,
          error.code || "MIGRATION_ERROR",
          String(error.message).slice(0, 500),
        ],
      );
    }
    await pool.query(
      `UPDATE artifact_storage_migration_runs
       SET checkpoint_document_id = $2, attempted_count = $3,
           verified_count = $4, failed_count = $5
       WHERE id = $1`,
      [runId, checkpoint, verified + failed, verified, failed],
    );
  }
  const status = failed === 0 ? "completed" : verified > 0 ? "partial" : "failed";
  await pool.query(
    `UPDATE artifact_storage_migration_runs
     SET status = $2, completed_at = NOW() WHERE id = $1`,
    [runId, status],
  );
  return { runId, status, attempted: verified + failed, verified, failed, checkpoint };
};

const verifyArtifactObjects = async (
  pool,
  { limit = 25, env = process.env, storage } = {},
) => {
  const objectStorage = storage || createObjectStorage({ env });
  const result = await pool.query(
    `SELECT id, document_id, object_key, sha256, byte_size
     FROM document_artifact_objects
     WHERE status IN ('verified', 'active')
     ORDER BY id LIMIT $1`,
    [boundedLimit(limit, 25)],
  );
  const failures = [];
  for (const row of result.rows) {
    try {
      const artifact = await objectStorage.getArtifact({
        key: row.object_key,
        expectedHash: row.sha256,
      });
      if (artifact.body.length !== Number(row.byte_size)) {
        throw new Error("Stored byte size does not match the database reference.");
      }
    } catch (error) {
      failures.push({
        objectId: Number(row.id),
        documentId: Number(row.document_id),
        code: error.code || "VERIFY_ERROR",
      });
    }
  }
  return { checked: result.rows.length, verified: result.rows.length - failures.length, failures };
};

const clearMigratedInlineArtifacts = async (
  pool,
  { limit = 500, trustUploadChecksum = false } = {},
) => {
  if (!trustUploadChecksum) {
    const error = new Error(
      "Clearing inline artifact payloads requires explicit --trust-upload-checksum.",
    );
    error.code = "INLINE_ARTIFACT_CLEAR_REQUIRES_TRUST";
    throw error;
  }
  const bounded = boundedLimit(limit, 500);
  const result = await pool.query(
    `WITH candidates AS (
       SELECT
         artifact.document_id,
         artifact.original_text,
         object.object_key,
         object.sha256,
         object.byte_size
       FROM document_text_artifacts artifact
       JOIN document_artifact_objects object
         ON object.document_id = artifact.document_id
        AND object.status = 'verified'
        AND object.source_locator = 'document_text_artifacts.original_text'
       WHERE btrim(artifact.original_text) <> ''
       ORDER BY artifact.document_id
       LIMIT $1
     )
     UPDATE document_text_artifacts artifact
     SET original_text = '',
         metadata_json = COALESCE(artifact.metadata_json, '{}'::jsonb)
           || jsonb_build_object(
             'originalTextExternalized', true,
             'originalTextObjectKey', candidates.object_key,
             'originalTextSha256', candidates.sha256,
             'originalTextByteSize', candidates.byte_size,
             'originalTextClearedAt', NOW()
           ),
         updated_at = NOW()
     FROM candidates
     WHERE artifact.document_id = candidates.document_id
     RETURNING
       artifact.document_id,
       octet_length(candidates.original_text)::BIGINT AS cleared_bytes`,
    [bounded],
  );
  return {
    clearedRows: result.rowCount,
    clearedBytes: result.rows.reduce(
      (sum, row) => sum + Number(row.cleared_bytes || 0),
      0,
    ),
    trustUploadChecksum,
  };
};

const rollbackArtifactMigration = async (pool, runId) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await client.query(
      `UPDATE document_artifact_objects object
       SET status = 'rolled_back', updated_at = NOW()
       FROM artifact_storage_migration_items item
       WHERE item.run_id = $1 AND item.status = 'verified'
         AND object.document_id = item.document_id
         AND object.artifact_kind = item.artifact_kind
         AND object.sha256 = item.source_sha256
       RETURNING object.id`,
      [runId],
    );
    await client.query(
      `UPDATE artifact_storage_migration_items
       SET status = 'rolled_back', updated_at = NOW()
       WHERE run_id = $1 AND status = 'verified'`,
      [runId],
    );
    await client.query(
      `UPDATE artifact_storage_migration_runs
       SET status = 'rolled_back', completed_at = NOW() WHERE id = $1`,
      [runId],
    );
    await client.query("COMMIT");
    return { runId, rolledBackReferences: result.rowCount, originalPostgresValuesRetained: true };
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
};

module.exports = {
  artifactKindForRow,
  auditArtifactStorage,
  boundedLimit,
  clearMigratedInlineArtifacts,
  dryRunArtifactMigration,
  migrateArtifacts,
  rollbackArtifactMigration,
  verifyArtifactObjects,
};
