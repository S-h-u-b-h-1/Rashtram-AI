const express = require("express");
const DocumentChat = require("../models/DocumentChat");
const {
  getDocumentContext,
  processDocument,
  retrievePassages,
} = require("./documentResearchService");
const { generateResponse } = require("../lib/vectordb");

const router = express.Router();

const identity = (req) => {
  const rawId =
    req.body.documentId || req.query.documentId || req.params.documentId;
  if (!rawId) throw new Error("Document ID is required.");
  return {
    documentType: DocumentChat.normalizeType(
      req.body.documentType ||
        req.query.documentType ||
        req.params.documentType,
    ),
    documentId: String(rawId),
  };
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
    return res.status(400).json({ error: error.message });
  }
});

router.post("/process", async (req, res) => {
  try {
    const { documentType, documentId } = identity(req);
    const result = await processDocument(documentType, documentId);
    return res.json({ success: true, ...result });
  } catch (error) {
    console.error("Unified document processing failed:", error);
    return res.status(error.status || 500).json({ error: error.message });
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
    console.error("Unified chat session failed:", error);
    return res.status(400).json({ error: error.message });
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
    return res.status(400).json({ error: error.message });
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
    return res.status(400).json({ error: error.message });
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
    return res.status(400).json({ error: error.message });
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
    return res.status(400).json({ error: error.message });
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
    return res.status(400).json({ error: error.message });
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
    return res.status(400).json({ error: error.message });
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
    return res.status(400).json({ error: error.message });
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
    return res.status(400).json({ error: error.message });
  }
});

router.post("/", async (req, res) => {
  try {
    const { documentType, documentId } = identity(req);
    const message = String(req.body.message || "").trim();
    if (!message) {
      return res.status(400).json({ error: "Message is required." });
    }
    const passages = await retrievePassages(
      documentType,
      documentId,
      message,
      6,
    );
    const context = passages
      .map((item) => `[Passage ${item.passage}]\n${item.content}`)
      .join("\n\n");
    const sources = passages.map((item) => ({
      ...item,
      content: item.content.slice(0, 360),
    }));

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    res.write(
      `data: ${JSON.stringify({
        type: "meta",
        documentType,
        documentId,
        sources,
      })}\n\n`,
    );
    const stream = await generateResponse(message, context);
    for await (const chunk of stream) {
      const content =
        typeof chunk.text === "function" ? chunk.text() : chunk.text || "";
      if (content) {
        res.write(
          `data: ${JSON.stringify({ type: "content", content })}\n\n`,
        );
      }
    }
    res.write("data: [DONE]\n\n");
    return res.end();
  } catch (error) {
    console.error("Unified document chat failed:", error);
    if (!res.headersSent) {
      return res.status(error.status || 500).json({ error: error.message });
    }
    res.write(
      `data: ${JSON.stringify({ type: "error", error: error.message })}\n\n`,
    );
    return res.end();
  }
});

module.exports = router;
