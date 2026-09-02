#!/usr/bin/env node

const path = require("node:path");
require("dotenv").config({
  path: process.env.ENV_FILE || path.resolve(__dirname, "../.env.local"),
});
const {
  GetBucketCorsCommand,
  PutBucketCorsCommand,
  S3Client,
} = require("@aws-sdk/client-s3");
const { NodeHttpHandler } = require("@smithy/node-http-handler");
const { objectStorageConfig } = require("../lib/storage/objectStorage");

const config = objectStorageConfig();
if (!config.configured) throw new Error("Object storage is not configured.");

const client = new S3Client({
  endpoint: config.endpoint,
  region: config.region,
  forcePathStyle: config.forcePathStyle,
  credentials: config.credentials,
  requestHandler: new NodeHttpHandler({ connectionTimeout: 15_000, socketTimeout: 120_000 }),
});

const expectedRule = {
  ID: "rashtram-private-research-source-upload",
  AllowedHeaders: ["*"],
  AllowedMethods: ["PUT"],
  AllowedOrigins: [
    "https://rashtram-ai.vercel.app",
    "http://localhost:3000",
  ],
  ExposeHeaders: ["ETag"],
  MaxAgeSeconds: 3600,
};

(async () => {
  let current = [];
  try {
    current = (await client.send(new GetBucketCorsCommand({ Bucket: config.bucket }))).CORSRules || [];
  } catch (error) {
    if (!["NoSuchCORSConfiguration", "NoSuchCorsConfiguration"].includes(error.name) &&
        Number(error.$metadata?.httpStatusCode || 0) !== 404) throw error;
  }
  const retained = current.filter((rule) =>
    rule.ID !== expectedRule.ID &&
    !rule.AllowedOrigins?.includes("https://rashtram-ai.vercel.app"),
  );
  await client.send(new PutBucketCorsCommand({
    Bucket: config.bucket,
    CORSConfiguration: { CORSRules: [...retained, expectedRule] },
  }));
  const verified = (await client.send(new GetBucketCorsCommand({ Bucket: config.bucket }))).CORSRules || [];
  const active = verified.find((rule) =>
    rule.ID === expectedRule.ID ||
    rule.AllowedOrigins?.includes("https://rashtram-ai.vercel.app"),
  );
  if (!active || !active.AllowedOrigins?.includes("https://rashtram-ai.vercel.app") || !active.AllowedMethods?.includes("PUT")) {
    throw new Error("The source-upload CORS rule could not be verified after writing it.");
  }
  console.log(JSON.stringify({
    configured: true,
    ruleId: active.ID,
    origins: active.AllowedOrigins,
    methods: active.AllowedMethods,
    publicReadEnabled: false,
  }, null, 2));
})().catch((error) => {
  console.error(JSON.stringify({ message: error.message, code: error.Code || error.name || null }));
  process.exitCode = 1;
});
