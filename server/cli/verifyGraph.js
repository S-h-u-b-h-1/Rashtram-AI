require("dotenv").config({
  path: process.env.ENV_FILE || require("path").join(__dirname, "../.env.local"),
});
const { getPool, query } = require("../db");
const {
  findPath,
  getGraph,
  getKnowledgeGraphMetrics,
  getRelationshipContext,
  searchGraph,
} = require("../graph/knowledgeGraphService");
const {
  getDocumentRecommendations,
} = require("../document/recommendationService");

const main = async () => {
  const schema = await query(`
    SELECT column_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'document_relationships'
      AND column_name IN (
        'source_document_id',
        'target_document_id',
        'relationship_strength',
        'relationship_source',
        'explanation',
        'relationship_evidence'
      )
    ORDER BY column_name
  `);
  const sample = await query(`
    SELECT from_document_id, to_document_id
    FROM document_relationships
    ORDER BY COALESCE(relationship_strength, confidence, 0) DESC
    LIMIT 1
  `);
  const metrics = await getKnowledgeGraphMetrics();
  const search = await searchGraph("finance", { limit: 3 });
  let graph = null;
  let path = null;
  let recommendations = [];
  let chatContext = null;
  if (sample.rows[0]) {
    graph = await getGraph(sample.rows[0].from_document_id, {
      depth: 2,
      limit: 40,
    });
    path = await findPath(
      sample.rows[0].from_document_id,
      sample.rows[0].to_document_id,
    );
    recommendations = await getDocumentRecommendations(
      sample.rows[0].from_document_id,
      null,
      { limit: 3, includeNonReady: true, useUserProfile: false },
    );
    chatContext = await getRelationshipContext(
      sample.rows[0].from_document_id,
      "What laws are related and what amended this document?",
    );
  }
  const report = {
    ok:
      schema.rows.length === 6 &&
      Array.isArray(search.nodes) &&
      (!sample.rows[0] || (graph?.edges?.length && path?.found)),
    schemaColumns: schema.rows.map((row) => row.column_name),
    metrics,
    searchResults: search.nodes.length,
    sampleGraphNodes: graph?.nodes?.length || 0,
    sampleGraphEdges: graph?.edges?.length || 0,
    samplePathLength: path?.length ?? null,
    graphAwareRecommendations: recommendations.length,
    graphChatSources: chatContext?.sources?.length || 0,
  };
  console.log(JSON.stringify(report, null, 2));
  if (!report.ok) process.exitCode = 1;
};

main()
  .catch((error) => {
    console.error("Knowledge graph verification failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    if (globalThis.__rashtramPostgresPool) await getPool().end();
  });
