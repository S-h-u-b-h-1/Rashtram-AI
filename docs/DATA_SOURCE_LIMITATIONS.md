# Data Source Limitations

## Current corpus caveat

The 2026-07-15 live snapshot contains 19,355 records, but only 1,912 are
research-ready and comparison-ready. The product must not imply that every
catalogued record supports AI chat, comparison, or compliance conclusions.

## Source caveats

- PRS is a major source but is not the authoritative legal record.
- India Code and Gazette-style records should be preferred for legal text when available.
- PIB is official communication, not legislation.
- NITI Aayog documents are policy/advisory material, not binding law unless linked to a binding instrument.
- MyGov often represents consultations; status and deadlines must be preserved.
- Secondary research can support background context but not primary legal claims.
- State source coverage is partial and must be labelled as such until each state connector is tested and monitored.
- Regulator source coverage is partial; registry presence is not complete coverage.

## Unsupported claims

The system must not produce final legal/compliance advice without:

- direct source support;
- exact citation;
- clear uncertainty label;
- professional-review warning for operational/legal decisions.

## Current known limitations

- 16,681 documents remain in the processable backlog.
- The historical processing-attempt failure rate is 41.58%; this is not the percentage of catalogue records proven permanently unusable.
- PDF checksum population is incomplete (the catalogue statistics report zero populated PDF hashes).
- 1,117 probable duplicate groups remain.
- Source health is bounded and reports partial failures, but upstream availability still varies.
- File checksum coverage is incomplete.
- Processing failures are now structured with `failure_code`, `retry_eligible`, `pipeline_stage`, checksums, and extraction metadata, but historical records still require migration/backfill verification before every failure can be trusted as fully classified.
- Enterprise controls and billing are not implemented.

## Failure and readiness inspection

Use these commands before making any coverage claim:

```bash
npm run process:failures --prefix server
npm run process:backlog --prefix server
npm run process:consistency --prefix server
npm run document:readiness --prefix server -- --document-id=<id>
```

If a document is not `comparison_ready`, the product should explain why rather than implying chat/comparison support.

## 2026-07-13 download-source limits

The current production download-failure sample contains 452 download-stage failures:

| Source | Documents |
| --- | ---: |
| PRS India | 397 |
| Policy Edge | 29 |
| CERC | 13 |
| India Code | 10 |
| NCLAT | 2 |
| State policy | 1 |

By inferred HTTP class:

| Class | Documents | Operational meaning |
| --- | ---: | --- |
| 5xx/server-side | 386 | Retryable in bounded batches only |
| 404/not found | 52 | Permanent until source URL changes |
| 403/access denied | 10 | Permanent until source policy/access changes |
| unknown download error | 4 | Retryable only after inspection |

There were no preserved text artifacts and no deterministic canonical-ready alternatives in the latest dry-run sample. The platform should therefore show these documents as unavailable for chat/comparison instead of silently reprocessing them or inventing answers.

## PRS recovery limitation, 2026-07-13

The controlled Batch A experiment showed that PRS direct-PDF records can sometimes progress beyond the old download failure: 4 of the first 5 processed attempts produced text artifacts/chunks.

However, none became research-ready in this run because a later-stage null-summary bug stopped completion and the PRS circuit breaker entered cooldown. Batch B and Batch C were therefore intentionally not run.

The current limitation is no longer just “download unavailable”; for some PRS records it is “download can recover, but full readiness must be rerun after cooldown and code fix.”

## PRS catalogue ingestion audit, 2026-07-15

PRS currently exposes the four catalogues used by Rashtram AI as public HTML
pages, not through an authenticated API configured in this repository. Live
HTTP checks returned `200` and the current parser discovered records and PDF
links from Parliament Bills, Parliament Acts, State Bills, and State Acts.

The scheduled connector previously defaulted to Parliament Bills only. In
addition, bounded State pagination raised an exception after reaching
`maxPages`, discarding the records already collected from the permitted pages.
Both behaviours are fixed: the scheduled default is all four collections, and
a page bound now returns collected records with a non-fatal truncation
diagnostic.

A bounded post-fix run fetched 100 records, inserted 2 new Maharashtra source
records, updated 15 changed records, skipped 83 unchanged duplicates, found 75
PDF URLs, and recorded 0 failures. This confirms current bounded cataloguing;
it does not claim complete historical coverage beyond the configured page
limit, nor does cataloguing alone imply research readiness.

## All-source connectivity audit, 2026-07-15

A complete bounded health sweep found 23 connected sources, 5 reachable sources
with no records in the sample, 8 intentionally blocked sources, and no source
remaining unavailable because of a TLS-chain error.

The Node runtime could not build certificate chains for IGOD, CCI, NMC, and
CBIC because those official servers omitted public intermediates. The fetcher
now adds only the validated public intermediates required by those exact host
families, alongside Node's normal root store. Certificate and hostname
verification remain enabled; this is not an insecure TLS bypass.

CCI's generic HTML page previously exposed navigation links that could be
mistaken for regulation records. CCI now uses its official public DataTables
JSON listing, stable numeric IDs, publication dates, and official PDF paths.
A bounded live run inserted 10 CCI regulations. A separate bounded live run
inserted 10 NMC records. Directory refreshes completed for IGOD ministry and
state entries, and a stale-source refresh inserted 4 new Delhi legislature
records.

An idempotency rerun exposed a cross-source date-comparison bug: PostgreSQL
`DATE` values were serialized with the local offset and counted as changes on
every run. Date-only comparison now preserves calendar dates. The final CCI
rerun inserted 0, updated 0, and skipped the same 10 records as duplicates.

CBIC is only partially operational: its Angular application shell is reachable,
but the public same-origin notifications endpoint identified in the official
bundle returned HTTP 500 during this audit. No CBIC records were fabricated or
scraped from navigation. The source remains “reachable / no data” until the
upstream API returns a valid document payload.
