# Cost Optimisation Report

Date: 2026-07-11

## Controls already in place

- Batch embedding token budgeting.
- Local deterministic embedding fallback.
- Summary caching from stored processed text.
- Queue concurrency limits.
- Source-host concurrency limits.
- Bounded repair/backfill commands.
- No full-corpus processing inside a single deployment.

## Sprint changes

- Gemini is now the primary provider.
- Remote embedding health is checked without silently counting local fallback as remote success.
- Processing can auto-enqueue on user open, prioritizing demand-driven documents before blind backlog processing.

## Operating guidance

Use cost-bounded batches:

```bash
npm run documents:repair --prefix server -- --limit=50 --concurrency=2
```

Scale only after reviewing:

- average processing time;
- OCR usage;
- embedding failures;
- provider latency;
- failed/dead-letter rates;
- documents per hour.

## Do not

- regenerate embeddings for unchanged documents;
- process the entire backlog in one command;
- mark documents ready using synthetic summaries;
- retry permanent PDF/source failures indefinitely.
