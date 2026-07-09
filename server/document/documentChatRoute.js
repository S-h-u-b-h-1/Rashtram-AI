const express = require("express");
const DocumentChat = require("../models/DocumentChat");
const {
  getDocumentContext,
  retrievePassages,
} = require("./documentResearchService");
const { generateResponse } = require("../lib/vectordb");
const {
  getRelationshipContext,
} = require("../graph/knowledgeGraphService");
const {
  prepareDocument,
} = require("./readinessService");
const { getDocumentReadiness } = require("./readinessContract");
const DocumentRepository = require("./DocumentRepository");
const {
  completeSSE,
  errorSSE,
  sendSSE,
  startSSE,
} = require("../lib/sse");

const router = express.Router();

const identity = (req) => {
  const body = req.body || {};
  const requestQuery = req.query || {};
  const params = req.params || {};
  const rawId =
    body.documentId || requestQuery.documentId || params.documentId;
  if (!rawId) {
    const error = new Error("Document ID is required.");
    error.status = 400;
    throw error;
  }
  let documentType;
  try {
    documentType = DocumentChat.normalizeType(
      body.documentType ||
        requestQuery.documentType ||
        params.documentType,
    );
  } catch (error) {
    error.status = 400;
    throw error;
  }
  return {
    documentType,
    documentId: String(rawId),
  };
};

const respondWithError = (res, error, context) => {
  const status = error.status || 500;
  if (status >= 500) {
    console.error(`${context}:`, error);
  }
  return res.status(status).json({ error: error.message });
};

router.get("/document/:documentType/:documentId", async (req, res) => {
  try {
    const { documentType, documentId } = identity(req);
    const document = await getDocumentContext(documentType, documentId);
    if (!document) {
      return res.status(404).json({ error: "Document not found." });
    }
    return res.json({ document });
  } catch (error) {
    return respondWithError(res, error, "Unified document context failed");
  }
});

router.post("/process", async (req, res) => {
  const startedAt = Date.now();
  let documentId = null;
  try {
    const identityValue = identity(req);
    const { documentType } = identityValue;
    documentId = identityValue.documentId;
    console.log("[document-process] started", {
      documentType,
      documentId,
    });
    const result = await prepareDocument(documentId, {
      userId: req.user.id,
      priority: 100,
      reason: "user_prepare",
    });
    console.log("[document-process] completed", {
      documentType,
      documentId,
      chunksStored: result.chunksStored,
      alreadyProcessed: result.alreadyProcessed,
      durationMs: Date.now() - startedAt,
      languageCode: result.textArtifact?.languageCode || null,
      ocrUsed: result.textArtifact?.ocrUsed || false,
    });
    const readiness = await getDocumentReadiness(documentId);
    const { document: _document, ...readinessPayload } = readiness || {};
    return res.json({
      success: Boolean(readiness?.comparisonReady || result.researchReady),
      ...result,
      readiness: readinessPayload,
      researchReady: Boolean(readiness?.researchReady || result.researchReady),
      comparisonReady: Boolean(
        readiness?.comparisonReady || result.comparisonReady,
      ),
    });
  } catch (error) {
    console.error("[document-process] failed", {
      message: error.message,
      status: error.status || 500,
      durationMs: Date.now() - startedAt,
      documentType: req.body?.documentType,
      documentId: req.body?.documentId,
    });
    return respondWithError(
      res,
      error,
      "Unified document processing failed",
    );
  }
});

router.post("/session", async (req, res) => {
  try {
    const { documentType, documentId } = identity(req);
    const document = await getDocumentContext(documentType, documentId);
    if (!document) {
      return res.status(404).json({ error: "Document not found." });
    }
    const chat = await DocumentChat.findOrCreate(req.user.id, {
      ...document,
      documentType,
      documentId,
      summary: req.body.summary || null,
    });
    return res.json({ success: true, chat, document });
  } catch (error) {
    return respondWithError(res, error, "Unified chat session failed");
  }
});

