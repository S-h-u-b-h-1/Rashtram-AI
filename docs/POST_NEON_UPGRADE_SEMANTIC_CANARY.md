# Post-Neon Upgrade Capacity Verification and Semantic Canary

Verified against the production-linked Neon PostgreSQL database, Gemini, and
Pinecone on 21 August 2026. No batch beyond the approved five P1 documents was
run.

## Outcome

The Neon upgrade removed the database-capacity rollout block. PostgreSQL now
reports `neon.max_cluster_size` as 17,592,186,044,416 bytes (16 TiB). Rashtram
AI continues to use the unchanged 82% processing pause threshold and currently
calculates the bounded safe batch as 25.

The five-document canary completed with five retrieval-verified successes and
no provider or vector failures. Effective semantic coverage increased from 31
to 36 documents (0.99% to 1.15%).

## Capacity

| Measure | Before canary | After canary | Change |
|---|---:|---:|---:|
| PostgreSQL bytes | 485,359,616 | 485,408,768 | +49,152 |
| Provider-reported maximum | 17,592,186,044,416 | 17,592,186,044,416 | 0 |
| Remaining headroom | 17,591,700,684,800 | 17,591,700,635,648 | -49,152 |
| Utilisation | about 0.00276% | about 0.00276% | negligible |
| Processing pause threshold | 82% | 82% | unchanged |
| Safe batch size | 25 | 25 | unchanged |

The previous 512 MiB ceiling was too small for the legitimate current corpus:
the live database already contains about 463 MiB of catalogue, source,
retrieval, processing, knowledge, and user state. The premium capacity is the
correct primary remedy; valuable searchable evidence should not be deleted to
fit the former limit.

## Lightweight storage hygiene

- Database integrity checks found no orphan normalized sources, resources, or
  research messages, no document parity failure, and no duplicate canonical
  identifiers.
- Object storage is configured. It contains 3,136 verified artifact references
  representing 90,300,017 bytes.
- Only nine remaining inline artifacts are currently eligible for migration,
  totaling 103,317 bytes. This is not meaningful capacity pressure.
- The retention dry run found 18 completed processing jobs older than 30 days
  and no other eligible rows. They were not deleted because the reclaim would
  be immaterial after the upgrade.
- The largest relation remains `document_text_chunks` at 160,710,656 bytes,
  including its 52,436,992-byte full-text index and 60,227,584 bytes of TOAST.
  This is active search infrastructure, not disposable duplication.
- Legacy compatibility relations remain actively referenced and were not
  removed. Zero-scan indexes were treated only as review signals; none were
  dropped without workload proof.
- Old embedding metadata remains a semantic migration backlog rather than a
  cleanup target. Current searchable chunks and provenance were preserved.

## Pre-canary semantic audit

| Measure | Value |
|---|---:|
| Public catalogue | 19,911 |
| Search-ready | 3,138 |
| Active retrieval-verified semantic documents | 31 |
| Effective semantic coverage | 0.99% |
| Semantic backlog | 3,107 |
| P0 / P1 / P2 / P3 backlog | 0 / 145 / 2,962 / 0 |
| PostgreSQL active vector references | 310 |
| Pinecone active vectors | 302 |
| Reference discrepancy | 8 |
| Old/unversioned namespace documents | 1,542 |

Active embedding configuration:

- Provider: Gemini
- Model: `gemini-embedding-001`
- Dimension: 768
- Namespace: `gemini-embedding-001-768-v1`

The Pinecone indexes were reachable. Their low-occupancy status is the known
coverage deficit being repaired, not a provider outage. Production Gemini
generation, embedding, and streaming checks all passed.

## Approved canary

The dry run selected exactly five public P1 documents, 23 existing chunks, and
24,767 estimated embedding-input tokens. It scheduled zero downloads, zero
extraction, and zero OCR.

| Document | Result | Chunks | Generated | Reused on final run | Tokens | Final run duration | Probe |
|---|---|---:|---:|---:|---:|---:|---|
| 20422 — Publication under Section 3D | reconciled | 2 | 2 before retry | 2 | 3,860 | 4,204 ms | passed, first attempt |
| 20424 — Publication under Section 3A | indexed | 1 | 1 | 0 | 1,575 | 5,030 ms | passed, first attempt |
| 20438 — Navi Mumbai declaration notification | indexed | 1 | 1 | 0 | 1,067 | 5,259 ms | passed, first attempt |
| 961 — "Tribhuvan" Sahkari University Act, 2025 | indexed | 18 | 18 | 0 | 17,634 | 13,930 ms | passed, first attempt |
| 962 — Mussalman Wakf (Repeal) Act, 2025 | indexed | 1 | 1 | 0 | 631 | 3,498 ms | passed, first attempt |

