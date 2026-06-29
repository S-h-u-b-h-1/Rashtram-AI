const express = require("express");
const { pdfProcessor } = require("../lib/pdfProcessor");
const {
  checkEGazetteExists,
  createProbeVector,
  generateEGazetteSummary,
  getEGazetteIndex,
  storeEGazetteContentInChunks,
} = require("../lib/vectordb");
const { getGazetteById } = require("./egazetteService");

const router = express.Router();

const loadExistingContent = async (gazetteId) => {
  const result = await getEGazetteIndex().query({
    vector: createProbeVector(),
    topK: 100,
    filter: { gazetteId: { $eq: String(gazetteId) } },
    includeMetadata: true,
  });
  return result.matches || [];
};

router.post("/", async (req, res) => {
  try {
    const { gazetteId } = req.body;
    if (!gazetteId) {
      return res.status(400).json({
        error: "Gazette ID is required.",
      });
    }
    const gazette = await getGazetteById(gazetteId, req.user.id);
    if (!gazette) {
      return res.status(404).json({ error: "Gazette document not found." });
    }
    if (!gazette.pdfUrl) {
      return res.status(422).json({
        error: "This Gazette record does not have an official PDF.",
      });
    }
    const { pdfUrl, title } = gazette;

    const existence = await checkEGazetteExists(gazetteId);
    if (existence.exists) {
      let summary = existence.summary;
      const matches = summary ? [] : await loadExistingContent(gazetteId);
      if (!summary && matches.length) {
        const context = matches
          .map((match) => match.metadata?.content || "")
          .filter(Boolean)
          .join("\n\n");
        if (context) {
          summary = await generateEGazetteSummary(context);
          await Promise.all(
            matches.map((match) =>
              getEGazetteIndex().update({
                id: match.id,
                metadata: { ...match.metadata, summary },
              }),
            ),
          );
        }
      }
      return res.json({
        success: true,
        alreadyProcessed: true,
        processingMethod: "existing-data",
        chunksStored: existence.chunksCount || matches.length || 0,
        summary: summary || null,
        gazetteTitle: existence.gazetteTitle,
        lastProcessed: existence.lastProcessed,
      });
    }

    const processed = await pdfProcessor.processPDFAndCreateChunks(
      pdfUrl,
      gazetteId,
      title,
    );
    const summaryContext = processed.chunks
      .slice(0, 6)
      .map((chunk) => chunk.content)
      .join("\n\n");
    const summary = await generateEGazetteSummary(summaryContext);
    const chunks = processed.chunks.map((chunk, index) => ({
      ...chunk,
      id: `gazette-${gazetteId}-chunk-${index}`,
      gazetteId: String(gazetteId),
      title,
      metadata: {
        ...chunk.metadata,
        documentType: "gazette",
        summary,
      },
    }));
    const stored = await storeEGazetteContentInChunks(chunks);
    return res.json({
      success: true,
      alreadyProcessed: false,
      processingMethod: "full-pdf-chunking",
      chunksStored: stored.chunksStored,
      totalChunks: processed.totalChunks,
      originalLength: processed.originalLength,
      summary,
      pdfMetadata: processed.pdfMetadata,
    });
  } catch (error) {
    console.error("Failed to process eGazette PDF:", error);
    return res.status(500).json({
      error: `Failed to process Gazette: ${error.message}`,
    });
  }
});

module.exports = router;
