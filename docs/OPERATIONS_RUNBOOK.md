# Operations Runbook

## Daily checks

Run:

```bash
npm run db:verify --prefix server
npm run process:status --prefix server
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
2. Inspect representative failed documents with `documents:inspect`.
3. Classify failure as permanent/retriable/provider/source/parser.
4. Do not mark ready until retrieval verification passes.

Connector failure:

1. Run connector fixture tests.
2. Check robots/access restrictions.
3. Update parser version.
4. Record source status in `source_registry`.

Provider failure:

1. Check `AI_PROVIDER`, model variables, and provider health.
2. Confirm fallbacks do not leak provider secrets.
3. Preserve extracted text even if summary/embedding fails.

