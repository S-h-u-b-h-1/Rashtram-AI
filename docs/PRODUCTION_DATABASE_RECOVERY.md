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

## Capacity planning baseline — 2026-08-01

`npm run db:capacity-report --prefix server` is the canonical read-only capacity report. It verifies migration 022, measures chunk and artifact payloads, inventories the legacy table dependencies, and projects storage from exact production relation sizes. It does not enqueue work or modify records.

The post-sprint production baseline is 483,262,464 bytes used of 536,870,912 bytes, leaving 53,608,448 bytes (51.13 MiB) and reporting 90.01% usage. There are 19,618 catalogue documents, 3,107 research-ready documents, and 3,113 documents with artifacts and chunks.

Measured storage categories:

| Category | Current bytes | Current MiB | Projection driver |
| --- | ---: | ---: | --- |
| Documents, metadata, legacy mirror | 139,886,592 | 133.41 | Catalogue documents |
| Sources and resources | 92,676,096 | 88.38 | Catalogue documents |
| Citation-ready chunks | 117,063,680 | 111.64 | Research-ready documents |
| Full-text artifacts and summaries | 52,633,600 | 50.20 | Artifact-bearing documents |
| Processing state/jobs/attempts | 30,449,664 | 29.04 | Existing catalogue; jobs are retention bounded |
| Graph relationships | 30,384,128 | 28.98 | Measured relationships per prepared document |
| User data | 3,874,816 | 3.70 | Traffic, held constant in processing projections |
| Operational logs | 4,530,176 | 4.32 | Traffic and retention, held constant |
| Database/catalog allocation overhead | 11,763,712 | 11.22 | Held constant |

### Storage growth model

The model keeps the existing 19,618-document catalogue and its source/resource rows in place while more of that corpus becomes research-ready. Catalogue-sized categories scale only when the target exceeds 19,618 documents. Chunks, artifacts, and graph rows scale from their measured bytes per currently prepared document. User and retention-bounded operational data remain at current size because they are traffic-driven. PostgreSQL relation allocation is page-granular, and a future corpus can have a different document-length mix, so these are measured planning estimates rather than quotas.

| Research-ready target | Projected bytes | Projected MiB | Position against current 512 MiB tier |
| ---: | ---: | ---: | --- |
| 2,500 | 443,863,202 | 423.30 | Historical/theoretical point; already exceeded in ready count |
| 5,000 | 604,545,347 | 576.54 | Does not fit |
| 10,000 | 925,909,640 | 883.02 | Does not fit; below 25% free on 1 GiB |
| 20,000 | 1,573,759,577 | 1,500.85 | Requires at least a 2 GiB working tier for 25% free |

At the current mix, one prepared document consumes approximately 64,273 bytes across chunks, artifacts, and measured graph storage. The current safe processing limit is therefore **zero**: the hard guard blocks automatic, manual, resumed, and batch processing until usage is below 82% and at least 64 MiB is free. Research on documents that are already prepared remains available. After upgrading, restart with a 1–5 document smoke and then a maximum 25-document batch; re-run the capacity report between batches.

## Migration 022 verification

The normal migration command completed with no pending migration. Production records `022_document_text_chunks_content_hash.js` at `2026-08-01T04:30:14.553Z`, and it is the latest migration.

Verified schema state:

- `document_text_chunks.content_hash` exists.
- `document_text_chunks.embedding_namespace` exists.
- Partial index `document_text_chunks_content_hash_idx (document_id, content_hash) WHERE content_hash IS NOT NULL` exists.
- The migration runner reports no pending or partial migration.
- Both new fields currently have zero populated rows. This is expected because migration 022 is additive and deliberately does not rewrite the 23,234-row chunk table.
- New/reprocessed chunks calculate and use both values. Automated retrieval tests verify that unchanged hashes in the same namespace avoid embedding writes and changed chunks remain citation-safe.

