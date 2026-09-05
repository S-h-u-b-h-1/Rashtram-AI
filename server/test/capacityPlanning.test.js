const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const assert = require("node:assert/strict");
const {
  assertBulkProcessingSafe,
  buildProjectionModels,
  buildProjections,
  evaluateStorageStatus,
} = require("../lib/database/capacity");
const {
  artifactKey,
  createObjectStorage,
  objectStorageConfig,
  runObjectStorageSmokeTest,
  sanitizedObjectStorageStatus,
  sha256,
} = require("../lib/storage/objectStorage");
const {
  artifactKindForRow,
  clearMigratedInlineArtifacts,
  migrateArtifacts,
} = require("../lib/storage/artifactMigration");
const {
  postgresChunkMetadata,
} = require("../document/documentResearchService");

const MiB = 1024 * 1024;
const thresholds = {
  warningPercent: 70,
  pausePercent: 82,
  criticalPercent: 90,
  minimumHeadroomBytes: 64 * MiB,
};

test("storage guard exposes 70/80/90 alerts and pauses bulk work at 82 percent", () => {
  const warning = evaluateStorageStatus(
    { databaseBytes: 75, maxBytes: 100 },
    { ...thresholds, minimumHeadroomBytes: 0 },
  );
  assert.equal(warning.level, "warning");
  assert.deepEqual(warning.alerts, ["warning_70_percent"]);
  assert.equal(warning.bulkProcessingAllowed, true);

  const paused = evaluateStorageStatus(
    { databaseBytes: 82, maxBytes: 100 },
    { ...thresholds, minimumHeadroomBytes: 0 },
  );
  assert.equal(paused.level, "paused");
  assert.deepEqual(paused.alerts, ["warning_70_percent", "warning_80_percent"]);
  assert.equal(paused.bulkProcessingAllowed, false);

  const critical = evaluateStorageStatus(
    { databaseBytes: 90, maxBytes: 100 },
    { ...thresholds, minimumHeadroomBytes: 0 },
  );
  assert.equal(critical.level, "critical");
  assert.deepEqual(critical.alerts, [
    "warning_70_percent",
    "warning_80_percent",
    "critical_90_percent",
  ]);
});

test("storage guard fails closed when the provider limit is unavailable", async () => {
  const pool = {
    query: async () => ({ rows: [{ database_bytes: "100", max_bytes: null }] }),
  };
  await assert.rejects(
    assertBulkProcessingSafe(pool, { env: {} }),
    (error) => error.code === "DATABASE_STORAGE_HEADROOM_LOW" &&
      error.storage.level === "unknown",
  );
});

test("storage status calculates a bounded safe batch from both headroom guards", () => {
  const status = evaluateStorageStatus(
    { databaseBytes: 600 * MiB, maxBytes: 1024 * MiB },
    {
      ...thresholds,
      highGrowthBytesPerReadyDocument: 128 * 1024,
    },
  );
  assert.equal(status.state, "Healthy");
  assert.equal(status.safeBatchSize, 25);
  const noByteHeadroom = evaluateStorageStatus(
    { databaseBytes: 965 * MiB, maxBytes: 1024 * MiB },
    {
      ...thresholds,
      pausePercent: 99,
      highGrowthBytesPerReadyDocument: 128 * 1024,
    },
  );
  assert.equal(noByteHeadroom.safeBatchSize, 0);
  assert.equal(noByteHeadroom.bulkProcessingAllowed, false);
});

test("capacity projections scale measured ready-document categories", () => {
  const projections = buildProjections({
    databaseBytes: 1_000,
    catalogueDocuments: 100,
    researchReadyDocuments: 10,
    artifactDocuments: 10,
    chunkDocuments: 10,
    categories: {
      documents: { bytes: 100 },
      sourcesResources: { bytes: 100 },
      processingState: { bytes: 100 },
      chunks: { bytes: 200 },
      summaries: { bytes: 100 },
      graphRelationships: { bytes: 50 },
      userData: { bytes: 25 },
      operationalLogs: { bytes: 25 },
    },
    targets: [20],
  });
  assert.equal(projections[0].expected, 1_350);
  assert.equal(projections[0].incrementalDocuments, 10);
});

