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
```

If `ingest:health` hangs or exceeds the operations timeout, treat that as a source-health bug. Health checks must return partial failure information.

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
