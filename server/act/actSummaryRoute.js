const express = require('express');
const { createProbeVector, getActIndex } = require('../lib/vectordb');

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const { actId } = req.query;

    if (!actId) {
      return res.status(400).json({ error: 'Act ID is required' });
    }

    const index = getActIndex();

    const searchResults = await index.query({
      vector: createProbeVector(),
      topK: 1,
      filter: { actId: { $eq: actId } },
      includeMetadata: true,
    });

    if (searchResults.matches && searchResults.matches.length > 0) {
      const summary = searchResults.matches[0].metadata.summary;
      const title = searchResults.matches[0].metadata.title;

      return res.json({
        actId,
        title,
        summary,
        hasData: true,
      });
    } else {
      return res.json({
        actId,
        summary: null,
        hasData: false,
        message: 'Act not yet processed or no data available',
      });
    }

  } catch (error) {
    console.error('Error fetching act summary:', error);
    res.status(500).json({
      error: `Failed to fetch summary: ${error.message}`,
    });
  }
});

module.exports = router;
