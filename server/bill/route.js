const express = require('express');
const { searchSimilarContent, generateResponse } = require('../lib/vectordb');

const router = express.Router();

router.post('/', async (req, res) => {
  try {
    const { message, billId } = req.body;

    if (!message || !billId) {
      return res.status(400).json({ error: 'Message and bill ID are required' });
    }

    console.log(`Searching for content related to: ${message}`);
    const similarContent = await searchSimilarContent(message, billId, 5);

    const context = similarContent
      .map(match => match.metadata.content)
      .join('\n\n');

    const sources = similarContent.map(match => ({
      score: match.score,
      chunkIndex: match.metadata.chunkIndex,
      content: match.metadata.content.substring(0, 200) + '...',
    }));


    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');


    res.write(`data: ${JSON.stringify({ type: 'meta', sources, billId })}\n\n`);

    console.log('Generating response...');
    const stream = await generateResponse(message, context);

    for await (const chunk of stream) {
      const content =
        typeof chunk.text === "function" ? chunk.text() : chunk.text || "";
      if (content) {
        res.write(`data: ${JSON.stringify({ type: 'content', content })}\n\n`);
      }
    }

    res.write('data: [DONE]\n\n');
    res.end();
  } catch (error) {
    console.error('Error in chat:', error);

    if (!res.headersSent) {
      res.status(500).json({
        error: `Failed to process chat: ${error.message}`,
      });
    } else {

      res.write(`data: ${JSON.stringify({ type: 'error', error: error.message })}\n\n`);
      res.end();
    }
  }
});

module.exports = router;
