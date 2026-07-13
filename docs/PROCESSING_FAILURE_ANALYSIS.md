# Processing Failure Analysis

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
