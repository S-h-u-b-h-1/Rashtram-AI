# Production Database Recovery

## Incident summary

On 2026-08-01 the production API returned HTTP 503 from `/health`. Vercel logs and a direct read-only database check confirmed PostgreSQL error `53100`: Neon could not extend a relation because the 512 MiB project limit had been reached. The database, credentials, TLS, compute, connection count, and migration lock were not the cause.

Migration `022_document_text_chunks_content_hash.js` was the first write attempted during cold-start schema initialization and rolled back when Neon rejected the file extension. This made the health handler correctly report the database as disconnected.

## Recovery controls and rollback

Before any deletion:

- Neon project: `RashtramAI`; production branch: `production`.
- Restore window confirmed: 21,600 seconds (six hours at incident time).
- Manual Neon snapshot created: `pre-storage-recovery-2026-08-01` (`snap-divine-star-ah64zsqb`).
- Latest migration recorded before cleanup: `021_quarantine_post_audit_relationship_inferences.js`.
- Critical counts recorded by `db:storage-report`.
- The 34,442 quarantine rows were additionally exported as gzip-compressed NDJSON, parsed back, counted, and SHA-256 verified before truncation. The archive and manifest are operational recovery artifacts in `/tmp`; they are intentionally not committed.

Rollback options are, in order: restore the Neon snapshot to a preview branch and inspect it before finalizing; or recreate the quarantine rows from the verified NDJSON archive. Restoring the quarantine is not required for application functionality because no runtime code reads it.

## Storage before and after

| Metric | Before | After |
| --- | ---: | ---: |
| Database size | 513,703,936 bytes (489.91 MiB) | 483,229,696 bytes (460.84 MiB) |
| Neon logical limit | 536,870,912 bytes (512 MiB) | 536,870,912 bytes (512 MiB) |
| Headroom | effectively exhausted for relation extension | 53,641,216 bytes (51.16 MiB) |
| Usage | 95.70% by `pg_database_size` | 90.01% |
| Latest migration | 021 | 022 applied at 2026-08-01T04:30:14Z |

The emergency action truncated only `document_relationship_quarantine`: 34,442 archived rows, 30,474,240 relation bytes before, 16,384 after. Seven expired sessions were then deleted by the normal retention policy. No canonical document, live relationship, document resource, source provenance, chat, message, note, comparison, collection, profile, or processing payload was removed.

## Storage inventory

`npm run db:storage-report --prefix server` produces the complete current inventory for every public table and index. It connects directly with a single connection so it remains usable when an unapplied migration is blocked. The JSON includes exact row counts, heap/index/TOAST/total bytes, estimated dead tuples, access counters, classification, reproducibility, and cleanup safety for tables; indexes include size, scans, constraint status, active-use signal, reproducibility, and conservative removal guidance.

Largest relations after recovery:

| Relation | Rows | Heap | Indexes | Total | Classification | Cleanup |
| --- | ---: | ---: | ---: | ---: | --- | --- |
| `document_text_chunks` | 23,234 | 21,372,928 | 36,216,832 | 117,063,680 | reproducible derived | keep; required by research |
| `documents` | 19,618 | 42,360,832 | 42,254,336 | 88,702,976 | essential | never automatic |
| `document_sources` | 18,544 | 40,812,544 | 8,781,824 | 61,390,848 | essential provenance | never automatic |
| `document_text_artifacts` | 3,113 | 3,686,400 | 303,104 | 52,633,600 | reproducible derived | keep; required by readiness |
| `legislative_documents` | 19,618 | 20,389,888 | 13,819,904 | 41,803,776 | active compatibility | migration required |
| `document_relationships` | 1,134 | 16,089,088 | 12,976,128 | 29,106,176 | essential graph | never automatic |
| `document_resources` | 20,392 | 7,282,688 | 10,559,488 | 17,883,136 | essential resource/provenance | never automatic |
| `document_processing_state` | 19,308 | 11,960,320 | 3,661,824 | 15,663,104 | reproducible derived | keep while operational |
| `legislative_document_resources` | 20,392 | 7,143,424 | 4,112,384 | 11,296,768 | active compatibility | migration required |
| `document_metadata` | 17,741 | 6,389,760 | 507,904 | 9,379,840 | essential | never automatic |

