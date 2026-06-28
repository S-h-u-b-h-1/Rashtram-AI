const express = require('express');
const router = express.Router();
const BillChat = require('../models/BillChat');
const ActChat = require('../models/ActChat');
const fetchuser = require('../middleware/fetchuser');
const {
  getDashboardIntelligence,
  getSourceHealth,
} = require("./intelligenceService");


router.get('/', fetchuser, async (req, res) => {
  try {
    const userId = req.user.id;


    const [recentBills, recentActs] = await Promise.all([
      BillChat.getUserRecentChats(userId, 5),
      ActChat.getUserRecentChats(userId, 5)
    ]);


    const [totalBills, totalActs] = await Promise.all([
      BillChat.countDocuments({ userId, isActive: true }),
      ActChat.countDocuments({ userId, isActive: true })
    ]);

    res.json({
      recentBills,
      recentActs,
      stats: {
        totalBills,
        totalActs,
        totalChats: totalBills + totalActs
      }
    });
  } catch (error) {
    console.error('Dashboard data fetch error:', error);
    res.status(500).json({ message: 'Server error fetching dashboard data' });
  }
});

router.get("/intelligence", fetchuser, async (req, res) => {
  try {
    const data = await getDashboardIntelligence(req.user.id);
    return res.json(data);
  } catch (error) {
    console.error("Dashboard intelligence fetch error:", error);
    return res
      .status(500)
      .json({ error: "Unable to load legislative intelligence right now." });
  }
});

router.get("/source-health", fetchuser, async (req, res) => {
  try {
    return res.json({ sources: await getSourceHealth() });
  } catch (error) {
    console.error("Dashboard source health fetch error:", error);
    return res
      .status(500)
      .json({ error: "Unable to load source health right now." });
  }
});

module.exports = router;
