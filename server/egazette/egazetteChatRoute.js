const express = require("express");
const EGazetteChat = require("../models/EGazetteChat");
const {
  generateResponse,
  searchSimilarContentForEGazette,
} = require("../lib/vectordb");
const { getGazetteById } = require("./egazetteService");

const router = express.Router();

router.post("/session", async (req, res) => {
  try {
    const { gazetteId, summary } = req.body;
    if (!gazetteId) {
      return res.status(400).json({
        error: "Gazette ID is required.",
      });
    }
    const gazette = await getGazetteById(gazetteId, req.user.id);
    if (!gazette) {
      return res.status(404).json({ error: "Gazette document not found." });
    }
    const chat = await EGazetteChat.findOrCreate(req.user.id, {
      gazetteId,
      title: gazette.title,
      gazetteNumber: gazette.gazetteNumber,
      notificationType: gazette.notificationType,
      status: gazette.status,
      pdfUrl: gazette.pdfUrl,
      sourceUrl: gazette.sourceUrl,
      summary,
      metadata: {
        ministry: gazette.ministry,
        department: gazette.department,
        jurisdiction: gazette.jurisdiction,
        gazetteType: gazette.gazetteType,
      },
    });
    return res.json({ success: true, chat });
  } catch (error) {
    console.error("Failed to create eGazette chat:", error);
    return res.status(500).json({ error: "Failed to save Gazette chat." });
  }
});

router.get("/history", async (req, res) => {
  try {
    if (req.query.gazetteId) {
      const chat = await EGazetteChat.findOne({
        userId: req.user.id,
        gazetteId: req.query.gazetteId,
      });
      return res.json({ success: true, chat });
    }
    const requestedLimit = Number.parseInt(req.query.limit, 10);
    const limit = Number.isFinite(requestedLimit)
      ? Math.min(Math.max(requestedLimit, 1), 50)
      : 10;
    const chats = await EGazetteChat.getRecent(req.user.id, limit);
    return res.json({ success: true, chats, count: chats.length });
  } catch (error) {
    console.error("Failed to load eGazette chat history:", error);
    return res.status(500).json({ error: "Failed to load chat history." });
  }
});

router.post("/message", async (req, res) => {
  try {
    const { gazetteId, text, sender, timestamp, sources, isError } = req.body;
    if (!gazetteId || !text || !sender) {
      return res.status(400).json({
        error: "Gazette ID, message text, and sender are required.",
      });
    }
    const chat = await EGazetteChat.findOne({
      userId: req.user.id,
      gazetteId,
    });
    if (!chat) return res.status(404).json({ error: "Chat not found." });
    await chat.addMessage({ text, sender, timestamp, sources, isError });
    return res.json({ success: true, chat });
  } catch (error) {
    console.error("Failed to save eGazette chat message:", error);
    return res.status(500).json({ error: "Failed to save chat message." });
  }
});

router.patch("/summary", async (req, res) => {
  try {
    const { gazetteId, summary } = req.body;
    if (!gazetteId || !summary) {
      return res.status(400).json({
        error: "Gazette ID and summary are required.",
      });
    }
    const chat = await EGazetteChat.findOne({
      userId: req.user.id,
      gazetteId,
    });
    if (!chat) return res.status(404).json({ error: "Chat not found." });
    await chat.updateSummary(summary);
    return res.json({ success: true, summary: chat.summary });
  } catch (error) {
    console.error("Failed to update eGazette summary:", error);
    return res.status(500).json({ error: "Failed to update summary." });
  }
});

router.delete("/history", async (req, res) => {
  try {
    if (!req.query.gazetteId) {
      return res.status(400).json({ error: "Gazette ID is required." });
    }
    const chat = await EGazetteChat.findOne({
      userId: req.user.id,
      gazetteId: req.query.gazetteId,
    });
    if (!chat) return res.status(404).json({ error: "Chat not found." });
    await chat.clearChat();
    return res.json({ success: true });
  } catch (error) {
    console.error("Failed to clear eGazette chat:", error);
    return res.status(500).json({ error: "Failed to clear chat." });
  }
});

router.post("/", async (req, res) => {
  try {
    const { message, gazetteId } = req.body;
    if (!message || !gazetteId) {
      return res.status(400).json({
        error: "Message and Gazette ID are required.",
      });
    }
    const matches = await searchSimilarContentForEGazette(
      message,
      gazetteId,
      6,
    );
    const context = matches
      .map(
        (match, index) =>
          `[Passage ${index + 1}]\n${match.metadata?.content || ""}`,
      )
      .filter(Boolean)
      .join("\n\n");
    const sources = matches.map((match) => ({
      score: match.score,
      chunkIndex: match.metadata?.chunkIndex,
      totalChunks: match.metadata?.totalChunks,
      source: match.metadata?.source || "Official Gazette PDF",
      pdfUrl: match.metadata?.pdfUrl || null,
      content: String(match.metadata?.content || "").slice(0, 260),
    }));

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    res.write(
      `data: ${JSON.stringify({
        type: "meta",
        sources,
        gazetteId: String(gazetteId),
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
    console.error("eGazette chat failed:", error);
    if (!res.headersSent) {
      return res.status(500).json({
        error: `Failed to answer Gazette question: ${error.message}`,
      });
    }
    res.write(
      `data: ${JSON.stringify({ type: "error", error: error.message })}\n\n`,
    );
    return res.end();
  }
});

module.exports = router;
