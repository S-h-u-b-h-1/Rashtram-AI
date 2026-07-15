# Operations Runbook

## Daily checks

Run:

```bash
npm run db:verify --prefix server
npm run process:status --prefix server
npm run process:failures --prefix server
npm run process:backlog --prefix server
npm run process:consistency --prefix server
npm run release:verify --prefix server
```

Review:

- research-ready count;
- comparison-ready count;
- processable backlog;
- failed/dead-letter jobs;
- failure rate;
- latest processed documents;
- duplicate groups and pending match reviews.

## Ingestion checks

Run:

```bash
npm run catalog:stats --prefix server
npm run ingest:health --prefix server
npm run prs:health --prefix server -- --collections=all --limit=5 --max-pages=1
npm run prs:sync --prefix server -- --dry-run --collections=all --limit=25 --max-pages=1
```

If `ingest:health` hangs or exceeds the operations timeout, treat that as a source-health bug. Health checks must return partial failure information.

PRS uses public HTML catalogue pages rather than an authenticated API. A PRS
dry run compares stable source IDs with the database and reports prospective
new records, updates, and unchanged duplicates before any write. `max-pages`
is a safe page bound: reaching it returns the collected page and a truncation
diagnostic; it must not discard already discovered records.

## Processing

Run controlled batches:

```bash
npm run process:documents --prefix server -- --limit=10 --only-unprocessed
```

Do not scale concurrency until:

- provider latency is stable;
- memory is below deployment limits;
- source failures are classified;
- queue failure rate decreases.

## Failure response

High extraction failure:

1. Inspect `process:status`.
2. Inspect grouped failure causes with `process:failures`.
3. Inspect representative failed documents with `document:readiness -- --document-id=<id>` or `documents:inspect`.
4. Classify failure as permanent/retriable/provider/source/parser using `failure_code` and `pipeline_stage`.
5. Do not mark ready until retrieval verification passes.

Retryable backlog:

1. Run `npm run process:retryable --prefix server` first. This is a dry run.
2. Review failure codes, retry counts, and sources.
3. Enqueue only a bounded retry batch:

```bash
npm run process:retryable --prefix server -- --enqueue --limit=50
```

Do not enqueue permanent failures until the source, connector, parser, or metadata issue is fixed.

Connector failure:

1. Run connector fixture tests.
2. Check robots/access restrictions.
3. Update parser version.
4. Record source status in `source_registry`.

Provider failure:

1. Check `AI_PROVIDER`, model variables, and provider health.
2. Confirm fallbacks do not leak provider secrets.
3. Preserve extracted text even if summary/embedding fails.

## Download failure diagnostics

Use the download-specific report before retrying acquisition failures:

```bash
npm run download:failures --prefix server -- --limit=1000 --sample=0
```

Use the deterministic-alternative dry run before relinking any failed document:

```bash
npm run download:alternatives --prefix server -- --dry-run --limit=25
```

Rules:

- Retry only `DOWNLOAD_SERVER_ERROR`, `DOWNLOAD_RATE_LIMITED`, `DOWNLOAD_DNS_FAILED`, `DOWNLOAD_TIMEOUT`, and `DOWNLOAD_UNKNOWN` in bounded batches.
- Do not retry `DOWNLOAD_NOT_FOUND`, `DOWNLOAD_ACCESS_DENIED`, `DOWNLOAD_HTML_RESPONSE`, `DOWNLOAD_UNSUPPORTED_CONTENT`, `DOWNLOAD_ZERO_BYTE`, `DOWNLOAD_TRUNCATED`, or checksum mismatches until the source URL or connector is fixed.
- Do not bypass source restrictions, robots rules, private-network protection, or blocked-source behavior.
- Do not relink to an alternative URL unless the checksum, canonical identifier, or exact legal identifier is deterministic.
- Use `process:retryable -- --dry-run` first; enqueue only after reviewing the exact candidates.

Dry run:

```bash
npm run process:retryable --prefix server -- --stage=download --limit=25 --dry-run
```

Queue only reviewed retriable records:

```bash
npm run process:retryable --prefix server -- --stage=download --limit=25 --enqueue
```

If readiness/chunking consistency contradicts the database state, run the repair dry run first:

```bash
npm run process:repair-consistency --prefix server -- --dry-run --limit=20
```

Apply only after reviewing the dry-run output:

```bash
npm run process:repair-consistency --prefix server -- --limit=20
```

Every repair must leave an audit row in `document_processing_audit_log`.

## Source-aware recovery batches

Run PRS/download recovery through the controlled batch runner:

```bash
npm run process:recover-downloads --prefix server -- --batch=A --limit=25 --dry-run
npm run process:recover-downloads --prefix server -- --batch=A --limit=25 --concurrency=1 --max-attempts=4
```

If an earlier run enqueued jobs but did not process them, resume the exact batch:

```bash
npm run process:recover-downloads --prefix server -- --batch=A --limit=25 --resume-existing
```

Do not run Batch B or C unless Batch A completes without:

- circuit-breaker activation;
- invalid file validation;
- source/document mismatch;
- readiness contradictions;
- unexpected provider quota/cost failures.

Latest Batch A status, 2026-07-13:

- 25 selected, 5 processed before cooldown, 20 paused.
- 4 recovered far enough to create text artifacts and chunks.
- 0 newly research-ready.
- PRS circuit breaker activated and cooldown was respected.
- Batch B/C were not executed.

## Research evaluation

Run the deterministic benchmark:

```bash
npm run eval:research --prefix server -- --limit=30 --retrieval-only --output-json --output-markdown
```

Run the readiness sample audit:

```bash
npm run research:ready-audit --prefix server -- --per-type=3
```

Current baseline is documented in `docs/RESEARCH_BENCHMARK_RESULTS.md`.