Do not backfill the two fields on the current tier. A full update would grow the heap/TOAST/index and generate WAL while production is at 90.01%. Backfill only after a tier upgrade, in bounded batches guarded by the storage check.

## `legislative_documents` compatibility audit

`legislative_documents` occupies 41,803,776 bytes: 20,389,888 heap, 13,819,904 indexes, and 7,593,984 TOAST across 19,618 rows. The corresponding legacy resource mirror adds 11,296,768 bytes. It is not removable in this sprint.

Runtime and operational reads remain in catalogue/policy/egazette services, dashboard and profile intelligence, recommendation and graph services, activity, document repository/readiness/processing code, recovery/evaluation CLIs, and both ingestion repositories. Direct writes remain in the ingestion repositories, `DocumentRepository`, readiness status compatibility updates, and the Policy Edge importer. An `AFTER INSERT OR UPDATE` trigger still synchronizes legacy rows into schema v2.

Eleven foreign-key columns still target the legacy table:

- `catalog_match_reviews.candidate_document_id`
- `document_relationships.from_document_id` and `to_document_id`
- `document_sources.document_id`
- `document_text_artifacts.document_id`
- `intelligence_events.document_id`
- `legislative_document_resources.document_id`
- `saved_graph_paths.source_document_id` and `target_document_id`
- `user_activity_events.document_id`
- `user_document_interactions.document_id`

Rollback value is currently high: the legacy table is still an ingestion/write authority and provides compatibility for old routes and recovery tooling. Removal complexity is high because reads, writes, triggers, foreign keys, and rollback procedures must all move together.

Staged deprecation plan:

1. Prohibit new legacy foreign keys and inventory every legacy SQL reference in CI.
2. Move product reads to `documents`, `document_sources`, `document_resources`, and processing state; retain parity assertions.
3. Make schema v2 the only write authority and replace the legacy table with a compatibility view or reverse projection.
4. Repoint foreign keys to `documents(id)` using validated, low-lock migrations.
5. Run row, checksum, source, and API parity checks for at least one full ingestion/retention cycle.
6. Snapshot and export the mirror, disable the trigger, observe rollback telemetry, then archive/drop only in a separately approved sprint.

## Chunk-storage audit

`document_text_chunks` contains 23,234 chunks across 3,113 documents, averaging 7.46 chunks per document, 4,260.98 original-text bytes, 985.76 tokens, and 875.22 metadata bytes per chunk. No row currently stores translated text, so `translated_text` consumes no material payload and must not be populated with English duplicates.

The table uses 59,473,920 bytes of TOAST. Its 33,538,048-byte full-text GIN index is the largest index and remains required by the local lexical/hybrid retrieval plan even though the cumulative scan counter was reset or reports zero. The document/chunk indexes have 29,367 and 26,694 observed scans.

There are 402 repeated payload rows in 371 text-hash groups (1.73% of chunks). These cannot be deleted or merged solely by text because separate document versions and chunk coordinates require independent citation identity. Migration 022's per-document content hash enables safe reuse during reprocessing without cross-document merging.

Chunk metadata is citation-bearing: chunk index, language, page estimates, structural type, section/clause identifiers, source URL, and embedding provider/model/dimension are read by retrieval, citation rendering, and embedding recovery. The audit also found 7,720,115 bytes of repeated `summary` values and 1,074,054 bytes of repeated `content` values inside chunk metadata. These payloads already live in `document_text_artifacts` and `document_text_chunks.original_text`; new/naturally reprocessed PostgreSQL chunks now omit those two metadata keys while Pinecone retains the metadata its legacy routes require. Existing rows are not rewritten under current headroom. Repeated PDF/source URLs remain because local citations currently read them without an additional join.

Recommended optimization order after capacity upgrade:

1. Populate content hash and embedding namespace only as chunks are naturally reprocessed.
2. Keep citation-ready normalized/original chunks and the full-text index in PostgreSQL.
3. Do not store translated text when it is identical or unused.
4. Move full raw extracted/OCR text out of `document_text_artifacts`, after checksum-verified object writes and retrieval fallback are deployed.
5. Evaluate metadata normalization with an observed-key report before changing citation fields.
6. Never deduplicate different document IDs or versions based only on chunk text.

