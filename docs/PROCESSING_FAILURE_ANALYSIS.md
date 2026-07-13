# Processing Failure Analysis

> Historical diagnostic snapshot. Do not reuse its counts as current metrics; see `CURRENT_PLATFORM_AUDIT.md` and rerun the operational commands.

Date: 2026-07-13

This document captures the current production-hardening position for Rashtram AI document processing. It is intentionally operational: it explains what fails, how failures are now classified, and how to inspect or retry safely.

## Current measured baseline

The latest audited repository/database snapshot recorded:

| Metric | Value |
|---|---:|
| Canonical documents | 19,307 |
| Documents with PDF | 17,514 |
| Research-ready documents | 1,485 |
| Comparison-ready documents | 1,485 |
| Processable backlog | 17,118 |
| Processing attempts | 2,808 |
| Completed attempts | 1,475 |
| Failed attempts | 1,331 |
| Processing failure rate | 47.4% |

The failure rate is too high for a reliable research product. The hardening target is not to mark more documents as ready; it is to reduce preventable failures and make each non-ready state explainable.

## New failure taxonomy

Migration `013_processing_failure_taxonomy.js` adds first-class failure and traceability fields to:

- `document_processing_state`
- `document_processing_jobs`
- `document_processing_attempts`

Primary fields:

- `failure_code`
- `retry_eligible`
- `pipeline_stage`
- `input_checksum_sha256`
- `output_checksum_sha256`
- `extraction_method`
- `extraction_quality_json`
- `worker_version`
- `estimated_cost_usd`

Failure codes are defined in `server/document/failureTaxonomy.js`.

Migration `015_normalize_failure_pipeline_stage.js` normalizes historical `pipeline_stage` values from structured failure codes so old free-text stages do not distort operations reports.

Main categories:

- source/download: `SOURCE_URL_MISSING`, `SOURCE_URL_UNREACHABLE`, HTTP status failures, timeout, network error
- PDF/OCR: invalid MIME, corrupt/encrypted PDF, OCR required/unavailable
- extraction/chunking: empty text, too-short text, empty chunks
- retrieval/AI: embedding provider, vector store, summary provider, retrieval verification
- data quality: duplicate canonical conflict, incomplete metadata
- fallback: unknown processing error

## Retry policy

Retryable by default:

- transient network failures
- rate limits
- HTTP server failures
- provider quota or temporary provider errors
- vector store failures
- OCR unavailable
- retrieval verification failures

Non-retryable by default:

- missing source URL
- 401/403/404 source failures
- invalid MIME type
- corrupt/encrypted PDF
- empty or too-short extracted text
- empty chunking result
- duplicate canonical conflicts
- metadata incomplete

This conservative split prevents repeated processing of records that need source repair or connector repair rather than retries.

## Commands

Failure analysis:

```bash
npm run process:failures --prefix server
```

Backlog analysis:

```bash
npm run process:backlog --prefix server
```

Retryable dry run:

```bash
npm run process:retryable --prefix server
```

Explicit enqueue, only after reviewing the dry run:

```bash
npm run process:retryable --prefix server -- --enqueue --limit=50
```

Consistency checks:

```bash
npm run process:consistency --prefix server
```

Single-document readiness explanation:

```bash
npm run document:readiness --prefix server -- --document-id=3646
```

## Operational interpretation

Use `process:failures` first. It groups failures by failure code, pipeline stage, source, document type, MIME type, extraction method, and retry count.

Use `process:backlog` to choose the next safe batch. Prioritize:

1. `processing_failed_retriable`
2. `pdf_available_not_processed`
3. `source_extractable_not_processed`
4. `ocr_required`

Do not prioritize:

- `source_only` until connector/source extraction is available
- `missing_pdf` until source repair improves
- permanent failures until the code/source/parser issue is corrected

## Current product impact

Chat and comparison must remain gated by readiness. A document should only be shown as research/comparison ready when:

- an accessible source exists;
- processing completed;
- extraction completed;
- chunks exist;
- retrieval works;
- retrieval was verified;
- no active processing failure remains.

The new taxonomy makes non-ready states explainable instead of silently failing with generic 500s or ambiguous “processing failed” labels.

## 2026-07-13 production hardening update

Live production diagnostics after migration `017_normalize_download_failure_codes.js`:

- Total catalogue documents: 19,307
- Failed documents: 464
- Download-stage failures: 452
- Retry-eligible failures: 398
- Uncoded failures: 0
- Failed-with-chunks contradictions: 0
- Ready-without-chunks contradictions: 0
- Retryable/permanent contradictions: 0

Current failure-code distribution:

| Failure code | Documents | Retry eligible |
| --- | ---: | --- |
| `DOWNLOAD_SERVER_ERROR` | 386 | yes |
| `DOWNLOAD_NOT_FOUND` | 52 | no |
| `DOWNLOAD_ACCESS_DENIED` | 10 | no |
| `UNKNOWN_PROCESSING_ERROR` | 8 | yes |
| `DOWNLOAD_UNKNOWN` | 4 | yes |
| `PDF_SCANNED_OCR_REQUIRED` | 3 | no |
| `INVALID_MIME_TYPE` | 1 | no |
| `TEXT_ENCODING_UNSUPPORTED` | 1 | no |

The previous generic HTTP download codes were normalized to `DOWNLOAD_*` codes. Permanent source errors such as 404 and 403 are no longer retry-eligible.

Five `ready_without_chunks` records were repaired by regenerating chunks from preserved `document_text_artifacts.original_text`. Four retryability contradictions were corrected and written to `document_processing_audit_log`.

Download diagnostics:

```bash
npm run download:failures --prefix server -- --limit=1000 --sample=0
npm run download:alternatives --prefix server -- --dry-run --limit=25
```

The latest deterministic alternative-source dry run found no safe canonical alternatives for the first 25 failed downloads. Do not link alternatives unless checksum/legal-identifier evidence is exact.

## 2026-07-13 controlled recovery experiment

Source-aware retry controls were added and Batch A was executed against PRS.

Result:

- Selected documents: 25
- Processed before safety stop: 5
- Circuit-breaker activations: 1
- Downloads/extractions that produced preserved text/chunks: 4
- Newly research-ready: 0
- Batch B/C: not executed

The Batch A failures exposed a later-stage null-summary bug, not a readiness-gate issue. The code now handles `summary = null` without failing usage accounting or vector metadata updates.

The PRS circuit entered cooldown and was not bypassed.