test("existing architecture projections never fall below current allocation", () => {
  const report = buildProjectionModels({
    databaseBytes: 1_000,
    researchReadyDocuments: 12,
    artifactDocuments: 12,
    chunkDocuments: 12,
    categories: {
      chunks: { bytes: 240 },
      summaries: { bytes: 120 },
      graphRelationships: { bytes: 120 },
      legacyMirror: { bytes: 100 },
    },
    targets: [10, 20],
  });
  assert.deepEqual(
    report.models[0].projections.map((projection) => projection.expected),
    [1_000, 1_320],
  );
  assert.ok(report.models[2].projections[0].expected < 1_000);
  assert.equal(report.models[2].completedMigrationAssumed, true);
});

test("manual and batch processing invoke the database storage guard", () => {
  const workerSource = fs.readFileSync(
    path.resolve(__dirname, "../document/processingWorkerService.js"),
    "utf8",
  );
  assert.match(
    workerSource,
    /runProcessingBatch[\s\S]*assertBulkProcessingSafe\(getPool\(\)\)/,
  );
  const readinessSource = fs.readFileSync(
    path.resolve(__dirname, "../document/readinessService.js"),
    "utf8",
  );
  assert.match(
    readinessSource,
    /enqueueProcessing[\s\S]*!storageChecked[\s\S]*assertBulkProcessingSafe\(getPool\(\)\)/,
  );
});

test("S3-compatible artifact keys are deterministic and content-addressed", () => {
  const body = Buffer.from("verified artifact");
  const hash = sha256(body);
  assert.equal(
    artifactKey({ kind: "pdf", hash, extension: "pdf" }),
    `rashtram/pdf/${hash.slice(0, 2)}/${hash}.pdf`,
  );
  assert.throws(
    () => artifactKey({ kind: "unknown", hash, extension: "bin" }),
    /Unsupported/,
  );
});

test("object-storage adapter verifies writes without exposing credentials", async () => {
  const commands = [];
  const client = {
    send: async (command) => {
      commands.push(command);
      return {};
    },
  };
  const env = {
    OBJECT_STORAGE_PROVIDER: "r2",
    OBJECT_STORAGE_ENDPOINT: "https://example.r2.cloudflarestorage.com",
    OBJECT_STORAGE_BUCKET: "rashtram-artifacts",
    OBJECT_STORAGE_ACCESS_KEY_ID: "private-access-key",
    OBJECT_STORAGE_SECRET_ACCESS_KEY: "private-secret",
  };
  const storage = createObjectStorage({ env, client });
  const result = await storage.putArtifact({
    kind: "source-html",
    body: "<html>official source</html>",
    contentType: "text/html",
    extension: "html",
  });
  assert.equal(commands.length, 1);
  assert.equal(commands[0].input.Bucket, "rashtram-artifacts");
  assert.equal(commands[0].input.Metadata.sha256, result.hash);
  const status = JSON.stringify(sanitizedObjectStorageStatus(env));
  assert.doesNotMatch(status, /private-access-key|private-secret/);
  assert.deepEqual(Object.keys(JSON.parse(status)).sort(), [
    "configured",
    "providerName",
    "reachable",
    "readAvailable",
    "writeAvailable",
  ]);
  assert.equal(JSON.parse(status).providerName, "r2");
});

test("object storage is explicitly disabled for absent or partial configuration", () => {
  assert.equal(objectStorageConfig({}).configured, false);
  assert.equal(objectStorageConfig({ OBJECT_STORAGE_PROVIDER: "disabled" }).configured, false);
  assert.equal(objectStorageConfig({
    OBJECT_STORAGE_PROVIDER: "s3",
    OBJECT_STORAGE_ENDPOINT: "https://s3.example.test",
  }).configured, false);
});

