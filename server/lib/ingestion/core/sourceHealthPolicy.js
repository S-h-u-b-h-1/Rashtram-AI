const { sourcePolicyFor } = require("./sourcePolicy");

const CONNECTOR_STATUS = Object.freeze({
  FRESH: "FRESH",
  DELAYED: "DELAYED",
  STALE: "STALE",
  BLOCKED_EXTERNAL: "BLOCKED_EXTERNAL",
  DEGRADED: "DEGRADED",
  ERROR: "ERROR",
  NO_DATA: "NO_DATA",
});

const FAILURE_CLASSES = Object.freeze([
  "DNS_FAILURE",
  "TLS_CERTIFICATE_FAILURE",
  "TLS_PROTOCOL_FAILURE",
  "HTTP_404",
  "HTTP_403",
  "HTTP_429",
  "ROBOTS_BLOCK",
  "CAPTCHA_BLOCK",
  "WAF_BLOCK",
  "TIMEOUT",
  "REDIRECT_LOOP",
  "REDIRECT_CHANGED",
  "JAVASCRIPT_REQUIRED",
  "AUTH_REQUIRED",
  "URL_PATTERN_CHANGED",
  "API_CHANGED",
  "HTML_STRUCTURE_CHANGED",
  "PDF_DISCOVERY_FAILED",
  "CONTENT_TYPE_MISMATCH",
  "HTML_INSTEAD_OF_PDF",
  "PARSER_FAILED",
  "LOW_QUALITY_EXTRACTION",
  "SCHEDULER_STALE",
  "DUPLICATE_INGESTION_ERROR",
  "SOURCE_NO_LONGER_AVAILABLE",
  "UNKNOWN",
]);

const EXTERNALLY_BLOCKED_FAILURES = new Set([
  "ROBOTS_BLOCK",
  "CAPTCHA_BLOCK",
  "WAF_BLOCK",
  "HTTP_403",
  "HTTP_429",
  "AUTH_REQUIRED",
  "TLS_CERTIFICATE_FAILURE",
  "TLS_PROTOCOL_FAILURE",
]);

const normalizeFailureText = (input = {}) => [
  input.code,
  input.message,
  input.error,
  input.reason,
  input.latestError,
  input.parserMessage,
].filter(Boolean).join(" ").toLowerCase();

const classifyFailure = (input = {}) => {
  const text = normalizeFailureText(input);
  const explicitCode = String(input.code || "").toUpperCase();
  if (FAILURE_CLASSES.includes(explicitCode)) return explicitCode;
  if (/robots\.txt|robots block|disallow(?:s|ed)? catalog/.test(text)) return "ROBOTS_BLOCK";
  if (/captcha/.test(text)) return "CAPTCHA_BLOCK";
  if (/cloudflare|web application firewall|\bwaf\b|access denied/.test(text)) return "WAF_BLOCK";
  if (/unable to verify|certificate|cert_|self[- ]signed|hostname.*certificate|leaf signature/.test(text)) return "TLS_CERTIFICATE_FAILURE";
  if (/eproto|tls protocol|wrong version number|handshake/.test(text)) return "TLS_PROTOCOL_FAILURE";
  if (/enotfound|eai_again|getaddrinfo|dns/.test(text)) return "DNS_FAILURE";
  if (/redirect.*(?:loop|many times)|maxredirect/.test(text)) return "REDIRECT_LOOP";
  if (/redirect.*(?:changed|invalid|missing location)/.test(text)) return "REDIRECT_CHANGED";
  if (/status code 429|\bhttp.?429\b|rate.?limit/.test(text)) return "HTTP_429";
  if (/status code 403|\bhttp.?403\b|forbidden/.test(text)) return "HTTP_403";
  if (/status code 404|\bhttp.?404\b|not found/.test(text)) return "HTTP_404";
  if (/status code 401|\bhttp.?401\b|requires sign[- ]?in|authentication required/.test(text)) return "AUTH_REQUIRED";
  if (/timeout|timed out|econnreset|econnrefused|unreachable/.test(text)) return "TIMEOUT";
  if (/javascript|client-side|hydration|interactive .*filter|asp\.net controls/.test(text)) return "JAVASCRIPT_REQUIRED";
  if (/html instead of (?:a )?pdf|downloaded response is html/.test(text)) return "HTML_INSTEAD_OF_PDF";
  if (/content.?type|did not return .*pdf/.test(text)) return "CONTENT_TYPE_MISMATCH";
  if (/duplicate key|unique constraint/.test(text)) return "DUPLICATE_INGESTION_ERROR";
  if (/low.?quality|not enough readable|no readable|text quality/.test(text)) return "LOW_QUALITY_EXTRACTION";
  if (/parser|response shape|html structure|no matching crawlable records/.test(text)) return "HTML_STRUCTURE_CHANGED";
  if (/pdf.*(?:not discovered|discovery failed)|no (?:crawlable )?.*pdf/.test(text)) {
    return "PDF_DISCOVERY_FAILED";
  }
  if (/api .*changed|unexpected api|payload.*array/.test(text)) return "API_CHANGED";
  if (/url pattern|endpoint .*changed|route .*changed|retired .*path/.test(text)) {
    return "URL_PATTERN_CHANGED";
  }
  if (/no longer available|retired|gone\b/.test(text)) return "SOURCE_NO_LONGER_AVAILABLE";
  return text ? "UNKNOWN" : null;
};