The first bookkeeping attempt for document 20422 exposed a PostgreSQL
parameter-type bug after its two vectors had been written. The document stayed
search-ready and was not counted semantic-ready. The insert was fixed and
regression-tested; the retry reused both vectors and completed the state and
audit records without another embedding call.

Measured totals:

- Documents attempted: 5
- Documents succeeded: 5
- Documents failed: 0
- Provider/vector failures: 0
- Chunks and new vectors: 23
- Gemini embedding-input tokens: 24,767
- Gemini batch embedding calls: 5 (one bounded document batch each)
- Final successful run duration: 31,921 ms (6,384 ms/document)
- Total processing-attempt duration including the recovered bookkeeping
  attempt: about 41,920 ms
- PostgreSQL growth: 49,152 bytes (about 9,830 bytes/document, conservatively
  including the failed attempt's operational record)
- Pinecone growth: 23 vectors (4.6 vectors/document)

## Post-canary semantic audit

| Measure | Before | After | Change |
|---|---:|---:|---:|
| Active semantic documents | 31 | 36 | +5 |
| Effective coverage | 0.99% | 1.15% | +0.16 points |
| Semantic backlog | 3,107 | 3,102 | -5 |
| P1 backlog | 145 | 140 | -5 |
| PostgreSQL active references | 310 | 333 | +23 |
| Pinecone active vectors | 302 | 325 | +23 |
| PostgreSQL/Pinecone discrepancy | 8 | 8 | unchanged |
| Old/unversioned namespace documents | 1,542 | 1,538 | -4 |
| Stale old-namespace references | 12,120 | 12,098 | -22 |

The unchanged eight-reference discrepancy predates this canary. The canary
neither increased nor concealed it.

## Retrieval quality

Every canary document passed an additional paraphrased research query. All five
returned their own vector candidates with the active Gemini namespace, hybrid
fusion, authority weighting, reranking, and original source links. Document 961
required an explicit semantic probe because the normal query planner correctly
found sufficient local text for the first question; its forced verification
returned 18 vector candidates and hybrid-ranked cited passages.

The unchanged synthetic CI benchmark produced identical before/after results:

| Metric | Before | After |
|---|---:|---:|
| Recall@10 | 1.000 | 1.000 |
| MRR | 0.875 | 0.875 |
| nDCG@10 | 0.724085 | 0.724085 |
| Citation precision | 1.000 | 1.000 |
| Citation recall | 1.000 | 1.000 |
| Unsupported factual claim rate | 0 | 0 |
| Abstention precision | 1.000 | 1.000 |
| Abstention recall | 1.000 | 1.000 |

The five canary documents are not represented in this small synthetic fixture,
so an unchanged result is expected. These metrics are regression checks, not
claims of expert legal accuracy.

## Rollout projections

The projections below use the measured canary averages: 4.6 vectors, 4,953.4
embedding-input tokens, 6.384 seconds, and 9,830.4 PostgreSQL bytes per newly
semantic document. They are operational estimates, not provider-price quotes.

| Target coverage | Additional documents | New vectors | Input tokens | Sequential processing time | PostgreSQL growth |
|---|---:|---:|---:|---:|---:|
| 10% | 278 | 1,279 | 1,377,045 | about 29.6 min | 2,732,851 bytes |
| 25% | 749 | 3,445 | 3,710,097 | about 79.7 min | 7,362,970 bytes |
| 50% | 1,533 | 7,052 | 7,593,562 | about 163.1 min | 15,070,003 bytes |
| 75% | 2,318 | 10,663 | 11,481,981 | about 246.6 min | 22,786,867 bytes |

Corpus mix varies significantly, so future batches must continue reporting
actual chunk, token, duration, and storage distributions rather than treating
these five-document averages as guarantees.

## Verification

- Backend suite: 398 passed, 1 intentionally skipped
- Frontend suite: 4 passed
- Frontend lint: passed
- Frontend production build: passed
- RAG CI regression gate: passed before and after
- Production database integrity: passed after updating the verifier to derive
  the latest migration from the repository and explicitly validate migrations
  030–032
- Production backend health: PostgreSQL connected; Gemini generation,
  embeddings, and streaming available
- Recent Vercel logs: no production error spike

## Recommendation

The semantic rollout can safely continue, but it should remain bounded and
priority-driven. The single recommended next batch is **25 P1 documents**:

- it matches the application's current maximum safe batch;
- all five canary documents succeeded after the bookkeeping fix;
- Gemini and Pinecone had zero provider failures;
- measured database growth is negligible relative to verified headroom; and
- P1 still contains 140 high-priority documents.

Do not run that batch automatically. Capture the same before/after measurements
and stop on the existing capacity or consecutive-failure controls.
