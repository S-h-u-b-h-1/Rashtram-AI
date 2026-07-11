# Processing Architecture Report

Date: 2026-07-11

## Current architecture

Rashtram AI already has the core production processing architecture:

- `document_processing_jobs` queue;
- priority-based enqueue;
- worker leasing;
- heartbeat updates;
- stale worker recovery;
- retry and dead-letter states;
- source-host concurrency limits;
- processing attempts;
- processing state table;
- resumable batch commands;
- catalogue audit/repair commands.

The key worker implementation is in:

- `server/document/readinessService.js`
- `server/document/processingWorkerService.js`
- `server/document/catalogueAuditService.js`

## Sprint change

Document opening now triggers queue-only automatic preparation when a document is processable but not comparison-ready.

Routes updated:

- `GET /api/document-chat/document/:documentType/:documentId`
- `GET /api/documents/:id`

These routes enqueue background processing and return immediately. They do not perform long-running processing inside the GET request.

## Processing invariants

- Never mark `comparison_ready` unless retrieval verification succeeds.
- Never fake readiness for source-only or missing-PDF records.
- Permanent failures remain separate from retriable failures.
- Existing local chunks may be used for fallback retrieval, but readiness still requires explicit retrieval verification.

## Backfill operating model

Use bounded batches only:

```bash
npm run documents:audit --prefix server
npm run documents:repair --prefix server -- --limit=100 --concurrency=2 --source-concurrency=2
npm run process:status --prefix server
```

Do not process the full backlog in one deployment or one command.

## Next operations

1. Confirm production Gemini `/health`.
2. Start a small repair batch.
3. Check failure distribution.
4. Increase concurrency only after provider latency and failure rate are stable.
