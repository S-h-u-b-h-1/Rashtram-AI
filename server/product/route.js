const express = require("express");
const { generationLimiter } = require("../middleware/security");
const { sendError } = require("../lib/httpResponse");
const { runComplianceCopilot } = require("./complianceCopilotService");
const {
  createWatchlist, deleteWatchlist, listAlerts, listWatchlists, refreshWatchlists,
} = require("./watchlistService");

const router = express.Router();

router.post("/compliance", generationLimiter, async (req, res) => {
  try {
    return res.json(await runComplianceCopilot(req.user.id, req.body));
  } catch (error) {
    return sendError(res, error, "Compliance research failed");
  }
});

router.get("/watchlists", async (req, res) => {
  try { return res.json({ watchlists: await listWatchlists(req.user.id) }); }
  catch (error) { return sendError(res, error, "Watchlist listing failed"); }
});

router.post("/watchlists", async (req, res) => {
  try { return res.status(201).json(await createWatchlist(req.user.id, req.body)); }
  catch (error) { return sendError(res, error, "Watchlist creation failed"); }
});

router.delete("/watchlists/:id", async (req, res) => {
  try { return res.json(await deleteWatchlist(req.user.id, req.params.id)); }
  catch (error) { return sendError(res, error, "Watchlist deletion failed"); }
});

router.post("/watchlists/refresh", generationLimiter, async (req, res) => {
  try { return res.json(await refreshWatchlists(req.user.id)); }
  catch (error) { return sendError(res, error, "Watchlist refresh failed"); }
});

router.get("/alerts", async (req, res) => {
  try { return res.json({ alerts: await listAlerts(req.user.id) }); }
  catch (error) { return sendError(res, error, "Regulatory alert listing failed"); }
});

module.exports = router;
