# Corpus Quality Report

Date: 2026-07-11

## Current corpus classes

The catalogue audit separates documents into operational classes:

- ready;
- comparison-ready;
- processable unprocessed;
- retriable failure;
- permanent failure;
- source-only;
- invalid/quarantined.

Latest `process:audit` result:

- audited: 19,245
- comparison-ready: 1,008
- source-only: 569
- PDF available but not processed: 16,288
- source-extractable but not processed: 879
- retriable failures: 397
- permanent failures: 65
- invalid/quarantined: 38
- unsupported file type: 1

## Quality checks

The platform checks:

- accessible source/resource;
- usable PDF or HTML resource;
- extracted text chunks;
- vector references;
- retrieval verification;
- visibility/quarantine flags;
- processing failure class;
- duplicate catalogue/resource signals.

## Repair policy

Safe repairs may:

- enqueue processable unprocessed documents;
- retry retriable failures;
- reuse existing local chunks;
- recover stale readiness flags from verified processing state.

Unsafe repairs must not:

- invent missing source text;
- mark inaccessible documents ready;
- promote local-only documents to comparison-ready without retrieval verification;
- hide permanent failures.
