const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const {
  MAX_LEGACY_UPLOAD_BYTES,
  MAX_ACTIVE_UPLOAD_INTENTS_PER_USER,
  MAX_SOURCE_BYTES,
  assertPdfUploadStorageAvailable,
  assertPublicUrl,
  claimPdfUploadForProcessing,
  deleteSource,
  extractHtml,
  findLinkedPdfUrl,
  persistSourceRows,
  persistSource,
  planDurablePdfOriginal,
  promoteAndPersistProcessedPdf,
  promoteVerifiedPdfOriginal,
  quarantineFailedUploadObject,
  reservePdfUploadIntentRecord,
  safeProcessingFailure,
  storeOriginal,
  uploadNotReadyError,
  sweepStalePdfUploadIntents,
  validatePdfUploadIntent,
} = require("../research/sourceService");
const {
  createObjectStorage,
  userSourceIntentObjectKey,
  userSourceObjectKey,
} = require("../lib/storage/objectStorage");

test("direct PDF uploads expose a truthful 50 MB limit and a Vercel-safe legacy fallback", () => {
  assert.equal(MAX_SOURCE_BYTES, 50 * 1024 * 1024);
  assert.equal(MAX_LEGACY_UPLOAD_BYTES, 3 * 1024 * 1024);
  assert.equal(
    userSourceObjectKey({ userId: 42, uploadId: "123e4567-e89b-12d3-a456-426614174000" }),
    "rashtram/user-sources/42/123e4567-e89b-12d3-a456-426614174000.pdf",
  );
  assert.equal(
    userSourceIntentObjectKey({ userId: 42, uploadId: "123e4567-e89b-12d3-a456-426614174000" }),
    "rashtram/user-source-intents/42/123e4567-e89b-12d3-a456-426614174000.pdf",
  );
});

test("presigned direct uploads bind a short expiry, length and checksum headers", async () => {
  const storage = createObjectStorage({
    env: {
      OBJECT_STORAGE_PROVIDER: "s3",
      OBJECT_STORAGE_ENDPOINT: "https://storage.example.com",
      OBJECT_STORAGE_BUCKET: "private-test",
      OBJECT_STORAGE_REGION: "us-east-1",
      OBJECT_STORAGE_ACCESS_KEY_ID: "test-access",
      OBJECT_STORAGE_SECRET_ACCESS_KEY: "test-secret",
    },
  });
  const signed = await storage.createPresignedUpload({
    key: "rashtram/user-source-intents/42/test.pdf",
    contentType: "application/pdf",
    contentLength: 1234,
    checksumSha256: "a".repeat(64),
    expiresIn: 900,
  });
  assert.equal(signed.expiresIn, 300);
  assert.equal(signed.requiredHeaders["Content-Type"], "application/pdf");
  const signedUrl = new URL(signed.uploadUrl);
  assert.equal(
    signedUrl.searchParams.get("x-amz-checksum-sha256"),
    Buffer.from("a".repeat(64), "hex").toString("base64"),
  );
  const signedHeaders = signedUrl.searchParams.get("X-Amz-SignedHeaders") || "";
  assert.match(signedHeaders, /content-length/);
});

test("PDF upload intent reports an oversized file as 413 FILE_TOO_LARGE", () => {
  assert.throws(
    () => validatePdfUploadIntent({
      mimeType: "application/pdf",
      sizeBytes: MAX_SOURCE_BYTES + 1,
      checksumSha256: "a".repeat(64),
    }),
    (error) => {
      assert.equal(error.status, 413);
      assert.equal(error.failureCode, "FILE_TOO_LARGE");
      assert.equal(error.message, "This file exceeds the 50 MB upload limit.");
      return true;
    },
  );
});

test("PDF upload intent reports invalid file metadata as 422 INVALID_DOCUMENT", () => {
  for (const input of [
    { mimeType: "application/pdf", sizeBytes: 0, checksumSha256: "a".repeat(64) },
    { mimeType: "text/html", sizeBytes: 1024, checksumSha256: "a".repeat(64) },
    { mimeType: "application/pdf", sizeBytes: 1024, checksumSha256: "not-a-checksum" },
  ]) {
    assert.throws(
      () => validatePdfUploadIntent(input),
      (error) => {
        assert.equal(error.status, 422);
        assert.equal(error.failureCode, "INVALID_DOCUMENT");
        return true;
      },
    );
  }
});

