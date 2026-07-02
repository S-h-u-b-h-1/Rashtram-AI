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
];