## Artifact and summary retention audit

`document_text_artifacts` contains exactly one row per document because `document_id` is the primary key. It has 3,113 rows, no empty original text, 1,339 rows without an English summary, and no content-fingerprint mismatch where both hashes are present. All artifact timestamps precede their associated `documents.updated_at`, but this is caused by later catalogue/quality timestamp updates; the matching content fingerprints do not indicate stale text.

Twenty duplicate original-text groups contain 21 additional rows. These are cross-document matches and may be legitimate versions or duplicate official publications. They are not confirmed deletion candidates. Multiple model-version rows cannot accumulate in this schema, because every save upserts the single document row. Consequently the safe deletion count is zero, and no artifact was removed or rewritten in this sprint.

Before any future artifact cleanup: produce a dry-run list containing document IDs, canonical IDs, source URLs, content fingerprints, and byte totals; export the selected rows to checksummed object storage; verify citations and rollback restoration; then delete only content-identical obsolete versions whose canonical/version identity has been independently resolved.

## Artifact placement strategy

| Data | Class | Target placement |
| --- | --- | --- |
| Canonical document metadata, provenance pointers, user data | A — must remain in PostgreSQL | PostgreSQL |
| Citation chunks, page/section coordinates, active summaries | B — fast retrieval | PostgreSQL |
| Raw PDFs, source HTML, complete extracted text, OCR text | C — object storage | R2/S3-compatible bucket; PostgreSQL keeps hash, key, MIME type and provenance |
| Embeddings, derived summaries, processing-state projections | D — regenerable | Keep active state; rebuild from checksummed source/artifact |
| Old source snapshots, expired processing diagnostics, quarantine exports | E — archive | Versioned object storage with lifecycle policy and manifest |

The server now has an S3-compatible adapter supporting Cloudflare R2 or AWS S3. Objects use content-addressed keys such as `rashtram/pdf/<hash-prefix>/<sha256>.pdf`, send a SHA-256 checksum, store checksum metadata, and verify bytes again on read. Configuration is fail-closed and its health representation never returns access keys or secrets. Production credentials and buckets are not configured, and no production object was moved in this sprint.

