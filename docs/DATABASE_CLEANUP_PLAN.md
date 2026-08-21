# Database Cleanup Plan

Generated from the configured PostgreSQL database at 2026-08-21T07:16:22.713Z.

## Safety policy

- No table is dropped by this sprint.
- Schema-v2 tables are additive and existing records are mirrored through compatibility triggers.
- A future destructive migration requires explicit approval, a backup, a compatibility-window report, and verified zero reads/writes.

## Legacy compatibility tables

- `act_chats` (0 rows): retain as legacy archive; current compatibility code references: 7.
- `bill_chats` (0 rows): retain as legacy archive; current compatibility code references: 7.
- `contact_requests` (0 rows): retain as legacy archive; current compatibility code references: 5.
- `document_chats` (57 rows): retain as legacy archive; current compatibility code references: 8.
- `egazette_chats` (1 rows): retain as legacy archive; current compatibility code references: 7.
- `legislative_document_resources` (20573 rows): retain as legacy archive; current compatibility code references: 11.
- `legislative_documents` (19949 rows): retain as legacy archive; current compatibility code references: 40.
- `multi_document_chats` (3 rows): retain as legacy archive; current compatibility code references: 6.
- `related_bills` (3 rows): retain as legacy archive; current compatibility code references: 5.

## Empty tables

- `act_chats`: **legacy_archive** — Preserved for backward compatibility while additive triggers mirror data into schema v2.
- `audit_logs`: **keep** — Normalized schema-v2 feature table; empty until the feature produces data.
- `bill_chats`: **legacy_archive** — Preserved for backward compatibility while additive triggers mirror data into schema v2.
- `bookmarks`: **keep** — Normalized schema-v2 feature table; empty until the feature produces data.
- `bug_reports`: **keep** — Normalized schema-v2 feature table; empty until the feature produces data.
- `contact_requests`: **legacy_archive** — Preserved for backward compatibility while additive triggers mirror data into schema v2.
- `dedupe_candidates`: **keep** — Normalized schema-v2 feature table; empty until the feature produces data.
- `document_processing_stages`: **keep** — Active application or infrastructure table.
- `feedback_submissions`: **keep** — Normalized schema-v2 feature table; empty until the feature produces data.
- `knowledge_edges`: **keep** — Normalized schema-v2 feature table; empty until the feature produces data.
- `knowledge_evidence`: **keep** — Normalized schema-v2 feature table; empty until the feature produces data.
- `knowledge_nodes`: **keep** — Normalized schema-v2 feature table; empty until the feature produces data.
- `policy_chats`: **keep** — Active application or infrastructure table.
- `policy_drafts`: **keep** — Active application or infrastructure table.
- `research_query_telemetry`: **keep** — Active application or infrastructure table.
- `research_source_chunks`: **keep** — Active application or infrastructure table.
- `research_sources`: **keep** — Active application or infrastructure table.
- `saved_graph_paths`: **keep** — Active application or infrastructure table.
- `user_activity_events`: **keep** — Active application or infrastructure table.
- `user_sessions`: **keep** — Normalized schema-v2 feature table; empty until the feature produces data.

## Future drop candidates

- None. Empty tables currently represent normalized feature capacity or migration infrastructure.

## Proposed future sequence

1. Observe schema-v2 in production for at least one full ingestion and research cycle.
2. Confirm all normalized row-count and orphan checks remain green.
3. Switch remaining read paths from legacy compatibility tables.
4. Freeze legacy writes and verify mirror parity.
5. Archive legacy tables in a dedicated schema.
6. Drop only in a separately approved migration.