test("PDF upload intent accepts the exact 50 MB boundary", () => {
  assert.deepEqual(
    validatePdfUploadIntent({
      mimeType: "application/pdf",
      sizeBytes: MAX_SOURCE_BYTES,
      checksumSha256: "A".repeat(64),
    }),
    {
      size: MAX_SOURCE_BYTES,
      mimeType: "application/pdf",
      checksum: "a".repeat(64),
    },
  );
});

test("missing object storage reports a safe 503 STORAGE_UNAVAILABLE contract", () => {
  assert.throws(
    () => assertPdfUploadStorageAvailable({ OBJECT_STORAGE_PROVIDER: "disabled" }),
    (error) => {
      assert.equal(error.status, 503);
      assert.equal(error.failureCode, "STORAGE_UNAVAILABLE");
      assert.equal(error.publicCode, "STORAGE_UNAVAILABLE");
      assert.equal(
        error.publicMessage,
        "Private document storage is temporarily unavailable. Please retry later.",
      );
      return true;
    },
  );
});

test("an upload that has not reached storage reports 409 NOT_READY", () => {
  const error = uploadNotReadyError();
  assert.equal(error.status, 409);
  assert.equal(error.failureCode, "NOT_READY");
  assert.match(error.message, /upload has not completed/i);
});

const fakePool = (respond) => {
  const statements = [];
  let released = false;
  const client = {
    async query(sql, params = []) {
      statements.push({ sql: String(sql), params });
      return respond(String(sql), params, statements);
    },
    release() {
      released = true;
    },
  };
  return {
    pool: { connect: async () => client },
    statements,
    released: () => released,
  };
};

test("compatibility source and chunks roll back atomically on an injected chunk failure", async () => {
  const fixture = fakePool((sql, params) => {
    if (/INSERT INTO research_sources/i.test(sql)) return { rows: [{ id: 91 }] };
    if (/INSERT INTO research_source_chunks/i.test(sql) && params[1] === 1) {
      throw new Error("injected chunk failure");
    }
    return { rows: [] };
  });
  await assert.rejects(
    () => persistSourceRows({
      pool: fixture.pool,
      sourceValues: [1, "Title", "pdf_upload", null, "a.pdf", "application/pdf", null, "a".repeat(64), 100, "en", "text", "{}"],
      chunks: [
        { content: "first citation-ready passage", metadata: {} },
        { content: "second citation-ready passage", metadata: {} },
      ],
    }),
    /injected chunk failure/,
  );
  assert.equal(fixture.statements[0].sql, "BEGIN");
  assert.ok(fixture.statements.some(({ sql }) => sql === "ROLLBACK"));
  assert.ok(!fixture.statements.some(({ sql }) => sql === "COMMIT"));
  assert.equal(fixture.released(), true);
});

test("compatibility upload requires durable storage and compensates a rolled-back database write", async () => {
  await assert.rejects(
    () => storeOriginal({
      buffer: Buffer.from("%PDF-test"),
      kind: "pdf",
      extension: "pdf",
      contentType: "application/pdf",
      metadata: {},
      userId: 42,
      requireDurable: true,
      storage: { putUserSourceArtifact: async () => { throw new Error("provider credential detail"); } },
    }),
    (error) => error.status === 503 && error.failureCode === "STORAGE_UNAVAILABLE" &&
      !error.message.includes("credential"),
  );

  const deleted = [];
  const fixture = fakePool((sql) => {
    if (/INSERT INTO research_sources/i.test(sql)) throw new Error("database write failed");
    return { rows: [] };
  });
  await assert.rejects(
    () => persistSource({
      userId: 42,
      title: "Durable private PDF",
      sourceType: "pdf_upload",
      fileName: "private.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.from("%PDF-private-original"),
      extracted: {
        text: "A sufficiently long private source passage for grounded research and citations.",
        language: { languageCode: "en" },
        chunks: [{ content: "A sufficiently long private source passage for grounded research and citations.", metadata: {} }],
      },
      requireDurableOriginal: true,
      pool: fixture.pool,
      storage: {
        putUserSourceArtifact: async ({ userId }) => ({
          key: `rashtram/user-sources/${userId}/stored.pdf`, hash: "a".repeat(64), bytes: 21,
        }),
        deleteArtifact: async (key) => deleted.push(key),
      },
    }),
    /database write failed/,
  );
  assert.deepEqual(deleted, ["rashtram/user-sources/42/stored.pdf"]);
  assert.ok(fixture.statements.some(({ sql }) => sql === "ROLLBACK"));
});

