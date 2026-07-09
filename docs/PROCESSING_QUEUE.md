# Processing Queue Operations

## Architecture

The corpus worker uses PostgreSQL as the durable queue and checkpoint store.
Jobs are claimed atomically with `FOR UPDATE SKIP LOCKED`; no two workers can
claim the same job. Each attempt, worker heartbeat, queue wait, duration,
failure stage, estimated token usage, stage latency, and peak memory value is
persisted.

Queue states:

- `queued`: eligible when `next_attempt_at <= NOW()`
- `running`: owned by a live worker heartbeat
- `completed`: retrieval verified and promoted
- `failed`: retry budget exhausted for a retriable failure
- `dead_letter`: permanent failure such as encrypted/corrupt/missing PDF
- `cancelled`: manually removed from processing

The unique active-job index prevents duplicate queued/running jobs for one
document.

## Worker safety

- Default concurrency: `3`
- Default concurrent downloads per source host: `2`
- Maximum supported process concurrency: `8`
- Maximum per-source concurrency: `4`
- Default retry budget: `3`
- Retry delay: exponential, starting at 15 seconds and capped at 15 minutes
- Stale heartbeat recovery: 15 minutes
- Worker heartbeat: every 30 seconds

Per-source limits are enforced in the atomic claim query. This allows OpenAI
and Pinecone work to run concurrently without opening an unbounded number of
requests to PRS, IndiaCode, PIB, or another government host.

## Commands

Queue and process a prioritized batch:

```bash
npm run process:documents --prefix server -- \
  --limit=100 --only-unprocessed --concurrency=3 --source-concurrency=2
```

Queue without consuming:

```bash
npm run process:documents --prefix server -- \
  --limit=500 --only-unprocessed --enqueue-only
```

Resume queued work after a restart:

```bash
npm run process:documents --prefix server -- \
  --limit=500 --resume --concurrency=3
```

Retry documents classified as retriable:

```bash
npm run process:documents --prefix server -- \
  --limit=100 --retry-failed --concurrency=3
```

Target one corpus type:

```bash
npm run process:documents --prefix server -- \
  --type=bill --limit=100 --concurrency=3
```

Process PolicyEdge-backed policy source articles directly:

```bash
npm run process:policies --prefix server -- --limit=25
```

Use the policy-specific command when the goal is policy readiness. The generic
queue can resume older queued jobs first, even when a type filter is supplied
for enqueue selection.

Inspect state and performance:

```bash
npm run process:status --prefix server
npm run process:audit --prefix server
```

## Priority score

The bounded 1–100 priority score includes:

- recent user views;
- comparison selection;
- recommendation demand;
- knowledge-graph degree;
- policy/Bill/Act/Gazette type weighting;
- recent publication year;
- quality score; and
- PDF-size cost efficiency.

Documents are never promoted by score. Score only controls queue order.

## Resume and failure handling

The database is the checkpoint. If a process exits, a later run recovers stale
`running` jobs after the heartbeat threshold. A retriable failure returns to
`queued` until its attempt budget is exhausted. Permanent failures go directly
to `dead_letter` and retain the exact stage/reason.

Do not delete dead-letter jobs automatically. Fix the source/configuration or
manually review the document before requeueing.

## Unattended schedule

`.github/workflows/corpus-processing.yml` runs a bounded batch every six hours.
GitHub Actions concurrency prevents overlapping corpus runs. The workflow can
also be dispatched manually with batch size, worker concurrency, and
resume-only controls. It requires repository secrets for `DATABASE_URL`,
`OPENAI_API_KEY`, and `PINECONE_API_KEY`.

GitHub evaluates scheduled workflows only from the repository's default
branch. The schedule becomes active after the processing workflow is merged
to `main`; pushes to a feature branch do not activate the cron trigger.
