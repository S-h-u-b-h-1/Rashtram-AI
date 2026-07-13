# Research Evaluation Framework

## Goal

Create repeatable measurements for retrieval quality, citation correctness, answer groundedness, comparison quality, latency, and cost.

## Benchmark categories

- Bill summary.
- Act interpretation.
- Amendment comparison.
- Regulatory circular retrieval.
- State-policy comparison.
- Ministry discovery.
- Exact clause retrieval.
- Timeline analysis.
- Business-impact analysis.
- Cross-document reasoning.

## Metrics

- Retrieval precision.
- Retrieval recall.
- Citation correctness.
- Answer correctness.
- Answer completeness.
- Unsupported-claim rate.
- Hallucination rate.
- Comparison quality.
- Latency.
- Generation and embedding cost.

## Command

JSON report:

`npm run eval:research --prefix server`

Markdown report:

`npm run eval:research --prefix server -- --markdown`

Output:

- JSON report for CI by default.
- Markdown report for humans with `--markdown`.
- Per-question retrieved documents, cited chunks, answer labels, latency, and provider usage.

## Minimum benchmark record

```json
{
  "id": "bill-summary-001",
  "category": "bill_summary",
  "query": "Summarise the key provisions of this Bill.",
  "documentIds": ["..."],
  "expectedSources": ["..."],
  "mustMention": ["purpose", "major provisions", "affected stakeholders"],
  "forbiddenClaims": ["unsupported legal advice"]
}
```

## Current status

The repo now has a benchmark scaffold and command. It verifies benchmark category coverage and current corpus readiness coverage. It does not yet score generated answers; answer-quality metrics remain `not_measured` until evaluator fixtures, expected answers, and citation adjudication are added.
