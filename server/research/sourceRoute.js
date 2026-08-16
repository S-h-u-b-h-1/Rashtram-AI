const express = require("express");
const {
  MAX_SOURCE_BYTES,
  addPdfSource,
  addUrlSource,
  deleteSource,
  listSources,
} = require("./sourceService");
const { sendError } = require("../lib/httpResponse");

const router = express.Router();

router.get("/", async (req, res) => {
  try {
    return res.json({ sources: await listSources(req.user.id) });
  } catch (error) {
    return sendError(res, error, "Research sources could not be loaded");
  }
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
    if (buffer.length > MAX_SOURCE_BYTES) {
      return res.status(413).json({ error: "PDF uploads are limited to 20 MB." });
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

router.delete("/:sourceId", async (req, res) => {
  try {
    const deleted = await deleteSource(req.user.id, req.params.sourceId);
    return res.status(deleted ? 200 : 404).json({ deleted });
  } catch (error) {
    return sendError(res, error, "The study source could not be removed");
  }
});

module.exports = router;