test("active signed upload intents are bounded per user under one transaction lock", async () => {
  const fixture = fakePool((sql) => {
    if (/SELECT id, object_key/i.test(sql)) return { rows: [] };
    if (/active_count/i.test(sql)) {
      return { rows: [{ active_count: MAX_ACTIVE_UPLOAD_INTENTS_PER_USER }] };
    }
    return { rows: [] };
  });
  await assert.rejects(
    () => reservePdfUploadIntentRecord({
      pool: fixture.pool,
      storage: { deleteArtifact: async () => undefined },
      userId: 42,
      uploadId: "123e4567-e89b-12d3-a456-426614174000",
      objectKey: "rashtram/user-sources/42/123e4567-e89b-12d3-a456-426614174000.pdf",
      fileName: "bounded.pdf",
      validated: { mimeType: "application/pdf", checksum: "a".repeat(64), size: 1024 },
    }),
    (error) => {
      assert.equal(error.status, 429);
      assert.equal(error.failureCode, "UPLOAD_INTENT_LIMIT");
      return true;
    },
  );
  assert.ok(fixture.statements.some(({ sql }) => /pg_advisory_xact_lock/i.test(sql)));
  assert.ok(fixture.statements.some(({ sql }) => sql === "ROLLBACK"));
  assert.ok(!fixture.statements.some(({ sql }) => /INSERT INTO research_sources/i.test(sql)));
});

test("upload intent reservation never performs slow object deletion inside its database transaction", async () => {
  const deletedObjects = [];
  const fixture = fakePool((sql) => {
    if (/SELECT id, object_key/i.test(sql)) {
      return { rows: [{ id: 7, object_key: "rashtram/user-sources/42/stale.pdf" }] };
    }
    if (/active_count/i.test(sql)) return { rows: [{ active_count: 0 }] };
    if (/INSERT INTO research_sources/i.test(sql)) {
      return { rows: [{ id: 8, user_id: 42, metadata_json: {} }] };
    }
    return { rows: [] };
  });
  await reservePdfUploadIntentRecord({
    pool: fixture.pool,
    storage: { deleteArtifact: async (key) => deletedObjects.push(key) },
    userId: 42,
    uploadId: "123e4567-e89b-12d3-a456-426614174000",
    objectKey: "rashtram/user-sources/42/123e4567-e89b-12d3-a456-426614174000.pdf",
    fileName: "new.pdf",
    validated: { mimeType: "application/pdf", checksum: "a".repeat(64), size: 1024 },
  });
  assert.deepEqual(deletedObjects, []);
  assert.ok(!fixture.statements.some(({ sql }) => /DELETE FROM research_sources WHERE id/i.test(sql)));
  assert.ok(fixture.statements.some(({ sql }) => sql === "COMMIT"));
});

