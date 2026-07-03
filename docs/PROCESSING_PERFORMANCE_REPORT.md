# Processing Performance Report

Report date: 3 July 2026

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

## Measurement notes

Token figures are conservative estimates derived from text length because the
current OpenAI response/embedding wrappers do not expose provider billing
records to the job context. `usage_json.estimated=true` makes that limitation
explicit. Provider invoices remain the authoritative cost record.

Throughput and completion estimates are based on the currently observed
window and stabilize as more attempts finish. Early estimates should not be
used for capacity commitments.
