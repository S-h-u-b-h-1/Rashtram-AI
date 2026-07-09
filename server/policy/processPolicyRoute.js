const express = require("express");
const { prepareDocument } = require("../document/readinessService");
const { getPolicyById } = require("./policyService");

const router = express.Router();

router.post("/", async (req, res) => {
  const policyId = req.body.policyId || req.body.documentId;
  if (!policyId) {
    return res.status(400).json({ error: "Policy ID is required." });
  }

  try {
    const policy = await getPolicyById(policyId);
    if (!policy) {
      return res.status(404).json({ error: "Policy document not found." });
    }

    const result = await prepareDocument(policyId, {
      userId: req.user.id,
      priority: 95,
      reason: "policy_prepare",
    });

    return res.json({
      success: true,
      policyId: String(policyId),
      policyTitle: policy.title,
      ...result,
    });
  } catch (error) {
    console.error("Failed to process policy article:", error);
    return res.status(error.status || 500).json({
      error: error.message || "Failed to process policy.",
    });
  }
});

module.exports = router;
