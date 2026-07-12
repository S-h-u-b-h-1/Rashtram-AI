const express = require("express");
const {
  createProbeVector,
  getPolicyIndex,
} = require("../lib/vectordb");
const {
  ensureSummary,
  getTextArtifact,
} = require("../document/documentResearchService");

const router = express.Router();

router.get("/", async (req, res) => {
  try {
    const { policyId } = req.query;
    if (!policyId) {
      return res.status(400).json({ error: "Policy ID is required." });
    }
    const artifact = await getTextArtifact(policyId);
    if (artifact?.englishSummary) {
      return res.json({
        policyId: String(policyId),
        title: null,
        summary: artifact.englishSummary,
        hasData: true,
        source: "database",
        cached: true,
        updatedAt: artifact.updatedAt,
      });
    }
    const generated = await ensureSummary("policy", policyId);
    if (generated?.summary) {
      return res.json({
        policyId: String(policyId),
        title: null,
        summary: generated.summary,
        hasData: true,
        source: "database",
        cached: Boolean(generated.cached),
      });
    }
    const result = await getPolicyIndex().query({
      vector: createProbeVector(),
      topK: 1,
      filter: { policyId: { $eq: String(policyId) } },
      includeMetadata: true,
    });
    const match = result.matches?.[0];
    return res.json({
      policyId: String(policyId),
      title: match?.metadata?.policyTitle || null,
      summary: match?.metadata?.summary || null,
      hasData: Boolean(match),
    });
  } catch (error) {
    console.error("Failed to fetch policy summary:", error);
    return res.status(500).json({
      error: `Failed to fetch policy summary: ${error.message}`,
    });
  }
});

module.exports = router;
