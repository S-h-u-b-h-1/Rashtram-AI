const express = require("express");
const {
  getPolicyById,
  getPolicyFilters,
  listPolicies,
} = require("./policyService");
const { searchIndexedPolicyIds } = require("../lib/vectordb");

const router = express.Router();

router.get("/", async (req, res) => {
  try {
    let indexedIds = [];
    if (String(req.query.search || "").trim().length >= 3) {
      try {
        indexedIds = await searchIndexedPolicyIds(req.query.search);
      } catch (error) {
        console.warn(
          "Indexed policy text search unavailable; using catalogue search:",
          error.message,
        );
      }
    }
    const catalogue = await listPolicies({
      page: req.query.page,
      limit: req.query.limit,
      search: req.query.search,
      category: req.query.category,
      year: req.query.year,
      jurisdiction: req.query.jurisdiction,
      sortBy: req.query.sortBy,
      sortDirection: req.query.sortDirection,
      indexedIds,
    });
    return res.json({
      ...catalogue,
      filters: await getPolicyFilters(),
      source: "policyedge-catalog",
    });
  } catch (error) {
    console.error("Failed to query policy catalogue:", error);
    return res.status(500).json({
      error: "Failed to fetch policy records.",
      policies: [],
      pagination: {
        page: 1,
        limit: 20,
        total: 0,
        totalPages: 0,
        hasMore: false,
      },
    });
  }
});

router.get("/filters", async (_req, res) => {
  try {
    return res.json(await getPolicyFilters());
  } catch (error) {
    console.error("Failed to query policy filters:", error);
    return res.status(500).json({ error: "Failed to fetch filters." });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const policy = await getPolicyById(req.params.id);
    if (!policy) {
      return res.status(404).json({ error: "Policy document not found." });
    }
    return res.json({ policy });
  } catch (error) {
    console.error("Failed to load policy document:", error);
    return res.status(500).json({
      error: "Failed to load the policy document.",
    });
  }
});

module.exports = router;
