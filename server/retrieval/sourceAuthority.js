const SOURCE_AUTHORITY = Object.freeze({
  PRIMARY_OFFICIAL: "PRIMARY_OFFICIAL",
  OFFICIAL_SECONDARY: "OFFICIAL_SECONDARY",
  INSTITUTIONAL: "INSTITUTIONAL",
  RESEARCH: "RESEARCH",
  USER_SOURCE: "USER_SOURCE",
  UNKNOWN: "UNKNOWN",
});

const authorityWeights = () => ({
  [SOURCE_AUTHORITY.PRIMARY_OFFICIAL]: Number(process.env.RETRIEVAL_AUTHORITY_PRIMARY || 1),
  [SOURCE_AUTHORITY.OFFICIAL_SECONDARY]: Number(process.env.RETRIEVAL_AUTHORITY_SECONDARY || 0.9),
  [SOURCE_AUTHORITY.INSTITUTIONAL]: Number(process.env.RETRIEVAL_AUTHORITY_INSTITUTIONAL || 0.8),
  [SOURCE_AUTHORITY.RESEARCH]: Number(process.env.RETRIEVAL_AUTHORITY_RESEARCH || 0.75),
  [SOURCE_AUTHORITY.USER_SOURCE]: Number(process.env.RETRIEVAL_AUTHORITY_USER || 0.8),
  [SOURCE_AUTHORITY.UNKNOWN]: Number(process.env.RETRIEVAL_AUTHORITY_UNKNOWN || 0.55),
});

const classifySourceAuthority = (source = {}) => {
  if (source.userSource || source.sourceType === "pdf_upload" || source.sourceType === "url") {
    return SOURCE_AUTHORITY.USER_SOURCE;
  }
  const text = [source.sourceUrl, source.pdfUrl, source.source, source.sourceName,
    source.authority, source.sourceClassification].filter(Boolean).join(" ").toLowerCase();
  if (/\b(gov\.in|nic\.in|indiacode\.nic\.in|egazette|sansad|parliamentofindia|rbi\.org\.in|sebi\.gov\.in|supremecourt\.gov\.in)\b/.test(text)) {
    return SOURCE_AUTHORITY.PRIMARY_OFFICIAL;
  }
  if (/\b(pib\.gov\.in|ministry|department|commission|authority|board)\b/.test(text)) {
    return SOURCE_AUTHORITY.OFFICIAL_SECONDARY;
  }
  if (/\b(who\.int|un\.org|worldbank\.org|oecd\.org|institution|university|institute)\b/.test(text)) {
    return SOURCE_AUTHORITY.INSTITUTIONAL;
  }
  if (/\b(journal|research|working paper|doi\.org|arxiv)\b/.test(text)) {
    return SOURCE_AUTHORITY.RESEARCH;
  }
  return SOURCE_AUTHORITY.UNKNOWN;
};

// Authority is deliberately a small relevance-gated adjustment. A source with
// no query relevance cannot outrank a clearly relevant source merely by being official.
const authorityAdjustment = (authorityClass, relevance) => {
  const boundedRelevance = Math.max(0, Math.min(1, Number(relevance || 0)));
  return boundedRelevance * Math.max(0, authorityWeights()[authorityClass] || 0) * 0.08;
};

module.exports = {
  SOURCE_AUTHORITY,
  authorityAdjustment,
  authorityWeights,
  classifySourceAuthority,
};
