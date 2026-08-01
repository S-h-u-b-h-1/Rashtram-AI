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
## Storage projection validation — 2026-08-01

The post-migration-023 production baseline is **483,434,496 bytes
(461.04 MiB) of 536,870,912 bytes (512 MiB)**. Free space is 53,436,416
bytes (50.96 MiB), usage is 90.05%, and the storage state is
`Processing Paused`. The safe processing limit is **zero documents** because
usage is above the 82% pause threshold and free space is below the 64 MiB
floor. The guard was not bypassed.

The catalogue contains 19,618 documents, 3,107 marked research-ready, and
3,113 with chunks/artifacts. The projection denominator is therefore 3,113
prepared documents, not an approximate 1,000.

### Corrected formula and measured ranges

Current physical allocation separates into:

| Component | Bytes | MiB | Projection treatment |
| --- | ---: | ---: | --- |
| Fixed baseline | 283,353,088 | 270.23 | Held fixed while the existing catalogue is prepared |
| Existing prepared-variable storage | 200,081,408 | 190.81 | Chunks, artifacts, and graph at 3,113 prepared documents |
| Legacy mirror within fixed baseline | 53,100,544 | 50.64 | Removed only in the completed target-architecture model |
| Total | 483,434,496 | 461.04 | Exact `pg_database_size` after migration 023 |

The measured prepared-variable categories are 117,063,680 bytes of chunks,
52,633,600 bytes of text artifacts/summaries, and 30,384,128 bytes of graph
storage. Documents, sources/resources, processing state, user data,
operational logs, and database overhead remain in the fixed baseline because
the 19,618-row catalogue already exists.

For each category, expected growth is current physical relation bytes divided
by its actual prepared-document count. Low and high use the observed P25 and
P90 per-document logical row-size ratios from the production corpus. The
resulting combined bytes per additional prepared document are:

| Architecture | Low (P25-scaled) | Expected | High (P90-scaled) |
| --- | ---: | ---: | ---: |
| Current, no optimization | 13,570 | 64,292 | 130,931 |
| New chunk writes omit duplicated summary/content metadata | 13,570 | 59,705 | 130,931 |
| Object-storage + legacy-deprecation target | 7,803 | 47,184 | 128,634 |

The new-write optimization saves an expected 4,587 physical bytes per new
prepared document. P25 and P90 duplicate-metadata payloads were zero, so the
low and high bounds are intentionally unchanged rather than invented. The
object-storage target retains summaries and citation-ready chunks in
PostgreSQL and removes only the measured physical share attributable to full
`original_text` after a verified migration and rollback window.

Exact formulas:

- Existing architectures:
  `current_database_bytes + max(0, target - 3,113) × measured_incremental_bytes_per_document + max(0, target - 19,618) × 10,702 measured catalogue bytes/document`.
- Completed target architecture:
  `(fixed_baseline_bytes - legacy_mirror_bytes) + target ×
  (optimized_chunks + retained_artifacts + graph)_bytes_per_document + max(0,
  target - 19,618) × 10,702 measured catalogue bytes/document`.
- The current and new-write models floor targets below 3,113 at current
  allocation. Only the target model may be lower than current usage, and it
  explicitly assumes completed object offload, physical table compaction, and
  approved legacy deprecation.

### Low / expected / high projections

All values are MiB. These are capacity ranges, not quotas; PostgreSQL relation
allocation is page-granular and future document length/type mix can differ.

| Ready target | Current architecture | Optimized new writes | Completed offload/deprecation target |
| ---: | ---: | ---: | ---: |
| 2,500 | 461.04 / 461.04 / 461.04 | 461.04 / 461.04 / 461.04 | 238.19 / 332.08 / 526.27 |
| 5,000 | 485.46 / 576.74 / 696.66 | 485.46 / 568.48 / 696.66 | 256.79 / 444.58 / 832.96 |
| 10,000 | 550.17 / 883.30 / 1,320.99 | 550.17 / 853.18 / 1,320.99 | 294.00 / 669.57 / 1,446.33 |
| 20,000 | 683.48 / 1,500.34 / 2,573.55 | 683.48 / 1,426.46 / 2,573.55 | 372.31 / 1,123.46 / 2,676.98 |

