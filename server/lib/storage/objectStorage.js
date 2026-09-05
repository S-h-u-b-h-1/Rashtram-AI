const crypto = require("node:crypto");
const {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  ListObjectVersionsCommand,
  PutObjectCommand,
  S3Client,
} = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");
const { NodeHttpHandler } = require("@smithy/node-http-handler");

const ARTIFACT_KINDS = new Set([
  "pdf",
  "source-html",
  "extracted-text",
  "ocr-text",
  "snapshot",
  "processing-log",
  "quarantine-archive",
]);

const sha256 = (body) =>
  crypto.createHash("sha256").update(body).digest("hex");

const userSourceObjectKey = ({ userId, uploadId, extension = "pdf" }) => {
  const normalizedUserId = String(userId || "");
  const normalizedUploadId = String(uploadId || "").toLowerCase();
  const safeExtension = String(extension).toLowerCase().replace(/[^a-z0-9]/g, "");
  if (!/^\d+$/.test(normalizedUserId) || !/^[a-f0-9-]{36}$/.test(normalizedUploadId)) {
    throw new Error("User-source object identity is invalid.");
  }
  if (!safeExtension) throw new Error("User-source object extension is invalid.");
  return `rashtram/user-sources/${normalizedUserId}/${normalizedUploadId}.${safeExtension}`;
};

const userSourceIntentObjectKey = ({ userId, uploadId, extension = "pdf" }) =>
  userSourceObjectKey({ userId, uploadId, extension }).replace(
    "rashtram/user-sources/",
    "rashtram/user-source-intents/",
  );

const artifactKey = ({ kind, hash, extension = "bin" }) => {
  if (!ARTIFACT_KINDS.has(kind)) {
    throw new Error(`Unsupported object-storage artifact kind: ${kind}`);
  }
  if (!/^[a-f0-9]{64}$/i.test(hash)) {
    throw new Error("Object-storage artifact hash must be a SHA-256 hex digest.");
  }
  const safeExtension = String(extension).toLowerCase().replace(/[^a-z0-9]/g, "");
  if (!safeExtension) throw new Error("Object-storage extension is invalid.");
  return `rashtram/${kind}/${hash.slice(0, 2)}/${hash}.${safeExtension}`;
};

const objectStorageConfig = (env = process.env) => {
  const requestTimeoutMs = Number.parseInt(
    env.OBJECT_STORAGE_REQUEST_TIMEOUT_MS || "120000",
    10,
  );
  const provider = String(env.OBJECT_STORAGE_PROVIDER || "disabled").trim().toLowerCase();
  const endpoint = env.OBJECT_STORAGE_ENDPOINT || null;
  const bucket = env.OBJECT_STORAGE_BUCKET || null;
  const accessKeyId = env.OBJECT_STORAGE_ACCESS_KEY_ID || null;
  const secretAccessKey = env.OBJECT_STORAGE_SECRET_ACCESS_KEY || null;
  const configured = provider !== "disabled" &&
    Boolean(endpoint && bucket && accessKeyId && secretAccessKey);
  return {
    configured,
    provider,
    endpoint,
    bucket,
    region: env.OBJECT_STORAGE_REGION || "auto",
    forcePathStyle: ["1", "true", "yes"].includes(
      String(env.OBJECT_STORAGE_FORCE_PATH_STYLE || "false").toLowerCase(),
    ),
    credentials: configured ? { accessKeyId, secretAccessKey } : null,
    publicBaseUrl: env.OBJECT_STORAGE_PUBLIC_BASE_URL || null,
    requestTimeoutMs: Number.isFinite(requestTimeoutMs) && requestTimeoutMs > 0
      ? requestTimeoutMs
      : 120000,
  };
};

const sanitizedObjectStorageStatus = (env = process.env) => {
  const config = objectStorageConfig(env);
  return {
    configured: config.configured,
    reachable: false,
    readAvailable: false,
    writeAvailable: false,
    providerName: config.provider,
  };
};

const listExactObjectVersions = async ({
  client,
  bucket,
  key,
  maxPages = 100,
}) => {
  const exactKey = String(key || "");
  if (!exactKey) throw new Error("Object-storage key is required for version listing.");
  const matches = [];
  let keyMarker;
  let versionIdMarker;
  for (let page = 0; page < maxPages; page += 1) {
    const result = await client.send(new ListObjectVersionsCommand({
      Bucket: bucket,
      Prefix: exactKey,
      MaxKeys: 1000,
      ...(keyMarker ? { KeyMarker: keyMarker } : {}),
      ...(versionIdMarker ? { VersionIdMarker: versionIdMarker } : {}),
    }));
    for (const item of result.Versions || []) {
      if (item.Key === exactKey && item.VersionId != null) {
        matches.push({ key: exactKey, versionId: String(item.VersionId), kind: "version" });
      }
    }
    for (const item of result.DeleteMarkers || []) {
      if (item.Key === exactKey && item.VersionId != null) {
        matches.push({ key: exactKey, versionId: String(item.VersionId), kind: "delete_marker" });
      }
    }
    if (!result.IsTruncated) return matches;
    if (!result.NextKeyMarker ||
        result.NextKeyMarker === keyMarker && result.NextVersionIdMarker === versionIdMarker) {
      throw new Error("Object-version listing did not advance safely.");
    }
    keyMarker = result.NextKeyMarker;
    versionIdMarker = result.NextVersionIdMarker;
  }
  throw new Error("Object-version listing exceeded the bounded pagination limit.");
};

