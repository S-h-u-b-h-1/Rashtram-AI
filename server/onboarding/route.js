const express = require("express");
const fetchuser = require("../middleware/fetchuser");
const {
  getAuthState,
  saveOnboarding,
} = require("./onboardingService");

const router = express.Router();

router.get("/", fetchuser, async (req, res) => {
  try {
    const state = await getAuthState(req.user.id);
    if (!state) return res.status(404).json({ error: "User not found." });
    return res.json(state);
  } catch (error) {
    return res.status(500).json({ error: "Unable to load onboarding state." });
  }
});

router.put("/", fetchuser, async (req, res) => {
  try {
    const state = await saveOnboarding(req.user.id, req.body, {
      complete: false,
      skipped: false,
    });
    return res.json({ success: true, ...state });
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
});

router.post("/skip", fetchuser, async (req, res) => {
  try {
    const state = await saveOnboarding(req.user.id, req.body, {
      complete: false,
      skipped: true,
    });
    return res.json({ success: true, ...state });
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
});

router.post("/complete", fetchuser, async (req, res) => {
  try {
    const state = await saveOnboarding(req.user.id, req.body, {
      complete: true,
      skipped: false,
    });
    return res.json({ success: true, ...state });
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
});

module.exports = router;
