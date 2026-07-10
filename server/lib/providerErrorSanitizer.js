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

module.exports = {
  GENERIC_PROVIDER_ERROR,
  redactLongTokenLikeValues,
  sanitizeProviderError,
};
