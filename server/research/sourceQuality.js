const {
  SOURCE_AUTHORITY_CLASSES,
  sourcePolicyFor,
} = require("../lib/ingestion/core/sourcePolicy");

const FETCH_STATUS = Object.freeze({
  SUCCESS: "SUCCESS",
  BLOCKED: "BLOCKED",
  FAILED: "FAILED",
});

const EXTRACTION_STATUS = Object.freeze({
  GOOD: "GOOD",
  PARTIAL: "PARTIAL",
  LOW_QUALITY: "LOW_QUALITY",
  FAILED: "FAILED",
});

const EVIDENCE_STATUS = Object.freeze({
  USABLE: "USABLE",
  LIMITED: "LIMITED",
  NOT_USABLE: "NOT_USABLE",
});

const OFFICIAL_REGULATOR_HOSTS = new Set([
  "rbi.org.in", "www.rbi.org.in", "sebi.gov.in", "www.sebi.gov.in",
  "trai.gov.in", "www.trai.gov.in", "uidai.gov.in", "www.uidai.gov.in",
  "cci.gov.in", "www.cci.gov.in", "cercind.gov.in", "irdai.gov.in",
  "www.pfrda.org.in", "pfrda.org.in", "nmc.org.in", "www.nmc.org.in",
  "aicte-india.org", "www.aicte-india.org", "ugc.gov.in", "www.ugc.gov.in",
  "eci.gov.in", "www.eci.gov.in", "nclt.gov.in", "nclat.nic.in",
  "gstcouncil.gov.in", "www.gstcouncil.gov.in", "incometaxindia.gov.in",
  "www.incometaxindia.gov.in", "cbic.gov.in", "www.cbic.gov.in",
  "taxinformation.cbic.gov.in",
]);

const LEGISLATURE_HOSTS = new Set([
  "sansad.in", "www.sansad.in", "eparlib.sansad.in", "loksabha.nic.in",
  "rajyasabha.nic.in", "prsindia.org",
]);

const INSTITUTIONAL_HOSTS = new Set([
  "who.int", "www.who.int", "un.org", "www.un.org", "worldbank.org",
  "www.worldbank.org", "oecd.org", "www.oecd.org",
]);

const TRUSTED_SECONDARY_HOSTS = new Set([
  "prsindia.org", "www.prsindia.org", "policyedge.in", "www.policyedge.in",
]);

const hostnameFor = (value) => {
  try {
    return new URL(String(value || "")).hostname.toLowerCase();
  } catch {
    return "";
  }
};

const hostMatches = (hostname, suffix) =>
  hostname === suffix || hostname.endsWith(`.${suffix}`);

const isGovernmentHost = (hostname) =>
  hostMatches(hostname, "gov.in") || hostMatches(hostname, "nic.in");

const classifyDetailedAuthority = ({
  sourceName,
  sourceUrl,
  canonicalUrl,
  sourceType,
} = {}) => {
  if (sourceName) {
    const configured = sourcePolicyFor(sourceName);
    if (configured.authorityClass !== SOURCE_AUTHORITY_CLASSES.UNKNOWN) {
      return configured.authorityClass;
    }
  }
  const hostname = hostnameFor(canonicalUrl || sourceUrl);
  if (!hostname) return SOURCE_AUTHORITY_CLASSES.UNKNOWN;
  if (OFFICIAL_REGULATOR_HOSTS.has(hostname)) {
    return SOURCE_AUTHORITY_CLASSES.OFFICIAL_REGULATORY;
  }
  if (LEGISLATURE_HOSTS.has(hostname) && !hostname.includes("prsindia")) {
    return SOURCE_AUTHORITY_CLASSES.OFFICIAL_LEGISLATURE;
  }
  if (hostMatches(hostname, "indiacode.nic.in") ||
      hostMatches(hostname, "egazette.gov.in")) {
    return SOURCE_AUTHORITY_CLASSES.OFFICIAL_PRIMARY;
  }
  if (isGovernmentHost(hostname)) {
    return SOURCE_AUTHORITY_CLASSES.OFFICIAL_GOVERNMENT;
  }
  if (TRUSTED_SECONDARY_HOSTS.has(hostname)) {
    return SOURCE_AUTHORITY_CLASSES.TRUSTED_SECONDARY;
  }
  if (INSTITUTIONAL_HOSTS.has(hostname)) {
    return SOURCE_AUTHORITY_CLASSES.INSTITUTIONAL_SECONDARY;
  }
  if (hostMatches(hostname, "doi.org") || hostMatches(hostname, "arxiv.org") ||
      /(?:^|\.)(?:ac\.in|edu|edu\.in)$/.test(hostname)) {
    return SOURCE_AUTHORITY_CLASSES.ACADEMIC_RESEARCH;
  }
  if (sourceType === "external_url") return SOURCE_AUTHORITY_CLASSES.GENERIC_WEB;
  return SOURCE_AUTHORITY_CLASSES.UNKNOWN;
};

const extractionStatusFor = (extracted = {}) => {
  const quality = extracted.quality || {};
  const textLength = Number(quality.normalizedCharacters || extracted.text?.length || 0);
  if (textLength < 40) return EXTRACTION_STATUS.FAILED;
  if (quality.valid === false) return EXTRACTION_STATUS.LOW_QUALITY;
  if (extracted.partialValid || quality.reasons?.length || textLength < 1_200) {
    return EXTRACTION_STATUS.PARTIAL;
  }
  return EXTRACTION_STATUS.GOOD;
};

