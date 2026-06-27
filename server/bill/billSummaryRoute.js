const express = require('express');
const { createProbeVector, getIndex } = require('../lib/vectordb');

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const { billId } = req.query;

    if (!billId) {
      return res.status(400).json({ error: 'Bill ID is required' });
    }

    const index = getIndex();

    const searchResults = await index.query({
      vector: createProbeVector(),
      topK: 1,
      filter: { billId: { $eq: billId } },
      includeMetadata: true,
    });

    if (searchResults.matches && searchResults.matches.length > 0) {
      const summary = searchResults.matches[0].metadata.summary;
      const title = searchResults.matches[0].metadata.title;

      return res.json({
        billId,
        title,
        summary,
        hasData: true,
      });
    } else {
      return res.json({
        billId,
        summary: null,
        hasData: false,
        message: 'Bill not yet processed or no data available',
      });
    }

  } catch (error) {
    console.error('Error fetching bill summary:', error);
    res.status(500).json({
      error: `Failed to fetch summary: ${error.message}`,
    });
  }
});

module.exports = router;
