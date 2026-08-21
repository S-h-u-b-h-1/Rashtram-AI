const QUERY_TYPES = Object.freeze({
  METADATA: "METADATA",
  EXACT_REFERENCE: "EXACT_REFERENCE",
  FACTUAL: "FACTUAL",
  SEMANTIC: "SEMANTIC",
  RELATIONSHIP: "RELATIONSHIP",
  TIMELINE: "TIMELINE",
  COMPARISON: "COMPARISON",
  COMPLIANCE: "COMPLIANCE",
  POLICY_ANALYSIS: "POLICY_ANALYSIS",
});

const matches = (value, pattern) => pattern.test(String(value || ""));

const classifyQuery = (query, options = {}) => {
  const text = String(query || "").trim();
  if (options.comparison || Number(options.documentCount || 1) > 1 ||
      matches(text, /\b(compare|comparison|contrast|differences? between|versus|vs\.?)\b/i)) {
    return QUERY_TYPES.COMPARISON;
  }
  if (matches(
    text,
    /\b(section|subsection|sub-section|clause|article|rule|schedule|chapter)\s+(?:[\divxlcdm]+(?:\.\d+)*(?:\s*\([\w-]+\))*|(?:\([\w-]+\))+)/i,
  )) {
    return QUERY_TYPES.EXACT_REFERENCE;
  }
  if (matches(text, /\b(amend|amended|repeal|replace|related|relationship|linked|implements?|implemented by|issued under|supersed|deriv(?:e|ed)|parent act)\b/i)) {
    return QUERY_TYPES.RELATIONSHIP;
  }
  if (matches(text, /\b(timeline|chronolog|before|after|when|commencement|effective date|sequence|history)\b/i)) {
    return QUERY_TYPES.TIMELINE;
  }
  if (matches(text, /\b(compliance|comply|obligation|penalt|licen[cs]|reporting requirement|due diligence|regulatory burden|prohibited|must|shall)\b/i)) {
    return QUERY_TYPES.COMPLIANCE;
  }
  if (matches(text, /\b(policy objective|policy impact|implementation risk|stakeholder|affected (?:groups?|institutions?)|beneficiar|trade-?off|recommend|policy analysis|institutional capacity)\b/i)) {
    return QUERY_TYPES.POLICY_ANALYSIS;
  }
  if (matches(text, /\b(title|name|year|date|published|introduced|enacted|status|ministry|department|authority|jurisdiction|source|document type|who issued)\b/i)) {
    return QUERY_TYPES.METADATA;
  }
  if (matches(text, /\b(why|how might|implication|significance|effect on|impact on|interpret|analyse|analyze|explain)\b/i)) {
    return QUERY_TYPES.SEMANTIC;
  }
  return QUERY_TYPES.FACTUAL;
};

const planQuery = (query, options = {}) => {
  const queryType = options.queryType || classifyQuery(query, options);
  const plans = {
    [QUERY_TYPES.METADATA]: {
      useMetadata: true, useLexical: false, useVector: false, useGraph: false,
    },
    [QUERY_TYPES.EXACT_REFERENCE]: {
      useMetadata: false, useLexical: true, useVector: false, useGraph: false,
    },
    [QUERY_TYPES.FACTUAL]: {
      useMetadata: true, useLexical: true, useVector: "if_insufficient", useGraph: false,
    },
    [QUERY_TYPES.SEMANTIC]: {
      useMetadata: false, useLexical: true, useVector: true, useGraph: false,
    },
    [QUERY_TYPES.RELATIONSHIP]: {
      useMetadata: true, useLexical: true, useVector: "if_insufficient", useGraph: true,
    },
    [QUERY_TYPES.TIMELINE]: {
      useMetadata: true, useLexical: true, useVector: "if_insufficient", useGraph: true,
    },
    [QUERY_TYPES.COMPARISON]: {
      useMetadata: true, useLexical: true, useVector: true, useGraph: true,
    },
    [QUERY_TYPES.COMPLIANCE]: {
      useMetadata: false, useLexical: true, useVector: true, useGraph: false,
    },
    [QUERY_TYPES.POLICY_ANALYSIS]: {
      useMetadata: true, useLexical: true, useVector: true, useGraph: true,
    },
  };
  return {
    queryType,
    ...plans[queryType],
    comparisonIsolation: queryType === QUERY_TYPES.COMPARISON,
    plannerVersion: "retrieval-query-planner-v3.0",
  };
};

module.exports = { QUERY_TYPES, classifyQuery, planQuery };
