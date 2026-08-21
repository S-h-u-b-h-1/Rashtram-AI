# Rashtram RAG Evaluation V1

RAG Eval V1 makes retrieval and answer quality measurable. It does not claim that synthetic or model-produced cases are expert legal ground truth.

## Benchmark cases

The canonical format is `server/evaluation/benchmarks/schema-v1.json`. Each case records the question, query type, expected documents/resources and source coordinates, bounded gold and acceptable evidence, answerability/conflict/date context, authority expectation, difficulty, jurisdiction, document type, review governance, notes, and benchmark version.

Review status is mandatory:

- `AUTO_GENERATED_DRAFT` — development only;
- `INTERNAL_REVIEWED` — checked by the Rashtram team;
- `DOMAIN_REVIEWED` — checked by an identified reviewer role with relevant domain context;
- `EXPERT_VERIFIED` — checked by a qualified domain reviewer; or
- `REJECTED` — retained for audit because the case is flawed or unsuitable.

The repository includes a small synthetic CI subset. It tests the evaluator and retrieval contracts, not legal accuracy. The format and runner support larger 100–500 case datasets without pretending automatically generated answers were reviewed.

## Metrics

Deterministic metrics include Recall@1/3/5/10, MRR, nDCG@10, document-hit and exact-reference hit rates, primary-source preference where authority metadata is observable, citation precision/recall, unsupported material factual-claim rate, evidence faithfulness, abstention precision/recall, conflict detection, and temporal accuracy where labelled. Multiple acceptable documents and evidence passages are supported and duplicate result identities are removed before scoring.

Answer scores consume the deterministic claim states produced by Evidence Safety V1. A future model judge may add qualitative fields, but must record its model and prompt version and must remain separate from heuristic metrics.

Every report records evaluator type/version plus nullable model and prompt-version fields. RAG Eval V1 currently sets those model fields to `null` because it does not use an LLM judge.

## Experiments

`compareConfigurations` accepts result bundles for:

- FTS only;
- vector only;
- hybrid;
- hybrid + RRF;
- hybrid + reranking; and
- knowledge-assisted hybrid.

Experiments are offline reports. They never change production retrieval configuration.

## Reproducibility

Every run records retrieval, embedding model/version, chunking, reranker, query planner, and authority configuration versions plus a stable fingerprint. Production retrieval diagnostics expose the same fields.

## CI policy

Run:

```text
npm run eval:rag:ci --prefix server
```

The checked-in baseline can fail CI only for material drops in Recall@10, MRR, or citation precision. Allowed absolute drops are documented beside each metric. Baselines never update automatically: changing one requires both an explicit output path and `--confirm-baseline-update`, followed by human review of the diff.

## Human review workflow

1. Copy the benchmark template or add JSON cases conforming to the schema.
2. Keep new cases `AUTO_GENERATED_DRAFT` until the evidence and acceptable alternatives are checked.
3. Record why each document/passage is acceptable, including jurisdiction and version.
4. Promote to `INTERNAL_REVIEWED` only after a second team member checks it.
5. Promote to `DOMAIN_REVIEWED` or `EXPERT_VERIFIED` only after a qualified reviewer has checked the source evidence and the reviewer role and timestamp are recorded. Do not fabricate reviewer identities.
6. Never paste copyrighted full documents into the benchmark; store bounded evidence spans and stable source coordinates.

## Reports and failures

JSON and Markdown reports show overall metrics and breakdowns by document type, query type, jurisdiction, authority class, difficulty, answerability, and review maturity. Per-case failure labels identify missing documents, wrong chunks, unsupported citations/claims, and abstention false positives/negatives.

No retrieval improvement should be claimed unless an appropriately reviewed benchmark shows it.

The checked-in synthetic baseline and its interpretation are documented in `docs/RAG_EVAL_V1_BASELINE.md`.