const hoursSince = (value, now = Date.now()) => {
  if (!value) return null;
  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp)
    ? Math.max(0, (now - timestamp) / 3_600_000)
    : null;
};

const freshnessThresholds = (sourceName, fallback = {}) => {
  const policy = sourcePolicyFor(sourceName, fallback);
  const cadenceHours = Math.max(1, Number(policy.cadenceHours || 720));
  return {
    cadenceHours,
    freshHours: cadenceHours <= 6 ? cadenceHours * 2 : cadenceHours * 1.5,
    staleHours: cadenceHours <= 6 ? cadenceHours * 4 : cadenceHours * 3,
  };
};

const classifyConnectorState = ({
  sourceName,
  liveStatus,
  lastSuccess,
  lastAttempt,
  failureClass,
  externalBlock = false,
  sampleRecordsDiscovered = 0,
  sampleDirectoryEntriesDiscovered = 0,
  storedSourceRecords = 0,
  unseenCount = 0,
  enabled = true,
  now = Date.now(),
  ingestionFrequency,
} = {}) => {
  const normalizedLive = String(liveStatus || "").toLowerCase();
  const observedFailure = failureClass || null;
  if (normalizedLive === "blocked_external" || externalBlock ||
      EXTERNALLY_BLOCKED_FAILURES.has(observedFailure)) {
    return CONNECTOR_STATUS.BLOCKED_EXTERNAL;
  }
  if (normalizedLive === "error") return CONNECTOR_STATUS.ERROR;
  if (normalizedLive === "no_data") return CONNECTOR_STATUS.NO_DATA;
  if (normalizedLive === "stale") return CONNECTOR_STATUS.STALE;
  if (normalizedLive === "delayed") return CONNECTOR_STATUS.DELAYED;
  if (normalizedLive === "behind upstream" || unseenCount > 0) {
    return CONNECTOR_STATUS.DEGRADED;
  }
  if (["unavailable", "parser changed", "failed", "error"].includes(normalizedLive)) {
    return observedFailure === "TLS_CERTIFICATE_FAILURE" && externalBlock
      ? CONNECTOR_STATUS.BLOCKED_EXTERNAL
      : CONNECTOR_STATUS.ERROR;
  }
  if (normalizedLive === "degraded") return CONNECTOR_STATUS.DEGRADED;
  const discovered = Number(sampleRecordsDiscovered || 0) +
    Number(sampleDirectoryEntriesDiscovered || 0);
  if (normalizedLive === "no data found" || (!discovered && !storedSourceRecords && enabled)) {
    return CONNECTOR_STATUS.NO_DATA;
  }
  if (!enabled) return CONNECTOR_STATUS.NO_DATA;

  const { freshHours, staleHours } = freshnessThresholds(sourceName, {
    ingestionFrequency,
  });
  const ageHours = hoursSince(lastSuccess || lastAttempt, now);
  if (ageHours == null) return discovered || storedSourceRecords
    ? CONNECTOR_STATUS.DELAYED
    : CONNECTOR_STATUS.NO_DATA;
  if (ageHours <= freshHours) return CONNECTOR_STATUS.FRESH;
  if (ageHours <= staleHours) return CONNECTOR_STATUS.DELAYED;
  return CONNECTOR_STATUS.STALE;
};

const publicConnectorStatus = (status) => ({
  [CONNECTOR_STATUS.FRESH]: "Fresh",
  [CONNECTOR_STATUS.DELAYED]: "Delayed",
  [CONNECTOR_STATUS.STALE]: "Stale",
  [CONNECTOR_STATUS.BLOCKED_EXTERNAL]: "Blocked",
  [CONNECTOR_STATUS.DEGRADED]: "Degraded",
  [CONNECTOR_STATUS.ERROR]: "Error",
  [CONNECTOR_STATUS.NO_DATA]: "No data",
})[status] || "No data";

module.exports = {
  CONNECTOR_STATUS,
  EXTERNALLY_BLOCKED_FAILURES,
  FAILURE_CLASSES,
  classifyConnectorState,
  classifyFailure,
  freshnessThresholds,
  hoursSince,
  publicConnectorStatus,
};
