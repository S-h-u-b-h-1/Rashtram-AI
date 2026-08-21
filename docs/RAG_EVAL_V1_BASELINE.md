# RAG Eval V1 synthetic CI baseline

This is the durable baseline report for the small deterministic CI fixture. The cases are `AUTO_GENERATED_DRAFT` synthetic contracts; they are not expert-reviewed legal questions and do not establish production research accuracy.

## Baseline

| Metric | Value | Regression allowance |
|---|---:|---:|
| Recall@1 | 0.625 | informational |
| Recall@3 | 1.000 | informational |
| Recall@5 | 1.000 | informational |
| Recall@10 | 1.000 | maximum absolute drop 0.02 |
| MRR | 0.875 | maximum absolute drop 0.03 |
| nDCG@10 | 0.724085 | informational |
| Citation precision | 1.000 | maximum absolute drop 0.02 |
| Citation recall | 1.000 | informational |
| Unsupported material factual-claim rate | 0.000 | informational |
| Evidence faithfulness | 1.000 | informational |
| Abstention precision | 1.000 | informational |
| Abstention recall | 1.000 | informational |

The fixture has five cases. Retrieval aggregates exclude the deliberately unanswerable case. The MRR allowance permits harmless deterministic tie movement while still detecting a material rank regression; Recall@10 protects acceptable-document coverage; citation precision has the strictest safety role. The machine-readable policy and reasons live in `server/evaluation/benchmarks/ci-baseline-v1.json`.

## Reproducibility

- Evaluator: deterministic `rag-eval-v1`; no model judge.
- Retrieval: `retrieval-v3.0`.
- Embedding: fixture-only `fixture-none` / `fixture-v1`.
- Chunking: `synthetic-fixture-v1`.
- Reranker: `deterministic-reranker-v2`.
- Query planner: `retrieval-query-planner-v3.0`.
- Authority configuration: `authority-config-v1`.
- Version fingerprint: `ce8d01d4e253c4a0`.

Run `npm run eval:rag:ci --prefix server` to reproduce the gate. A baseline change requires the explicit confirmation flag described in `docs/RAG_EVAL_V1.md`, a reviewed diff, and a documented reason. It is never updated automatically.
