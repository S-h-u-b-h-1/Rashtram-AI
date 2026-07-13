const RESEARCH_BENCHMARKS = [
  {
    id: "bill-summary-001",
    category: "bill_summary",
    query: "Summarise the purpose, major provisions, and affected stakeholders of this Bill.",
    requiredDocumentTypes: ["bill"],
    mustMeasure: ["citation_correctness", "summary_completeness"],
  },
  {
    id: "act-interpretation-001",
    category: "act_interpretation",
    query: "Find the exact section that creates this obligation and explain it with citations.",
    requiredDocumentTypes: ["act"],
    mustMeasure: ["exact_clause_retrieval", "unsupported_claim_rate"],
  },
  {
    id: "amendment-comparison-001",
    category: "amendment_comparison",
    query: "Compare the amending instrument against the original law and cite clause-level changes.",
    requiredDocumentTypes: ["act", "bill", "notification"],
    mustMeasure: ["comparison_quality", "citation_correctness"],
  },
  {
    id: "regulatory-circular-001",
    category: "regulatory_circular",
    query: "Identify the regulator, applicability, effective date, and cited operative directions.",
    requiredDocumentTypes: ["circular", "notification", "regulation"],
    mustMeasure: ["metadata_precision", "citation_correctness"],
  },
  {
    id: "state-policy-comparison-001",
    category: "state_policy_comparison",
    query: "Compare two state policies for incentives, eligibility, authority, and effective period.",
    requiredDocumentTypes: ["policy"],
    requiredJurisdictionLevel: "state",
    mustMeasure: ["comparison_quality", "jurisdiction_filter_accuracy"],
  },
  {
    id: "ministry-discovery-001",
    category: "ministry_discovery",
    query: "Which ministry documents are relevant to this topic, and which are official versus secondary?",
    requiredDocumentTypes: ["policy", "press_release", "report"],
    mustMeasure: ["source_authority_ranking", "retrieval_precision"],
  },
  {
    id: "timeline-analysis-001",
    category: "timeline_analysis",
    query: "Build a dated timeline of related legal and policy changes.",
    requiredDocumentTypes: ["bill", "act", "notification", "policy"],
    mustMeasure: ["date_accuracy", "relationship_precision"],
  },
  {
    id: "business-impact-001",
    category: "business_impact",
    query: "For a business profile, identify directly supported obligations and items requiring professional review.",
    requiredDocumentTypes: ["act", "rule", "circular", "notification", "policy"],
    mustMeasure: ["claim_label_accuracy", "unsupported_claim_rate"],
  },
];

const REQUIRED_CATEGORIES = [
  "bill_summary",
  "act_interpretation",
  "amendment_comparison",
  "regulatory_circular",
  "state_policy_comparison",
  "ministry_discovery",
  "timeline_analysis",
  "business_impact",
];

module.exports = {
  REQUIRED_CATEGORIES,
  RESEARCH_BENCHMARKS,
};
