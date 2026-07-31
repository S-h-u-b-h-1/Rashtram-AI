const express = require("express");
const fetchuser = require("../middleware/fetchuser");
const { sendError } = require("../lib/httpResponse");
const {
  findPath,
  getKnowledgeGraphMetrics,
  saveGraphPath,
  searchGraph,
} = require("./knowledgeGraphService");

const router = express.Router();

router.get("/search", fetchuser, async (req, res) => {
  try {
    return res.json(
      await searchGraph(req.query.q, {
        type: req.query.type,
        limit: req.query.limit,
      }),
    );
  } catch (error) {
    return sendError(res, error, "Knowledge graph search failed");
  }
});

router.get("/path", fetchuser, async (req, res) => {
  try {
    return res.json({
      path: await findPath(req.query.from, req.query.to, {
        maxDepth: req.query.maxDepth,
      }),
    });
  } catch (error) {
    return sendError(res, error, "Knowledge graph path search failed");
  }
});

router.post("/paths", fetchuser, async (req, res) => {
  try {
    const savedPath = await saveGraphPath(
      req.user.id,
      req.body.sourceDocumentId,
      req.body.targetDocumentId,
      req.body.title,
    );
    return res.status(201).json({ savedPath });
  } catch (error) {
    return sendError(res, error, "Knowledge graph path save failed");
  }
});

router.get("/metrics", fetchuser, async (req, res) => {
  try {
    return res.json({ knowledgeGraph: await getKnowledgeGraphMetrics() });
  } catch (error) {
    return sendError(res, error, "Knowledge graph metrics failed");
  }
});

module.exports = router;
