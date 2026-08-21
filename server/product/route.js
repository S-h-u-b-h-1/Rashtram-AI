const express = require("express");
const { generationLimiter } = require("../middleware/security");
const { sendError } = require("../lib/httpResponse");
const { runComplianceCopilot } = require("./complianceCopilotService");

const router = express.Router();

router.post("/compliance", generationLimiter, async (req, res) => {
  try {
    return res.json(await runComplianceCopilot(req.user.id, req.body));
  } catch (error) {
    return sendError(res, error, "Compliance research failed");
  }
});

module.exports = router;