test("failed PDF processing deletes its private object or marks cleanup pending", async () => {
  const updates = [];
  const row = { id: 9, object_key: "rashtram/user-sources/42/failed.pdf" };
  const deleted = await quarantineFailedUploadObject({
    userId: 42,
    row,
    failure: Object.assign(new Error("invalid PDF"), { failureCode: "INVALID_DOCUMENT" }),
    storage: { deleteArtifact: async () => undefined },
    queryFn: async (sql, params) => {
      updates.push({ sql, params });
      return { rows: [] };
    },
  });
  assert.deepEqual(deleted, { objectDeleted: true, cleanupPending: false });
  assert.equal(updates[0].params[1], true);
  assert.equal(updates[0].params[5], 42);

  updates.length = 0;
  const quarantined = await quarantineFailedUploadObject({
    userId: 42,
    row,
    failure: new Error("processing failed"),
    storage: { deleteArtifact: async () => { throw new Error("storage unavailable"); } },
    queryFn: async (sql, params) => {
      updates.push({ sql, params });
      return { rows: [] };
    },
  });
  assert.deepEqual(quarantined, { objectDeleted: false, cleanupPending: true });
  assert.match(updates[0].params[3], /cleanup_pending/);
  assert.equal(updates[0].params[5], 42);
  assert.equal(updates[0].params[0], "The uploaded PDF could not be processed.");
  assert.doesNotMatch(updates[0].params[0], /storage unavailable|processing failed/i);
});

test("PDF processing is atomically claimed and a concurrent caller cannot fail its peer", async () => {
  const calls = [];
  await assert.rejects(
    () => claimPdfUploadForProcessing({
      userId: 42,
      sourceId: 9,
      attemptId: "attempt-b",
      queryFn: async (sql, params) => {
        calls.push({ sql, params });
        if (/^UPDATE research_sources/i.test(sql.trim())) return { rows: [] };
        return { rows: [{ id: 9, user_id: 42, status: "processing", metadata_json: { uploadStage: "extracting", processingAttemptId: "attempt-a" } }] };
      },
    }),
    (error) => error.status === 409 && error.failureCode === "UPLOAD_PROCESSING_IN_PROGRESS",
  );
  assert.equal(calls.length, 2);
  assert.match(calls[0].sql, /uploadStage.*awaiting_upload/s);
});

test("a failed extraction can be retried from its preserved durable original", async () => {
  const calls = [];
  const durableRow = {
    id: 9,
    user_id: 42,
    status: "processing",
    object_key: "rashtram/user-sources/42/123e4567-e89b-12d3-a456-426614174000.pdf",
    metadata_json: {
      durableOriginal: true,
      uploadStage: "extracting",
      processingAttemptId: "retry-attempt",
    },
  };
  const result = await claimPdfUploadForProcessing({
    userId: 42,
    sourceId: 9,
    attemptId: "retry-attempt",
    queryFn: async (sql, params) => {
      calls.push({ sql, params });
      return { rows: [durableRow] };
    },
  });
  assert.equal(result.row.object_key, durableRow.object_key);
  assert.match(calls[0].sql, /status = 'failed'[\s\S]*durableOriginal[\s\S]*rashtram\/user-sources/);
});

test("durable promotion is tracked in PostgreSQL before the storage write", async () => {
  const calls = [];
  const row = {
    id: 9,
    metadata_json: { uploadId: "123e4567-e89b-12d3-a456-426614174000" },
  };
  const result = await planDurablePdfOriginal({
    userId: 42,
    row,
    attemptId: "attempt-a",
    queryFn: async (sql, params) => {
      calls.push({ sql, params });
      return {
        rows: [{
          ...row,
          metadata_json: {
            ...row.metadata_json,
            durableObjectKeyPlanned: JSON.parse(params[0]).durableObjectKeyPlanned,
          },
        }],
      };
    },
  });
  assert.equal(
    result.plannedKey,
    "rashtram/user-sources/42/123e4567-e89b-12d3-a456-426614174000.pdf",
  );
  assert.equal(JSON.parse(calls[0].params[0]).durableObjectKeyPlanned, result.plannedKey);
});

