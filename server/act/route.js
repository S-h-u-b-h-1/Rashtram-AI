const express = require('express');
const { searchSimilarContentForAct, generateResponse } = require('../lib/vectordb');
const {
  completeSSE,
  errorSSE,
  sendSSE,
  startSSE,
} = require("../lib/sse");

const router = express.Router();

router.post('/', async (req, res) => {
  try {
    const { message, actId } = req.body;

    if (!message || !actId) {
      return res.status(400).json({ error: 'Message and act ID are required' });
    }

    console.log(`Searching for content related to: ${message}`);
    const similarContent = await searchSimilarContentForAct(message, actId, 5);

    const context = similarContent
      .map(match => match.metadata.content)
      .join('\n\n');

    const sources = similarContent.map(match => ({
      score: match.score,
      chunkIndex: match.metadata.chunkIndex,
      content: match.metadata.content.substring(0, 200) + '...',
    }));


    startSSE(res);
    sendSSE(res, { type: "meta", sources, actId });

    console.log('Generating response...');
    const stream = await generateResponse(message, context);

    for await (const chunk of stream) {
      if (res.destroyed || res.writableEnded) break;
      const content =
        typeof chunk.text === "function" ? chunk.text() : chunk.text || "";
      if (content) {
        sendSSE(res, { type: "content", content });
      }
    }

    if (!res.destroyed && !res.writableEnded) completeSSE(res);
  } catch (error) {
    console.error('Error in chat:', error);

    if (!res.headersSent) {
      res.status(500).json({
        error: `Failed to process chat: ${error.message}`,
      });
    } else {

      errorSSE(res, error);
    }
  }
});

module.exports = router;