The target model applies corpus-size variability to every row in a rebuilt
target corpus; its high bound can therefore exceed the current model, whose
already-written 3,113 documents remain at their known physical size. Plan
tiers against the high bound plus operational margin, not expected alone.

## Migration status

The normal migration runner applied `023_artifact_object_storage.js` and
`024_shared_artifact_object_keys.js` after confirming migrations 001–022.
They created only empty reference/checkpoint tables and a lookup index. No
artifact payload was moved, rewritten, or deleted.

Migration 022 remains verified:

- `document_text_chunks.content_hash` exists.
- `document_text_chunks.embedding_namespace` exists.
- Partial index
  `document_text_chunks_content_hash_idx (document_id, content_hash) WHERE
  content_hash IS NOT NULL` exists.
- Migration 022 remains recorded at 2026-08-01T04:30:14.553Z.
- Historical chunks remain intentionally unbackfilled at current capacity.
- New/reprocessed chunks calculate the fields, and retrieval regression tests
  cover unchanged-hash reuse and changed-content citation safety.

Migration 023 adds:

- `document_artifact_objects`: document/resource reference, artifact kind,
  object key, SHA-256, MIME type, byte size, processing version, verification
  timestamp, status, and whether the PostgreSQL original remains.
- `artifact_storage_migration_runs`: bounded-run checkpoint and counters.
- `artifact_storage_migration_items`: per-object success/failure record.

Migration 024 permits multiple document references to the same
content-addressed object key while preserving document identity in separate
rows. It replaces object-key uniqueness with a non-unique lookup index; it
does not merge documents based on text.

## Object-storage configuration and verification

The adapter is provider-neutral S3-compatible and uses only server-side
environment variables:

`OBJECT_STORAGE_PROVIDER`, `OBJECT_STORAGE_ENDPOINT`,
`OBJECT_STORAGE_BUCKET`, `OBJECT_STORAGE_ACCESS_KEY_ID`,
`OBJECT_STORAGE_SECRET_ACCESS_KEY`, `OBJECT_STORAGE_REGION`, and
`OBJECT_STORAGE_PUBLIC_BASE_URL`. Optional
`OBJECT_STORAGE_FORCE_PATH_STYLE` supports compatible local/providers.
Credentials are never logged or returned. Missing/partial configuration is an
explicit disabled state.

The protected admin health response exposes only `configured`, `reachable`,
`readAvailable`, `writeAvailable`, and `providerName`. A configured health
probe uses disposable content and cleans it up.

Current production/local configuration result:

- configured: false
- reachable/read/write: false
- provider: disabled
- smoke test: **not run against a provider**, because no object-storage
  credentials/bucket are configured
- production objects moved: zero
- object references: zero
- migration failures: zero

`storage:audit` found 3,113 eligible full-text artifacts totaling 89,242,062
logical bytes: 1,004 source-HTML extractions, 37 OCR outputs, and 2,072 PDF-text
extractions. `storage:migrate --dry-run --limit=10` selected ten records and
1,290,000 bytes without writing. `storage:verify` correctly reported the
disabled state and checked zero references.

A configured smoke performs upload, object metadata SHA verification, read,
byte equality, delete, and a post-delete head check. Automated tests exercise
the full lifecycle with a disposable fake provider; that is not represented
as a production-provider success.

