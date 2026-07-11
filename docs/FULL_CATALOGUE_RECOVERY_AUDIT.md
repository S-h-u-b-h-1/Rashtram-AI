# Full Catalogue Recovery Audit

Date: 2026-07-11

## Incident scope

This audit covered three production failure classes:

- document detail API crashes for malformed or incomplete catalogue records;
- stale readiness flags allowing zero-chunk documents into comparison flows;
- lack of a resumable catalogue-wide readiness classification.

## Reproduced production IDs

| Document ID | Result after audit | Canonical readiness |
| --- | --- | --- |
| `20833` | Valid policy detail; HTML resource; 2 chunks | `ready` |
| `3646` | Valid bill detail; PDF resource; 19 chunks | `ready` |
| `186` | Valid bill record; 4 accessible PDF resources; 0 chunks | `not_ready`, `reasonCode=no_chunks` |

Document `186` is deliberately not comparison-ready. Its stale `documents.research_ready` and `documents.comparison_ready` flags were cleared.

## Root causes

1. Detail responses treated optional child data as mandatory. A failure in sources, resources, relationships, recommendations, timeline, or graph could fail the whole detail route.
2. Legacy ready flags could remain true even when the canonical evidence showed zero chunks.
3. The catalogue did not have a resumable operation to classify every record by readiness evidence.
4. Vector/provider checks could abort preparation before local text or PDF extraction fallback was attempted.

## Fixes implemented

- Added defensive mapping utilities for JSON, arrays, objects, dates, numbers, and nullable strings.
- Hardened `DocumentService.getById` so optional child segments return safe fallbacks plus warnings.
- Sanitized document route HTTP 500 responses with request IDs instead of raw internals.
- Expanded `GET /api/documents/:id` response to include `sources`, `resources`, `relationships`, `recommendations`, `readiness`, and `warnings`.
- Strengthened `getDocumentReadiness` with explicit `status`, `reasonCode`, `requirements`, `counts`, and retrieval mode.
- Added resumable catalogue audit and repair commands.
- Fixed vector-check dependency so processing can continue to local/PDF extraction when vector services are unavailable.

## Production audit result

The resumable audit processed 19,237 rows. Current normalized document table total is 19,245. Current `process:status` after sync:

- total documents: 19,245
- research-ready: 934
- comparison-ready: 934
- processable backlog: 17,755
- source-only: 475
- retriable failures: 407
- permanent failures: 55
- invalid/quarantined: 38

## Operational commands

```bash
npm run documents:audit --prefix server -- --batch-size=500
npm run documents:audit --prefix server -- --batch-size=5000 --resume
npm run documents:repair --prefix server -- --classification=processable_unprocessed --limit=100
npm run documents:repair --prefix server -- --classification=retriable_failure --limit=100
npm run documents:inspect --prefix server -- 186 3646 20833
npm run process:status --prefix server
```

## Remaining limitations

- The audit classifies resource state from stored catalogue evidence; it does not re-download every PDF.
- Processing the 17k+ processable backlog must remain worker-batched and rate-limited.
- Document `186` still needs actual preparation before comparison; it is now truthfully blocked instead of falsely ready.
