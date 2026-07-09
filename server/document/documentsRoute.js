const express = require("express");
const crypto = require("node:crypto");
const { query } = require("../db");
const DocumentService = require("./DocumentService");
const DocumentRepository = require("./DocumentRepository");
const {
  retrievePassages,
} = require("./documentResearchService");
const { generateResponse } = require("../lib/vectordb");
const {
  completeSSE,
  errorSSE,
  sendSSE,
  startSSE,
} = require("../lib/sse");
const {
  createComparison,
  deleteComparison,
  getComparison,
} = require("./documentComparisonService");
const {
  getComparisonRecommendations,
  getDocumentRecommendations,
} = require("./recommendationService");
const { prepareDocument } = require("./readinessService");
const { getDocumentReadiness } = require("./readinessContract");

const router = express.Router();

const normalizeChatIds = (value) => [
  ...new Set(
    (Array.isArray(value) ? value : String(value || "").split(","))
      .map((id) => String(id || "").trim())
      .filter(Boolean),
  ),
].slice(0, 5);

const selectionKey = (ids) =>
  [...ids].sort((left, right) =>
    left.localeCompare(right, undefined, { numeric: true }),
  ).join(":");

const sendError = (res, error, context) => {
  const status = error.status || 500;
  if (status >= 500) console.error(`${context}:`, error);
  return res.status(status).json({
    error: error.message,
    ...(error.details ? { details: error.details } : {}),
  });
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

router.post("/recommend-for-comparison", async (req, res) => {
  try {
    return res.json(
      await getComparisonRecommendations(req.user.id, req.body),
    );
  } catch (error) {
    return sendError(res, error, "Comparison recommendations failed");
  }
});

router.get("/chat/history", async (req, res) => {
  try {
    const ids = normalizeChatIds(req.query.ids);
    if (ids.length < 2) return res.json({ messages: [] });
    const result = await query(
      `SELECT messages, comparison_id, updated_at
       FROM multi_document_chats
       WHERE user_id = $1 AND selection_key = $2
       LIMIT 1`,
      [req.user.id, selectionKey(ids)],
    );
    const row = result.rows[0];
    return res.json({
      messages: row?.messages || [],
      comparisonId: row?.comparison_id ? String(row.comparison_id) : null,
      updatedAt: row?.updated_at || null,
    });
  } catch (error) {
    return sendError(res, error, "Cross-document history lookup failed");
  }
});

router.delete("/chat/history", async (req, res) => {
  try {
    const ids = normalizeChatIds(req.query.ids);
    if (ids.length < 2) {
      return res.status(400).json({ error: "At least two IDs are required." });
    }
    await query(
      `DELETE FROM multi_document_chats
       WHERE user_id = $1 AND selection_key = $2`,
      [req.user.id, selectionKey(ids)],
    );
    return res.json({ success: true });
  } catch (error) {
    return sendError(res, error, "Cross-document history clear failed");
  }
});

router.post("/compare", async (req, res) => {
  try {
    const comparison = await createComparison(req.user.id, req.body);
    return res.status(201).json({
      comparison,
      comparisonId: comparison.id,
      documents: comparison.result.documents || [],
      summary: comparison.result.executiveSummary || "",
      ...comparison.result,
      recommendedDocuments: comparison.recommendedDocuments,
      createdAt: comparison.createdAt,
    });
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
    return res.json({
      comparison,
      comparisonId: comparison.id,
      documents: comparison.result.documents || [],
      summary: comparison.result.executiveSummary || "",
      ...comparison.result,
      recommendedDocuments: comparison.recommendedDocuments,
      createdAt: comparison.createdAt,
    });
  } catch (error) {
    return sendError(res, error, "Document comparison lookup failed");
  }
});

router.delete("/compare/:comparisonId", async (req, res) => {
  try {
    const deleted = await deleteComparison(
      req.user.id,
      req.params.comparisonId,
    );
    return res.status(deleted ? 200 : 404).json({ deleted });
  } catch (error) {
    return sendError(res, error, "Document comparison delete failed");
  }
});

router.post("/chat", async (req, res) => {
  try {
    const ids = normalizeChatIds(req.body.documentIds);
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

    startSSE(res);
    sendSSE(res, {
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
      metadata: {
        grounded: true,
        documentCount: documents.length,
      },
    });
    const responseLanguage = req.body.responseLanguage || "Auto";
    const stream = await generateResponse(message, context, {
      responseLanguage,
    });
    let fullResponse = "";
    for await (const chunk of stream) {
      if (res.destroyed || res.writableEnded) break;
      const content =
        typeof chunk.text === "function" ? chunk.text() : chunk.text || "";
      if (content) {
        fullResponse += content;
        sendSSE(res, { type: "content", content });
      }
    }
    if (res.destroyed || res.writableEnded) return undefined;
    const now = new Date().toISOString();
    const persistedMessages = [
      {
        _id: crypto.randomUUID(),
        sender: "user",
        text: message,
        timestamp: now,
        sources: [],
      },
      {
        _id: crypto.randomUUID(),
        sender: "assistant",
        text: fullResponse,
        timestamp: now,
        sources,
        metadata: {
          grounded: true,
          documentIds: ids,
          responseLanguage,
        },
      },
    ];
    await query(
      `INSERT INTO multi_document_chats (
         user_id, selection_key, document_ids_json, comparison_id, messages
       )
       VALUES (
         $1, $2, $3::jsonb,
         (
           SELECT id FROM document_comparisons
           WHERE id::TEXT = $4 AND user_id = $1
         ),
         $5::jsonb
       )
       ON CONFLICT (user_id, selection_key)
       DO UPDATE SET
         messages = multi_document_chats.messages || EXCLUDED.messages,
         comparison_id = COALESCE(
           EXCLUDED.comparison_id,
           multi_document_chats.comparison_id
         ),
         updated_at = NOW()`,
      [
        req.user.id,
        selectionKey(ids),
        JSON.stringify(ids),
        String(req.body.comparisonId || ""),
        JSON.stringify(persistedMessages),
      ],
    );
    completeSSE(res, { persisted: true });
    return undefined;
  } catch (error) {
    console.error("Cross-document chat failed:", error);
    if (!res.headersSent) return sendError(res, error, "Cross-document chat failed");
    errorSSE(res, error);
    return undefined;
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

router.get("/:id/readiness", async (req, res) => {
  try {
    const readiness = await getDocumentReadiness(req.params.id);
    if (!readiness) {
      return res.status(404).json({ error: "Document not found." });
    }
    const { document: _document, ...payload } = readiness;
    return res.json(payload);
  } catch (error) {
    return sendError(res, error, "Document readiness lookup failed");
  }
});

router.post("/:id/prepare", async (req, res) => {
  try {
    const before = await getDocumentReadiness(req.params.id);
    if (!before) {
      return res.status(404).json({ error: "Document not found." });
    }
    if (before.comparisonReady) {
      const { document: _document, ...payload } = before;
      return res.json({ success: true, alreadyReady: true, readiness: payload });
    }
    if (!before.canPrepare) {
      const error = new Error(before.reason || "This document cannot be prepared.");
      error.status = 422;
      throw error;
    }
    const result = await prepareDocument(req.params.id, {
      userId: req.user.id,
      priority: 100,
      reason: "document_prepare",
    });
    const after = await getDocumentReadiness(req.params.id);
    const { document: _document, ...readiness } = after || {};
    return res.json({
      success: Boolean(after?.comparisonReady),
      ...result,
      readiness,
      researchReady: Boolean(after?.researchReady),
      comparisonReady: Boolean(after?.comparisonReady),
    });
  } catch (error) {
    return sendError(res, error, "Document preparation failed");
  }
});

router.get("/:id/relationships", async (req, res) => {
  try {
    const { getRelationships } = require("../graph/knowledgeGraphService");
    return res.json(
      await getRelationships(req.params.id, {
        type: req.query.type,
        minimumConfidence: req.query.minimumConfidence,
        limit: req.query.limit,
        offset: req.query.offset,
      }),
    );
  } catch (error) {
    return sendError(res, error, "Universal document relationships failed");
  }
});

router.get("/:id/recommendations", async (req, res) => {
  try {
    const [recommendations, relatedChats] = await Promise.all([
      getDocumentRecommendations(req.params.id, req.user.id, {
        type: req.query.type,
        limit: req.query.limit,
        includeNonReady: req.query.includeNonReady,
        useUserProfile: req.query.useUserProfile,
        query: req.query.q || req.query.query,
      }),
      DocumentService.getRelatedChats(
        req.params.id,
        req.user.id,
        req.query.limit,
      ),
    ]);
    return res.json({
      documentId: String(req.params.id),
      recommendations,
      relatedChats,
    });
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
    const { getGraph } = require("../graph/knowledgeGraphService");
    const graph = await getGraph(req.params.id, {
      depth: req.query.depth,
      limit: req.query.limit,
    });
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