Neon’s native branch-aware S3-compatible storage is currently beta and limited
to eligible `us-east-2` projects, so it must not be assumed available for this
existing project without console/API confirmation. R2 or standard S3 remain
valid through the same adapter. See [Neon’s current storage beta
notice](https://neon.com/blog/neon-backend-is-beta).

## Canonical artifact placement policy

| Category | Placement | Reason |
| --- | --- | --- |
| Canonical document metadata and source/resource provenance | PostgreSQL | Transactional identity and joins |
| Citation-ready chunks, page/section coordinates, FTS index | PostgreSQL | Local retrieval and citation accuracy |
| Active/frequently read summaries | PostgreSQL | Low-latency product reads |
| Processing state, graph relationships, user data | PostgreSQL | Transactional application state |
| Object key/hash/size/type/version/reference | PostgreSQL | Integrity and lifecycle authority |
| Original PDFs and source HTML | Private object storage | Large immutable source artifacts |
| Complete extracted text and OCR output | Private object storage | Large payload; PostgreSQL retains citation chunks |
| Archived snapshots, old processing artifacts, quarantine exports | Versioned object storage/archive tier | Infrequent access and lifecycle controls |
| Embeddings and regenerable derived projections | Regenerable | Rebuild only from checksummed authoritative input |

Every stored object must have document ID, optional resource ID, object key,
SHA-256, MIME type, byte size, processing version, and creation/verification
timestamp in PostgreSQL.

## Resumable production migration and rollback

Commands:

- `npm run storage:audit --prefix server` — read-only eligibility and reference
  inventory.
- `npm run storage:migrate --prefix server -- --dry-run --limit=10` — bounded,
  no-write candidate manifest.
- `npm run storage:migrate --prefix server -- --limit=10` — real migration;
  unavailable while object storage is disabled.
- `npm run storage:verify --prefix server -- --limit=25` — disposable provider
  smoke plus checksum readback of bounded references.
- `npm run storage:migrate --prefix server -- --rollback-run=<id>` — marks
  references from one run rolled back; PostgreSQL originals remain authoritative.

Apply behavior is idempotent by document/kind/SHA and content-addressed object
key. Each object is uploaded, headed, read, hashed, and byte-compared before a
database reference is committed. A run checkpoints after each document,
records per-object failure codes, never clears `original_text`, and caps one
invocation at 25. Rollback changes reference state only; it does not delete a
possibly shared content-addressed object. Raw PostgreSQL values can be removed
only in a separately approved phase after shadow reads, a full rollback
window, a backup, and storage reclamation planning.

## Legacy dependency inventory

The physical mirror is still essential today. It consumes 53,100,544 bytes:
41,803,776 for `legislative_documents` and 11,296,768 for
`legislative_document_resources`.

Active runtime reads exist in:

- `activity/activityService.js`
- `dashboard/intelligenceService.js`
- `document/DocumentRepository.js`, `catalogueAuditService.js`,
  `documentResearchService.js`, `processingWorkerService.js`,
  `readinessService.js`, and `recommendationService.js`
- `egazette/egazetteService.js`
- `graph/knowledgeGraphService.js` and `relationshipEngine.js`
- `policy/policyService.js`
- `profile/profileService.js`
- `lib/catalogRepository.js` and
  `lib/ingestion/core/catalogRepository.js`

Active writes remain in both catalogue repositories,
`DocumentRepository.js`, `documentResearchService.js`,
`readinessService.js`, and `cli/ingestPolicyEdge.js`. Operational
compatibility/fallback reads remain in `cli/dbVerify.js`,
`documentReadiness.js`, `documentsInspect.js`, `downloadAlternatives.js`,
`downloadFailures.js`, `processBacklog.js`, `processFailures.js`,
`processPolicyBatch.js`, `processRetryable.js`, `recoverEmbeddings.js`,
`researchEval.js`, `researchReadyAudit.js`, and
`runDownloadRecoveryBatch.js`. Migration-only references exist in migrations
001, 002, 005, and 006 and the legacy bootstrap in `db.js`.
`test/databaseMaintenance.test.js` is test-only. No reference was classified
obsolete without runtime evidence.

There are two synchronization triggers (four trigger events): document and
resource mirrors both synchronize on INSERT and UPDATE. There are no
compatibility views today.

Eleven foreign-key columns still target `legislative_documents`:

- `catalog_match_reviews.candidate_document_id`
- `document_relationships.from_document_id` and `to_document_id`
- `document_sources.document_id`
- `document_text_artifacts.document_id`
- `intelligence_events.document_id`
- `legislative_document_resources.document_id`
- `saved_graph_paths.source_document_id` and `target_document_id`
- `user_activity_events.document_id`
- `user_document_interactions.document_id`

Rollback value and removal complexity are both high. Staged deprecation:

1. Instrument every remaining legacy read/write and reject new legacy FKs.
2. Move runtime reads to Schema V2 with API/row parity assertions.
3. Repoint FKs to `documents(id)` using additive not-valid/validate/swap
   migrations where applicable.
4. Make Schema V2 authoritative and stop dual writes only after one complete
   ingestion/retention cycle passes parity checks.
5. Replace physical legacy reads with a read-only compatibility view.
6. Export/checksum the mirror and remove physical tables only with explicit
   approval and a tested rollback.

No legacy row/table was deleted, truncated, or made read-only in this sprint.

## Storage guardrails and controlled processing

Defaults:

- warning at 70%
- processing pause at 82%
- critical alert at 90%
- minimum free space 67,108,864 bytes
- conservative high-growth planning unit 131,072 bytes/document, rounded up
  from the measured 130,931-byte P90
- maximum calculated initial batch 25

The admin status contains current bytes, limit, free bytes, percentage,
state/severity, safe batch size, and pause reason, without URLs or credentials.
Processing is allowed only when both percentage and byte-headroom checks pass.
Unknown provider capacity fails closed.

At 90.05%, the current safe limit is zero. Do not run the five-type validation
or Batch B. After a confirmed capacity upgrade:

1. Re-run migration, capacity, database, and release verification.
2. Confirm usage below 82% and at least 64 MiB free.
3. Use the reported safe batch, capped at five for Batch A: one Parliament
   Bill, State Bill, Act, Policy, and Gazette.
4. Measure database before/after, chunks, artifacts, vector writes, processing
   duration, retrieval, and failures.
5. Stop if failures exceed 10%, observed growth materially exceeds the
   130,931-byte P90, provider health degrades, vector writes fail, or the guard
   approaches either threshold.
6. Only then run Batch B, capped at 25 and the calculated safe batch. Never
   continue automatically.

## Favicon verification

The Next.js application has `client/src/app/favicon.ico`, and metadata
references `/favicon.ico`, 16×16/32×32 PNGs, and the Apple icon. The frontend
production endpoint returned HTTP 200 with `image/x-icon` during this sprint.
The API host was the remaining 404 source; it now has a branded, no-database
`/favicon.ico` response. Production API HTTP 200 must be confirmed after the
new commit is deployed.

## Exact next operational action

**Increase the PostgreSQL storage limit before processing anything.** Use a
tier sized against the high projection and at least 25% steady-state
headroom—not merely the expected curve. After the upgrade, re-run
`db:capacity-report`; the guard will calculate the safe initial batch. In
parallel, provision a private S3-compatible bucket with least-privilege
credentials, versioning/lifecycle policy, and no public write access, then run
`storage:verify`. Do not run `storage:migrate --limit=10` until that
synthetic smoke passes.

Current operational risks:

- 90.05% usage leaves insufficient headroom for batch processing, index/WAL
  bursts, or an in-place artifact rewrite.
- Object storage is not configured, so no provider read/write guarantee exists.
- The legacy mirror remains a live authority/fallback with eleven FK columns
  and two sync triggers.
- Moving logical artifact bytes does not shrink PostgreSQL immediately;
  reclamation requires a separately planned rewrite/compaction with temporary
  headroom.
- P90 ranges are measured from this corpus, not a guarantee for unusually long
  gazettes, acts, or OCR-heavy documents.
