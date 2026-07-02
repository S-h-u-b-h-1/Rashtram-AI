# Database Schema v2

Last verified: 2 July 2026

## Design

Schema v2 separates identity, documents, research, ingestion, intelligence,
feedback, and audit concerns. It is additive: no production table was dropped,
and existing IDs are preserved.

```text
users
  ├─ user_profiles / user_preferences / user_sessions
  ├─ research_chats ─ research_messages
  ├─ research_notes / research_collections / bookmarks / saved_searches
  └─ audit_logs / feedback_submissions / bug_reports

source_registry ─ source_connectors ─ source_health
       │
documents ─ document_sources
    ├─ document_resources
    ├─ document_metadata
    ├─ document_processing_state
    ├─ document_text_chunks
    ├─ document_relationships
    └─ document_topics ─ topic_taxonomy

ingestion_runs ─ ingestion_run_items
source_snapshots
dedupe_candidates / catalog_match_reviews
intelligence_events / dashboard_metrics / recommendations
```

## Compatibility strategy

`legislative_documents`, `legislative_document_resources`, and legacy chat
tables remain available. Database triggers mirror catalogue, resource,
snapshot, and universal-chat writes into schema v2. Existing API IDs therefore
remain stable while backend reads progressively move to the normalized model.

Applied migrations are recorded in `schema_migrations` with immutable
checksums. Startup uses PostgreSQL advisory locks, so concurrent serverless
instances cannot race migrations.

## Universal document identity

`documents.id` exactly matches the legacy catalogue ID. `canonical_id` is
unique. Source-specific identity is stored in `document_sources`, while
downloadable or readable assets are stored in `document_resources`.
Source-native fields remain in raw metadata; normalized fields are first-class
columns.

Source names retain their externally used slug for backward compatibility and
also carry `normalized_source_name` (for example `prs_india`) in the source
registry and source records.

## Research readiness

`documents.research_ready` is true only when all of the following hold:

1. a canonical source URL exists;
2. an accessible PDF, text, or HTML resource exists;
3. processing, extraction, and embedding states are `ready`;
4. `chunks_count` is greater than zero;
5. no processing error is present.

The six documents processed before schema v2 were backfilled from verified
legacy processing success. Future processing writes the actual chunk count.

## Search and performance

The schema includes B-tree indexes for document type, jurisdiction, state,
ministry, year, publication date, readiness, source priority, quality, and
timestamps. A generated `TSVECTOR` with a GIN index covers title, identifiers,
authority, ministry, and category. JSON metadata uses GIN indexes only where it
is queried.

## Migration commands

```bash
npm run db:audit --prefix server
npm run db:migrate --prefix server
npm run db:verify --prefix server
npm run db:cleanup-report --prefix server
```

Migrations are additive and transaction-scoped. A checksum mismatch is treated
as an error; applied migration files must never be edited.
