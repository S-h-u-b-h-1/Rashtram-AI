const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const assert = require("node:assert/strict");
const {
  assertBulkProcessingSafe,
  buildProjections,
  evaluateStorageStatus,
} = require("../lib/database/capacity");
const {
  artifactKey,
  createObjectStorage,
  sanitizedObjectStorageStatus,
  sha256,
} = require("../lib/storage/objectStorage");
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
  assert.equal(projections[0].breakdown.chunks, 400);
  assert.equal(projections[0].breakdown.summaries, 200);
  assert.equal(projections[0].breakdown.documents, 100);
  assert.equal(projections[0].projectedBytes, 1_050);
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
  assert.match(status, /example\.r2\.cloudflarestorage\.com/);
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