test("failed extraction preserves the durable original and only cleans temporary artifacts", async () => {
  const deleted = [];
  const updates = [];
  const row = {
    id: 9,
    object_key: "rashtram/user-sources/42/123e4567-e89b-12d3-a456-426614174000.pdf",
    metadata_json: {
      durableOriginal: true,
      temporaryObjectKeyToDelete: "rashtram/user-source-intents/42/temporary.pdf",
      processingAttemptId: "attempt-a",
    },
  };
  const result = await quarantineFailedUploadObject({
    userId: 42,
    row,
    failure: Object.assign(new Error("OCR failed"), { failureCode: "LOW_QUALITY_TEXT" }),
    storage: { deleteArtifact: async (key) => deleted.push(key) },
    processingAttemptId: "attempt-a",
    queryFn: async (sql, params) => {
      if (/^\s*SELECT \*/i.test(sql)) return { rows: [row] };
      updates.push({ sql, params });
      return { rows: [{ id: 9 }] };
    },
  });
  assert.equal(result.objectDeleted, true);
  assert.deepEqual(deleted, ["rashtram/user-source-intents/42/temporary.pdf"]);
  assert.match(updates[0].params[3], /failed_retryable/);
  assert.equal(updates[0].params[2], true);
});

test("verified direct upload is promoted to a durable user-scoped original", async () => {
  const body = Buffer.from("%PDF-durable-original");
  const hash = require("node:crypto").createHash("sha256").update(body).digest("hex");
  const calls = [];
  const result = await promoteVerifiedPdfOriginal({
    userId: 42,
    row: {
      id: 9,
      object_key: "rashtram/user-source-intents/42/upload.pdf",
      size_bytes: body.length,
      checksum_sha256: hash,
      metadata_json: { uploadId: "123e4567-e89b-12d3-a456-426614174000" },
    },
    body,
    storage: {
      putUserSourceArtifact: async (input) => {
        calls.push(["put", input]);
        return { key: "rashtram/user-sources/42/123e4567-e89b-12d3-a456-426614174000.pdf" };
      },
      headArtifact: async (key) => ({ key, bytes: body.length, contentType: "application/pdf", hash }),
      getArtifact: async ({ key, expectedHash }) => ({ key, body, hash: expectedHash }),
      deleteArtifact: async (key) => calls.push(["delete", key]),
    },
  });
  assert.equal(result.key, "rashtram/user-sources/42/123e4567-e89b-12d3-a456-426614174000.pdf");
  assert.equal(calls[0][1].uploadId, "123e4567-e89b-12d3-a456-426614174000");
  assert.equal(calls.some(([kind]) => kind === "delete"), false);
});

test("durable promotion is compensating-deleted when ready-state persistence rolls back", async () => {
  const body = Buffer.from("%PDF-compensate-durable");
  const hash = require("node:crypto").createHash("sha256").update(body).digest("hex");
  const durableKey = "rashtram/user-sources/42/123e4567-e89b-12d3-a456-426614174000.pdf";
  const deleted = [];
  const fixture = fakePool((sql) => {
    if (/INSERT INTO research_source_chunks/i.test(sql)) throw new Error("injected ready-state failure");
    return { rows: [] };
  });
  await assert.rejects(
    () => promoteAndPersistProcessedPdf({
      storage: {
        putUserSourceArtifact: async () => ({ key: durableKey }),
        headArtifact: async () => ({ bytes: body.length, contentType: "application/pdf", hash }),
        getArtifact: async ({ expectedHash }) => ({ body, hash: expectedHash }),
        deleteArtifact: async (key) => deleted.push(key),
      },
      pool: fixture.pool,
      userId: 42,
      row: {
        id: 9,
        object_key: "rashtram/user-source-intents/42/upload.pdf",
        size_bytes: body.length,
        checksum_sha256: hash,
        metadata_json: { uploadId: "123e4567-e89b-12d3-a456-426614174000" },
      },
      attemptId: "attempt-a",
      body,
      extracted: { title: "Durable PDF" },
      text: "Citation-ready extracted text",
      language: { languageCode: "en" },
      chunks: [{ content: "Citation-ready extracted text", metadata: {} }],
    }),
    /injected ready-state failure/,
  );
  assert.deepEqual(deleted, [durableKey]);
  assert.ok(fixture.statements.some(({ sql }) => sql === "ROLLBACK"));
});

