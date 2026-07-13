# Data Source Limitations

## Current corpus caveat

The 2026-07-13 11:04 UTC audit snapshot contains 19,307 records, but only 1,602 are research-ready and comparison-ready. The product must not imply that every catalogued record supports AI chat, comparison, or compliance conclusions.

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

- 17,118 documents remain in the processable backlog.
- The historical processing-attempt failure rate is 45.8%; this is not the percentage of catalogue records proven permanently unusable.
- PDF checksum population is incomplete (the catalogue statistics report zero populated PDF hashes).
- 1,113 probable duplicate groups remain unresolved.
- 1,113 probable duplicate groups remain.
- Source health command needs bounded timeout behavior.
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
