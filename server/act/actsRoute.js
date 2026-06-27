const express = require("express");
const cheerio = require("cheerio");
const axios = require("axios");
const router = express.Router();


let actsCache = {
  data: null,
  timestamp: null,
  ttl: 5 * 60 * 1000,
};


const extractYearFromTitle = (title) => {
  const yearMatch = title.match(/,?\s*(\d{4})/);
  return yearMatch ? parseInt(yearMatch[1]) : null;
};

router.get("/", async (req, res) => {
  const baseUrl = "https://prsindia.org";
  const url = `${baseUrl}/acts/parliament`;

  const page = parseInt(req.query.page || "1");
  const limit = parseInt(req.query.limit || "10");
  const skip = (page - 1) * limit;
  const searchQuery = req.query.search || "";
  const yearFilter = req.query.year ? parseInt(req.query.year) : null;

  try {
    let allActs = [];
    let uniqueYears = [];


    const now = Date.now();
    const cacheValid = actsCache.data && actsCache.timestamp && (now - actsCache.timestamp) < actsCache.ttl;

    if (cacheValid) {
      console.log('✅ Using cached acts data');
      allActs = actsCache.data.acts;
      uniqueYears = actsCache.data.years;
    } else {
      console.log('🔄 Fetching fresh acts data from PRS India...');

      const { data: body } = await axios.get(url, {
        headers: { "Cache-Control": "no-store" },
      });
      const $ = cheerio.load(body);


      $(".view-content .views-row").each((i, el) => {
        const actTitle = $(el)
          .find(".views-field-title-field a")
          .attr("title")
          ?.trim() || $(el).find(".views-field-title-field a").text().trim();

        const pdfLink = $(el)
          .find(".views-field-title-field a")
          .attr("href");

        if (actTitle && pdfLink) {
          const fullPdfUrl = pdfLink.startsWith("http")
            ? pdfLink
            : pdfLink.startsWith("/")
            ? baseUrl + pdfLink
            : baseUrl + "/" + pdfLink;

          const year = extractYearFromTitle(actTitle);

          allActs.push({
            id: i + 1,
            title: actTitle,
            year: year,
            status: "Active",
            pdf: fullPdfUrl,
          });
        }
      });


      const yearsSet = new Set();
      allActs.forEach((act) => {
        if (act.year && act.year >= 1900 && act.year <= new Date().getFullYear()) {
          yearsSet.add(act.year);
        }
      });
      uniqueYears = Array.from(yearsSet).sort((a, b) => b - a);


      actsCache.data = { acts: allActs, years: uniqueYears };
      actsCache.timestamp = now;
      console.log(`✅ Cached ${allActs.length} acts for 5 minutes`);
    }


    let filteredActs = allActs;
    if (searchQuery) {
      filteredActs = filteredActs.filter((act) =>
        act.title.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }


    if (yearFilter) {
      filteredActs = filteredActs.filter((act) => act.year === yearFilter);
    }


    const paginatedActs = filteredActs.slice(skip, skip + limit);

    const totalActs = filteredActs.length;
    const hasMore = skip + limit < totalActs;

    res.json({
      acts: paginatedActs,
      years: uniqueYears,
      pagination: {
        page,
        limit,
        total: totalActs,
        hasMore,
        totalPages: Math.ceil(totalActs / limit),
      },
    });
  } catch (error) {
    console.error("❌ Error scraping acts:", error.message);
    res.status(500).json({
      error: "Failed to fetch acts",
      acts: [],
      years: uniqueYears,
      pagination: {
        page,
        limit,
        total: 0,
        hasMore: false,
        totalPages: 0,
      },
    });
  }
});


router.get("/years", async (req, res) => {
  try {

    const now = Date.now();
    const cacheValid = actsCache.data && actsCache.timestamp && (now - actsCache.timestamp) < actsCache.ttl;

    let years = [];

    if (cacheValid) {
      console.log('✅ Using cached years');
      years = actsCache.data.years;
    } else {
      console.log('🔄 Fetching fresh years...');
      const baseUrl = "https://prsindia.org";
      const url = `${baseUrl}/acts/parliament`;

      const { data: body } = await axios.get(url, {
        headers: { "Cache-Control": "no-store" },
      });
      const $ = cheerio.load(body);

      const yearsSet = new Set();
      $(".view-content .views-row").each((i, el) => {
        const actTitle = $(el)
          .find(".views-field-title-field a")
          .attr("title")
          ?.trim() || $(el).find(".views-field-title-field a").text().trim();

        if (actTitle) {
          const year = extractYearFromTitle(actTitle);
          if (year && year >= 1900 && year <= new Date().getFullYear()) {
            yearsSet.add(year);
          }
        }
      });

      years = Array.from(yearsSet).sort((a, b) => b - a);
    }

    res.json({
      success: true,
      years: years,
      count: years.length,
    });
  } catch (error) {
    console.error("❌ Error fetching act years:", error.message);
    res.status(500).json({
      success: false,
      error: "Failed to fetch act years",
      years: [],
      count: 0,
    });
  }
});

module.exports = router;
