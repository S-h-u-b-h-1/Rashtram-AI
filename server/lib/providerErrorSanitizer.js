const GENERIC_PROVIDER_ERROR = "AI generation provider unavailable.";

const redactLongTokenLikeValues = (value) =>
  String(value || "").replace(
    /\b(?:sk-[A-Za-z0-9_-]+|AQ\.[A-Za-z0-9_-]+|pcsk_[A-Za-z0-9_-]+|[A-Za-z0-9_-]{32,})\b/g,
    "[redacted]",
  );

const sanitizeProviderError = (error) => {
  const message = redactLongTokenLikeValues(error?.message || error || "")
    .normalize("NFKC")
    .replace(/\s+/g, " ")
    .trim();
  if (!message) return GENERIC_PROVIDER_ERROR;
  if (
    /\b(api key|apikey|authorization|authentication|credential|secret|token|billing|quota|401|429)\b/i
      .test(message)
  ) {
    return GENERIC_PROVIDER_ERROR;
  }
  return message.slice(0, 240) || GENERIC_PROVIDER_ERROR;
};

const classifyProviderError = (error) => {
  const status = Number(error?.status || error?.code);
  const message = String(error?.message || error || "")
    .normalize("NFKC")
    .replace(/\s+/g, " ")
    .trim();

  if (
    [401, 403].includes(status) ||
    /\b(api key|apikey|authorization|authentication|credential|permission denied|forbidden)\b/i
      .test(message)
  ) {
    return "auth_or_permission";
  }
  if (
    status === 429 ||
    /\b(rate limit|rate-limit|too many requests)\b/i.test(message)
  ) {
    return "rate_limited";
  }
  if (/\b(quota|billing)\b/i.test(message)) {
    return "quota_or_billing";
  }
  if (
    status === 404 ||
    /\b(model|not found|does not exist|unsupported)\b/i.test(message)
  ) {
    return "model_unavailable";
  }
  if (
    status === 408 ||
    error?.name === "AbortError" ||
    /\b(timeout|timed out|aborted)\b/i.test(message)
  ) {
    return "timeout";
  }
  if (
    [500, 502, 503, 504].includes(status) ||
    /\b(overloaded|unavailable|temporar)\b/i.test(message)
  ) {
    return "provider_unavailable";
  }
  if (
    /\b(enotfound|econnreset|econnrefused|network|fetch failed)\b/i
      .test(message)
  ) {
    return "network";
  }
  return "unknown";
};

module.exports = {
  GENERIC_PROVIDER_ERROR,
  classifyProviderError,
  redactLongTokenLikeValues,
  sanitizeProviderError,
};
