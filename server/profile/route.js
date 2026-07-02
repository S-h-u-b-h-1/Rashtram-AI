const express = require("express");
const fetchuser = require("../middleware/fetchuser");
const {
  getProfileData,
} = require("../dashboard/intelligenceService");
const {
  addCollectionItem,
  addSavedContent,
  addSavedSearch,
  changePassword,
  createCollection,
  getAccountData,
  removeSavedContent,
  revokeSession,
  updateProfile,
} = require("./profileService");
const {
  getComparisons,
} = require("../document/documentComparisonService");

const router = express.Router();

router.get("/", fetchuser, async (req, res) => {
  try {
    const profile = await getProfileData(req.user.id);
    if (!profile) {
      return res.status(404).json({ error: "User profile not found." });
    }
    return res.json({
      ...profile,
      account: await getAccountData(req.user.id),
    });
  } catch (error) {
    console.error("Profile fetch error:", error);
    return res.status(500).json({ error: "Unable to load profile right now." });
  }
});

router.get("/comparisons", fetchuser, async (req, res) => {
  try {
    return res.json({
      comparisons: await getComparisons(req.user.id, req.query.limit),
    });
  } catch (error) {
    console.error("Comparison history fetch error:", error);
    return res.status(500).json({ error: "Unable to load comparison history." });
  }
});

router.patch("/", fetchuser, async (req, res) => {
  try {
    const profile = await updateProfile(req.user.id, req.body);
    return res.json({ success: true, profile });
  } catch (error) {
    if (error.code === "23505") {
      return res.status(409).json({ error: "That username is already used." });
    }
    return res.status(400).json({ error: error.message });
  }
});

router.patch("/password", fetchuser, async (req, res) => {
  try {
    await changePassword(
      req.user.id,
      req.body.currentPassword,
      req.body.newPassword,
    );
    return res.json({
      success: true,
      message: "Password changed. Other sessions have been revoked.",
    });
  } catch (error) {
    return res.status(error.status || 400).json({ error: error.message });
  }
});

router.post("/saved", fetchuser, async (req, res) => {
  try {
    const item = await addSavedContent(req.user.id, req.body);
    return res.status(item ? 201 : 200).json({ success: true, item });
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
});

router.delete("/saved/:id", fetchuser, async (req, res) => {
  const removed = await removeSavedContent(req.user.id, req.params.id);
  return res.status(removed ? 200 : 404).json({ success: removed });
});

router.post("/saved-searches", fetchuser, async (req, res) => {
  const search = await addSavedSearch(req.user.id, req.body);
  return res.status(201).json({ success: true, search });
});

router.post("/collections", fetchuser, async (req, res) => {
  const collection = await createCollection(req.user.id, req.body);
  return res.status(201).json({ success: true, collection });
});

router.post("/collections/:id/items", fetchuser, async (req, res) => {
  const item = await addCollectionItem(
    req.user.id,
    req.params.id,
    req.body,
  );
  return res.status(item ? 201 : 404).json({
    success: Boolean(item),
    item,
  });
});

router.delete("/sessions/:id", fetchuser, async (req, res) => {
  const revoked = await revokeSession(req.user.id, req.params.id);
  return res.status(revoked ? 200 : 404).json({ success: revoked });
});

router.get("/export", fetchuser, async (req, res) => {
  try {
    const [profile, account] = await Promise.all([
      getProfileData(req.user.id),
      getAccountData(req.user.id),
    ]);
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="rashtram-research-export-${Date.now()}.json"`,
    );
    return res.send(
      JSON.stringify(
        {
          exportedAt: new Date().toISOString(),
          profile,
          account: { ...account, sessions: undefined },
        },
        null,
        2,
      ),
    );
  } catch (error) {
    return res.status(500).json({ error: "Research export failed." });
  }
});

module.exports = router;
