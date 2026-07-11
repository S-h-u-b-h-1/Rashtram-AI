# Processing Operations

Date: 2026-07-11

## Safe commands

Catalogue classification:

```bash
npm run documents:audit --prefix server -- --batch-size=500
npm run documents:audit --prefix server -- --batch-size=5000 --resume
```

Targeted inspection:

```bash
npm run documents:inspect --prefix server -- 186 3646 20833
```

Controlled repair:

```bash
npm run documents:repair --prefix server -- --classification=processable_unprocessed --limit=100
npm run documents:repair --prefix server -- --classification=retriable_failure --limit=100
```

Status:

```bash
npm run process:status --prefix server
```

## Guardrails

- Do not bulk-process the full corpus inside request handlers.
- Use queue leasing, heartbeat, bounded concurrency, and retry limits.
- Preserve chunks and extracted text if later embedding or summary generation fails.
- Treat local PostgreSQL text chunks as a valid retrieval fallback when vector storage is unavailable.
- Clear stale ready flags when canonical retrieval evidence fails.

## Recovery pattern

1. Audit catalogue state.
2. Inspect incident IDs.
3. Repair only a bounded class and limit.
4. Re-run readiness audit.
5. Verify `db:verify`, `process:status`, and `release:verify`.
