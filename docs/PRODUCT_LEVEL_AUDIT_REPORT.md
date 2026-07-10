# Product-Level Reliability, Corpus Scaling, and Commercial Readiness Audit

Date: 2026-07-10

Branch: `main`

## Executive status

Rashtram AI is usable for early pilot workflows when users stay within research-ready documents. The product now has a verified fallback path for provider failures, safer processing workers, source health visibility, and a materially larger ready corpus.

The main remaining production risk is AI provider configuration. Summary/chat/comparison generation currently falls back to extractive grounded mode because the configured provider/model calls are failing. This preserves product usability and source grounding, but it is not the intended premium AI experience.

## Production corpus baseline and final state

| Metric | Start of sprint turn | Final verified state |
| --- | ---: | ---: |
| Total documents | 19,237 | 19,237 |
| Research-ready | 741 | 761 |
| Comparison-ready | 741 | 761 |
| Chunks | 9,668 | 9,900 |
| Embeddings / local retrieval vectors | 9,668 | 9,900 |
| Processable backlog | 17,824 | 17,804 |
| Running workers | 2–3 initially | 0 final |

The ready corpus increased by 20 documents during this sprint turn. This includes existing in-flight workers plus controlled batches across Acts, Policies, and Gazette-family documents.

## Controlled processing expansion

Large concurrent processing was intentionally not started because existing workers were already active. Additional batches were run at `--concurrency=1 --source-concurrency=1 --skip-graph`.

| Batch | Command scope | Processed | Ready | Failed | Verified document IDs |
| --- | --- | ---: | ---: | ---: | --- |
| Acts | `--type=act --limit=2` | 2 | 2 | 0 | `10489`, `961` |
| Policies | `--type=policy --limit=2` | 2 | 2 | 0 | `20981`, `20983` |
| Gazette-family | `--type=gazette --limit=2` | 2 | 2 | 0 | `20602`, `23271` |

Observed behavior:

- AI summary generation failed safely and produced extractive summaries.
- Remote embeddings failed safely and deterministic local embeddings were used.
- Retrieval verification passed before documents were marked research/comparison-ready.
- Gazette-family type mapping correctly selected `regulation` documents under the `gazette` batch alias.

## Bugs found and fixes implemented

### 1. Transient DB failure aborted processing batches

Problem: `process:documents` could fail the whole batch when the Postgres connection terminated during the next job claim, even after already processing documents successfully.

Fix:

- Added transient DB error detection in `server/document/processingWorkerService.js`.
- Job claim and queue-count operations now retry transient failures.
- After repeated transient failures, the worker stops gracefully and returns partial results instead of throwing away the whole batch.

### 2. Provider and credential errors could persist into readiness fields

Problem: legacy rows contained provider/key/billing text in `failure_reason` and `readiness_reason`.

Fix:

- `classifyProcessingFailure` now classifies on raw errors but persists sanitized provider messages.
- `DocumentRepository.updateProcessingStatus` sanitizes failure text before persistence.
- `process:audit` now sanitizes legacy provider/credential-style failure rows.
- Regression tests assert provider fallback metadata does not expose raw credentials.

### 3. Provider outage blocked premium generation but not product use

Current behavior:

- Chat: returns grounded extractive answer when provider generation fails.
- Comparison: returns extractive fallback comparison when provider generation fails.
- Processing: extractive summaries and local embeddings keep documents usable.

Known limitation:

- The fallback is reliable but not equivalent to final AI prose quality. Fixing provider/model environment remains required.

## Current processing failure reasons

After sanitization:

| Failure reason | Count | Notes |
| --- | ---: | --- |
| AI generation provider unavailable. | 377 retriable + 1 permanent legacy row | Provider/model/config issue; no credential text exposed |
| `404 status code (no body)` | 53 | Broken PDF/source URLs |
| `Request failed with status code 403` | 9 | Source access restrictions |
| `read ECONNRESET` | 2 | Retriable network issue |
| Scanned/large/unsupported PDF issues | 3 | OCR or PDF limits |
| `unsupported Unicode escape sequence` | 1 | Parser/data edge case |

## Source refresh audit

`npm run ingest:health --prefix server -- --timeout-ms=8000 --retries=0 --limit=2 --max-pages=1 --delay-ms=0`

Result:

- Connected: 21 sources
- No data found: 4 sources
- Blocked: 8 sources
- Unavailable/degraded: 3 sources

Key healthy sources:

- PRS India: fresh, 17,545 stored records, sample PDFs discovered
- eGazette: fresh, recent 2026 PDFs discovered
- PIB: fresh, latest 2026 releases discovered
- State policy: fresh, PDF discovery works
- RBI, SEBI, TRAI, CERC, UGC and other regulators: mostly connected/fresh

Known blocked/degraded sources:

- Digital Sansad, Lok Sabha, Rajya Sabha: JavaScript/access-control issues
- State Gazette: interactive ASP.NET listing
- OGD India, IRDAI, PFRDA, NCLT: robots/CAPTCHA/access restrictions
- CCI, NMC, CBIC: certificate verification failures

## PRS and scheduled ingestion verification

PRS bounded live refresh:

- Source: `prs-india`
- Discovered: 10
- Stored: 10
- Inserted: 0
- Updated: 10
- PDF URLs found: 12
- Errors: 0

Daily dry-run:

- Started sources: 11
- Failed sources: 0
- Partial failures: 0
- PRS dry-run discovered 50 records and 83 PDF URLs.
- India Code dry-run discovered 50 central acts and 53 PDF URLs.
- eGazette dry-run discovered 7 recent records and 7 PDFs, including 2026-07-10 Gazette notifications.
- PIB/RBI/TRAI and other scheduled sources returned current 2026 records.

## PDF catalogue audit summary

Current known issues:

- 16,342 documents have PDF URLs but are not processed yet.
- 1,083 documents have extractable source pages but have not been processed.
- 53 permanent failures are broken PDFs returning `404 status code`.
- 9 permanent failures are blocked by `403`.
- Duplicate resource/title groups remain in the catalogue, mainly PRS state bill/ordinance variants and generic India Code `Rules` titles.

No fake readiness was introduced; strict readiness verification continues to pass.

## Dashboard/product clarity audit

Verified backend stats now expose real values:

- Total documents
- Research-ready count
- Comparison-ready count
- Latest processed records
- Source health
- Processing status

Known frontend/product clarity gap:

- Dashboard is backed by real data, but the next UI pass should reduce clutter and explicitly answer:
  - “What changed?”
  - “What can I research?”
  - “What should I read next?”

## Chat and comparison audit

Verified:

- Research-ready documents have chunked text and retrieval metadata.
- Chat fallback returns grounded content instead of failing when generation provider is unavailable.
- SSE tests pass.
- Comparison fallback returns structured output and saves results.
- Backend readiness remains the source of truth.

Known limitation:

- Provider/model configuration must be fixed for full streaming AI output. Current fallback can appear as a single extractive chunk.

## Recommendation audit

Verified by tests:

- Recommendations exclude low-quality, hidden, and non-ready records.
- Recommendations expand policy and Gazette-family aliases.
- Recommendation scoring uses grounded catalogue signals.

Known limitation:

- UI explanations should be made more explicit for pilot users: reason, confidence, readiness, and compare/research availability.

## Verification commands run

- `git checkout main`
- `git pull --rebase origin main`
- `git status --short`
- `npm run process:status --prefix server`
- `npm run process:audit --prefix server`
- `npm run db:verify --prefix server`
- `npm run ingest:health --prefix server -- --timeout-ms=8000 --retries=0 --limit=2 --max-pages=1 --delay-ms=0`
- `npm run ingest:sources --prefix server -- --sources=prs-india --max-pages=2 --download-pdfs=false --limit=10`
- `npm run ingest:daily --prefix server -- --dry-run`
- `npm run process:documents --prefix server -- --type=act --limit=2 --only-unprocessed --concurrency=1 --source-concurrency=1 --skip-graph`
- `npm run process:documents --prefix server -- --type=policy --limit=2 --only-unprocessed --concurrency=1 --source-concurrency=1 --skip-graph`
- `npm run process:documents --prefix server -- --type=gazette --limit=2 --only-unprocessed --concurrency=1 --source-concurrency=1 --skip-graph`
- `npm run catalog:duplicates --prefix server`
- `npm test --prefix server`

## Known limitations before pilots

1. Provider/model configuration must be corrected.
2. Processing throughput is still low for the full backlog.
3. Source blocks are real external constraints and need alternate official mirrors/manual ingestion paths.
4. Duplicate catalogue groups need a controlled merge/review workflow, not automated destructive merging.
5. Dashboard and recommendation UI need clearer pilot-facing explanation.

## Pilot readiness conclusion

Rashtram AI is ready for limited early pilots focused on:

- ready document search/research,
- grounded source snippets,
- fallback comparison,
- policy/legal research workflows,
- demonstrations using verified ready document IDs.

It is not yet ready to promise full-corpus coverage or uninterrupted premium AI generation until provider configuration and processing throughput are fixed.
