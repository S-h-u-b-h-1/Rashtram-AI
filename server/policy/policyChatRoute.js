const express = require("express");
const PolicyChat = require("../models/PolicyChat");
const {
  generateResponse,
  searchSimilarContentForPolicy,
} = require("../lib/vectordb");
const {
  completeSSE,
  errorSSE,
  sendSSE,
  startSSE,
} = require("../lib/sse");
const { getPolicyById } = require("./policyService");

const router = express.Router();

router.post("/session", async (req, res) => {
  try {
    const { policyId, summary } = req.body;
    if (!policyId) {
      return res.status(400).json({
        error: "Policy ID is required.",
      });
    }
    const policy = await getPolicyById(policyId);
    if (!policy) {
      return res.status(404).json({ error: "Policy document not found." });
    }
    const chat = await PolicyChat.findOrCreate(req.user.id, {
      policyId,
      title: policy.title,
      category: policy.category,
      status: policy.status,
      sourceUrl: policy.sourceUrl,
      summary,
      metadata: {
        ministry: policy.ministry,
        department: policy.department,
        jurisdiction: policy.jurisdiction,
      },
    });
    return res.json({ success: true, chat });
  } catch (error) {
    console.error("Failed to create policy chat:", error);
    return res.status(500).json({ error: "Failed to save policy chat." });
  }
});

router.get("/history", async (req, res) => {
  try {
    if (req.query.policyId) {
      const chat = await PolicyChat.findOne({
        userId: req.user.id,
        policyId: req.query.policyId,
      });
      return res.json({ success: true, chat });
    }
    const requestedLimit = Number.parseInt(req.query.limit, 10);
    const limit = Number.isFinite(requestedLimit)
      ? Math.min(Math.max(requestedLimit, 1), 50)
      : 10;
    const chats = await PolicyChat.getRecent(req.user.id, limit);
    return res.json({ success: true, chats, count: chats.length });
  } catch (error) {
    console.error("Failed to load policy chat history:", error);
    return res.status(500).json({ error: "Failed to load chat history." });
  }
});

router.post("/message", async (req, res) => {
  try {
    const { policyId, text, sender, timestamp, sources, isError } = req.body;
    if (!policyId || !text || !sender) {
      return res.status(400).json({
        error: "Policy ID, message text, and sender are required.",
      });
    }
    const chat = await PolicyChat.findOne({
      userId: req.user.id,
      policyId,
    });
    if (!chat) return res.status(404).json({ error: "Chat not found." });
    await chat.addMessage({ text, sender, timestamp, sources, isError });
    return res.json({ success: true, chat });
  } catch (error) {
    console.error("Failed to save policy chat message:", error);
    return res.status(500).json({ error: "Failed to save chat message." });
  }
});

router.patch("/summary", async (req, res) => {
  try {
    const { policyId, summary } = req.body;
    if (!policyId || !summary) {
      return res.status(400).json({
        error: "Policy ID and summary are required.",
      });
    }
    const chat = await PolicyChat.findOne({
      userId: req.user.id,
      policyId,
    });
    if (!chat) return res.status(404).json({ error: "Chat not found." });
    await chat.updateSummary(summary);
    return res.json({ success: true, summary: chat.summary });
  } catch (error) {
    console.error("Failed to update policy summary:", error);
    return res.status(500).json({ error: "Failed to update summary." });
  }
});

router.delete("/history", async (req, res) => {
  try {
    if (!req.query.policyId) {
      return res.status(400).json({ error: "Policy ID is required." });
    }
    const chat = await PolicyChat.findOne({
      userId: req.user.id,
      policyId: req.query.policyId,
    });
    if (!chat) return res.status(404).json({ error: "Chat not found." });
    await chat.clearChat();
    return res.json({ success: true });
  } catch (error) {
    console.error("Failed to clear policy chat:", error);
    return res.status(500).json({ error: "Failed to clear chat." });
  }
});

router.post("/", async (req, res) => {
  try {
    const { message, policyId } = req.body;
    if (!message || !policyId) {
      return res.status(400).json({
        error: "Message and Policy ID are required.",
      });
    }
    const matches = await searchSimilarContentForPolicy(
      message,
      policyId,
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
      source: match.metadata?.source || "PolicyEdge Article",
      sourceUrl: match.metadata?.sourceUrl || null,
      content: String(match.metadata?.content || "").slice(0, 260),
    }));

    startSSE(res);
    sendSSE(res, {
      type: "meta",
      sources,
      policyId: String(policyId),
    });
    const stream = await generateResponse(message, context);
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
    console.error("Policy chat failed:", error);
    if (!res.headersSent) {
      return res.status(500).json({
        error: `Failed to answer policy question: ${error.message}`,
      });
    }
    errorSSE(res, error);
    return undefined;
  }
});

module.exports = router;
