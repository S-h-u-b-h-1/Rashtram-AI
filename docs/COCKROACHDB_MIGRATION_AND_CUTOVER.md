# CockroachDB Migration and Cutover Evaluation

Status: **in progress — blocked on cluster access**
Last updated: 2026-08-03

## Evidence standard

This document separates three things and never blurs them:

- **Measured** — verified against this repository or a live system in this sprint.
- **Design** — code written and unit-tested here, but not yet exercised against CockroachDB.
- **Unverified** — requires the live cluster; no claim is made either way.

Per `docs/DOCUMENTATION_STATUS.md`, this is the canonical CockroachDB
document. No parallel Cockroach audit files should be created.

## Why this is being considered

The Neon production branch hit its hard 512 MiB storage ceiling
(`logical_size` measured at 537,714,688 bytes against a 536,870,912-byte
cap), which blocks all file-extend operations with SQLSTATE 53100. See
`docs/PRODUCTION_DATABASE_RECOVERY.md`. The stated driver for CockroachDB
is a larger free managed-storage allowance.

**Assumption not yet validated:** that CockroachDB Basic's free allowance
is materially larger *for this workload* and remains free at the projected
corpus size. This should be confirmed against current CockroachDB pricing
before engineering effort continues, because it is the entire premise of
the migration. The alternative — a paid Neon tier — resolves the same
constraint with zero migration risk and zero code change.

## Current state of this evaluation

| Phase | Status |
|---|---|
| §1 Explicit database targets + guard | **Done, tested** |
| §2 Adapter layer (locking) | **Done, tested** |
| §4 Cockroach migration lock | **Done, tested** |
| §6 Serializable transaction retry | **Done, tested** |
| §3 Run migrations on cluster | **Blocked** — no cluster access |
| §5 Lexical retrieval replacement | **Inventoried; build blocked** |
| §7 Queue semantics under contention | **Blocked** |
| §8–10 Fixtures, API tests, benchmarks | **Blocked** |
| §11–13 Export/import, rehearsal, parity | **Not started** |
| §14–16 Cutover, rollback, readiness | **Not started** |

**Blocker:** `COCKROACH_DATABASE_URL` is not configured, and the
CockroachDB MCP connector is disconnected. Every phase that requires
executing SQL against CockroachDB cannot proceed. No compatibility verdict
can be issued until it does.

## Measured: PostgreSQL-specific surface in this codebase

This is the complete, verified inventory of what would need a Cockroach
path. Counts are from static analysis of the current tree (24 migrations
plus the `server/db.js` bootstrap schema).

### A. Dual-write triggers — the largest single dependency

Four PL/pgSQL trigger functions implement the entire legacy→v2 mirroring
system. They use `DECLARE` blocks, `%ROWTYPE` variables, and
`SELECT ... INTO`:

| Function | Mirrors | Defined in |
|---|---|---|
| `sync_document_v2_from_legacy()` | `legislative_documents` → `documents` | `001_database_v2.js:765` |
| `sync_resource_v2_from_legacy()` | legacy resources → `document_resources` | `001_database_v2.js:876` |
| `sync_research_chat_v2()` | `document_chats` → `research_chats` | `001_database_v2.js:924` |
| `sync_source_snapshot_v2()` | `source_collection_snapshots` → `source_snapshots` | `002_normalized_support_tables.js:72` |

These are not incidental. `docs/DATABASE_SCHEMA_V2.md` documents the dual
-write design as the compatibility contract between the v1 and v2 schemas,
and `server/lib/database/audit.js` treats the legacy tables as
intentionally retained. Any Cockroach path must either port these to
Cockroach-supported triggers, reimplement them in application code, or
first complete the legacy-mirror deprecation that
`docs/PRODUCTION_DATABASE_RECOVERY.md` already scopes.

### B. Full-text search

The generated column and its index:

- `legislative_documents.search_vector` — `TSVECTOR GENERATED ALWAYS AS (TO_TSVECTOR('english', ...)) STORED` (`db.js:557`)
- 8 `USING GIN` indexes total: `001` (2), `004` (1), `005` (1), `019` (2), `db.js` (2)

