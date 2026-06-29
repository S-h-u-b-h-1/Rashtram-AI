const express = require("express");
const {
  createProbeVector,
  getEGazetteIndex,
} = require("../lib/vectordb");

const router = express.Router();

router.get("/", async (req, res) => {
  try {
    const { gazetteId } = req.query;
    if (!gazetteId) {
      return res.status(400).json({ error: "Gazette ID is required." });
    }
    const result = await getEGazetteIndex().query({
      vector: createProbeVector(),
      topK: 1,
      filter: { gazetteId: { $eq: String(gazetteId) } },
      includeMetadata: true,
    });
    const match = result.matches?.[0];
    return res.json({
      gazetteId: String(gazetteId),
      title: match?.metadata?.gazetteTitle || null,
      summary: match?.metadata?.summary || null,
      hasData: Boolean(match),
    });
  } catch (error) {
    console.error("Failed to fetch eGazette summary:", error);
    return res.status(500).json({
      error: `Failed to fetch Gazette summary: ${error.message}`,
    });
  }
});

module.exports = router;