router.get("/history", async (req, res) => {
  try {
    if (!req.query.documentType || !req.query.documentId) {
      const chats = await DocumentChat.getRecent(req.user.id, req.query.limit);
      return res.json({ success: true, chats, count: chats.length });
    }
    const { documentType, documentId } = identity(req);
    const chat = await DocumentChat.findOne(
      req.user.id,
      documentType,
      documentId,
    );
    const notes = await DocumentChat.getNotes(
      req.user.id,
      documentType,
      documentId,
    );
    return res.json({ success: true, chat, notes });
  } catch (error) {
    return respondWithError(res, error, "Unified chat history failed");
  }
});

router.post("/message", async (req, res) => {
  try {
    const { documentType, documentId } = identity(req);
    if (!req.body.text || !["user", "assistant"].includes(req.body.sender)) {
      return res.status(400).json({
        error: "Message text and a valid sender are required.",
      });
    }
    const chat = await DocumentChat.addMessage(
      req.user.id,
      documentType,
      documentId,
      req.body,
    );
    if (!chat) return res.status(404).json({ error: "Chat not found." });
    return res.json({ success: true, chat });
  } catch (error) {
    return respondWithError(res, error, "Unified chat message save failed");
  }
});

router.patch("/summary", async (req, res) => {
  try {
    const { documentType, documentId } = identity(req);
    if (!req.body.summary) {
      return res.status(400).json({ error: "Summary is required." });
    }
    const chat = await DocumentChat.updateSummary(
      req.user.id,
      documentType,
      documentId,
      req.body.summary,
    );
    return res.json({ success: true, summary: chat?.summary || null });
  } catch (error) {
    return respondWithError(res, error, "Unified chat summary update failed");
  }
});

router.patch("/pin", async (req, res) => {
  try {
    const { documentType, documentId } = identity(req);
    const chat = await DocumentChat.setPinned(
      req.user.id,
      documentType,
      documentId,
      req.body.isPinned,
    );
    return res.json({ success: true, chat });
  } catch (error) {
    return respondWithError(res, error, "Unified chat pin update failed");
  }
});

router.delete("/history", async (req, res) => {
  try {
    const { documentType, documentId } = identity(req);
    const chat = await DocumentChat.clear(
      req.user.id,
      documentType,
      documentId,
    );
    return res.json({ success: true, chat });
  } catch (error) {
    return respondWithError(res, error, "Unified chat clear failed");
  }
});

router.post("/notes", async (req, res) => {
  try {
    const { documentType, documentId } = identity(req);
    const body = String(req.body.body || "").trim().slice(0, 10_000);
    if (!body) return res.status(400).json({ error: "Note is required." });
    const note = await DocumentChat.addNote(
      req.user.id,
      documentType,
      documentId,
      body,
    );
    return res.status(201).json({ success: true, note });
  } catch (error) {
    return respondWithError(res, error, "Unified research note save failed");
  }
});

router.delete("/notes/:noteId", async (req, res) => {
  const removed = await DocumentChat.deleteNote(req.user.id, req.params.noteId);
  return res.status(removed ? 200 : 404).json({ success: removed });
});

router.post("/feedback", async (req, res) => {
  try {
    const { documentType, documentId } = identity(req);
    if (![-1, 1].includes(Number(req.body.rating))) {
      return res.status(400).json({ error: "Rating must be -1 or 1." });
    }
    const feedback = await DocumentChat.saveFeedback(
      req.user.id,
      documentType,
      documentId,
      req.body.messageId,
      Number(req.body.rating),
      String(req.body.reason || "").slice(0, 500) || null,
    );
    return res.json({ success: true, feedback });
  } catch (error) {
    return respondWithError(res, error, "Unified chat feedback save failed");
  }
});

