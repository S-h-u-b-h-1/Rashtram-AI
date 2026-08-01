const crypto = require("node:crypto");
const {
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} = require("@aws-sdk/client-s3");

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
  const endpoint = env.OBJECT_STORAGE_ENDPOINT || null;
  const bucket = env.OBJECT_STORAGE_BUCKET || null;
  const accessKeyId = env.OBJECT_STORAGE_ACCESS_KEY_ID || null;
  const secretAccessKey = env.OBJECT_STORAGE_SECRET_ACCESS_KEY || null;
  const configured = Boolean(endpoint && bucket && accessKeyId && secretAccessKey);
  return {
    configured,
    endpoint,
    bucket,
    region: env.OBJECT_STORAGE_REGION || "auto",
    forcePathStyle: ["1", "true", "yes"].includes(
      String(env.OBJECT_STORAGE_FORCE_PATH_STYLE || "false").toLowerCase(),
    ),
    credentials: configured ? { accessKeyId, secretAccessKey } : null,
  };
};

const sanitizedObjectStorageStatus = (env = process.env) => {
  const config = objectStorageConfig(env);
  let endpointHost = null;
  if (config.endpoint) {
    try {
      endpointHost = new URL(config.endpoint).hostname;
    } catch {
      endpointHost = "invalid";
    }
  }
  return {
    configured: config.configured,
    provider: "s3-compatible",
    endpointHost,
    bucketConfigured: Boolean(config.bucket),
    region: config.region,
  };
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
  });
  const bucket = config.bucket || env.OBJECT_STORAGE_BUCKET;

  return {
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
  };
};

module.exports = {
  ARTIFACT_KINDS,
  artifactKey,
  createObjectStorage,
  objectStorageConfig,
  sanitizedObjectStorageStatus,
  sha256,
};