test("ready-state transaction stores the durable original key", async () => {
  const durableKey = "rashtram/user-sources/42/durable.pdf";
  const fixture = fakePool((sql, params) => {
    if (/UPDATE research_sources SET title/i.test(sql)) {
      return { rows: [{
        id: 9,
        user_id: 42,
        title: "Durable PDF",
        status: "ready",
        object_key: params[4],
        metadata_json: { uploadStage: "ready", durableOriginal: true },
      }] };
    }
    return { rows: [] };
  });
  const result = await promoteAndPersistProcessedPdf({
    storage: {
      putUserSourceArtifact: async () => ({ key: durableKey }),
      headArtifact: async () => ({ bytes: 4 }),
      getArtifact: async ({ expectedHash }) => ({ body: Buffer.from("test"), hash: expectedHash }),
      deleteArtifact: async () => undefined,
    },
    pool: fixture.pool,
    userId: 42,
    row: {
      id: 9,
      object_key: "rashtram/user-source-intents/42/upload.pdf",
      size_bytes: 4,
      checksum_sha256: "a".repeat(64),
      metadata_json: { uploadId: "123e4567-e89b-12d3-a456-426614174000" },
    },
    attemptId: "attempt-a",
    body: Buffer.from("test"),
    extracted: { title: "Durable PDF" },
    text: "Citation-ready extracted text",
    language: { languageCode: "en" },
    chunks: [{ content: "Citation-ready extracted text", metadata: {} }],
  });
  assert.equal(result.ready.object_key, durableKey);
  assert.ok(fixture.statements.some(({ sql }) => sql === "COMMIT"));
  const update = fixture.statements.find(({ sql }) => /UPDATE research_sources SET title/i.test(sql));
  assert.equal(update.params[4], durableKey);
});

test("processing storage failures use the safe 503 contract and never retain provider details", () => {
  const safe = safeProcessingFailure(Object.assign(new Error("secret provider endpoint failed"), {
    status: 503,
    failureCode: "STORAGE_UNAVAILABLE",
  }));
  assert.deepEqual(safe, {
    code: "STORAGE_UNAVAILABLE",
    message: "Private document storage is temporarily unavailable. Please retry later.",
  });
  assert.doesNotMatch(safe.message, /endpoint|secret/);
});

test("scheduled stale-intent sweep is bounded, skips locks and remains ownership scoped", async () => {
  const deletedObjects = [];
  const fixture = fakePool((sql) => {
    if (/SELECT id, user_id, object_key/i.test(sql)) {
      return { rows: [
        { id: 1, user_id: 42, object_key: "rashtram/user-source-intents/42/stale.pdf" },
        { id: 2, user_id: 43, object_key: "rashtram/user-source-intents/99/not-owned.pdf" },
      ] };
    }
    if (/DELETE FROM research_sources/i.test(sql)) return { rows: [{ id: 1 }] };
    return { rows: [] };
  });
  const result = await sweepStalePdfUploadIntents({
    pool: fixture.pool,
    storage: { deleteArtifact: async (key) => deletedObjects.push(key) },
    limit: 9999,
  });
  assert.deepEqual(deletedObjects, ["rashtram/user-source-intents/42/stale.pdf"]);
  assert.equal(result.limit, 100);
  assert.equal(result.selected, 2);
  assert.equal(result.deleted, 1);
  assert.equal(result.ownershipRejected, 1);
  const select = fixture.statements.find(({ sql }) => /SELECT id, user_id, object_key/i.test(sql));
  assert.match(select.sql, /FOR UPDATE SKIP LOCKED/);
  assert.equal(select.params[2], 100);
  const scopedDelete = fixture.statements.find(({ sql }) => /DELETE FROM research_sources/i.test(sql));
  assert.deepEqual(scopedDelete.params.slice(0, 2), [1, 42]);
  assert.equal(typeof scopedDelete.params[2], "string");
});

test("source deletion never deletes another user's row or private object", async () => {
  let storageCalls = 0;
  const deleted = await deleteSource(42, 99, {
    queryFn: async () => ({ rows: [] }),
    storage: { deleteArtifact: async () => { storageCalls += 1; } },
  });
  assert.equal(deleted, false);
  assert.equal(storageCalls, 0);
});

