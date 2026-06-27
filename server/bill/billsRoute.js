const express = require('express');
const cheerio = require('cheerio');
const axios = require('axios');
const RelatedBills = require('../models/RelatedBills');
const router = express.Router();


let billsCache = {
  data: null,
  timestamp: null,
  ttl: 5 * 60 * 1000,
};

router.get('/', async (req, res) => {
  const baseUrl = 'https://prsindia.org';
  const url = `${baseUrl}/billtrack/`;

  const page = parseInt(req.query.page || '1');
  const limit = parseInt(req.query.limit || '10');
  const skip = (page - 1) * limit;
  const searchQuery = req.query.search || '';
  const statusFilter = req.query.status || '';

  try {
    let allBills = [];
    let uniqueStatuses = [];


    const now = Date.now();
    const cacheValid = billsCache.data && billsCache.timestamp && (now - billsCache.timestamp) < billsCache.ttl;

    if (cacheValid) {
      console.log('✅ Using cached bills data');
      allBills = billsCache.data.bills;
      uniqueStatuses = billsCache.data.statuses;
    } else {
      console.log('🔄 Fetching fresh bills data from PRS India...');

      const { data: body } = await axios.get(url, { headers: { 'Cache-Control': 'no-store' } });
      const $ = cheerio.load(body);

      $('.view-content .views-row').each((i, el) => {
        const billTitle = $(el).find('.views-field-title-field a').text().trim();
        const detailLink = $(el).find('.views-field-title-field a').attr('href');
        const status = $(el).find('.views-field-field-bill-status span').text().trim();

        if (billTitle && detailLink) {
          allBills.push({
            id: i + 1,
            title: billTitle,
            link: baseUrl + detailLink,
            status: status || 'Unknown',
            pdf: null,
          });
        }
      });


      const statusesSet = new Set();
      allBills.forEach((bill) => {
        if (bill.status) {
          statusesSet.add(bill.status);
        }
      });
      uniqueStatuses = Array.from(statusesSet).sort();


      billsCache.data = { bills: allBills, statuses: uniqueStatuses };
      billsCache.timestamp = now;
      console.log(`✅ Cached ${allBills.length} bills for 5 minutes`);
    }


    let filteredBills = allBills;
    if (searchQuery) {
      filteredBills = filteredBills.filter((bill) =>
        bill.title.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }


    if (statusFilter && statusFilter !== 'All') {
      filteredBills = filteredBills.filter((bill) => bill.status === statusFilter);
    }


    const paginatedBills = filteredBills.slice(skip, skip + limit);

    const totalBills = filteredBills.length;
    const hasMore = skip + limit < totalBills;

    res.json({
      bills: paginatedBills,
      statuses: uniqueStatuses,
      pagination: {
        page,
        limit,
        total: totalBills,
        hasMore,
        totalPages: Math.ceil(totalBills / limit),
      },
    });
  } catch (error) {
    console.error('❌ Error scraping bills:', error.message);
    res.status(500).json({
      error: 'Failed to fetch bills',
      bills: [],
      statuses: [],
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


router.get('/status', async (req, res) => {
  try {

    const now = Date.now();
    const cacheValid = billsCache.data && billsCache.timestamp && (now - billsCache.timestamp) < billsCache.ttl;

    let statuses = [];

    if (cacheValid) {
      console.log('✅ Using cached statuses');
      statuses = billsCache.data.statuses;
    } else {
      console.log('🔄 Fetching fresh statuses...');
      const baseUrl = 'https://prsindia.org';
      const url = `${baseUrl}/billtrack/`;

      const { data: body } = await axios.get(url, { headers: { 'Cache-Control': 'no-store' } });
      const $ = cheerio.load(body);

      const statusesSet = new Set();
      $('.view-content .views-row').each((i, el) => {
        const status = $(el).find('.views-field-field-bill-status span').text().trim();
        if (status) {
          statusesSet.add(status);
        }
      });

      statuses = Array.from(statusesSet).sort();
    }

    res.json({
      success: true,
      statuses: statuses,
      count: statuses.length,
    });
  } catch (error) {
    console.error('❌ Error fetching bill statuses:', error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch bill statuses',
      statuses: [],
      count: 0,
    });
  }
});


router.get('/pdf', async (req, res) => {
  const { link } = req.query;

  if (!link) {
    return res.status(400).json({ error: 'Bill link is required' });
  }

  try {
    const baseUrl = 'https://prsindia.org';
    const { data: html } = await axios.get(link);
    const $ = cheerio.load(html);
    const pdfLink = $("a[href$='.pdf']").attr('href');

    if (pdfLink) {
      const fullPdfUrl = pdfLink.startsWith('http')
        ? pdfLink
        : pdfLink.startsWith('/')
        ? baseUrl + pdfLink
        : baseUrl + '/' + pdfLink;

      res.json({ success: true, pdf: fullPdfUrl });
    } else {
      res.json({ success: false, pdf: null, message: 'No PDF found for this bill' });
    }
  } catch (error) {
    console.error('❌ Error fetching PDF:', error.message);
    res.status(500).json({ success: false, error: 'Failed to fetch PDF link' });
  }
});


router.get('/relatedBills', async (req, res) => {
  const { billId } = req.query;

  if (!billId) {
    return res.status(400).json({ error: 'Bill ID is required' });
  }

  try {

    const CACHE_VALIDITY_DAYS = 7;
    const cachedRelated = await RelatedBills.findOne({ billId: billId.toString() });

    if (cachedRelated) {
      const daysSinceUpdate = (Date.now() - cachedRelated.lastUpdated) / (1000 * 60 * 60 * 24);

      if (daysSinceUpdate < CACHE_VALIDITY_DAYS) {
        console.log(`✅ Using cached related bills from MongoDB (${daysSinceUpdate.toFixed(1)} days old)`);
        return res.json({
          success: true,
          relatedBills: cachedRelated.relatedBills,
          count: cachedRelated.relatedBills.length,
          cached: true,
          lastUpdated: cachedRelated.lastUpdated,
        });
      } else {
        console.log('🔄 Cache expired, fetching fresh related bills...');
      }
    } else {
      console.log('📝 No cache found, computing related bills...');
    }


    const now = Date.now();
    const cacheValid = billsCache.data && billsCache.timestamp && (now - billsCache.timestamp) < billsCache.ttl;

    let allBills = [];

    if (cacheValid) {
      allBills = billsCache.data.bills;
    } else {
      const baseUrl = 'https://prsindia.org';
      const url = `${baseUrl}/billtrack/`;

      const { data: body } = await axios.get(url, { headers: { 'Cache-Control': 'no-store' } });
      const $ = cheerio.load(body);

      $('.view-content .views-row').each((i, el) => {
        const billTitle = $(el).find('.views-field-title-field a').text().trim();
        const detailLink = $(el).find('.views-field-title-field a').attr('href');
        const status = $(el).find('.views-field-field-bill-status span').text().trim();

        if (billTitle && detailLink) {
          allBills.push({
            id: i + 1,
            title: billTitle,
            link: baseUrl + detailLink,
            status: status || 'Unknown',
            pdf: null,
          });
        }
      });
    }

    const currentBill = allBills.find(bill => bill.id.toString() === billId.toString());

    if (!currentBill) {
      return res.json({
        success: true,
        relatedBills: [],
        message: 'Bill not found',
      });
    }


    const { findSimilarBills } = await import('../lib/vectordb.js');
    const similarBills = await findSimilarBills(billId.toString(), currentBill.title, 5);


    const enrichedRelatedBills = similarBills.map(similar => {
      const billDetails = allBills.find(b => b.id.toString() === similar.billId);
      return {
        billId: similar.billId,
        title: similar.title,
        link: billDetails?.link || null,
        status: billDetails?.status || 'Unknown',
        pdf: billDetails?.pdf || null,
        similarityScore: similar.similarityScore,
      };
    });


    await RelatedBills.findOneAndUpdate(
      { billId: billId.toString() },
      {
        billId: billId.toString(),
        billTitle: currentBill.title,
        relatedBills: enrichedRelatedBills,
        lastUpdated: new Date(),
      },
      { upsert: true, new: true }
    );

    console.log(`💾 Saved ${enrichedRelatedBills.length} related bills to MongoDB cache`);

    res.json({
      success: true,
      relatedBills: enrichedRelatedBills,
      count: enrichedRelatedBills.length,
      cached: false,
      computedNow: true,
    });
  } catch (error) {
    console.error('❌ Error fetching related bills:', error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch related bills',
      relatedBills: [],
      count: 0,
    });
  }
});

module.exports = router;
