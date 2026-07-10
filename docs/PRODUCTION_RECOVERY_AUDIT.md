# Production Recovery Audit

Date: 2026-07-10

## Scope

Production recovery sprint covering research readiness, document preparation,
chat reliability, comparison reliability, recommendations, source refresh, PDF
catalogue state, and processing backlog.

## Baseline production findings

- Total catalogue documents: 19,237.
- Research-ready before recovery batch: 707.
- Comparison-ready before recovery batch: 707.
- Processable backlog before recovery batch: 17,858.
- Chunks before recovery batch: 9,548.
- Embeddings before recovery batch: 9,548.
- Historical processing failure rate before patch: 63.77%.

## Root causes found

1. AI provider/model failures were blocking otherwise valid document
   processing. The dominant failure was provider billing/model availability:
   `429 Your account is not active` and Gemini embedding model 404s.
2. Summary/question generation was treated as part of the critical readiness
   path even after PDF extraction and chunking succeeded.
3. `process:documents --type=...` enqueued type-filtered jobs but workers then
   claimed from the global queue, causing typed batches to process unrelated
   queued documents.
4. `--type=gazette` only matched literal `gazette` records, while many Gazette
   family records are stored as `notification`, `rule`, `regulation`, `order`,
   `circular`, and `ordinance`.
5. Some failures are legitimate permanent source failures, especially 404 PDFs.
   These must remain blocked and must not be marked ready.

## Fixes implemented

- Added extractive summary fallback in `documentResearchService` so extracted
  text can become research-ready when AI summary generation fails.
- Added safe suggested-question fallback so provider failures do not block
  chunk persistence/readiness promotion.
- Preserved local text chunks before vector storage and allowed local retrieval
  fallback to remain a valid readiness path.
- Added extractive chat fallback for single-document and multi-document chat
  when generation fails after grounded passages are retrieved.
- Scoped processing workers to the jobs selected by the current batch unless
  `--resume` is explicitly used.
- Expanded `--type=gazette` into the full Gazette-family type set.
- Added regression tests for extractive fallback readiness, typed batch
  scoping, and Gazette type aliases.

## Production-safe processing batches run

| Batch | Result |
| --- | --- |
| `bill --limit=5 --retry-failed` | 5 processed, 5 ready, 0 failed |
| `act --limit=2 --only-unprocessed` | 2 processed, 1 ready, 1 permanent PDF 404 |
| `policy --limit=2 --only-unprocessed` | 2 processed, 1 ready, 1 permanent PDF 404 |
| `gazette --limit=2 --only-unprocessed` before worker fix | exposed worker scoping bug; unrelated queued Bills were processed |
| `gazette --limit=1 --only-unprocessed` after worker/type fix | selected Gazette-family `regulation` document 20597; correctly permanent-failed on PDF 404 |

## Post-batch state

- Research-ready after recovery batches: 716.
- Comparison-ready after recovery batches: 716.
- Processable backlog after recovery batches: 17,849.
- Chunks after recovery batches: 9,581.
- Embeddings after recovery batches: 9,581.
- Retriable failures after recovery batches: 366.
- Permanent failures after recovery batches: 67.

## PRS/source refresh verification

- Focused PRS health: connected, parser valid, no stored errors.
- Last successful PRS ingestion: 2026-07-09T17:01:12.562Z.
- PRS refresh age at audit: 12.3 hours.
- Focused live PRS refresh: 10 discovered, 10 updated, 12 PDF URLs found, 0 errors.
- Daily dry-run: 11 sources started, 0 failed sources, 0 partial failures.

## Verified document IDs

- Ready after retry/fallback: 1910, 1999, 1933, 1812, 1902.
- Ready in later samples: 2233, 2234, 2236, 2237.
- Correctly blocked permanent failures: 2230, 2235, 20597.

## Known limitations

- Provider configuration still reports generation/embedding model errors. The
  system now degrades safely, but production should still fix the provider/env
  configuration for better summaries and vector quality.
- The backlog remains large. The patched processing pipeline should be run in
  controlled batches, with source concurrency bounded.
- Some PDFs are genuinely unavailable and must remain permanent failures until
  source URLs are repaired.

## Next scaling plan

1. Deploy backend patch.
2. Run `process:documents --retry-failed` in batches of 50-100 with
   `--concurrency=1` or `2` until provider fallback performance is stable.
3. Run type-specific backfills in this order: bills, acts, state bills,
   policies, Gazette family.
4. Monitor `process:status`, Vercel logs, and readiness counts after each
   batch.
5. Repair permanent 404 source URLs separately; do not retry them blindly.
