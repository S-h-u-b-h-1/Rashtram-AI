# Processing Performance Report

Report date: 9 July 2026

## Profiled path

The profile covers PDF download, parse/validation, OCR, cleanup, language
detection, structural chunking, summary generation, embeddings, Pinecone
upsert, PostgreSQL chunk persistence, retrieval verification, and
post-processing graph discovery.

## Initial concurrency profile

The first six-document worker-pool profile completed all six documents after
one retriable metadata failure was fixed and resumed:

| Metric | Observed value |
| --- | ---: |
| Research/comparison ready after profile | 22 |
| Total stored chunks/embeddings | 472 / 472 |
| Successful documents in profile | 6 |
| Median completed attempt | 61.7 seconds |
| 95th percentile completed attempt | 149.3 seconds |
| Average PDF download | 0.61 seconds |
| Average embedding stage | 8.47 seconds |
| Average Pinecone stage | 3.40 seconds |
| Peak worker RSS | 167 MB |
| Estimated generation input tokens | 36,469 |
| Estimated generation output tokens | 20,386 |
| Estimated embedding input tokens | 454,473 |

The largest tested PDF created 204 chunks and took about 213 seconds. File-size
cost efficiency is now part of priority scoring so smaller high-value documents
increase corpus breadth first without excluding large documents.

## Bottlenecks found and fixed

1. Sequential processing: replaced by a configurable worker pool.
2. One-job-per-source scheduling starved workers when all priority documents
   were hosted by PRS. Replaced with a configurable per-source cap and waiting
   workers.
3. Nullable structural fields were rejected by Pinecone. Null metadata is now
   removed before vector upsert.
4. Summary text was duplicated into every chunk. The canonical text artifact
   is now the cache; chunk/vector metadata stays compact.
5. Summary and suggested questions required two serial model calls. Suggested
   questions are now generated in the structured summary, with the second call
   retained only as a fallback.
6. A large multilingual document exceeded OpenAI's 300,000-token aggregate
   embedding request limit. Embedding requests are now split by both input
   count and a conservative token estimate. The failed document was resumed
   from the durable queue and completed with 76 chunks in 91.2 seconds.
7. Hindi chunks appended the same generated English summary to every embedding
   input. The multilingual embedding model now receives the original source
   chunk directly; original text and translated summary remain separate cached
   artifacts.

## Measurement notes

Token figures are conservative estimates derived from text length because the
current OpenAI response/embedding wrappers do not expose provider billing
records to the job context. `usage_json.estimated=true` makes that limitation
explicit. Provider invoices remain the authoritative cost record.

Throughput and completion estimates are based on the currently observed
window and stabilize as more attempts finish. Early estimates should not be
used for capacity commitments.

## 9 July 2026 policy-source profile

The PolicyEdge HTML-source path was verified with a bounded 25-document policy
batch:

| Metric | Observed value |
| --- | ---: |
| Selected policy records | 25 |
| Ready policy records | 25 |
| Failed policy records | 0 |
| Stored chunks per policy | 1-3 |
| Corpus research/comparison-ready after audit | 499 |
| Total stored chunks/embeddings after audit | 7,174 / 7,174 |

The current local provider configuration returns 404 for the configured Gemini
generation/embedding models. The processor therefore used the explicit
extractive-summary and deterministic-local-embedding fallback path during this
profile. That kept readiness honest because promotion still required persisted
chunks, vector references, and retrieval verification.
