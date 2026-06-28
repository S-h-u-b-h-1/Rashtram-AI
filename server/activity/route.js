const express = require("express");
const fetchuser = require("../middleware/fetchuser");
const { activityLimiter } = require("../middleware/security");
const {
  getActivityPreferences,
  recordActivity,
  updateActivityPreferences,
} = require("./activityService");

const router = express.Router();

router.post("/", fetchuser, activityLimiter, async (req, res) => {
  try {
    const result = await recordActivity(req.user.id, req.body, {
      referrer: req.get("referer"),
    });
    return res.status(result.tracked ? 201 : 202).json(result);
  } catch (error) {
    if (
      /unsupported|must be|too large|positive integer|privacy preference/i.test(
        error.message,
      )
    ) {
      return res.status(400).json({ error: error.message });
    }
    console.error("Activity tracking error:", error);
    return res.status(500).json({ error: "Unable to record activity." });
  }
});

router.get("/preferences", fetchuser, async (req, res) => {
  try {
    return res.json(await getActivityPreferences(req.user.id));
  } catch (error) {
    console.error("Activity preference fetch error:", error);
    return res.status(500).json({ error: "Unable to load privacy settings." });
  }
});

router.patch("/preferences", fetchuser, async (req, res) => {
  try {
    const preferences = await updateActivityPreferences(req.user.id, {
      activityTrackingEnabled: req.body.activityTrackingEnabled,
      personalizationEnabled: req.body.personalizationEnabled,
    });
    return res.json(preferences);
  } catch (error) {
    if (/must be boolean|personalization requires/i.test(error.message)) {
      return res.status(400).json({ error: error.message });
    }
    console.error("Activity preference update error:", error);
    return res.status(500).json({ error: "Unable to update privacy settings." });
  }
});

module.exports = router;
