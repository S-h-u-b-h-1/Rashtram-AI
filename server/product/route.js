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
const { getCommercialPilotMetrics, recordProductMetric } = require("./productMetricsService");

const router = express.Router();

router.post("/compliance", generationLimiter, async (req, res) => {
  try {
    const startedAt = Date.now();
    const result = await runComplianceCopilot(req.user.id, req.body);
    await recordProductMetric(req.user.id, {
      eventType: "compliance_workflow_used", workflowType: "compliance_copilot",
      sessionId: req.get("x-research-session"), success: true,
      evidenceBacked: result.status === "completed", abstained: result.status !== "completed",
      evidenceCount: result.evidence?.length, citationCount: result.evidence?.length,
      timeToFinalAnswerMs: Date.now() - startedAt,
    });
    return res.json(result);
  } catch (error) {
    return sendError(res, error, "Compliance research failed");
  }
});

router.get("/watchlists", async (req, res) => {
  try { return res.json({ watchlists: await listWatchlists(req.user.id) }); }
  catch (error) { return sendError(res, error, "Watchlist listing failed"); }
});

router.post("/watchlists", async (req, res) => {
  try {
    const result = await createWatchlist(req.user.id, req.body);
    await recordProductMetric(req.user.id, { eventType: "watchlist_created",
      workflowType: "regulatory_watchlist", sessionId: req.get("x-research-session"),
      metadata: { watchType: result.watchType } });
    return res.status(201).json(result);
  }
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
  try {
    const startedAt = Date.now();
    const result = await runCrossStateComparison(req.user.id, req.body);
    const evidenceCount = result.states?.reduce((sum, state) => sum + (state.evidence?.length || 0), 0) || 0;
    await recordProductMetric(req.user.id, { eventType: "cross_state_comparison_used",
      workflowType: "cross_state_comparison", sessionId: req.get("x-research-session"),
      evidenceBacked: evidenceCount > 0, abstained: evidenceCount === 0,
      evidenceCount, citationCount: evidenceCount, timeToFinalAnswerMs: Date.now() - startedAt,
      metadata: { stateCount: result.states?.length || 0 } });
    return res.json(result);
  }
  catch (error) { return sendError(res, error, "Cross-state comparison failed"); }
});

router.post("/reports", generationLimiter, async (req, res) => {
  try {
    const startedAt = Date.now();
    const result = await generateResearchReport(req.user.id, req.body);
    await recordProductMetric(req.user.id, { eventType: "report_generated",
      workflowType: "research_report", sessionId: req.get("x-research-session"),
      evidenceBacked: result.verificationStatus === "verified_evidence",
      abstained: result.verificationStatus === "insufficient_evidence",
      evidenceCount: result.evidence?.length, citationCount: result.evidence?.length,
      timeToFinalAnswerMs: Date.now() - startedAt,
      metadata: { documentCount: result.selectedDocumentIds?.length || 0 } });
    return res.status(201).json(result);
  }
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
    await recordProductMetric(req.user.id, { eventType: "report_downloaded",
      workflowType: "research_report", sessionId: req.get("x-research-session"),
      evidenceBacked: report.verificationStatus === "verified_evidence",
      evidenceCount: report.evidence.length, citationCount: report.evidence.length,
      metadata: { documentCount: report.selectedDocumentIds.length } });
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Length", String(pdf.length));
    res.setHeader("Cache-Control", "private, no-store");
    res.setHeader("Content-Disposition", `attachment; filename="rashtram-${safeFilePart(report.title)}.pdf"`);
    return res.send(pdf);
  } catch (error) { return sendError(res, error, "Research report PDF export failed"); }
});

router.get("/metrics/me", async (req, res) => {
  try { return res.json(await getCommercialPilotMetrics({ userId: req.user.id })); }
  catch (error) { return sendError(res, error, "Product metrics retrieval failed"); }
});

module.exports = router;
