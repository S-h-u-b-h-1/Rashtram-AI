module.exports = [
  {
    name: "001_database_v2.js",
    migration: require("./001_database_v2"),
  },
  {
    name: "002_normalized_support_tables.js",
    migration: require("./002_normalized_support_tables"),
  },
  {
    name: "003_quarantine_navigation_artifacts.js",
    migration: require("./003_quarantine_navigation_artifacts"),
  },
  {
    name: "004_comparison_recommendation_intelligence.js",
    migration: require("./004_comparison_recommendation_intelligence"),
  },
  {
    name: "005_government_knowledge_graph.js",
    migration: require("./005_government_knowledge_graph"),
  },
];
