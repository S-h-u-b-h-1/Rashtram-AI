const express = require("express");
const DocumentService = require("./DocumentService");
const DocumentRepository = require("./DocumentRepository");
const {
  retrievePassages,
} = require("./documentResearchService");
const { generateResponse } = require("../lib/vectordb");
const {
  createComparison,
  getComparison,
} = require("./documentComparisonService");

const router = express.Router();

const sendError = (res, error, context) => {
  const status = error.status || 500;
  if (status >= 500) console.error(`${context}:`, error);
  return res.status(status).json({ error: error.message });
};

router.get("/", async (req, res) => {
  try {
    const result = await DocumentService.find(req.query);
    const filters = await DocumentService.getFilterOptions(req.query);
    return res.json({ ...result, filters, source: "universal-repository" });
  } catch (error) {
    return sendError(res, error, "Universal document query failed");
  }
});

router.get("/search", async (req, res) => {
  try {
    const result = await DocumentService.search({
      ...req.query,
      search: req.query.q || req.query.search,
    });
    return res.json({ ...result, source: "universal-search" });
  } catch (error) {
    return sendError(res, error, "Universal document search failed");
  }
});

router.get("/filters", async (req, res) => {
  try {
    return res.json(await DocumentService.getFilterOptions(req.query));
  } catch (error) {
    return sendError(res, error, "Universal document filters failed");
  }
});

router.post("/compare", async (req, res) => {
  try {
    const comparison = await createComparison(req.user.id, req.body);
    return res.status(201).json({ comparison });
  } catch (error) {
    return sendError(res, error, "Document comparison failed");
  }
});

router.get("/compare/:comparisonId", async (req, res) => {
  try {
    const comparison = await getComparison(
      req.user.id,
      req.params.comparisonId,
    );
    if (!comparison) {
      return res.status(404).json({ error: "Comparison not found." });
    }
    return res.json({ comparison });
  } catch (error) {
    return sendError(res, error, "Document comparison lookup failed");
  }
});

router.post("/chat", async (req, res) => {
  try {
    const ids = [
      ...new Set(
        (Array.isArray(req.body.documentIds) ? req.body.documentIds : [])
          .map(String)
          .filter(Boolean),
      ),
    ].slice(0, 5);
    const message = String(req.body.message || "").trim();
    if (!ids.length || !message) {
      return res.status(400).json({
        error: "A message and one to five document IDs are required.",
      });
    }
    const documents = (
      await Promise.all(ids.map((id) => DocumentRepository.getById(id)))
    ).filter(Boolean);
    if (!documents.length) {
      return res.status(404).json({ error: "Documents not found." });
    }
    const passagesPerDocument = Math.max(
      2,
      Math.floor(12 / documents.length),
    );
    const passageGroups = await Promise.all(
      documents.map(async (document) => ({
        document,
        passages: await retrievePassages(
          document.type,
          document.id,
          message,
          passagesPerDocument,
        ),
      })),
    );
    let passageNumber = 0;
    const sources = passageGroups.flatMap(({ document, passages }) =>
      passages.map((passage) => ({
        ...passage,
        passage: ++passageNumber,
        documentId: document.id,
        documentType: document.type,
        documentTitle: document.title,
        sourceUrl: document.sourceUrl,
        pdfUrl: document.pdfUrl,
      })),
    );
    const context = sources
      .map(
        (source) =>
          `[Passage ${source.passage}] ${source.documentTitle}\n${source.content}`,
      )
      .join("\n\n");
    if (!context) {
      const error = new Error(
        "No indexed passages are available for the selected documents.",
      );
      error.status = 422;
      throw error;
    }

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    res.write(
      `data: ${JSON.stringify({
        type: "meta",
        documents: documents.map(({ id, type, title }) => ({
          id,
          type,
          title,
        })),
        sources: sources.map((source) => ({
          ...source,
          content: source.content.slice(0, 360),
        })),
      })}\n\n`,
    );
    const responseLanguage = req.body.responseLanguage || "Auto";
    const stream = await generateResponse(message, context, {
      responseLanguage,
    });
    for await (const chunk of stream) {
      const content =
        typeof chunk.text === "function" ? chunk.text() : chunk.text || "";
      if (content) {
        res.write(`data: ${JSON.stringify({ type: "content", content })}\n\n`);
      }
    }
    res.write("data: [DONE]\n\n");
    return res.end();
  } catch (error) {
    console.error("Cross-document chat failed:", error);
    if (!res.headersSent) return sendError(res, error, "Cross-document chat failed");
    res.write(
      `data: ${JSON.stringify({ type: "error", error: error.message })}\n\n`,
    );
    return res.end();
  }
});

router.get("/:id/summary", async (req, res) => {
  try {
    const summary = await DocumentService.getSummary(req.params.id, req.user.id);
    return res.json({ summary });
  } catch (error) {
    return sendError(res, error, "Universal document summary failed");
  }
});

router.get("/:id/relationships", async (req, res) => {
  try {
    const relationships = await DocumentService.getRelated(req.params.id);
    return res.json({ relationships });
  } catch (error) {
    return sendError(res, error, "Universal document relationships failed");
  }
});

router.get("/:id/recommendations", async (req, res) => {
  try {
    const [recommendations, relatedChats] = await Promise.all([
      DocumentService.getRecommendations(
        req.params.id,
        req.user.id,
        req.query.limit,
      ),
      DocumentService.getRelatedChats(
        req.params.id,
        req.user.id,
        req.query.limit,
      ),
    ]);
    return res.json({ recommendations, relatedChats });
  } catch (error) {
    return sendError(res, error, "Universal recommendations failed");
  }
});

router.get("/:id/timeline", async (req, res) => {
  try {
    const timeline = await DocumentService.getTimeline(req.params.id);
    return res.json({ timeline });
  } catch (error) {
    return sendError(res, error, "Universal timeline failed");
  }
});

router.get("/:id/graph", async (req, res) => {
  try {
    const graph = await DocumentService.getGraph(req.params.id);
    return res.json({ graph });
  } catch (error) {
    return sendError(res, error, "Universal graph failed");
  }
});

router.get("/:id", async (req, res) => {
  try {
    const document = await DocumentService.getById(req.params.id, req.user.id);
    if (!document) {
      return res.status(404).json({ error: "Document not found." });
    }
    return res.json({ document });
  } catch (error) {
    return sendError(res, error, "Universal document lookup failed");
  }
});

module.exports = router;