Application-level query dependencies (4 files):

| File | Construct |
|---|---|
| `document/DocumentRepository.js:374,444` | `websearch_to_tsquery('english', …)`, `ts_rank(...)` |
| `document/recommendationService.js:490,512` | `search_vector @@ WEBSEARCH_TO_TSQUERY('simple', …)` |
| `document/documentResearchService.js:1272-1281` | `plainto_tsquery`, `ts_rank_cd`, `to_tsvector` |
| `cli/researchEval.js:316-332` | `plainto_tsquery`, `ts_rank_cd` |

This matters more than the raw count suggests: the hybrid retrieval
shipped in commit `4ede707` deliberately runs vector search **and**
Postgres full-text search concurrently and merges them. Full-text is a
first-class ranking signal, not a fallback. Replacing it changes retrieval
quality, so any substitute needs quality measurement against real legal
queries — not just "the query executes".

### C. Locking and concurrency

- `pg_advisory_xact_lock` — 2 distinct keys: schema bootstrap (`db.js:39`) and migrations (`lib/database/migrator.js:16`)
- `FOR UPDATE OF … SKIP LOCKED` — queue claim (`document/processingWorkerService.js:127`)

### D. Postgres regex dialect

`db.js` uses `\m` / `\M` word-boundary syntax (4 occurrences) inside
`REGEXP_REPLACE` for title normalization, plus `~*` case-insensitive
matching in `001`, `006`, `013`. These are Postgres regex extensions;
engines using RE2-style syntax express word boundaries differently. The
normalized-title values feed deduplication, so a silent regex behavior
change would corrupt dedupe rather than fail loudly — this needs explicit
verification, not assumption.

### E. System catalogs

3 files (`lib/database/audit.js`, `capacity.js`, `maintenance.js`) plus
several CLIs read `pg_stat_user_tables`, `pg_class`, `pg_total_relation_size`,
`pg_database_size`. All storage-reporting, capacity-planning, and
maintenance tooling built in commits `4ffe014`/`8a26111`/`52c613a` depends
on these.

### F. Other

`BIGSERIAL` primary keys across most tables; `ON CONFLICT` upserts
throughout; generated `STORED` columns for
`document_relationships.source_document_id` / `target_document_id`
(`005`, `db.js`).

## Design: what has been built and unit-tested

All of the following is committed, passes tests, and leaves the Neon path
byte-for-byte unchanged in behavior.

### `lib/database/dialect.js` — target selection and guard

- `DATABASE_DIALECT` defaults to `postgres`; Cockroach is opt-in only.
- `COCKROACH_DATABASE_URL` is a **separate** variable — Cockroach can never
  be reached through `DATABASE_URL`.
- `assertCockroachTarget()` **fails closed**: any Cockroach-only migration
  or destructive test refuses to run unless the dialect is explicitly
  `cockroach`. This is the mechanism that makes it structurally impossible
  for a Cockroach command to hit Neon production.
- `maskConnectionString()` reduces a URL to host + database only; tests
  assert that username, password, and query parameters never survive.

### `lib/database/migrationLock.js` — provider-specific locking

- Postgres: unchanged `pg_advisory_xact_lock`. A test asserts this path
  never touches the lease table.
- Cockroach: a `schema_migration_lock` lease row. Acquisition is a single
  atomic `INSERT … ON CONFLICT … WHERE lease_expires_at < NOW()`, so there
  is no read-then-write window for two runners to both win.
- Lease expiry exists specifically because advisory locks release for free
  on crash and a lease does not — without expiry, one crashed deploy would
  block all future deploys permanently.
- Tested: two concurrent runners → exactly one applies; lease released on
  success **and** on failure; expired lease from a crashed runner can be
  taken over, but a live lease cannot.

### `lib/database/transactionRetry.js` — serializable retry

- Retries only SQLSTATE `40001` / `40003` / `40P01`, plus message-based
  detection for drivers that drop the SQLSTATE.
