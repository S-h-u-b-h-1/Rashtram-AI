const express = require("express");
const {
  getProblemRecommendations,
  getRecentRecommendations,
} = require("../document/recommendationService");

const router = express.Router();

router.post("/problem", async (req, res) => {
  try {
    return res.json(await getProblemRecommendations(req.user.id, req.body));
  } catch (error) {
    const status = error.status || 500;
    if (status >= 500) {
      console.error("Problem recommendation failed:", error);
    }
    return res.status(status).json({ error: error.message });
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
    console.error("Recent recommendation lookup failed:", error);
    return res.status(500).json({
      error: "Unable to load recent recommendations.",
    });
  }
});

module.exports = router;
