# Research Benchmark Results

Last updated: 2026-07-13

## Execution status

The first live deterministic research benchmark was executed against production-backed stored chunks.

Command:

```bash
npm run eval:research --prefix server -- --limit=30 --retrieval-only --output-json --output-markdown
```

Output files were written to ignored local paths under `server/evaluation-results/` and were not committed.

## Measured results

| Metric | Result |
| --- | ---: |
| Questions executed | 30 |
| Retrieval questions | 25 |
| Insufficient-evidence questions | 5 |
| Recall@10 | 0.94 |
| Mean reciprocal rank | 1.0 |
| Expected document appearance rate | 1.0 |
| Expected chunk appearance rate | 1.0 |
| Citation correctness proxy | 1.0 |
| Unsupported-claim rate | 0 |
| Insufficient-evidence accuracy | 1.0 |
| Average retrieval latency | 3165.4 ms |
| Estimated generation cost | $0 |

Category results:

| Category | Questions | Recall@10 | MRR | Citation correctness proxy |
| --- | ---: | ---: | ---: | ---: |
| Exact retrieval | 20 | 1.0 | 1.0 | 1.0 |
| Comparison | 5 | 0.7 | 1.0 | 1.0 |
| Insufficient evidence | 5 | n/a | 0 | 1.0 |

## Interpretation

The exact-retrieval baseline is strong on this small deterministic benchmark.

The comparison baseline is weaker: both expected documents were not always recovered within top K. This is the most important retrieval-quality gap found in this run.

The insufficient-evidence cases use synthetic negative controls. The evaluator checks for direct rare-fact support rather than trusting high-level lexical matches.

## Human-reviewed sample

The benchmark questions are deterministically generated from research-ready metadata and stored chunks. A separate research-ready sample audit reviewed 33 records across 14 document types and found 0 false-ready cases.

This is not a substitute for legal review. Human legal adjudication of benchmark answers remains pending.

## Automated evaluation limits

- No model-generated answers were scored in this run.
- Citation correctness is a deterministic retrieval/citation proxy, not a human legal citation audit.
- Unsupported-claim rate is 0 because no generated answers were produced.
- Cost is 0 because the run was retrieval-only.
- Latency reflects unoptimized SQL retrieval over live stored chunks.

## Known biases

- Exact title/source/year questions are easier than open-ended legal reasoning.
- Comparison questions are generated from paired ready documents, not hand-curated amendment relationships.
- Negative controls are synthetic and may not represent realistic vague user questions.
- The benchmark is useful as a baseline, not a final research-quality certification.

## Gates

Current advisory gates:

- Expected document recall@K baseline: measured 0.94.
- Citation correctness proxy: measured 1.0.
- Unsupported-claim rate: measured 0 in retrieval-only mode.
- Insufficient-evidence behavior: measured 1.0 on synthetic controls.

Release-blocking gates remain:

- No critical readiness contradictions.
- No citation to an unrelated document in controlled deterministic checks.