const createObjectStorage = ({ env = process.env, client } = {}) => {
  const config = objectStorageConfig(env);
  if (!config.configured && !client) {
    throw new Error(
      "S3-compatible object storage is not configured. Set endpoint, bucket, and object-storage credentials.",
    );
  }
  const storageClient = client || new S3Client({
    endpoint: config.endpoint,
    region: config.region,
    forcePathStyle: config.forcePathStyle,
    credentials: config.credentials,
    requestHandler: new NodeHttpHandler({
      connectionTimeout: Math.min(config.requestTimeoutMs, 15000),
      socketTimeout: config.requestTimeoutMs,
    }),
  });
  const bucket = config.bucket || env.OBJECT_STORAGE_BUCKET;

  return {
    async createPresignedUpload({
      key,
      contentType,
      contentLength,
      checksumSha256,
      expiresIn = 300,
    }) {
      const ttl = Math.min(Math.max(Number(expiresIn) || 300, 60), 300);
      const checksumBase64 = /^[a-f0-9]{64}$/i.test(String(checksumSha256 || ""))
        ? Buffer.from(checksumSha256, "hex").toString("base64")
        : null;
      const command = new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        ContentType: contentType || "application/pdf",
        ...(Number.isSafeInteger(Number(contentLength)) && Number(contentLength) > 0
          ? { ContentLength: Number(contentLength) }
          : {}),
        ...(checksumBase64 ? { ChecksumSHA256: checksumBase64 } : {}),
        Metadata: {
          ...(Number.isSafeInteger(Number(contentLength))
            ? { expectedsize: String(contentLength) }
            : {}),
          ...(checksumSha256 ? { expectedsha256: String(checksumSha256).toLowerCase() } : {}),
        },
      });
      const uploadUrl = await getSignedUrl(storageClient, command, { expiresIn: ttl });
      return {
        key,
        uploadUrl,
        expiresIn: ttl,
        requiredHeaders: {
          "Content-Type": contentType || "application/pdf",
        },
      };
    },

    async putUserSourceArtifact({
      userId,
      uploadId = crypto.randomUUID(),
      body,
      contentType,
      extension,
      metadata = {},
    }) {
      const buffer = Buffer.isBuffer(body) ? body : Buffer.from(body);
      const hash = sha256(buffer);
      const key = userSourceObjectKey({ userId, uploadId, extension });
      await storageClient.send(new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: buffer,
        ContentType: contentType || "application/octet-stream",
        ChecksumSHA256: Buffer.from(hash, "hex").toString("base64"),
        Metadata: {
          ...Object.fromEntries(
            Object.entries(metadata).map(([name, value]) => [name, String(value)]),
          ),
          sha256: hash,
        },
      }));
      return { key, hash, bytes: buffer.length };
    },

    async putArtifact({ kind, body, contentType, extension, metadata = {} }) {
      const buffer = Buffer.isBuffer(body) ? body : Buffer.from(body);
      const hash = sha256(buffer);
      const key = artifactKey({ kind, hash, extension });
      await storageClient.send(new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: buffer,
        ContentType: contentType || "application/octet-stream",
        ChecksumSHA256: Buffer.from(hash, "hex").toString("base64"),
        Metadata: {
          ...Object.fromEntries(
            Object.entries(metadata).map(([name, value]) => [name, String(value)]),
          ),
          sha256: hash,
        },
      }));
      return { key, hash, bytes: buffer.length };
    },

    async headArtifact(key) {
      const result = await storageClient.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
      return {
        key,
        bytes: Number(result.ContentLength || 0),
        contentType: result.ContentType || null,
        hash: result.Metadata?.sha256 || null,
      };
    },

    async getArtifact({ key, expectedHash }) {
      const result = await storageClient.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
      const body = Buffer.from(await result.Body.transformToByteArray());
      const actualHash = sha256(body);
      const recordedHash = expectedHash || result.Metadata?.sha256;
      if (recordedHash && actualHash !== recordedHash) {
        const error = new Error("Object-storage checksum verification failed.");
        error.code = "OBJECT_STORAGE_CHECKSUM_MISMATCH";
        throw error;
      }
      return {
        key,
        body,
        hash: actualHash,
        contentType: result.ContentType || null,
      };
    },

    async listArtifactVersions(key) {
      return listExactObjectVersions({ client: storageClient, bucket, key });
    },

    async deleteArtifact(key) {
      const exactKey = String(key || "");
      if (!exactKey) throw new Error("Object-storage key is required for permanent deletion.");
      const maxPasses = 10;
      let deletedVersions = 0;
      for (let pass = 0; pass < maxPasses; pass += 1) {
        const versions = await listExactObjectVersions({
          client: storageClient,
          bucket,
          key: exactKey,
        });
        if (!versions.length) {
          return {
            key: exactKey,
            deleted: true,
            deletedVersions,
            permanentDeletionVerified: true,
          };
        }
        for (const version of versions) {
          await storageClient.send(new DeleteObjectCommand({
            Bucket: bucket,
            Key: exactKey,
            VersionId: version.versionId,
          }));
          deletedVersions += 1;
        }
      }
      const remaining = await listExactObjectVersions({
        client: storageClient,
        bucket,
        key: exactKey,
      });
      if (remaining.length) {
        const error = new Error("Object-storage permanent deletion could not be verified.");
        error.code = "OBJECT_STORAGE_DELETE_INCOMPLETE";
        throw error;
      }
      return {
        key: exactKey,
        deleted: true,
        deletedVersions,
        permanentDeletionVerified: true,
      };
    },
  };
};