The largest index is `document_text_chunks_original_text_fts_idx` at 33,538,048 bytes. Although its cumulative scan counter was zero, `EXPLAIN` for the production hybrid lexical query selected it in a `BitmapAnd` with the document/chunk index. It was retained. No index was removed based only on a zero scan counter.

## Data classification

1. Essential production: canonical documents, resources, source provenance, relationships, user profiles, chats/messages, notes, comparisons, collections, bookmarks, and saved searches. Never automatically deleted.
2. Reproducible derived: text chunks, text artifacts, processing state, dashboard metrics, and recommendation cache. Rebuildable but not safe to remove during normal operation because research readiness would be interrupted.
3. Expired operational: only rows satisfying the predicates below.
4. Duplicate data: none was deleted. Compatibility mirrors remain active and require a separate migration before removal.
5. Legacy/deprecated: legacy document/chat/resource tables are still referenced and were retained.
6. Unsafe without approval: source snapshots, audit logs, intelligence events, live relationship data, and any unclassified table.

## Retention policy

`npm run db:retention --prefix server -- --dry-run` reports candidates without deleting. The apply command deletes in batches of 500, at most ten batches per policy per invocation. Both limits are configurable but capped in code. Re-running is idempotent.

Exact predicates:

- Sessions: `expires_at < NOW()`.
- Revoked sessions: `revoked_at IS NOT NULL AND revoked_at < NOW() - INTERVAL '7 days'`.
- Recommendations: only rows with an explicit `expires_at < NOW()`.
- Successful ingestion detail rows: `status = 'stored'` and older than 30 days. Run summaries, documents, resources, and canonical source provenance remain.
- Completed/cancelled processing jobs: terminal and older than 30 days; child attempts cascade.
- Failed/dead-letter processing jobs: terminal and older than 90 days; child attempts cascade.
- System events: older than 90 days.

There is intentionally no automatic retention for source snapshots, audit logs, canonical data, chats, notes, comparisons, collections, document resources, or derived research text.

The protected Vercel cron endpoint runs bounded retention daily at 01:15 UTC. It uses the same `CRON_SECRET` authorization as the existing ingestion cron and returns 404 when the secret is absent or invalid.

## Maintenance policy

`npm run db:maintenance --prefix server -- --dry-run` reports its bounded target list. Apply runs non-blocking ordinary `VACUUM (ANALYZE)`—never `VACUUM FULL`—on at most six small operational tables. Ordinary vacuum makes deleted space reusable and refreshes planner statistics; it does not promise operating-system or Neon logical-size shrinkage.

Avoid `VACUUM FULL`, `CLUSTER`, and non-concurrent index rebuilds during production traffic. They require additional headroom and stronger locks. Review zero-scan indexes with `EXPLAIN (ANALYZE, BUFFERS)` against representative production queries before any drop.

## Pooling audit

- The application owns one shared `pg.Pool` in module/global scope; no route creates a pool per request.
- The production URL is a Neon pooled endpoint; the report exposes only the boolean result, never the hostname or credentials.
- Pool maximum: 5; idle timeout: 30 seconds; connection timeout: 10 seconds.
- TLS modes weaker than the current intended behavior are normalized to `verify-full`.
- Schema and migration clients are released in `finally`; transaction failures roll back.
- The audit found one active connection (the auditor itself), no long transaction, and no connection saturation against a 901-connection server limit.

## Remaining capacity risk

The outage is recovered, but 90.01% use is only about 51 MiB of headroom. Treat 85% as a warning and 90% as an incident threshold. Move to a Neon plan with at least 1 GiB logical storage before the next bulk ingestion or derived-data rebuild; target at least 25% steady-state free space. Retention protects operational growth but cannot offset growth in essential documents, resources, provenance, and research artifacts.
