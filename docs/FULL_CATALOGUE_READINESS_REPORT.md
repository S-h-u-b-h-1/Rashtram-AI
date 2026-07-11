# Full Catalogue Readiness Report

Date: 2026-07-11

## Canonical readiness rule

A document is research-ready and comparison-ready only when:

```text
public valid
AND has accessible PDF/text/HTML source
AND processing_status = ready
AND extraction_status = ready
AND chunking_status = ready
AND chunk_count > 0
AND retrieval is verified through vector, hybrid, or local_text fallback
AND no active processing error is present
```

No metadata-only comparison is permitted.

## Current catalogue counts

From production `process:status` after the recovery audit:

| Classification | Documents |
| --- | ---: |
| `processable_unprocessed` | 17,346 |
| `ready` | 916 |
| `comparison_ready` | 6 |
| `source_only` | 475 |
| `retriable_failure` | 407 |
| `permanent_failure` | 55 |
| `invalid_or_quarantined` | 38 |
| `processing_pending` | 2 |

Top-level readiness:

- total documents: 19,245
- research-ready: 934
- comparison-ready: 934
- stored chunks: 10,966
- stored vector references/embeddings: 10,966

## Failure taxonomy

- `ready`: retrieval is verified and chunks exist.
- `processable_unprocessed`: source/resource evidence exists but preparation is incomplete.
- `processing`: a worker currently owns the record.
- `retriable_failure`: the last failure appears temporary or recoverable.
- `ocr_required`: scanned content needs OCR before chunks can be produced.
- `broken_resource`: resources exist but are not currently accessible.
- `source_only`: source page exists but no processable resource is known.
- `unsupported_format`: resource type is unsupported for current processing.
- `permanent_failure`: source/PDF is permanently unavailable or unusable.
- `invalid_or_quarantined`: record should not be visible as a normal public document.

## Backfill plan

Priority order:

1. user-requested documents;
2. comparison-selected documents;
3. Parliament Bills;
4. Parliament Acts;
5. policies;
6. Gazette documents;
7. high-quality State Bills;
8. State Acts;
9. graph-connected documents;
10. recommendation candidates;
11. remaining processable documents.

Use `documents:repair` in small batches. Do not process the full backlog in a Vercel request.
