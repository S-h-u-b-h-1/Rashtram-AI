# Readiness Rules Implemented

Date: 2026-07-13

Rashtram AI uses readiness gates to prevent unprocessed catalogue records from appearing as fully usable research/chat/comparison documents.

## Research/comparison-ready requirements

A document is ready only when all of the following are true:

- catalogue record is public and not quarantined;
- title exists;
- accessible PDF/text/html resource or extractable source exists;
- processing status is `ready`;
- extraction status is `ready`;
- chunking status is `ready`;
- at least one non-empty text chunk exists;
- retrieval path exists through vector retrieval or local-text fallback;
- retrieval is verified;
- no active `error_message` or structured processing failure remains.

The implemented readiness contract is in:

- `server/document/readinessContract.js`
- `server/document/readinessService.js`
- `server/document/DocumentRepository.js`

## State classes

Important readiness classes:

- `comparison_ready`
- `research_ready`
- `pdf_available_not_processed`
- `source_extractable_not_processed`
- `processing_pending`
- `processing_failed_retriable`
- `processing_failed_permanent`
- `ocr_required`
- `unsupported_file_type`
- `source_only`
- `missing_pdf`
- `invalid_or_quarantined`

## New explanation command

Run:

```bash
npm run document:readiness --prefix server -- --document-id=<id>
```

The command reports:

- current readiness status;
- document metadata;
- per-requirement pass/fail explanation;
- resource and chunk counts;
- retrieval mode;
- failure code/stage/retry eligibility;
- input/output checksum traceability;
- extraction method and extraction quality metadata;
- recent processing jobs.

## What this prevents

The readiness rules prevent:

- a PDF URL from being treated as processed text;
- a processed artifact with no chunks from being chat-ready;
- failed documents from appearing as comparison-ready;
- vector failures from hiding local text retrieval status;
- catalogue-only records from producing unsupported AI answers.

## What it does not do

Readiness does not claim:

- legal correctness;
- complete corpus coverage;
- duplicate-free canonical status;
- source authority parity across all providers;
- benchmarked answer quality.

Those remain separate research-quality and data-platform workstreams.

## Consistency repair audit, 2026-07-13

The production consistency audit now explicitly checks:

- ready documents with no chunks;
- ready documents with no embeddings and no approved local-text fallback;
- comparison-ready documents whose processing state is not ready;
- ready documents with unresolved structured failures;
- failed documents that still have chunks;
- permanent/retryable failure-code contradictions;
- active duplicate processing jobs;
- retryable failures past the configured retry ceiling.

The 2026-07-13 repair pass fixed:

- 5 ready-without-chunks records by regenerating 101 total chunks from preserved original text;
- 4 retryability contradictions by marking permanent/non-retryable states consistently.

Post-repair audit result:

- `ready_without_chunks`: 0
- `failed_with_chunks`: 0
- `comparison_ready_without_ready_state`: 0
- `ready_with_unresolved_failure`: 0
- `non_retryable_marked_retriable`: 0
- `retryable_marked_permanent`: 0

The remaining `retryable_exceeding_max_attempts` count is an operational backlog signal, not a readiness bypass. Those records must remain non-ready until a controlled retry or source repair succeeds.