test("source deletion rejects a corrupted cross-account object key", async () => {
  let storageCalls = 0;
  await assert.rejects(
    () => deleteSource(42, 9, {
      queryFn: async (sql) => /^SELECT id/i.test(sql.trim())
        ? { rows: [{
            id: 9,
            user_id: 42,
            source_type: "pdf_upload",
            status: "ready",
            object_key: "rashtram/user-sources/99/not-owned.pdf",
            metadata_json: {},
          }] }
        : { rows: [] },
      storage: { deleteArtifact: async () => { storageCalls += 1; } },
    }),
    (error) => error.status === 409 &&
      error.failureCode === "UPLOAD_OBJECT_OWNERSHIP_INVALID",
  );
  assert.equal(storageCalls, 0);
});

test("cancelling a live presigned upload retains its tracked row until the URL is safely expired", async () => {
  const calls = [];
  const deleted = await deleteSource(42, 9, {
    queryFn: async (sql, params) => {
      calls.push({ sql, params });
      if (/^SELECT id/i.test(sql.trim())) {
        return { rows: [{
          id: 9,
          user_id: 42,
          source_type: "pdf_upload",
          status: "processing",
          object_key: "rashtram/user-source-intents/42/live.pdf",
          metadata_json: {
            uploadStage: "awaiting_upload",
            uploadExpiresAt: new Date(Date.now() + 60_000).toISOString(),
          },
        }] };
      }
      return { rows: [{ id: 9 }] };
    },
    storage: { deleteArtifact: async () => assert.fail("live signed key must not be deleted early") },
  });
  assert.equal(deleted, true);
  assert.equal(JSON.parse(calls[1].params[1]).uploadStage, "cancel_pending");
  assert.equal(JSON.parse(calls[1].params[1]).deletionPending, true);
  assert.ok(!calls.some(({ sql }) => /^DELETE FROM research_sources/i.test(sql.trim())));
});

test("deleting a ready source during its signed-link lifetime stays tracked and hidden for cleanup", async () => {
  const calls = [];
  const deleted = await deleteSource(42, 9, {
    queryFn: async (sql, params) => {
      calls.push({ sql, params });
      if (/^SELECT id/i.test(sql.trim())) {
        return { rows: [{
          id: 9,
          user_id: 42,
          source_type: "pdf_upload",
          status: "ready",
          object_key: "rashtram/user-sources/42/durable.pdf",
          metadata_json: {
            durableOriginal: true,
            uploadStage: "ready",
            uploadExpiresAt: new Date(Date.now() + 60_000).toISOString(),
            temporaryObjectKeyToDelete: "rashtram/user-source-intents/42/live.pdf",
          },
        }] };
      }
      return { rows: [{ id: 9 }] };
    },
    storage: { deleteArtifact: async () => assert.fail("live signed source must remain tracked") },
  });
  assert.equal(deleted, true);
  const metadata = JSON.parse(calls[1].params[1]);
  assert.equal(metadata.deletionPending, true);
  assert.match(String(require("node:fs").readFileSync(
    require("node:path").join(__dirname, "../research/sourceService.js"),
  )), /deletionPending[\s\S]*listSources|listSources[\s\S]*deletionPending/);
});

test("source deletion removes a durable original before the ownership-scoped row", async () => {
  const calls = [];
  const result = await deleteSource(42, 9, {
    queryFn: async (sql, params) => {
      calls.push(["db", sql, params]);
      if (/^SELECT id/i.test(sql.trim())) {
        return { rows: [{ id: 9, source_type: "pdf_upload", object_key: "rashtram/user-sources/42/durable.pdf" }] };
      }
      return { rows: [{ id: 9 }] };
    },
    storage: { deleteArtifact: async (key) => calls.push(["storage", key]) },
  });
  assert.equal(result, true);
  assert.deepEqual(calls[1], ["storage", "rashtram/user-sources/42/durable.pdf"]);
  assert.deepEqual(calls[2][2], [9, 42]);
});