const isOfficialAuthority = (authorityClass) => [
  SOURCE_AUTHORITY_CLASSES.OFFICIAL_PRIMARY,
  SOURCE_AUTHORITY_CLASSES.OFFICIAL_REGULATORY,
  SOURCE_AUTHORITY_CLASSES.OFFICIAL_GOVERNMENT,
  SOURCE_AUTHORITY_CLASSES.OFFICIAL_LEGISLATURE,
  SOURCE_AUTHORITY_CLASSES.GOVERNMENT_POLICY,
].includes(authorityClass);

const evidenceStatusFor = ({
  authorityClass,
  extractionStatus,
  purpose = "research",
  sourceType = "external_url",
} = {}) => {
  if ([EXTRACTION_STATUS.FAILED, EXTRACTION_STATUS.LOW_QUALITY]
    .includes(extractionStatus)) return EVIDENCE_STATUS.NOT_USABLE;
  const strictOfficialPurpose = ["legal", "compliance", "current_status"]
    .includes(String(purpose || "").toLowerCase());
  if (strictOfficialPurpose) {
    if (isOfficialAuthority(authorityClass)) {
      return extractionStatus === EXTRACTION_STATUS.GOOD
        ? EVIDENCE_STATUS.USABLE
        : EVIDENCE_STATUS.LIMITED;
    }
    return EVIDENCE_STATUS.NOT_USABLE;
  }
  if (sourceType === "pdf_upload") return EVIDENCE_STATUS.USABLE;
  if ([SOURCE_AUTHORITY_CLASSES.GENERIC_WEB, SOURCE_AUTHORITY_CLASSES.UNKNOWN]
    .includes(authorityClass)) return EVIDENCE_STATUS.LIMITED;
  return extractionStatus === EXTRACTION_STATUS.GOOD
    ? EVIDENCE_STATUS.USABLE
    : EVIDENCE_STATUS.LIMITED;
};

const publicAuthorityLabel = (authorityClass) => ({
  [SOURCE_AUTHORITY_CLASSES.OFFICIAL_PRIMARY]: "Official government source",
  [SOURCE_AUTHORITY_CLASSES.OFFICIAL_REGULATORY]: "Regulatory source",
  [SOURCE_AUTHORITY_CLASSES.OFFICIAL_GOVERNMENT]: "Official government source",
  [SOURCE_AUTHORITY_CLASSES.OFFICIAL_LEGISLATURE]: "Official legislature source",
  [SOURCE_AUTHORITY_CLASSES.GOVERNMENT_POLICY]: "Government policy source",
  [SOURCE_AUTHORITY_CLASSES.INSTITUTIONAL_SECONDARY]: "Institutional research",
  [SOURCE_AUTHORITY_CLASSES.ACADEMIC_RESEARCH]: "Academic research",
  [SOURCE_AUTHORITY_CLASSES.TRUSTED_SECONDARY]: "Institutional research",
  [SOURCE_AUTHORITY_CLASSES.GENERIC_WEB]: "External web source",
  [SOURCE_AUTHORITY_CLASSES.UNKNOWN]: "External web source",
})[authorityClass] || "External web source";

const toRetrievalAuthorityClass = (authorityClass, sourceType) => {
  if (isOfficialAuthority(authorityClass)) return "PRIMARY_OFFICIAL";
  if (authorityClass === SOURCE_AUTHORITY_CLASSES.INSTITUTIONAL_SECONDARY) return "INSTITUTIONAL";
  if ([SOURCE_AUTHORITY_CLASSES.ACADEMIC_RESEARCH,
    SOURCE_AUTHORITY_CLASSES.TRUSTED_SECONDARY].includes(authorityClass)) return "RESEARCH";
  if (sourceType === "pdf_upload") return "USER_SOURCE";
  return "UNKNOWN";
};

const chooseCanonicalSourceUrl = ({ requestedUrl, finalUrl, extractedCanonicalUrl }) => {
  const fallback = finalUrl || requestedUrl || null;
  if (!extractedCanonicalUrl) return fallback;
  const canonicalHost = hostnameFor(extractedCanonicalUrl);
  const finalHost = hostnameFor(fallback);
  if (!canonicalHost || !finalHost || canonicalHost !== finalHost) return fallback;
  try {
    const parsed = new URL(extractedCanonicalUrl);
    parsed.hash = "";
    for (const key of [...parsed.searchParams.keys()]) {
      if (/^(?:utm_|fbclid|gclid|ref$|session)/i.test(key)) parsed.searchParams.delete(key);
    }
    return parsed.toString();
  } catch {
    return fallback;
  }
};

const assessExternalSourceQuality = ({
  sourceName,
  sourceUrl,
  canonicalUrl,
  sourceType = "external_url",
  extracted = {},
  purpose = "research",
} = {}) => {
  const authorityClass = classifyDetailedAuthority({
    sourceName,
    sourceUrl,
    canonicalUrl,
    sourceType,
  });
  const extractionStatus = extractionStatusFor(extracted);
  const evidenceStatus = evidenceStatusFor({
    authorityClass,
    extractionStatus,
    purpose,
    sourceType,
  });
  return {
    fetchStatus: FETCH_STATUS.SUCCESS,
    extractionStatus,
    authorityClass,
    evidenceStatus,
    publicAuthorityLabel: publicAuthorityLabel(authorityClass),
  };
};

module.exports = {
  EVIDENCE_STATUS,
  EXTRACTION_STATUS,
  FETCH_STATUS,
  OFFICIAL_REGULATOR_HOSTS,
  assessExternalSourceQuality,
  chooseCanonicalSourceUrl,
  classifyDetailedAuthority,
  evidenceStatusFor,
  extractionStatusFor,
  isGovernmentHost,
  isOfficialAuthority,
  publicAuthorityLabel,
  toRetrievalAuthorityClass,
};
