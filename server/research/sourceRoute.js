const express = require("express");
const {
  MAX_SOURCE_BYTES,
  MAX_LEGACY_UPLOAD_BYTES,
  addPdfSource,
  addUrlSource,
  completePdfUpload,
  createPdfUploadIntent,
  deleteSource,
  listSources,
} = require("./sourceService");
const { sendError } = require("../lib/httpResponse");
const { objectStorageConfig } = require("../lib/storage/objectStorage");

const router = express.Router();

router.get("/", async (req, res) => {
  try {
    return res.json({ sources: await listSources(req.user.id) });
  } catch (error) {
    return sendError(res, error, "Research sources could not be loaded");
  }
});

router.get("/capabilities", (req, res) => {
  const directUpload = objectStorageConfig().configured;
  return res.json({
    directUpload,
    compatibilityUpload: directUpload,
    maxCompatibilityPdfBytes: MAX_LEGACY_UPLOAD_BYTES,
    storageStatus: directUpload ? "available" : "unavailable",
    maxPdfBytes: MAX_SOURCE_BYTES,
    maxPdfMegabytes: Math.floor(MAX_SOURCE_BYTES / 1024 / 1024),
    acceptedMimeTypes: ["application/pdf"],
    uploadIntegrity: {
      presignedUrlExpiresInSeconds: 300,
      providerEnforcesSignedContentLength: "provider-dependent",
      checksumSigned: true,
      postUploadHeadAndChecksumVerification: true,
      durableOriginalAfterProcessing: true,
      abandonedIntentCleanup: "bounded-lazy-and-scheduled",
    },
  });
});

router.post("/url", async (req, res) => {
  try {
    const url = String(req.body?.url || "").trim();
    if (!url) return res.status(400).json({ error: "A source link is required." });
    const source = await addUrlSource(req.user.id, url);
    return res.status(201).json({ source });
  } catch (error) {
    return sendError(res, error, "The source link could not be added");
  }
});

router.post("/upload", async (req, res) => {
  try {
    const fileName = String(req.body?.fileName || "document.pdf").trim().slice(0, 255);
    const mimeType = String(req.body?.mimeType || "application/pdf").trim();
    const encoded = String(req.body?.contentBase64 || "");
    if (!encoded) return res.status(400).json({ error: "A PDF file is required." });
    const buffer = Buffer.from(encoded, "base64");
    if (buffer.length > MAX_LEGACY_UPLOAD_BYTES) {
      return res.status(413).json({
        error: "This compatibility upload is limited to 3 MB. Please use the direct PDF upload flow.",
        code: "DIRECT_UPLOAD_REQUIRED",
      });
    }
    const source = await addPdfSource(req.user.id, {
      fileName,
      mimeType,
      buffer,
    });
    return res.status(201).json({ source });
  } catch (error) {
    return sendError(res, error, "The PDF could not be added for study");
  }
});

router.post("/upload-intent", async (req, res) => {
  try {
    const result = await createPdfUploadIntent(req.user.id, {
      fileName: req.body?.fileName,
      mimeType: req.body?.mimeType,
      sizeBytes: req.body?.sizeBytes,
      checksumSha256: req.body?.checksumSha256,
    });
    return res.status(201).json(result);
  } catch (error) {
    return sendError(res, error, "Private PDF upload could not be started");
  }
});

router.post("/:sourceId/process", async (req, res) => {
  try {
    const source = await completePdfUpload(req.user.id, req.params.sourceId);
    return res.status(200).json({ source });
  } catch (error) {
    return sendError(res, error, "Uploaded PDF could not be processed");
  }
});

router.delete("/:sourceId", async (req, res) => {
  try {
    const deleted = await deleteSource(req.user.id, req.params.sourceId);
    return res.status(deleted ? 200 : 404).json({ deleted });
  } catch (error) {
    return sendError(res, error, "The study source could not be removed");
  }
});

module.exports = router;
