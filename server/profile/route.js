const express = require("express");
const fetchuser = require("../middleware/fetchuser");
const {
  getProfileData,
} = require("../dashboard/intelligenceService");

const router = express.Router();

router.get("/", fetchuser, async (req, res) => {
  try {
    const profile = await getProfileData(req.user.id);
    if (!profile) {
      return res.status(404).json({ error: "User profile not found." });
    }
    return res.json(profile);
  } catch (error) {
    console.error("Profile fetch error:", error);
    return res.status(500).json({ error: "Unable to load profile right now." });
  }
});

module.exports = router;
