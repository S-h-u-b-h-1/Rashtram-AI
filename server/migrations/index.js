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
  {
    name: "019_research_retrieval_indexes.js",
    migration: require("./019_research_retrieval_indexes"),
  },
  {
    name: "020_quarantine_unsafe_relationship_inferences.js",
    migration: require("./020_quarantine_unsafe_relationship_inferences"),
  },
  {
    name: "021_quarantine_post_audit_relationship_inferences.js",
    migration: require("./021_quarantine_post_audit_relationship_inferences"),
  },
  {
    name: "022_document_text_chunks_content_hash.js",
    migration: require("./022_document_text_chunks_content_hash"),
  },
  {
    name: "023_artifact_object_storage.js",
    migration: require("./023_artifact_object_storage"),
  },
  {
    name: "024_shared_artifact_object_keys.js",
    migration: require("./024_shared_artifact_object_keys"),
  },
  {
    name: "025_remove_unused_schema_mirrors.js",
    migration: require("./025_remove_unused_schema_mirrors"),
  },
  {
    name: "026_restore_dedupe_candidates.js",
    migration: require("./026_restore_dedupe_candidates"),
  },
  {
    name: "027_research_sources.js",
    migration: require("./027_research_sources"),
  },
  {
    name: "028_policy_drafts.js",
    migration: require("./028_policy_drafts"),
  },
  {
    name: "029_processing_stage_capabilities.js",
    migration: require("./029_processing_stage_capabilities"),
  },
  {
    name: "030_knowledge_layer_v1.js",
    migration: require("./030_knowledge_layer_v1"),
  },
  {
    name: "031_research_query_observability.js",
    migration: require("./031_research_query_observability"),
  },
  {
    name: "032_semantic_coverage_v1.js",
    migration: require("./032_semantic_coverage_v1"),
  },
  {
    name: "033_large_document_intelligence.js",
    migration: require("./033_large_document_intelligence"),
  },
  {
    name: "034_temporal_legal_intelligence_v1.js",
    migration: require("./034_temporal_legal_intelligence_v1"),
  },
  {
    name: "035_compliance_copilot_v1.js",
    migration: require("./035_compliance_copilot_v1"),
  },
  {
    name: "036_regulatory_watchlists_v1.js",
    migration: require("./036_regulatory_watchlists_v1"),
  },
  {
    name: "037_cross_state_comparisons_v1.js",
    migration: require("./037_cross_state_comparisons_v1"),
  },
  {
    name: "038_research_reports_v1.js",
    migration: require("./038_research_reports_v1"),
  },
  {
    name: "039_commercial_pilot_observability.js",
    migration: require("./039_commercial_pilot_observability"),
  },
  {
    name: "040_product_reliability_v4.js",
    migration: require("./040_product_reliability_v4"),
  },
];
