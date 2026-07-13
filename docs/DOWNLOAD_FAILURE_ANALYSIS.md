# Download Failure Analysis

Last updated: 2026-07-13

## Purpose

This document records the production download-acquisition state for Rashtram AI and the rules for repairing it without weakening readiness gates or bypassing source restrictions.

## Current live state

Command used:

```bash
npm run download:failures --prefix server -- --limit=1000 --sample=0
```

Observed production result:

- Download-stage failures: 452
- Valid text artifacts available for those failures: 0
- Deterministic canonical-ready alternatives: 0
- Source page/canonical page present: 452
- Missing or malformed original file URL: 29

By source:

| Source | Documents |
| --- | ---: |
| PRS India | 397 |
| Policy Edge | 29 |
| CERC | 13 |
| India Code | 10 |
| NCLAT | 2 |
| State policy | 1 |

By normalized failure code:

| Failure code | Documents | Retry policy |
| --- | ---: | --- |
| `DOWNLOAD_SERVER_ERROR` | 386 | bounded retry |
| `DOWNLOAD_NOT_FOUND` | 52 | permanent until URL/source repair |
| `DOWNLOAD_ACCESS_DENIED` | 10 | permanent until source/access policy changes |
| `DOWNLOAD_UNKNOWN` | 4 | inspect, then bounded retry only if safe |

By inferred HTTP status:

| Inferred status | Documents |
| --- | ---: |
| 500 | 386 |
| 404 | 52 |
| 403 | 10 |
| unknown | 4 |

## Downloader behavior

The central downloader now:

- rejects missing, malformed, unsupported-protocol, and private-network URLs;
- uses a stable Rashtram AI user-agent;
- enforces redirect, timeout, and byte limits;
- writes downloads to temporary files and cleans them on success/failure;
- validates PDF signature, MIME/content type, content length, encryption, checksum, and duplicate-checksum evidence;
- returns structured failure codes for source, network, validation, and checksum problems.

## Recovery rules

Do:

- Run diagnostics before every batch.
- Retry only bounded `DOWNLOAD_SERVER_ERROR`, `DOWNLOAD_RATE_LIMITED`, `DOWNLOAD_DNS_FAILED`, `DOWNLOAD_TIMEOUT`, or inspected `DOWNLOAD_UNKNOWN` records.
- Preserve original Hindi/English source text and chunk evidence if a later summary/embedding stage fails.
- Write repair actions to `document_processing_audit_log`.

Do not:

- Treat a catalogue record or PDF URL as chat-ready by itself.
- Retry permanent 403/404 failures without source repair.
- Invent direct PDF links from listing pages.
- Bypass source restrictions, robots/access decisions, or private-network URL protection.
- Mark a record ready unless extraction, chunking, retrieval path, and retrieval verification all pass.

## Commands

Download-failure report:

```bash
npm run download:failures --prefix server -- --limit=1000 --sample=0
```

Alternative-source dry run:

```bash
npm run download:alternatives --prefix server -- --dry-run --limit=25
```

Retry dry run:

```bash
npm run process:retryable --prefix server -- --stage=download --limit=25 --dry-run
```

Reviewed enqueue:

```bash
npm run process:retryable --prefix server -- --stage=download --limit=25 --enqueue
```

Consistency dry run:

```bash
npm run process:repair-consistency --prefix server -- --dry-run --limit=20
```

Consistency apply:

```bash
npm run process:repair-consistency --prefix server -- --limit=20
```

## Controlled recovery update, 2026-07-13

Use source-aware recovery for PRS batches:

```bash
npm run process:recover-downloads --prefix server -- --batch=A --limit=25 --dry-run
npm run process:recover-downloads --prefix server -- --batch=A --limit=25 --concurrency=1 --max-attempts=4
```

Batch A outcome:

- 25 PRS records selected.
- 5 processed before source cooldown.
- 4 created text artifacts/chunk rows.
- 0 became research-ready.
- Circuit breaker activated once.
- Batch B/C were not run.

This is a positive signal that some PRS “download” failures are recoverable, but not enough to justify broad retry. Recovered files must still pass extraction, chunking, embedding/fallback retrieval, and readiness verification.