test("object-storage smoke test uploads, verifies bytes, deletes, and confirms absence", async () => {
  let stored = null;
  let versions = [];
  const client = {
    send: async (command) => {
      const name = command.constructor.name;
      if (name === "PutObjectCommand") {
        stored = Buffer.from(command.input.Body);
        versions = [{ Key: command.input.Key, VersionId: "v1" }];
        return {};
      }
      if (name === "GetObjectCommand") {
        return {
          Body: { transformToByteArray: async () => stored },
          Metadata: { sha256: sha256(stored) },
          ContentType: "text/plain",
        };
      }
      if (name === "DeleteObjectCommand") {
        versions = versions.filter((item) => item.VersionId !== command.input.VersionId);
        if (!versions.length) stored = null;
        return {};
      }
      if (name === "ListObjectVersionsCommand") {
        return { Versions: versions, DeleteMarkers: [], IsTruncated: false };
      }
      if (name === "HeadObjectCommand") {
        if (!stored) {
          const error = new Error("missing");
          error.name = "NotFound";
          throw error;
        }
        return {
          ContentLength: stored.length,
          Metadata: { sha256: sha256(stored) },
        };
      }
      throw new Error(`Unexpected command ${name}`);
    },
  };
  const smoke = await runObjectStorageSmokeTest({
    env: { OBJECT_STORAGE_BUCKET: "test" },
    client,
  });
  assert.equal(smoke.checksumVerified, true);
  assert.equal(smoke.byteEqualityVerified, true);
  assert.equal(smoke.versionInventoryBeforeDelete, 1);
  assert.equal(smoke.versionInventoryAfterDelete, 0);
  assert.equal(smoke.permanentDeletionVerified, true);
  assert.equal(smoke.leftoverObject, false);
  assert.equal(stored, null);
});

test("permanent object deletion removes versions and delete markers and is retry safe", async () => {
  const key = "rashtram/user-sources/42/exact.pdf";
  const prefixNeighbor = `${key}.not-the-same-object`;
  const entries = [
    { Key: key, VersionId: "v1", kind: "version" },
    { Key: key, VersionId: "v2", kind: "version" },
    { Key: key, VersionId: "m1", kind: "marker" },
    { Key: prefixNeighbor, VersionId: "neighbor", kind: "version" },
  ];
  const client = {
    async send(command) {
      if (command.constructor.name === "ListObjectVersionsCommand") {
        return {
          Versions: entries.filter((item) => item.kind === "version"),
          DeleteMarkers: entries.filter((item) => item.kind === "marker"),
          IsTruncated: false,
        };
      }
      if (command.constructor.name === "DeleteObjectCommand") {
        const index = entries.findIndex((item) =>
          item.Key === command.input.Key && item.VersionId === command.input.VersionId);
        if (index >= 0) entries.splice(index, 1);
        return {};
      }
      throw new Error(`Unexpected command ${command.constructor.name}`);
    },
  };
  const storage = createObjectStorage({
    env: { OBJECT_STORAGE_BUCKET: "private-test" },
    client,
  });
  const [first, concurrent] = await Promise.all([
    storage.deleteArtifact(key),
    storage.deleteArtifact(key),
  ]);
  assert.equal(first.permanentDeletionVerified, true);
  assert.equal(concurrent.permanentDeletionVerified, true);
  assert.deepEqual(await storage.listArtifactVersions(key), []);
  assert.ok(entries.some((item) => item.VersionId === "neighbor"));
  const repeated = await storage.deleteArtifact(key);
  assert.equal(repeated.deletedVersions, 0);
  assert.equal(repeated.permanentDeletionVerified, true);
});

test("artifact migration records a reference only after object verification", async () => {
  const events = [];
  const pool = {
    query: async (sql) => {
      if (sql.includes("FROM document_text_artifacts artifact")) {
        return { rows: [{
          document_id: "7",
          original_text: "citation-safe source text",
          extraction_method: "pdf_text",
          ocr_used: false,
          metadata_json: { pipelineVersion: "v2" },
          updated_at: new Date(),
          resource_id: "9",
        }] };
      }
      if (sql.includes("INSERT INTO artifact_storage_migration_runs")) {
        return { rows: [{ id: "3" }] };
      }
      events.push("pool-query");
      return { rows: [], rowCount: 1 };
    },
    connect: async () => ({
      query: async (sql) => {
        if (sql.includes("INSERT INTO document_artifact_objects")) {
          events.push("database-reference");
          assert.match(sql, /original_retained/);
        }
        return { rows: [], rowCount: 1 };
      },
      release: () => undefined,
    }),
  };
  const body = Buffer.from("citation-safe source text");
  const storage = {
    putArtifact: async () => {
      events.push("upload");
      return { key: "key", hash: sha256(body), bytes: body.length };
    },
    headArtifact: async () => {
      events.push("head-verify");
      return { key: "key", hash: sha256(body), bytes: body.length };
    },
    getArtifact: async () => {
      events.push("read-verify");
      return { key: "key", hash: sha256(body), body };
    },
  };
  const result = await migrateArtifacts(pool, { limit: 1, storage });
  assert.equal(result.verified, 1);
  assert.ok(events.indexOf("database-reference") > events.indexOf("read-verify"));
  assert.equal(artifactKindForRow({ extraction_method: "source_html" }), "source-html");
  assert.equal(artifactKindForRow({ extraction_method: "gemini_ocr" }), "ocr-text");
});

