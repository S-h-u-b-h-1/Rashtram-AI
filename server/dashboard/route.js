const express = require('express');
const router = express.Router();
const BillChat = require('../models/BillChat');
const ActChat = require('../models/ActChat');
const fetchuser = require('../middleware/fetchuser');


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

module.exports = router;