router.get("/export", async (req, res) => {
  try {
    const { documentType, documentId } = identity(req);
    const chat = await DocumentChat.findOne(
      req.user.id,
      documentType,
      documentId,
    );
    if (!chat) return res.status(404).json({ error: "Chat not found." });
    const markdown = [
      `# ${chat.title}`,
      "",
      `Document type: ${chat.documentType}`,
      `Exported: ${new Date().toISOString()}`,
      "",
      ...(chat.summary ? ["## Summary", "", chat.summary, ""] : []),
      "## Conversation",
      "",
      ...chat.messages.flatMap((message) => [
        `### ${message.sender === "user" ? "Researcher" : "Rashtram AI"}`,
        "",
        message.text,
        "",
      ]),
    ].join("\n");
    res.setHeader("Content-Type", "text/markdown; charset=utf-8");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="rashtram-${documentType}-${documentId}.md"`,
    );
    return res.send(markdown);
  } catch (error) {
    return respondWithError(res, error, "Unified chat export failed");
  }
});

router.post("/", async (req, res) => {
  try {
    const { documentType, documentId } = identity(req);
    const message = String(req.body.message || "").trim();
    if (!message) {
      return res.status(400).json({ error: "Message is required." });
    }
    const [passages, relationshipContext, document] = await Promise.all([
      retrievePassages(
        documentType,
        documentId,
        message,
        6,
      ),
      getRelationshipContext(documentId, message),
      DocumentRepository.getById(documentId),
    ]);
    const passageContext = passages
      .map((item) => {
        const location = [
          document?.title || `Document ${documentId}`,
          item.pageStart
            ? `Page ${item.pageStart}${
              item.pageEnd && item.pageEnd !== item.pageStart
                ? `–${item.pageEnd}`
                : ""
            }${item.pageEstimate ? " (estimated)" : ""}`
            : null,
          item.sectionTitle || (
            item.sectionId ? `Section ${item.sectionId}` : null
          ),
          item.clauseId ? `Clause ${item.clauseId}` : null,
          `Chunk ${item.chunkIndex + 1}`,
        ].filter(Boolean).join(" | ");
        return `[Source ${item.passage}: ${location}]\n${item.content}`;
      })
      .join("\n\n");
    const context = [
      passageContext,
      relationshipContext.context
        ? `Government knowledge graph:\n${relationshipContext.context}`
        : "",
    ].filter(Boolean).join("\n\n");
    const sources = [
      ...passages.map((item) => ({
        ...item,
        documentTitle: document?.title || null,
        documentType: document?.type || documentType,
        page: item.pageStart,
        section: item.sectionTitle || item.sectionId,
        clause: item.clauseId,
        chunk: item.chunkIndex + 1,
        sourceUrl: item.sourceUrl || document?.sourceUrl || null,
        pdfUrl: item.pdfUrl || document?.pdfUrl || null,
        content: item.content.slice(0, 360),
      })),
      ...relationshipContext.sources,
    ];

    startSSE(res);
    sendSSE(res, {
      type: "meta",
      documentType,
      documentId,
      sources,
      metadata: {
        grounded: true,
        passageCount: passages.length,
        graphSourceCount: relationshipContext.sources.length,
        graphGrounded: relationshipContext.graphGrounded,
      },
    });
    if (!context.trim()) {
      sendSSE(res, {
        type: "content",
        content:
          "I could not find enough grounded context in this document to answer reliably.",
      });
      completeSSE(res);
      return undefined;
    }
    const responseLanguage = req.body.responseLanguage || "Auto";
    const stream = await generateResponse(message, context, {
      responseLanguage,
    });
    for await (const chunk of stream) {
      if (res.destroyed || res.writableEnded) break;
      const content =
        typeof chunk.text === "function" ? chunk.text() : chunk.text || "";
      if (content) {
        sendSSE(res, { type: "content", content });
      }
    }
    if (!res.destroyed && !res.writableEnded) completeSSE(res);
    return undefined;
  } catch (error) {
    console.error("Unified document chat failed:", error);
    if (!res.headersSent) {
      return res.status(error.status || 500).json({ error: error.message });
    }
    errorSSE(res, error);
    return undefined;
  }
});

module.exports = router;
module.exports.resolveDocumentIdentity = identity;
