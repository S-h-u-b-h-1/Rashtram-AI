const express = require("express");
const cheerio = require("cheerio");
const axios = require("axios");
const RelatedBills = require("../models/RelatedBills");
const {
  findDocumentBySourceUrl,
  getDocumentById,
  getStatuses,
  listDocuments,
  updateDocumentPdf,
} = require("../lib/catalogService");

const router = express.Router();
const PRS_BASE_URL = "https://prsindia.org";

router.get("/", async (req, res) => {
  try {
    const [catalog, statuses] = await Promise.all([
      listDocuments({
        documentType: "bill",
        jurisdictionLevel: "parliament",
        page: req.query.page,
        limit: req.query.limit,
        search: req.query.search || "",
        status: req.query.status || "",
      }),
      getStatuses("bill"),
    ]);

    res.json({
      bills: catalog.documents,
      statuses,
      pagination: catalog.pagination,
      source: "persistent-catalog",
    });
  } catch (error) {
    console.error("Failed to query bills catalogue:", error);
    res.status(500).json({
      error: "Failed to fetch bills",
      bills: [],
      statuses: [],
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

router.get("/status", async (_req, res) => {
  try {
    const statuses = await getStatuses("bill");
    res.json({
      success: true,
      statuses,
      count: statuses.length,
      source: "persistent-catalog",
    });
  } catch (error) {
    console.error("Failed to query bill statuses:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch bill statuses",
      statuses: [],
      count: 0,
    });
  }
});

router.get("/pdf", async (req, res) => {
  const { link } = req.query;
  if (!link) {
    return res.status(400).json({ error: "Bill link is required" });
  }

  try {
    const storedDocument = await findDocumentBySourceUrl(link, "bill");
    if (storedDocument?.pdf) {
      return res.json({
        success: true,
        pdf: storedDocument.pdf,
        cached: true,
      });
    }

    const { data: html } = await axios.get(link, { timeout: 30_000 });
    const $ = cheerio.load(html);
    const pdfLink =
      $(".pdf-link[href]").first().attr("href") ||
      $("a[href$='.pdf']").first().attr("href");

    if (!pdfLink) {
      return res.json({
        success: false,
        pdf: null,
        message: "No PDF found for this bill",
      });
    }

    const pdfUrl = new URL(pdfLink, link || PRS_BASE_URL).toString();
    if (storedDocument) {
      await updateDocumentPdf(storedDocument.id, pdfUrl);
    }

    return res.json({ success: true, pdf: pdfUrl, cached: false });
  } catch (error) {
    console.error("Failed to fetch bill PDF:", error);
    return res.status(500).json({
      success: false,
      error: "Failed to fetch PDF link",
    });
  }
});

router.get("/relatedBills", async (req, res) => {
  const { billId } = req.query;
  if (!billId) {
    return res.status(400).json({ error: "Bill ID is required" });
  }

  try {
    const cachedRelated = await RelatedBills.findOne({
      billId: String(billId),
    });
    if (cachedRelated) {
      const ageInDays =
        (Date.now() - new Date(cachedRelated.lastUpdated).getTime()) /
        (1000 * 60 * 60 * 24);
      if (ageInDays < 7) {
        return res.json({
          success: true,
          relatedBills: cachedRelated.relatedBills,
          count: cachedRelated.relatedBills.length,
          cached: true,
          lastUpdated: cachedRelated.lastUpdated,
        });
      }
    }

    const currentBill = await getDocumentById(billId, "bill");
    if (!currentBill) {
      return res.json({
        success: true,
        relatedBills: [],
        message: "Bill not found",
      });
    }

    const { findSimilarBills } = require("../lib/vectordb");
    const similarBills = await findSimilarBills(
      String(billId),
      currentBill.title,
      5,
    );
    const enrichedRelatedBills = await Promise.all(
      similarBills.map(async (similar) => {
        const stored = await getDocumentById(similar.billId, "bill");
        return {
          billId: similar.billId,
          title: stored?.title || similar.title,
          link: stored?.link || null,
          status: stored?.status || "Unknown",
          pdf: stored?.pdf || null,
          similarityScore: similar.similarityScore,
        };
      }),
    );

    await RelatedBills.findOneAndUpdate(
      { billId: String(billId) },
      {
        billTitle: currentBill.title,
        relatedBills: enrichedRelatedBills,
        lastUpdated: new Date(),
      },
    );

    return res.json({
      success: true,
      relatedBills: enrichedRelatedBills,
      count: enrichedRelatedBills.length,
      cached: false,
      computedNow: true,
    });
  } catch (error) {
    console.error("Failed to fetch related bills:", error);
    return res.status(500).json({
      success: false,
      error: "Failed to fetch related bills",
      relatedBills: [],
      count: 0,
    });
  }
});

module.exports = router;
