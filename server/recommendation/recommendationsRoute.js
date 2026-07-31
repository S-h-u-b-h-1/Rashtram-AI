const express = require("express");
const { sendError } = require("../lib/httpResponse");
const {
  getProblemRecommendations,
  getRecentRecommendations,
} = require("../document/recommendationService");

const router = express.Router();

router.post("/problem", async (req, res) => {
  try {
    return res.json(await getProblemRecommendations(req.user.id, req.body));
  } catch (error) {
    return sendError(res, error, "Problem recommendation failed");
  }
});

router.get("/recent", async (req, res) => {
  try {
    return res.json({
      recommendations: await getRecentRecommendations(
        req.user.id,
        req.query.limit,
      ),
    });
  } catch (error) {
    return sendError(res, error, "Recent recommendation lookup failed");
  }
});

module.exports = router;
