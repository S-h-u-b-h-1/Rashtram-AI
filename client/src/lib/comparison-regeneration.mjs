export const comparisonActionState = ({
  hasComparison = false,
  loading = false,
  regenerating = false,
  readinessLoading = false,
  ready = false,
} = {}) => ({
  disabled: loading || regenerating || readinessLoading || !ready,
  label: regenerating
    ? "Regenerating comparison…"
    : loading
      ? "Comparing…"
      : readinessLoading
        ? "Checking readiness…"
        : hasComparison
          ? "Regenerate with AI"
          : "Run with these settings",
  preservePreviousResult: hasComparison,
});

export const applyRegenerationOutcome = (previousComparison, outcome) =>
  outcome?.comparison || previousComparison;