test("inline artifact cleanup requires explicit upload-checksum trust", async () => {
  const pool = {
    query: async () => {
      throw new Error("cleanup should not query without explicit trust");
    },
  };
  await assert.rejects(
    clearMigratedInlineArtifacts(pool, { trustUploadChecksum: false }),
    (error) => error.code === "INLINE_ARTIFACT_CLEAR_REQUIRES_TRUST",
  );
});

test("inline artifact cleanup only clears verified migrated payloads", async () => {
  const queries = [];
  const pool = {
    query: async (sql, params) => {
      queries.push({ sql, params });
      assert.match(sql, /JOIN document_artifact_objects object/);
      assert.match(sql, /object\.status = 'verified'/);
      assert.match(sql, /originalTextExternalized/);
      assert.deepEqual(params, [2]);
      return {
        rowCount: 2,
        rows: [{ cleared_bytes: "11" }, { cleared_bytes: "7" }],
      };
    },
  };
  const result = await clearMigratedInlineArtifacts(pool, {
    limit: 2,
    trustUploadChecksum: true,
  });
  assert.equal(queries.length, 1);
  assert.deepEqual(result, {
    clearedRows: 2,
    clearedBytes: 18,
    trustUploadChecksum: true,
  });
});

test("backend and Next metadata provide favicon endpoints", () => {
  const serverSource = fs.readFileSync(path.resolve(__dirname, "../server.js"), "utf8");
  const layoutSource = fs.readFileSync(
    path.resolve(__dirname, "../../client/src/app/layout.js"),
    "utf8",
  );
  assert.match(serverSource, /app\.get\("\/favicon\.ico"/);
  assert.match(layoutSource, /url: "\/favicon\.ico"/);
  assert.equal(fs.existsSync(path.resolve(__dirname, "../../client/src/app/favicon.ico")), true);
});

test("PostgreSQL chunk metadata omits duplicated payloads but preserves citations", () => {
  const metadata = postgresChunkMetadata({
    content: "already stored in original_text",
    summary: "already stored with the document artifact",
    pageStart: 4,
    pageEnd: 5,
    sectionId: "section-7",
    sourceUrl: "https://example.gov.in/record.pdf",
  });
  assert.equal(metadata.content, undefined);
  assert.equal(metadata.summary, undefined);
  assert.deepEqual(metadata, {
    pageStart: 4,
    pageEnd: 5,
    sectionId: "section-7",
    sourceUrl: "https://example.gov.in/record.pdf",
  });
});

test("object-storage reads fail closed on checksum mismatch", async () => {
  const body = Buffer.from("stored source artifact");
  const client = {
    send: async () => ({
      Body: { transformToByteArray: async () => body },
      Metadata: { sha256: sha256(body) },
      ContentType: "text/plain",
    }),
  };
  const storage = createObjectStorage({
    env: { OBJECT_STORAGE_BUCKET: "rashtram-artifacts" },
    client,
  });
  const artifact = await storage.getArtifact({ key: "verified-object" });
  assert.equal(artifact.body.toString(), body.toString());
  await assert.rejects(
    storage.getArtifact({ key: "verified-object", expectedHash: "0".repeat(64) }),
    (error) => error.code === "OBJECT_STORAGE_CHECKSUM_MISMATCH",
  );
});
