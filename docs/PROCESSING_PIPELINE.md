# Processing Pipeline

> The counts below are a historical baseline. Current measured counts are maintained in `CURRENT_PLATFORM_AUDIT.md`; pipeline mechanics remain relevant.

## Target lifecycle

`discovered → downloaded → validated → extracted → cleaned → structured → chunked → embedded → summarised → related → quality_checked → research_ready`

## Existing implementation

The repo already has:

- `document_processing_state`
- `document_processing_jobs`
- `document_processing_attempts`
- `document_processing_workers`
- `document_text_artifacts`
- PDF processor
- multilingual detection/cleanup/chunking
- OCR fallback
- summary generation with fallback
- embedding/local retrieval fallback
- graph relationship discovery
- readiness audit and status CLI tools

## Current operational status

As of 2026-07-13:

- Total documents: 19,307
- Research-ready: 1,485
- Comparison-ready: 1,485
- Processable backlog: 17,118
- Queue completed: 1,485
- Queue failed: 394
- Dead letter: 67
- Current failure rate: 47.4%

## Readiness rule

A document should not be marked research-ready unless:

- source provenance is preserved;
- a usable source page or file exists;
- extraction succeeds or source HTML is cleanly extractable;
- chunks exist;
- embeddings or verified local retrieval exists;
- retrieval probe succeeds;
- critical processing failure is absent;
- quality score meets the ready threshold.

## Remaining work

- Make every lifecycle stage explicitly timestamped.
- Store page-level raw extraction for all PDFs.
- Expand structure-aware parsing for parts, chapters, sections, clauses, schedules, tables, and annexures.
- Improve retry classification to reduce the 47.4% failure rate.
- Surface processing operations in admin APIs/UI.
