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
  {
    name: "006_full_research_readiness.js",
    migration: require("./006_full_research_readiness"),
  },
  {
    name: "007_mass_processing_infrastructure.js",
    migration: require("./007_mass_processing_infrastructure"),
  },
  {
    name: "008_source_html_extraction.js",
    migration: require("./008_source_html_extraction"),
  },
  {
    name: "009_retrieval_fallback_readiness.js",
    migration: require("./009_retrieval_fallback_readiness"),
  },
  {
    name: "010_profile_onboarding.js",
    migration: require("./010_profile_onboarding"),
  },
  {
    name: "011_profile_role_and_preference_sync.js",
    migration: require("./011_profile_role_and_preference_sync"),
  },
  {
    name: "012_source_authority_and_canonical_provenance.js",
    migration: require("./012_source_authority_and_canonical_provenance"),
  },
  {
    name: "013_processing_failure_taxonomy.js",
    migration: require("./013_processing_failure_taxonomy"),
  },
  {
    name: "014_document_content_fingerprint.js",
    migration: require("./014_document_content_fingerprint"),
  },
  {
    name: "015_normalize_failure_pipeline_stage.js",
    migration: require("./015_normalize_failure_pipeline_stage"),
  },
  {
    name: "016_processing_audit_log.js",
    migration: require("./016_processing_audit_log"),
  },
  {
    name: "017_normalize_download_failure_codes.js",
    migration: require("./017_normalize_download_failure_codes"),
  },
  {
    name: "018_source_aware_retry_controls.js",
    migration: require("./018_source_aware_retry_controls"),
  },
];
