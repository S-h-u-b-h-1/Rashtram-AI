const express = require("express");
const fetchuser = require("../middleware/fetchuser");
const { sendError } = require("../lib/httpResponse");
const {
  discoverKnowledgeCandidates,
  exportKnowledgeNode,
  findPath,
  getKnowledgeGraphMetrics,
  saveGraphPath,
  searchGraph,
} = require("./knowledgeGraphService");

const router = express.Router();

router.get("/knowledge/search", fetchuser, async (req, res) => {
  try {
    return res.json(await discoverKnowledgeCandidates(req.query.q, {
      userId: req.user.id,
      limit: req.query.limit,
    }));
  } catch (error) {
    return sendError(res, error, "Knowledge discovery failed");
  }
});

router.get("/knowledge/:id/export", fetchuser, async (req, res) => {
  try {
    const portable = await exportKnowledgeNode(req.params.id, req.user.id);
    return res
      .type("text/markdown; charset=utf-8")
      .set("Content-Disposition", `attachment; filename="rashtram-knowledge-${Number(req.params.id)}.md"`)
      .send(portable);
  } catch (error) {
    return sendError(res, error, "Knowledge export failed");
  }
});

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
