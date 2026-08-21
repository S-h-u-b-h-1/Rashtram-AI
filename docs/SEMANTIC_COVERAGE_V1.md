# Semantic Coverage & Corpus Quality V1

Production completion snapshot: 21 August 2026.

## Current corpus truth

| Measure | Verified value |
|---|---:|
| Public catalogue | 19,911 |
| Resource ready | 18,884 |
| Text/search ready | 3,138 |
| Flagged semantic ready | 192 |
| Derived active semantic ready | 192 |
| Flag/derived difference | 0 |
| Effective semantic coverage | 6.12% |
| Remaining P1 | 5 |
| P2 (not processed) | 2,941 |
| Current PostgreSQL vector references | 2,044 |
| Current Pinecone vectors | 2,047 |

The active configuration is Gemini `gemini-embedding-001`, 768 dimensions,
namespace `gemini-embedding-001-768-v1`.

Semantic readiness is derived from the current document chunks, current model
namespace and input hashes, physical vector presence, public/search readiness,
and a successful retrieval probe. An old capability flag or a successful
Pinecone write is not sufficient.

The identity audit has no missing current vectors and no metadata repairs left.
The remaining three Pinecone-only records belong to document 1734. That
document is not public/search-ready, so the records are quarantined for an
explicit historical-retention decision rather than deleted automatically. The
coarse namespace census therefore shows a three-vector surplus even though the
current public semantic corpus is internally complete.

## Completed rollout

The architecture-completion rollout used the required gates and never changed
the 82% processing pause threshold.

| Stage | Documents | Chunks/vectors | Tokens | Duration | Result |
|---|---:|---:|---:|---:|---|
| Canary | 5 | 23 | 20,907 recorded | 31.9 s | 5/5 |
| P1 batch | 25 | 232 | 244,631 | 178.7 s | 25/25 |
| P1 batch | 50 | 620 | 716,876 | 540.4 s | 50/50 |
| Final P1 | 60 | 723 | 780,244 | 505.9 s | 60/60 |
| Total | 140 | 1,598 | 1,762,658 | 1,256.9 s | 140/140 |

Across the rollout, 1,596 embeddings were generated and two compatible
embeddings were reused. Every document passed its semantic retrieval probe.
There were zero downloads, extraction runs, or OCR pages. The observed
database allocation increase was approximately 549 KiB; this is a noisy page-
allocation measure because catalogue ingestion was also active.

The five remaining P1 documents were deliberately excluded by the automatic
100-chunk ceiling:

| Document | Family | Chunks | Estimated embedding tokens |
|---:|---|---:|---:|
| 20582 | Gazette | 105 | 113,607 |
| 20576 | Gazette | 123 | 132,792 |
| 23310 | Gazette | 127 | 139,640 |
| 23257 | Gazette | 284 | 625,796 |
| 20425 | Gazette | 617 | 690,956 |

They remain `SEARCH_READY`. No override was used and no P2 document was
processed.

## Reconciliation

The original net discrepancy of eight hid two opposing identity problems: 147
PostgreSQL references without a physical vector and 132 Pinecone records whose
current metadata was absent. The safe reconciliation:

- repaired 129 exact, full-document metadata matches;
- regenerated 147 missing vectors from existing chunks;
- verified retrieval before semantic readiness;
- left three non-public Pinecone-only records deferred;
- reconciled 1,460 stale `semantic_ready` flags to current truth.

No canonical document, source text, or provenance history was deleted.

Use the bounded audit before any future repair:

```bash
npm run semantic:audit --prefix server
npm run semantic:reconcile --prefix server
npm run semantic:reconcile --prefix server -- --repair
npm run semantic:reconcile --prefix server -- --repair-readiness
```

Repair modes must only be used after reviewing the identity audit. The
backfill command remains bounded and defaults to a maximum of 100 chunks:

```bash
npm run semantic:backfill --prefix server -- --limit=5 --priority=P1 --dry-run
npm run semantic:backfill --prefix server -- --limit=5 --priority=P1
```

## Retrieval and evaluation result

Post-rollout production probes verified metadata-only, exact-reference,
semantic hybrid, relationship, timeline, and compliance retrieval. Metadata
avoided vector work; exact-reference used PostgreSQL FTS; semantic and
compliance used the vector path when appropriate; lexical/local fallback
remained available.

The unchanged RAG CI fixture remains:

| Metric | Result |
|---|---:|
| Recall@10 | 1.000 |
| MRR | 0.875 |
| nDCG@10 | 0.724085 |
| Citation precision/recall | 1.000 / 1.000 |
| Unsupported material claim rate | 0.000 |
| Abstention precision/recall | 1.000 / 1.000 |

It contains five `AUTO_GENERATED_DRAFT` cases and zero internally reviewed or
expert-verified cases. It is a regression fixture, not a legal-accuracy claim.

## Future P2 policy

P2 is intentionally frozen. A future selection policy should rank demonstrated
user demand, primary-source gaps, authority, recent regulatory importance,
comparison demand, document quality, knowledge relevance, and expert benchmark
coverage. It should select the most valuable records, not optimize for embedding
the whole backlog.
