const express = require("express");
const { generationLimiter } = require("../middleware/security");
const { sendError } = require("../lib/httpResponse");
const { runComplianceCopilot } = require("./complianceCopilotService");
const {
  createWatchlist, deleteWatchlist, listAlerts, listWatchlists, refreshWatchlists,
} = require("./watchlistService");
const { getAmendmentTracker } = require("./amendmentTrackerService");
const { runCrossStateComparison } = require("./crossStateComparisonService");
const {
  generateResearchReport, getResearchReport, reportAsMarkdown,
} = require("./researchReportService");
const { createResearchBriefPdf, safeFilePart } = require("../document/reportPdfService");

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

router.get("/amendments/:documentId", async (req, res) => {
  try { return res.json(await getAmendmentTracker(req.params.documentId)); }
  catch (error) { return sendError(res, error, "Amendment tracker failed"); }
});

router.post("/cross-state-comparison", generationLimiter, async (req, res) => {
  try { return res.json(await runCrossStateComparison(req.user.id, req.body)); }
  catch (error) { return sendError(res, error, "Cross-state comparison failed"); }
});

router.post("/reports", generationLimiter, async (req, res) => {
  try { return res.status(201).json(await generateResearchReport(req.user.id, req.body)); }
  catch (error) { return sendError(res, error, "Research report generation failed"); }
});

router.get("/reports/:id", async (req, res) => {
  try { return res.json(await getResearchReport(req.user.id, req.params.id)); }
  catch (error) { return sendError(res, error, "Research report retrieval failed"); }
});

router.get("/reports/:id/pdf", async (req, res) => {
  try {
    const report = await getResearchReport(req.user.id, req.params.id);
    const pdf = await createResearchBriefPdf({
      title: report.title, documentType: "Multi-document research report",
      reportText: reportAsMarkdown(report),
      sources: report.evidence.map((item) => ({
        documentTitle: item.documentTitle, page: item.pageStart,
        section: item.sectionTitle || item.sectionId, content: item.text,
        sourceUrl: item.sourceUrl,
      })),
      generatedAt: report.createdAt,
    });
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Length", String(pdf.length));
    res.setHeader("Cache-Control", "private, no-store");
    res.setHeader("Content-Disposition", `attachment; filename="rashtram-${safeFilePart(report.title)}.pdf"`);
    return res.send(pdf);
  } catch (error) { return sendError(res, error, "Research report PDF export failed"); }
});

module.exports = router;
