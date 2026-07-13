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

```bash
npm run eval:research --prefix server
```

Markdown report:

```bash
npm run eval:research --prefix server -- --output-markdown
```

Retrieval-only measured run:

```bash
npm run eval:research --prefix server -- --limit=30 --retrieval-only --output-json --output-markdown
```

Output:

- JSON report for CI by default.
- Markdown report for humans with `--output-markdown`.
- Per-question retrieved documents, cited chunks, answer labels, latency, and provider usage.
- Local result files are written under ignored `server/evaluation-results/` when output flags are used.

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

The benchmark command now measures deterministic retrieval and citation-proxy behavior against live stored chunks.

Latest measured baseline, 2026-07-13:

- Questions executed: 30
- Exact-retrieval questions: 20
- Comparison questions: 5
- Insufficient-evidence questions: 5
- Recall@10: 0.94
- Mean reciprocal rank: 1.0
- Citation correctness proxy: 1.0
- Unsupported-claim rate: 0 in retrieval-only mode
- Insufficient-evidence accuracy: 1.0 on synthetic controls
- Average retrieval latency: 3165.4 ms
- Estimated generation cost: $0

The runner still does not claim full answer-quality scoring unless generation and answer judging are explicitly enabled in a later phase. Human legal adjudication remains pending.

## Quality gates

Advisory gates:

- Expected document recall@K above the current baseline.
- Citation correctness proxy above 0.9.
- Unsupported-claim rate below 0.1 when answer generation is enabled.
- Insufficient-evidence behavior above 0.85.

Release-blocking gates:

- No critical readiness contradictions.
- No citation to an unrelated document in controlled deterministic checks.