Cloudflare R2 Standard is the preferred first artifact tier because its S3 API works with the adapter, the first 10 GB-month is included, standard storage is $0.015/GB-month, and direct egress is free. Pricing source: [Cloudflare R2 pricing](https://developers.cloudflare.com/r2/pricing/).

Migration sequence for artifacts:

1. Create a private bucket, least-privilege writer/reader credentials, versioning, retention, and lifecycle rules.
2. Upload without deleting PostgreSQL data; record object key, SHA-256, size, type, and source provenance.
3. Read back and hash every object; sample-render PDFs and compare extracted-text hashes.
4. Shadow-read through the abstraction while PostgreSQL remains authoritative.
5. Switch raw-artifact reads to object storage with PostgreSQL fallback.
6. After a full rollback window, remove only the duplicated raw payload column—not citation chunks or provenance—in bounded batches.

## Capacity options

### 1. Upgrade Neon — recommended now

- Native compatibility: no connection, extension, pool, or operational migration.
- Downtime: none expected for a billing-tier change.
- Rollback: retain the current branch, snapshot, and restore window.
- Cost: Launch is usage-based, currently shown as approximately $15/month for an intermittent 1 GB workload, with compute at $0.106/CU-hour and storage at $0.35/GB-month. History storage is separately metered. Source: [Neon pricing](https://neon.com/pricing).
- Fit: best immediate path. Use at least 1 GiB before any next batch; plan for at least 2 GiB if 20,000 ready documents remains the target.

### 2. Migrate to another managed PostgreSQL provider

- Compatibility: high with standard PostgreSQL, but validate extensions, TLS/pooling, generated columns, triggers, and connection limits.
- Downtime/effort: low-to-moderate with `pg_dump`/`pg_restore`; lower downtime is possible with logical replication and a short write freeze/cutover.
- Rollback: keep Neon read-only and reverse the application connection string until post-cutover writes begin; after that, a reverse-replication plan is required.
- Expected cost examples: Supabase Pro starts at $25/month, includes an 8 GB database disk and 100 GB object storage, with database disk overage at $0.125/GB-month. Sources: [Supabase pricing](https://supabase.com/pricing), [disk pricing](https://supabase.com/docs/guides/platform/manage-your-usage/disk-size). DigitalOcean managed PostgreSQL starts at $15/month for a single 1 GiB node; production HA starts with larger matching primary/standby nodes, and added storage is $0.21/GiB-month. Source: [DigitalOcean PostgreSQL pricing](https://docs.digitalocean.com/products/databases/postgresql/details/pricing/).
- Fit: reasonable if the team wants bundled object storage/auth or fixed managed operations, but it offers no compelling short-term advantage over a Neon upgrade for this 0.5–2 GiB dataset.

### 3. Self-host PostgreSQL

- Compatibility/control: highest PostgreSQL control, but every patch, backup, restore, replication, monitoring, TLS, failover, and capacity incident becomes Rashtram AI's responsibility.
- Downtime/effort: moderate-to-high. Use a separate `pg_dump` file for this dataset or logical replication for low downtime; validate restore before cutover.
- Rollback: preserve Neon, stop writes, restore connection configuration; reconcile writes made after cutover.
- Expected infrastructure cost: DigitalOcean Basic VMs currently start at $6/month for 1 GiB RAM/25 GiB SSD or $12/month for 2 GiB RAM/50 GiB SSD; backups and engineering/on-call time are additional. Source: [DigitalOcean Droplet pricing](https://www.digitalocean.com/pricing/droplets).
- Fit: not recommended at current scale. The apparent VM saving is smaller than the reliability and operational burden.

Rashtram AI should remain on PostgreSQL. No CockroachDB migration is recommended: the current system relies on PostgreSQL-specific full-text search, JSONB, generated columns, partial indexes, triggers, advisory/migration behavior, `SKIP LOCKED`, and PostgreSQL catalog functions, and no compatibility test has established drop-in equivalence.

## Storage safety controls

Document processing now evaluates live `pg_database_size` against Neon's reported limit before automatic/manual enqueueing, batch enqueueing, or resuming work. Defaults are configurable without code changes:

- `DATABASE_STORAGE_WARNING_PERCENT=70`
- `DATABASE_STORAGE_PAUSE_PERCENT=82`
- `DATABASE_STORAGE_CRITICAL_PERCENT=90`
- `DATABASE_STORAGE_MIN_HEADROOM_BYTES=67108864`
- `DATABASE_STORAGE_MAX_BYTES` is a fail-safe fallback when the provider limit setting is unavailable.

The guard fails closed if no trustworthy limit is available. At 70%, 80%, and 90% it emits sanitized alert codes. At or above 82%, or below the minimum byte headroom, processing throws `DATABASE_STORAGE_HEADROOM_LOW` before jobs are enqueued or claimed. The protected internal health endpoint `/api/internal/cron/health` returns bytes, percentage, thresholds, alerts, and whether processing is allowed; it is protected by `CRON_SECRET` and contains no database hostname, URL, or credentials. Daily maintenance logs warning/critical storage events and returns the same sanitized status.

## Approved next action

1. Upgrade Neon to Launch before any bulk processing.
2. Confirm a tier capable of at least 1 GiB logical storage, then re-run migration, capacity, database, and release verification.
3. Run one document from each required type, then at most 25 documents.
4. Re-run capacity report and stop if the 82%/64 MiB guard approaches.
5. Provision the private R2 bucket and perform a no-delete shadow migration for raw artifacts.
6. Keep `legislative_documents` until its staged deprecation and rollback gates are complete.