test("account deletion collects and removes durable research-source originals", () => {
  const profileService = fs.readFileSync(
    path.join(__dirname, "../profile/profileService.js"),
    "utf8",
  );
  assert.match(profileService, /SELECT object_key[\s\S]*durableObjectKeyPlanned[\s\S]*temporaryObjectKeyToDelete[\s\S]*FROM research_sources[\s\S]*WHERE user_id = \$1/);
  assert.match(profileService, /pg_advisory_xact_lock[\s\S]*research-source-upload/);
  assert.match(profileService, /uploadedObjectKeys\.map\(\(objectKey\) => storage\.deleteArtifact\(objectKey\)\)/);
  assert.doesNotMatch(profileService, /Promise\.allSettled\([\s\S]*uploadedObjectKeys/);
});

test("research source URL guard rejects local and credential-bearing URLs", async () => {
  await assert.rejects(() => assertPublicUrl("http://127.0.0.1:5001/private"));
  await assert.rejects(() => assertPublicUrl("http://localhost:3000"));
  await assert.rejects(() => assertPublicUrl("https://user:password@example.com/report"));
});

test("research source URL guard accepts a public HTTPS host", async () => {
  const parsed = await assertPublicUrl("https://example.com/research");
  assert.equal(parsed.protocol, "https:");
  assert.equal(parsed.hostname, "example.com");
});

test("external HTML extraction prefers the article over navigation and footer noise", () => {
  const extracted = extractHtml(
    Buffer.from(`<!doctype html><html><head>
      <meta property="og:title" content="Clean policy title">
      <meta name="description" content="Official policy description.">
    </head><body>
      <nav>Navigation item that must not become evidence.</nav>
      <article><h1>Clean policy title</h1><p>This policy establishes a national implementation framework with accountable institutions, timelines, and public reporting duties.</p></article>
      <footer>Footer text that must not become evidence.</footer>
    </body></html>`),
    "https://example.com/policy",
  );

  assert.equal(extracted.title, "Clean policy title");
  assert.match(extracted.text, /national implementation framework/);
  assert.doesNotMatch(extracted.text, /Navigation item/);
  assert.doesNotMatch(extracted.text, /Footer text/);
  assert.equal(extracted.extractionMethod, "source_html");
});

test("external HTML extraction reads structured article data from script-rendered pages", () => {
  const extracted = extractHtml(
    Buffer.from(`<!doctype html><html><head><title>Rendered shell</title>
      <script type="application/ld+json">{
        "@type": "Article",
        "headline": "Structured policy page",
        "articleBody": "The authority must publish quarterly implementation reports, consult affected institutions, and review compliance annually."
      }</script>
    </head><body><div id="app">Loading...</div></body></html>`),
    "https://example.com/rendered-policy",
  );

  assert.match(extracted.text, /publish quarterly implementation reports/);
  assert.equal(extracted.extractionMethod, "structured_html");
});

test("official ASP.NET form wrappers retain publication text instead of being discarded", () => {
  const extracted = extractHtml(Buffer.from(`<!doctype html><html><body>
    <form method="post"><main><h1>Official consultation</h1>
    <p>The regulator invites comments on proposed reporting, implementation, and review requirements for regulated entities.</p>
    <p>Responses should address administrative capacity, consumer safeguards, and phased commencement.</p>
    </main></form></body></html>`), "https://regulator.example.gov.in/report.aspx?id=42");
  assert.match(extracted.text, /invites comments/);
  assert.equal(extracted.quality.valid, true);
});

test("official publication pages can resolve a linked PDF regardless of wrapper extension", () => {
  const url = findLinkedPdfUrl(Buffer.from(`
    <a href="/web/?file=https%3A%2F%2Fregulator.example.gov.in%2Ffiles%2Fconsultation.pdf%23page%3D2">Open report</a>
  `), "https://regulator.example.gov.in/publication.aspx?id=42");
  assert.equal(url, "https://regulator.example.gov.in/files/consultation.pdf#page=2");
});