- Explicitly does **not** retry constraint violations or bad-column errors;
  a test asserts `23505` fails on the first attempt.
- Full-jitter backoff (not fixed or equal jitter) because the contended
  case is N workers aborting simultaneously on queue claim — full jitter
  spreads them maximally.
- Owns the transaction boundary so a retry replays from clean state; tests
  assert the exact `BEGIN/ROLLBACK/BEGIN/COMMIT` sequence and that every
  attempt releases its client.
- Safe on both dialects: at Neon's READ COMMITTED the retry path is inert.

**Caveat:** `work` must be idempotent with respect to side effects outside
the transaction, since it can legitimately run more than once. This is
documented in the module and matters for any call site that also writes to
Pinecone or increments module-scope counters.

## Unverified — requires the live cluster

No claim is made about any of these. They are the reason the evaluation
cannot conclude yet:

1. Whether each construct in the inventory above is supported by this
   cluster's CockroachDB version, and with what semantics.
2. Whether the 4 PL/pgSQL triggers port, need reimplementation in
   application code, or are obviated by legacy-mirror deprecation.
3. What lexical retrieval mechanism is available, and — critically — how
   its result quality compares on real legal queries.
4. Whether `FOR UPDATE OF … SKIP LOCKED` queue claiming behaves
   equivalently, and how much contention retry the worker pool needs.
5. Regex behavior for `\m` / `\M` and the dedupe correctness that depends
   on it.
6. Replacement for the `pg_*` catalog queries the storage/capacity tooling
   relies on.
7. Latency (p50/p95) and Request Unit consumption.

## Honest effort assessment

Based on the measured inventory, not on a guess about CockroachDB:

| Area | Classification | Note |
|---|---|---|
| Dialect/target guard | **A — done** | Built and tested |
| Migration locking | **A — done** | Built and tested |
| Transaction retry | **A — done** | Built and tested |
| `BIGSERIAL`, `ON CONFLICT`, JSONB | **A/B — likely low** | Broadly portable, needs confirmation |
| System catalogs | **B — moderate** | Mechanical rewrite of 3 modules + CLIs |
| Queue claim semantics | **B — moderate** | Design exists; correctness needs contention testing |
| Regex/dedupe | **B — moderate** | Small code, high blast radius if wrong |
| Full-text retrieval | **C — major** | Not a syntax swap; a retrieval-quality change |
| 4 dual-write triggers | **C — major** | Backbone of legacy compatibility |
| `db.js` bootstrap schema | **C — major** | ~1,200 lines, most Postgres-specific file in the tree |

The `server/db.js` bootstrap deserves emphasis: it is a *second* schema
system that runs before the 24 file-based migrations and concentrates the
generated `tsvector` column, the Postgres regex, its own advisory lock, and
much of the trigger installation. Any framing of this migration as "run the
migrations against Cockroach" understates it — `db.js` is the harder half.

## Recommendation (interim)

Not yet a final recommendation — that requires the cluster. What the
evidence supports today:

1. **Decouple the outage from the migration.** The storage ceiling is
   urgent; this migration is not a fast fix for it. Restore headroom by the
   means already scoped in `PRODUCTION_DATABASE_RECOVERY.md` (plan upgrade
   and/or artifact offload to object storage), independent of this
   evaluation.
2. **Validate the premise before spending more.** Confirm CockroachDB's
   free allowance genuinely covers the projected corpus. If it does not,
   the entire effort is moot.
3. **Consider that the object-storage work may resolve the constraint.**
   `document_text_chunks` (112 MB), `document_text_artifacts` (50 MB), and
   the TOAST behind them are the bulk of the database. Migrations 023/024
   and the artifact-offload tooling already built target exactly this. If
   offload lands, the storage pressure that motivates leaving Postgres
   substantially decreases.

## Explicitly not done

- No production data copied to CockroachDB.
- No Neon configuration modified.
- No cutover performed or scheduled.
- No CockroachDB code path enabled by default anywhere.