const isMissingObjectError = (error) =>
  error?.name === "NotFound" ||
  error?.name === "NoSuchKey" ||
  error?.$metadata?.httpStatusCode === 404;

const runObjectStorageSmokeTest = async ({ env = process.env, client } = {}) => {
  const status = sanitizedObjectStorageStatus(env);
  if (!status.configured && !client) {
    return { ...status, skipped: true, reason: "Object storage is disabled." };
  }
  const storage = createObjectStorage({ env, client });
  const nonce = crypto.randomBytes(16).toString("hex");
  const body = Buffer.from(`rashtram-object-storage-smoke:${nonce}`, "utf8");
  let key = null;
  try {
    const uploaded = await storage.putArtifact({
      kind: "processing-log",
      body,
      contentType: "text/plain; charset=utf-8",
      extension: "txt",
      metadata: { disposable: "true" },
    });
    key = uploaded.key;
    const head = await storage.headArtifact(key);
    const downloaded = await storage.getArtifact({
      key,
      expectedHash: uploaded.hash,
    });
    if (head.hash !== uploaded.hash || !downloaded.body.equals(body)) {
      const error = new Error("Object-storage smoke-test byte verification failed.");
      error.code = "OBJECT_STORAGE_SMOKE_VERIFICATION_FAILED";
      throw error;
    }
    const versionInventoryBeforeDelete = await storage.listArtifactVersions(key);
    const deletion = await storage.deleteArtifact(key);
    const versionInventoryAfterDelete = await storage.listArtifactVersions(key);
    if (!deletion.permanentDeletionVerified || versionInventoryAfterDelete.length) {
      const error = new Error("Object-storage version inventory remained after deletion.");
      error.code = "OBJECT_STORAGE_SMOKE_DELETE_FAILED";
      throw error;
    }
    try {
      await storage.headArtifact(key);
      const error = new Error("Object-storage smoke-test object remained after deletion.");
      error.code = "OBJECT_STORAGE_SMOKE_DELETE_FAILED";
      throw error;
    } catch (error) {
      if (!isMissingObjectError(error)) throw error;
    }
    return {
      configured: true,
      reachable: true,
      readAvailable: true,
      writeAvailable: true,
      providerName: objectStorageConfig(env).provider,
      checksumVerified: true,
      byteEqualityVerified: true,
      versionInventoryBeforeDelete: versionInventoryBeforeDelete.length,
      versionInventoryAfterDelete: versionInventoryAfterDelete.length,
      permanentDeletionVerified: true,
      leftoverObject: false,
    };
  } catch (error) {
    if (key) await storage.deleteArtifact(key).catch(() => undefined);
    error.objectStorageStatus = {
      configured: true,
      reachable: Boolean(key),
      readAvailable: false,
      writeAvailable: Boolean(key),
      providerName: objectStorageConfig(env).provider,
    };
    throw error;
  }
};

module.exports = {
  ARTIFACT_KINDS,
  artifactKey,
  createObjectStorage,
  isMissingObjectError,
  listExactObjectVersions,
  objectStorageConfig,
  sanitizedObjectStorageStatus,
  runObjectStorageSmokeTest,
  sha256,
  userSourceObjectKey,
  userSourceIntentObjectKey,
};
