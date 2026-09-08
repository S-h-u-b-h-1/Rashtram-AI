export const PROFILE_RECOMMENDATION_GRID_CLASSES =
  "grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4";

export const recommendationExplanation = (recommendation = {}) => {
  // An explicit omission from business discovery must not revive its raw
  // candidate-matching reason. Other recommendation surfaces retain theirs.
  const value = Object.hasOwn(recommendation, "whyThisMatters")
    ? recommendation.whyThisMatters : recommendation.reason;
  return typeof value === "string" && value.trim() ? value.trim() : null;
};

export const RECOMMENDATION_FILTERS = [
  { id: "all", label: "All" },
  { id: "same-jurisdiction", label: "Same Jurisdiction" },
  { id: "same-year", label: "Same Year" },
  { id: "recent", label: "Recent" },
  { id: "similar-topic", label: "Similar Topic" },
  { id: "research-ready", label: "Ready for research" },
];

const signalSet = (recommendation) =>
  new Set(
    Array.isArray(recommendation?.signals) ? recommendation.signals : [],
  );

export const recommendationMatchesFilter = (
  recommendation,
  filterId,
  now = Date.now(),
) => {
  if (filterId === "all") return true;
  const signals = signalSet(recommendation);
  if (filterId === "same-jurisdiction") {
    return signals.has("sameJurisdiction") || signals.has("sameState");
  }
  if (filterId === "same-year") return signals.has("sameYear");
  if (filterId === "similar-topic") {
    return [
      "semanticMatch",
      "titleMatch",
      "sameCategory",
      "sharedLegalIdentifier",
    ].some((signal) => signals.has(signal));
  }
  if (filterId === "research-ready") {
    return recommendation?.researchReady === true;
  }
  if (filterId === "recent") {
    if (signals.has("recent")) return true;
    const publishedAt = new Date(recommendation?.publicationDate || 0).getTime();
    const recentWindow = 366 * 24 * 60 * 60 * 1_000;
    return (
      Number.isFinite(publishedAt) &&
      publishedAt > 0 &&
      publishedAt <= now &&
      publishedAt >= now - recentWindow
    );
  }
  return false;
};

export const recommendationDocumentKey = (recommendation) => {
  const stableId =
    recommendation?.documentId ??
    recommendation?.id ??
    recommendation?._id ??
    recommendation?.recommendationId;
  return stableId == null || String(stableId).trim() === ""
    ? null
    : String(stableId);
};

const recommendationQuality = (recommendation) =>
  Number(recommendation?.score || 0) +
  (recommendation?.researchReady ? 0.05 : 0) +
  (recommendation?.comparisonReady ? 0.025 : 0);

export const deduplicateRecommendations = (recommendations = []) => {
  const unique = new Map();
  const unkeyed = [];
  for (const recommendation of recommendations) {
    const key = recommendationDocumentKey(recommendation);
    if (!key) {
      unkeyed.push(recommendation);
      continue;
    }
    const current = unique.get(key);
    if (
      !current ||
      recommendationQuality(recommendation) > recommendationQuality(current)
    ) {
      unique.set(key, recommendation);
    }
  }
  return [...unique.values(), ...unkeyed];
};

export const recommendationResearchHref = (recommendation) =>
  `/app/document/${encodeURIComponent(
    recommendation?.documentId ?? recommendation?.id ?? "",
  )}`;

export const compareActionState = (disabledReason, selected) => ({
  disabled: Boolean(disabledReason) && !selected,
  label: selected ? "Remove compare" : "Add to compare",
});

export const researchAreas = (plans = []) => {
  const seen = new Set();
  return plans.filter(plan => {
    const key = String(plan.area || '').trim().toLowerCase();
    if (!key || seen.has(key)) return false;
    seen.add(key); return true;
  }).slice(0, 6);
};

export const recommendationReadinessLabel = (document = {}, preparing = false) => {
  if (preparing || ['processing', 'preparing', 'queued'].includes(document.processingStatus)) return 'Preparing';
  if (document.capabilities?.chatReady ?? document.researchReady) return 'Ready to research';
  if (document.authorityClass === 'PRIMARY_OFFICIAL') return 'Official source found — not ready yet';
  return 'Supporting source · preparation required';
};
