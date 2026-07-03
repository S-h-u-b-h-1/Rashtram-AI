# Database Cleanup Plan

Generated from the configured PostgreSQL database at 2026-07-02T18:38:49.294Z.

## Safety policy

- No table is dropped by this sprint.
- Schema-v2 tables are additive and existing records are mirrored through compatibility triggers.
- A future destructive migration requires explicit approval, a backup, a compatibility-window report, and verified zero reads/writes.

## Legacy compatibility tables

- `act_chats` (2 rows): retain as legacy archive; current compatibility code references: 4.
- `bill_chats` (3 rows): retain as legacy archive; current compatibility code references: 4.
- `contact_requests` (0 rows): retain as legacy archive; current compatibility code references: 3.
- `document_chats` (32 rows): retain as legacy archive; current compatibility code references: 6.
- `egazette_chats` (1 rows): retain as legacy archive; current compatibility code references: 4.
- `legislative_document_resources` (18680 rows): retain as legacy archive; current compatibility code references: 6.
- `legislative_documents` (17744 rows): retain as legacy archive; current compatibility code references: 10.
- `multi_document_chats` (2 rows): retain as legacy archive; current compatibility code references: 3.
- `related_bills` (3 rows): retain as legacy archive; current compatibility code references: 3.

## Empty tables

- `audit_logs`: **keep** — Normalized schema-v2 feature table; empty until the feature produces data.
- `bug_reports`: **keep** — Normalized schema-v2 feature table; empty until the feature produces data.
- `contact_requests`: **legacy_archive** — Preserved for backward compatibility while additive triggers mirror data into schema v2.
- `contact_submissions`: **keep** — Normalized schema-v2 feature table; empty until the feature produces data.
- `dedupe_candidates`: **keep** — Normalized schema-v2 feature table; empty until the feature produces data.
- `document_chat_feedback`: **keep** — Active application or infrastructure table.
- `document_text_chunks`: **keep** — Normalized schema-v2 feature table; empty until the feature produces data.
- `document_topics`: **keep** — Normalized schema-v2 feature table; empty until the feature produces data.
- `feedback_submissions`: **keep** — Normalized schema-v2 feature table; empty until the feature produces data.
- `recommendations`: **keep** — Normalized schema-v2 feature table; empty until the feature produces data.
- `saved_searches`: **keep** — Normalized schema-v2 feature table; empty until the feature produces data.
- `system_events`: **keep** — Normalized schema-v2 feature table; empty until the feature produces data.
- `topic_taxonomy`: **keep** — Normalized schema-v2 feature table; empty until the feature produces data.

## Future drop candidates

- None. Empty tables currently represent normalized feature capacity or migration infrastructure.

## Proposed future sequence

1. Observe schema-v2 in production for at least one full ingestion and research cycle.
2. Confirm all normalized row-count and orphan checks remain green.
3. Switch remaining read paths from legacy compatibility tables.
4. Freeze legacy writes and verify mirror parity.
5. Archive legacy tables in a dedicated schema.
6. Drop only in a separately approved migration.
