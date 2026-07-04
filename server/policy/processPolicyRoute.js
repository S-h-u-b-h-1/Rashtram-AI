const express = require("express");
const {
  checkPolicyExists,
  createProbeVector,
  generatePolicySummary,
  getPolicyIndex,
  storePolicyContentInChunks,
} = require("../lib/vectordb");
const { getPolicyById } = require("./policyService");
const { fetchArticle } = require("../lib/ingestion/connectors/policyedgeConnector");
const { query } = require("../db");

const router = express.Router();

const splitIntoChunks = (text, chunkSize = 800) => {
  const words = text.split(" ");
  const chunks = [];
  for (let index = 0; index < words.length; index += chunkSize) {
    chunks.push(words.slice(index, index + chunkSize).join(" "));
  }
  return chunks;
};

const loadExistingContent = async (policyId) => {
  const result = await getPolicyIndex().query({
    vector: createProbeVector(),
    topK: 100,
    filter: { policyId: { $eq: String(policyId) } },
    includeMetadata: true,
  });
  return result.matches || [];
};

router.post("/", async (req, res) => {
  try {
    const { policyId } = req.body;
    if (!policyId) {
      return res.status(400).json({
        error: "Policy ID is required.",
      });
    }
    const policy = await getPolicyById(policyId);
    if (!policy) {
      return res.status(404).json({ error: "Policy document not found." });
    }

    const existence = await checkPolicyExists(policyId);
    if (existence.exists) {
      let summary = existence.summary;
      const matches = summary ? [] : await loadExistingContent(policyId);
      if (!summary && matches.length) {
        const context = matches
          .map((match) => match.metadata?.content || "")
          .filter(Boolean)
          .join("\n\n");
        if (context) {
          summary = await generatePolicySummary(context);
          await Promise.all(
            matches.map((match) =>
              getPolicyIndex().update({
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
        policyTitle: existence.policyTitle,
        lastProcessed: existence.lastProcessed,
        researchReady: true,
        comparisonReady: true,
      });
    }

    // Extract the slug from the source URL
    const sourceUrl = policy.sourceUrl || "";
    const slug = sourceUrl.split("/p/").pop();
    if (!slug) {
      return res.status(422).json({
        error:
          "Cannot determine the PolicyEdge article slug from the source URL.",
      });
    }

    const article = await fetchArticle(slug);
    const fullContent = [
      article.title,
      article.description,
      article.bodyText,
    ]
      .filter(Boolean)
      .join("\n\n");

    if (!fullContent || fullContent.length < 50) {
      return res.status(422).json({
        error: "Article content is too short to process.",
      });
    }

    const rawChunks = splitIntoChunks(fullContent);
    const summaryContext = rawChunks.slice(0, 6).join("\n\n");
    const summary = await generatePolicySummary(summaryContext);

    const chunks = rawChunks.map((chunk, index) => ({
      id: `policy-${policyId}-chunk-${index}`,
      policyId: String(policyId),
      title: article.title || policy.title,
      content: chunk,
      chunkIndex: index,
      totalChunks: rawChunks.length,
      metadata: {
        documentType: "policy",
        source: "PolicyEdge",
        sourceUrl: article.url,
        category: article.category,
        summary,
      },
    }));

    const stored = await storePolicyContentInChunks(chunks);

    await query(
      `UPDATE documents SET research_ready = true, comparison_ready = true, updated_at = NOW() WHERE id = $1`,
      [policyId]
    );

    return res.json({
      success: true,
      alreadyProcessed: false,
      processingMethod: "full-article-chunking",
      chunksStored: stored.chunksStored,
      totalChunks: rawChunks.length,
      originalLength: fullContent.length,
      summary,
      researchReady: true,
      comparisonReady: true,
    });
  } catch (error) {
    console.error("Failed to process policy article:", error);
    return res.status(500).json({
      error: `Failed to process policy: ${error.message}`,
    });
  }
});

module.exports = router;
