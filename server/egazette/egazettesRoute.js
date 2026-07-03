const express = require("express");
const {
  getGazetteById,
  getGazetteFilters,
  getGazetteRecommendations,
  listGazettes,
} = require("./egazetteService");
const { searchIndexedEGazetteIds } = require("../lib/vectordb");

const router = express.Router();

router.get("/", async (req, res) => {
  try {
    let indexedIds = [];
    if (String(req.query.search || "").trim().length >= 3) {
      try {
        indexedIds = await searchIndexedEGazetteIds(req.query.search);
      } catch (error) {
        console.warn(
          "Indexed Gazette text search unavailable; using catalogue search:",
          error.message,
        );
      }
    }
    const catalogue = await listGazettes({
      page: req.query.page,
      limit: req.query.limit,
      search: req.query.search,
      ministry: req.query.ministry,
      department: req.query.department,
      notificationType: req.query.notificationType,
      gazetteType: req.query.gazetteType,
      jurisdiction: req.query.jurisdiction,
      year: req.query.year,
      publicationFrom: req.query.publicationFrom,
      publicationTo: req.query.publicationTo,
      source: req.query.source,
      hasPdf: req.query.hasPdf,
      sortBy: req.query.sortBy,
      sortDirection: req.query.sortDirection,
      indexedIds,
    });
    return res.json({
      ...catalogue,
      filters: await getGazetteFilters(),
      source: "persistent-catalog",
    });
  } catch (error) {
    console.error("Failed to query eGazette catalogue:", error);
    return res.status(500).json({
      error: "Failed to fetch eGazette records.",
      gazettes: [],
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
    return res.json(await getGazetteFilters());
  } catch (error) {
    console.error("Failed to query eGazette filters:", error);
    return res.status(500).json({ error: "Failed to fetch filters." });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const gazette = await getGazetteById(req.params.id, req.user.id);
    if (!gazette) {
      return res.status(404).json({ error: "Gazette document not found." });
    }
    const recommendations = await getGazetteRecommendations(req.params.id);
    return res.json({ gazette, recommendations });
  } catch (error) {
    console.error("Failed to load eGazette document:", error);
    return res.status(500).json({
      error: "Failed to load the Gazette research document.",
    });
  }
});

module.exports = router;
