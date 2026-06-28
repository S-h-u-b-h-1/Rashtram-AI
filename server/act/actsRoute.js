const express = require("express");
const {
  getYears,
  listDocuments,
} = require("../lib/catalogService");

const router = express.Router();

router.get("/", async (req, res) => {
  try {
    const [catalog, years] = await Promise.all([
      listDocuments({
        documentType: "act",
        jurisdictionLevel: "parliament",
        page: req.query.page,
        limit: req.query.limit,
        search: req.query.search || "",
        year: req.query.year || "",
      }),
      getYears("act"),
    ]);

    res.json({
      acts: catalog.documents,
      years,
      pagination: catalog.pagination,
      source: "persistent-catalog",
    });
  } catch (error) {
    console.error("Failed to query acts catalogue:", error);
    res.status(500).json({
      error: "Failed to fetch acts",
      acts: [],
      years: [],
      pagination: {
        page: Number.parseInt(req.query.page || "1", 10),
        limit: Number.parseInt(req.query.limit || "10", 10),
        total: 0,
        hasMore: false,
        totalPages: 0,
      },
    });
  }
});

router.get("/years", async (_req, res) => {
  try {
    const years = await getYears("act");
    res.json({
      success: true,
      years,
      count: years.length,
      source: "persistent-catalog",
    });
  } catch (error) {
    console.error("Failed to query act years:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch act years",
      years: [],
      count: 0,
    });
  }
});

module.exports = router;
