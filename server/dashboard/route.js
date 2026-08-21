const express = require('express');
const router = express.Router();
const BillChat = require('../models/BillChat');
const ActChat = require('../models/ActChat');
const fetchuser = require('../middleware/fetchuser');
const {
  getDashboardIntelligence,
  getSourceHealth,
} = require("./intelligenceService");
const {
  getResearchOperations,
  getResearchQualityStatus,
} = require("./researchOperationsService");

const DASHBOARD_INTELLIGENCE_CACHE_MS = Number(
  process.env.DASHBOARD_INTELLIGENCE_CACHE_MS || 15_000,
);
const SOURCE_HEALTH_CACHE_MS = Number(
  process.env.SOURCE_HEALTH_CACHE_MS || 60_000,
);
const dashboardIntelligenceCache = new Map();
let sourceHealthCache = null;

const getCachedValue = (cache, key) => {
  const cached = cache.get(key);
  if (!cached || cached.expiresAt <= Date.now()) {
    cache.delete(key);
    return null;
  }
  return cached.value;
};

const setCachedValue = (cache, key, value, ttl) => {
  if (!ttl || ttl <= 0) return;
  cache.set(key, {
    value,
    expiresAt: Date.now() + ttl,
  });
  if (cache.size > 250) {
    for (const [entryKey, entry] of cache) {
      if (entry.expiresAt <= Date.now()) cache.delete(entryKey);
    }
  }
};


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
    const cacheKey = String(req.user.id);
    const cached = getCachedValue(dashboardIntelligenceCache, cacheKey);
    if (cached) {
      res.set("X-Rashtram-Cache", "HIT");
      return res.json(cached);
    }

    const data = await getDashboardIntelligence(req.user.id);
    setCachedValue(
      dashboardIntelligenceCache,
      cacheKey,
      data,
      DASHBOARD_INTELLIGENCE_CACHE_MS,
    );
    res.set("X-Rashtram-Cache", "MISS");
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
    if (sourceHealthCache?.expiresAt > Date.now()) {
      res.set("X-Rashtram-Cache", "HIT");
      return res.json(sourceHealthCache.value);
    }

    const data = { sources: await getSourceHealth() };
    sourceHealthCache = {
      value: data,
      expiresAt: Date.now() + SOURCE_HEALTH_CACHE_MS,
    };
    res.set("X-Rashtram-Cache", "MISS");
    return res.json(data);
  } catch (error) {
    console.error("Dashboard source health fetch error:", error);
    return res
      .status(500)
      .json({ error: "Unable to load source health right now." });
  }
});

router.get("/operations", fetchuser, async (req, res) => {
  try {
    return res.json(await getResearchOperations());
  } catch (error) {
    console.error("Research operations dashboard failed:", error.message);
    return res.status(500).json({ error: "Research operations are unavailable." });
  }
});

router.get("/research-quality", fetchuser, async (req, res) => {
  try {
    return res.json(await getResearchQualityStatus());
  } catch (error) {
    console.error("Research quality dashboard failed:", error.message);
    return res.status(500).json({ error: "Research quality metrics are unavailable." });
  }
});

module.exports = router;
