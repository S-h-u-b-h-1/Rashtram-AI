# Database Audit Report

Generated from the configured PostgreSQL database at 2026-07-02T14:00:07.235Z.

No tables were deleted during this audit. Legacy tables remain available while schema-v2 mirrors preserve backward compatibility.

## Inventory summary

- Tables: 56
- Empty tables: 13
- Legacy compatibility tables: 9
- Universal documents: 17742
- Strictly research-ready documents: 6
- Low-quality records (score below 40): 38
- Missing canonical source URL: 0
- Missing primary PDF resource: 408
- Broken resource rows: 0
- Orphan sources/resources/messages: 0/0/0
- Duplicate canonical IDs: 0
- Invalid research-ready flags: 0

## Table inventory

| Table | Rows | Code references | Classification | Last update |
|---|---:|---:|---|---|
| `act_chats` | 2 | 4 | legacy_archive | 2026-06-29T06:31:40.789Z |
| `application_schema_versions` | 1 | 2 | keep | 2026-07-02T03:43:16.982Z |
| `audit_logs` | 0 | 1 | keep | n/a |
| `bill_chats` | 3 | 4 | legacy_archive | 2026-06-27T14:11:36.853Z |
| `bookmarks` | 1 | 2 | keep | 2026-07-01T09:29:10.470Z |
| `bug_reports` | 0 | 1 | keep | n/a |
| `catalog_match_reviews` | 1 | 2 | keep | 2026-06-27T16:01:58.439Z |
| `contact_requests` | 0 | 3 | legacy_archive | n/a |
| `contact_submissions` | 0 | 1 | keep | n/a |
| `dashboard_metrics` | 7 | 2 | keep | n/a |
| `dedupe_candidates` | 0 | 2 | keep | n/a |
| `document_chat_feedback` | 0 | 2 | keep | n/a |
| `document_chats` | 32 | 6 | legacy_archive | 2026-07-02T09:40:29.188Z |
| `document_comparisons` | 5 | 4 | keep | 2026-07-02T05:46:49.438Z |
| `document_metadata` | 17741 | 1 | keep | 2026-07-02T09:40:26.800Z |
| `document_processing_state` | 17741 | 4 | keep | 2026-07-02T13:49:50.451Z |
| `document_relationships` | 6 | 5 | keep | 2026-06-27T16:09:09.525Z |
| `document_resources` | 18680 | 4 | keep | 2026-07-02T13:58:54.454Z |
| `document_sources` | 17751 | 5 | keep | 2026-07-02T13:58:57.048Z |
| `document_text_artifacts` | 10 | 3 | keep | 2026-07-02T09:40:25.307Z |
| `document_text_chunks` | 0 | 1 | keep | n/a |
| `document_topics` | 0 | 1 | keep | n/a |
| `documents` | 17742 | 26 | keep | 2026-07-02T13:59:15.575Z |
| `egazette_chats` | 1 | 4 | legacy_archive | 2026-06-29T12:43:38.960Z |
| `feedback_submissions` | 0 | 1 | keep | n/a |
| `ingestion_run_items` | 2 | 2 | keep | 2026-07-02T13:58:58.672Z |
| `ingestion_runs` | 60 | 6 | keep | 2026-07-02T13:58:59.199Z |
| `intelligence_events` | 289 | 5 | keep | 2026-07-02T13:58:57.048Z |
| `legislative_document_resources` | 18680 | 6 | legacy_archive | 2026-07-02T13:58:54.454Z |
| `legislative_documents` | 17742 | 10 | legacy_archive | 2026-07-02T13:58:57.048Z |
| `multi_document_chats` | 1 | 3 | legacy_archive | 2026-07-02T03:37:43.884Z |
| `recommendations` | 0 | 9 | keep | n/a |
| `related_bills` | 3 | 3 | legacy_archive | 2026-06-27T14:11:37.515Z |
| `research_chats` | 32 | 2 | keep | 2026-07-02T09:40:29.188Z |
| `research_collection_items` | 1 | 3 | keep | 2026-06-30T19:30:03.994Z |
| `research_collections` | 1 | 3 | keep | 2026-06-30T19:29:49.229Z |
| `research_messages` | 77 | 2 | keep | 2026-07-02T09:40:27.761Z |
| `research_notes` | 5 | 4 | keep | 2026-07-02T05:42:39.893Z |
| `saved_content` | 1 | 2 | keep | 2026-07-01T09:29:10.470Z |
| `saved_searches` | 0 | 3 | keep | n/a |
| `schema_migrations` | 3 | 2 | keep | 2026-07-02T13:58:18.762Z |
| `source_collection_snapshots` | 413 | 4 | keep | 2026-07-02T13:58:53.992Z |
| `source_connectors` | 28 | 1 | keep | 2026-07-02T13:30:59.203Z |
| `source_directory_entries` | 147 | 3 | keep | 2026-07-02T08:41:47.816Z |
| `source_health` | 1 | 3 | keep | 2026-07-02T13:58:59.734Z |
| `source_registry` | 28 | 5 | keep | 2026-07-02T13:58:59.455Z |
| `source_snapshots` | 413 | 0 | keep | 2026-07-02T13:58:53.992Z |
| `system_events` | 0 | 1 | keep | n/a |
| `topic_taxonomy` | 0 | 1 | keep | n/a |
| `user_activity_events` | 103 | 5 | keep | 2026-07-01T06:35:18.920Z |
| `user_document_interactions` | 6 | 3 | keep | n/a |
| `user_preferences` | 1 | 1 | keep | 2026-07-01T04:50:54.068Z |
| `user_profiles` | 1 | 5 | keep | 2026-07-01T04:50:54.068Z |
| `user_research_preferences` | 7 | 2 | keep | 2026-07-02T05:37:46.919Z |
| `user_sessions` | 22 | 4 | keep | 2026-07-02T13:20:54.743Z |
| `users` | 8 | 8 | keep | 2026-07-02T05:37:41.283Z |

## Detailed table findings

### act_chats

- Rows: 2
- Decision: **legacy_archive** — Preserved for backward compatibility while additive triggers mirror data into schema v2.
- Active code references: `server/dashboard/intelligenceService.js`, `server/db.js`, `server/lib/database/audit.js`, `server/models/ActChat.js`
- Nullable fields: act_status, pdf_url, summary
- Last-update signal: updated_at = 2026-06-29T06:31:40.789Z
- Indexes: `act_chats_pkey`, `act_chats_user_id_act_id_key`, `act_chats_user_recent_idx`
- Foreign keys: `act_chats_user_id_fkey`: FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE

| Column | Type | Nullable | Default |
|---|---|---|---|
| `id` | bigint | NO | nextval('act_chats_id_seq'::regclass) |
| `act_id` | text | NO |  |
| `user_id` | bigint | NO |  |
| `act_title` | text | NO |  |
| `act_status` | text | YES |  |
| `pdf_url` | text | YES |  |
| `summary` | text | YES |  |
| `messages` | jsonb | NO | '[]'::jsonb |
| `is_active` | boolean | NO | true |
| `created_at` | timestamp with time zone | NO | now() |
| `updated_at` | timestamp with time zone | NO | now() |

### application_schema_versions

- Rows: 1
- Decision: **keep** — Active application or infrastructure table.
- Active code references: `server/db.js`, `server/test/streamingChat.test.js`
- Nullable fields: none
- Last-update signal: updated_at = 2026-07-02T03:43:16.982Z
- Indexes: `application_schema_versions_pkey`
- Foreign keys: none

| Column | Type | Nullable | Default |
|---|---|---|---|
| `id` | smallint | NO | 1 |
| `version` | bigint | NO |  |
| `updated_at` | timestamp with time zone | NO | now() |

### audit_logs

- Rows: 0 (empty)
- Decision: **keep** — Normalized schema-v2 feature table; empty until the feature produces data.
- Active code references: `server/lib/database/audit.js`
- Nullable fields: user_id, entity_type, entity_id
- Last-update signal: created_at
- Indexes: `audit_logs_pkey`, `audit_logs_user_idx`
- Foreign keys: `audit_logs_user_id_fkey`: FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL

| Column | Type | Nullable | Default |
|---|---|---|---|
| `id` | bigint | NO | nextval('audit_logs_id_seq'::regclass) |
| `user_id` | bigint | YES |  |
| `action` | text | NO |  |
| `entity_type` | text | YES |  |
| `entity_id` | text | YES |  |
| `metadata_json` | jsonb | NO | '{}'::jsonb |
| `created_at` | timestamp with time zone | NO | now() |

### bill_chats

- Rows: 3
- Decision: **legacy_archive** — Preserved for backward compatibility while additive triggers mirror data into schema v2.
- Active code references: `server/dashboard/intelligenceService.js`, `server/db.js`, `server/lib/database/audit.js`, `server/models/BillChat.js`
- Nullable fields: bill_status, pdf_url, summary
- Last-update signal: updated_at = 2026-06-27T14:11:36.853Z
- Indexes: `bill_chats_pkey`, `bill_chats_user_id_bill_id_key`, `bill_chats_user_recent_idx`
- Foreign keys: `bill_chats_user_id_fkey`: FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE

| Column | Type | Nullable | Default |
|---|---|---|---|
| `id` | bigint | NO | nextval('bill_chats_id_seq'::regclass) |
| `bill_id` | text | NO |  |
| `user_id` | bigint | NO |  |
| `bill_title` | text | NO |  |
| `bill_status` | text | YES |  |
| `pdf_url` | text | YES |  |
| `summary` | text | YES |  |
| `messages` | jsonb | NO | '[]'::jsonb |
| `last_message_at` | timestamp with time zone | NO | now() |
| `is_active` | boolean | NO | true |
| `created_at` | timestamp with time zone | NO | now() |
| `updated_at` | timestamp with time zone | NO | now() |

### bookmarks

- Rows: 1
- Decision: **keep** — Active application or infrastructure table.
- Active code references: `server/lib/database/audit.js`, `server/profile/profileService.js`
- Nullable fields: legacy_saved_content_id, document_id, external_document_id
- Last-update signal: created_at = 2026-07-01T09:29:10.470Z
- Indexes: `bookmarks_legacy_saved_content_id_key`, `bookmarks_pkey`, `bookmarks_user_id_document_id_key`, `bookmarks_user_idx`
- Foreign keys: `bookmarks_document_id_fkey`: FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE; `bookmarks_user_id_fkey`: FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE

| Column | Type | Nullable | Default |
|---|---|---|---|
| `id` | bigint | NO | nextval('bookmarks_id_seq'::regclass) |
| `legacy_saved_content_id` | bigint | YES |  |
| `user_id` | bigint | NO |  |
| `document_id` | bigint | YES |  |
| `external_document_id` | text | YES |  |
| `title` | text | NO |  |
| `metadata_json` | jsonb | NO | '{}'::jsonb |
| `created_at` | timestamp with time zone | NO | now() |

### bug_reports

- Rows: 0 (empty)
- Decision: **keep** — Normalized schema-v2 feature table; empty until the feature produces data.
- Active code references: `server/lib/database/audit.js`
- Nullable fields: user_id
- Last-update signal: updated_at
- Indexes: `bug_reports_pkey`
- Foreign keys: `bug_reports_user_id_fkey`: FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL

| Column | Type | Nullable | Default |
|---|---|---|---|
| `id` | bigint | NO | nextval('bug_reports_id_seq'::regclass) |
| `user_id` | bigint | YES |  |
| `title` | text | NO |  |
| `description` | text | NO |  |
| `status` | text | NO | 'new'::text |
| `metadata_json` | jsonb | NO | '{}'::jsonb |
| `created_at` | timestamp with time zone | NO | now() |
| `updated_at` | timestamp with time zone | NO | now() |

### catalog_match_reviews

- Rows: 1
- Decision: **keep** — Active application or infrastructure table.
- Active code references: `server/db.js`, `server/lib/ingestion/core/catalogRepository.js`
- Nullable fields: reviewed_by, reviewed_at
- Last-update signal: created_at = 2026-06-27T16:01:58.439Z
- Indexes: `catalog_match_reviews_incoming_source_name_incoming_source__key`, `catalog_match_reviews_pending_idx`, `catalog_match_reviews_pkey`
- Foreign keys: `catalog_match_reviews_candidate_document_id_fkey`: FOREIGN KEY (candidate_document_id) REFERENCES legislative_documents(id) ON DELETE CASCADE

| Column | Type | Nullable | Default |
|---|---|---|---|
| `id` | bigint | NO | nextval('catalog_match_reviews_id_seq'::regclass) |
| `incoming_source_name` | text | NO |  |
| `incoming_source_record_id` | text | NO |  |
| `candidate_document_id` | bigint | NO |  |
| `similarity` | numeric | NO |  |
| `incoming_record` | jsonb | NO | '{}'::jsonb |
| `status` | text | NO | 'pending'::text |
| `reviewed_by` | text | YES |  |
| `reviewed_at` | timestamp with time zone | YES |  |
| `created_at` | timestamp with time zone | NO | now() |

### contact_requests

- Rows: 0 (empty)
- Decision: **legacy_archive** — Preserved for backward compatibility while additive triggers mirror data into schema v2.
- Active code references: `server/contact/route.js`, `server/db.js`, `server/lib/database/audit.js`
- Nullable fields: last_name, organization, phone
- Last-update signal: created_at
- Indexes: `contact_requests_pkey`, `contact_requests_recent_idx`
- Foreign keys: none

| Column | Type | Nullable | Default |
|---|---|---|---|
| `id` | bigint | NO | nextval('contact_requests_id_seq'::regclass) |
| `first_name` | text | NO |  |
| `last_name` | text | YES |  |
| `organization` | text | YES |  |
| `email` | text | NO |  |
| `phone` | text | YES |  |
| `message` | text | NO |  |
| `status` | text | NO | 'new'::text |
| `created_at` | timestamp with time zone | NO | now() |

### contact_submissions

- Rows: 0 (empty)
- Decision: **keep** — Normalized schema-v2 feature table; empty until the feature produces data.
- Active code references: `server/lib/database/audit.js`
- Nullable fields: legacy_contact_request_id, last_name, organization, phone
- Last-update signal: created_at
- Indexes: `contact_submissions_legacy_contact_request_id_key`, `contact_submissions_pkey`
- Foreign keys: none

| Column | Type | Nullable | Default |
|---|---|---|---|
| `id` | bigint | NO | nextval('contact_submissions_id_seq'::regclass) |
| `legacy_contact_request_id` | bigint | YES |  |
| `first_name` | text | NO |  |
| `last_name` | text | YES |  |
| `organization` | text | YES |  |
| `email` | text | NO |  |
| `phone` | text | YES |  |
| `message` | text | NO |  |
| `status` | text | NO | 'new'::text |
| `metadata_json` | jsonb | NO | '{}'::jsonb |
| `created_at` | timestamp with time zone | NO | now() |

### dashboard_metrics

- Rows: 7
- Decision: **keep** — Active application or infrastructure table.
- Active code references: `server/lib/database/audit.js`, `server/lib/database/quality.js`
- Nullable fields: metric_value
- Last-update signal: none
- Indexes: `dashboard_metrics_pkey`
- Foreign keys: none

| Column | Type | Nullable | Default |
|---|---|---|---|
| `metric_key` | text | NO |  |
| `metric_value` | numeric | YES |  |
| `dimensions_json` | jsonb | NO | '{}'::jsonb |
| `measured_at` | timestamp with time zone | NO | now() |

### dedupe_candidates

- Rows: 0 (empty)
- Decision: **keep** — Normalized schema-v2 feature table; empty until the feature produces data.
- Active code references: `server/lib/database/audit.js`, `server/lib/database/quality.js`
- Nullable fields: confidence, reviewed_at
- Last-update signal: created_at
- Indexes: `dedupe_candidates_document_id_candidate_document_id_match_t_key`, `dedupe_candidates_pkey`
- Foreign keys: `dedupe_candidates_candidate_document_id_fkey`: FOREIGN KEY (candidate_document_id) REFERENCES documents(id) ON DELETE CASCADE; `dedupe_candidates_document_id_fkey`: FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE

| Column | Type | Nullable | Default |
|---|---|---|---|
| `id` | bigint | NO | nextval('dedupe_candidates_id_seq'::regclass) |
| `document_id` | bigint | NO |  |
| `candidate_document_id` | bigint | NO |  |
| `match_type` | text | NO |  |
| `confidence` | numeric | YES |  |
| `status` | text | NO | 'pending'::text |
| `evidence_json` | jsonb | NO | '{}'::jsonb |
| `created_at` | timestamp with time zone | NO | now() |
| `reviewed_at` | timestamp with time zone | YES |  |

### document_chat_feedback

- Rows: 0 (empty)
- Decision: **keep** — Active application or infrastructure table.
- Active code references: `server/db.js`, `server/models/DocumentChat.js`
- Nullable fields: reason
- Last-update signal: updated_at
- Indexes: `document_chat_feedback_pkey`, `document_chat_feedback_user_id_document_type_document_id_me_key`
- Foreign keys: `document_chat_feedback_user_id_fkey`: FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE

| Column | Type | Nullable | Default |
|---|---|---|---|
| `id` | bigint | NO | nextval('document_chat_feedback_id_seq'::regclass) |
| `user_id` | bigint | NO |  |
| `document_type` | text | NO |  |
| `document_id` | text | NO |  |
| `message_id` | text | NO |  |
| `rating` | smallint | NO |  |
| `reason` | text | YES |  |
| `created_at` | timestamp with time zone | NO | now() |
| `updated_at` | timestamp with time zone | NO | now() |

### document_chats

- Rows: 32
- Decision: **legacy_archive** — Preserved for backward compatibility while additive triggers mirror data into schema v2.
- Active code references: `server/dashboard/intelligenceService.js`, `server/db.js`, `server/document/DocumentRepository.js`, `server/lib/database/audit.js`, `server/models/DocumentChat.js`, `server/profile/profileService.js`
- Nullable fields: status, pdf_url, source_url, summary
- Last-update signal: updated_at = 2026-07-02T09:40:29.188Z
- Indexes: `document_chats_document_idx`, `document_chats_pkey`, `document_chats_user_id_document_type_document_id_key`, `document_chats_user_recent_idx`
- Foreign keys: `document_chats_user_id_fkey`: FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE

| Column | Type | Nullable | Default |
|---|---|---|---|
| `id` | bigint | NO | nextval('document_chats_id_seq'::regclass) |
| `user_id` | bigint | NO |  |
| `document_type` | text | NO |  |
| `document_id` | text | NO |  |
| `document_title` | text | NO |  |
| `status` | text | YES |  |
| `pdf_url` | text | YES |  |
| `source_url` | text | YES |  |
| `summary` | text | YES |  |
| `messages` | jsonb | NO | '[]'::jsonb |
| `metadata_json` | jsonb | NO | '{}'::jsonb |
| `is_pinned` | boolean | NO | false |
| `is_active` | boolean | NO | true |
| `last_message_at` | timestamp with time zone | NO | now() |
| `last_accessed_at` | timestamp with time zone | NO | now() |
| `created_at` | timestamp with time zone | NO | now() |
| `updated_at` | timestamp with time zone | NO | now() |

### document_comparisons

- Rows: 5
- Decision: **keep** — Active application or infrastructure table.
- Active code references: `server/db.js`, `server/document/documentComparisonService.js`, `server/document/documentsRoute.js`, `server/lib/database/audit.js`
- Nullable fields: none
- Last-update signal: updated_at = 2026-07-02T05:46:49.438Z
- Indexes: `document_comparisons_pkey`, `document_comparisons_user_recent_idx`
- Foreign keys: `document_comparisons_user_id_fkey`: FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE

| Column | Type | Nullable | Default |
|---|---|---|---|
| `id` | bigint | NO | nextval('document_comparisons_id_seq'::regclass) |
| `user_id` | bigint | NO |  |
| `title` | text | NO |  |
| `document_ids_json` | jsonb | NO |  |
| `mode` | text | NO | 'comprehensive'::text |
| `language` | text | NO | 'English'::text |
| `result_json` | jsonb | NO | '{}'::jsonb |
| `created_at` | timestamp with time zone | NO | now() |
| `updated_at` | timestamp with time zone | NO | now() |

### document_metadata

- Rows: 17741
- Decision: **keep** — Active application or infrastructure table.
- Active code references: `server/lib/database/audit.js`
- Nullable fields: none
- Last-update signal: updated_at = 2026-07-02T09:40:26.800Z
- Indexes: `document_metadata_pkey`
- Foreign keys: `document_metadata_document_id_fkey`: FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE

| Column | Type | Nullable | Default |
|---|---|---|---|
| `document_id` | bigint | NO |  |
| `metadata_json` | jsonb | NO | '{}'::jsonb |
| `provenance_json` | jsonb | NO | '{}'::jsonb |
| `created_at` | timestamp with time zone | NO | now() |
| `updated_at` | timestamp with time zone | NO | now() |

### document_processing_state

- Rows: 17741
- Decision: **keep** — Active application or infrastructure table.
- Active code references: `server/cli/dbVerify.js`, `server/document/DocumentRepository.js`, `server/lib/database/audit.js`, `server/lib/database/quality.js`
- Nullable fields: error_message, embedding_provider, ai_provider, last_processed_at
- Last-update signal: updated_at = 2026-07-02T13:49:50.451Z
- Indexes: `document_processing_state_pkey`
- Foreign keys: `document_processing_state_document_id_fkey`: FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE

| Column | Type | Nullable | Default |
|---|---|---|---|
| `document_id` | bigint | NO |  |
| `processing_status` | text | NO | 'not_started'::text |
| `extraction_status` | text | NO | 'not_started'::text |
| `embedding_status` | text | NO | 'not_started'::text |
| `summary_status` | text | NO | 'not_started'::text |
| `ocr_status` | text | NO | 'not_required'::text |
| `error_message` | text | YES |  |
| `chunks_count` | integer | NO | 0 |
| `embedding_provider` | text | YES |  |
| `ai_provider` | text | YES |  |
| `last_processed_at` | timestamp with time zone | YES |  |
| `updated_at` | timestamp with time zone | NO | now() |

### document_relationships

- Rows: 6
- Decision: **keep** — Active application or infrastructure table.
- Active code references: `server/db.js`, `server/document/DocumentRepository.js`, `server/egazette/egazetteService.js`, `server/lib/database/audit.js`, `server/lib/ingestion/core/catalogRepository.js`
- Nullable fields: source_name, confidence, source_url
- Last-update signal: updated_at = 2026-06-27T16:09:09.525Z
- Indexes: `document_relationships_from_document_id_to_document_id_rela_key`, `document_relationships_from_idx`, `document_relationships_pkey`, `document_relationships_to_idx`
- Foreign keys: `document_relationships_from_document_id_fkey`: FOREIGN KEY (from_document_id) REFERENCES legislative_documents(id) ON DELETE CASCADE; `document_relationships_to_document_id_fkey`: FOREIGN KEY (to_document_id) REFERENCES legislative_documents(id) ON DELETE CASCADE

| Column | Type | Nullable | Default |
|---|---|---|---|
| `id` | bigint | NO | nextval('document_relationships_id_seq'::regclass) |
| `from_document_id` | bigint | NO |  |
| `to_document_id` | bigint | NO |  |
| `relationship_type` | text | NO |  |
| `source_name` | text | YES |  |
| `confidence` | numeric | YES |  |
| `metadata` | jsonb | NO | '{}'::jsonb |
| `created_at` | timestamp with time zone | NO | now() |
| `updated_at` | timestamp with time zone | NO | now() |
| `source_url` | text | YES |  |
| `metadata_json` | jsonb | NO | '{}'::jsonb |

### document_resources

- Rows: 18680
- Decision: **keep** — Active application or infrastructure table.
- Active code references: `server/cli/dbVerify.js`, `server/document/DocumentRepository.js`, `server/lib/database/audit.js`, `server/lib/database/quality.js`
- Nullable fields: source_id, label, mime_type, file_extension, file_size, language, hash_sha256, last_checked_at
- Last-update signal: updated_at = 2026-07-02T13:58:54.454Z
- Indexes: `document_resources_accessible_idx`, `document_resources_document_id_url_key`, `document_resources_document_idx`, `document_resources_hash_idx`, `document_resources_pkey`, `document_resources_url_idx`
- Foreign keys: `document_resources_document_id_fkey`: FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE; `document_resources_source_id_fkey`: FOREIGN KEY (source_id) REFERENCES document_sources(id) ON DELETE SET NULL

| Column | Type | Nullable | Default |
|---|---|---|---|
| `id` | bigint | NO |  |
| `document_id` | bigint | NO |  |
| `source_id` | bigint | YES |  |
| `resource_type` | text | NO |  |
| `label` | text | YES |  |
| `url` | text | NO |  |
| `mime_type` | text | YES |  |
| `file_extension` | text | YES |  |
| `file_size` | bigint | YES |  |
| `language` | text | YES |  |
| `hash_sha256` | text | YES |  |
| `is_primary` | boolean | NO | false |
| `is_accessible` | boolean | NO | true |
| `last_checked_at` | timestamp with time zone | YES |  |
| `metadata_json` | jsonb | NO | '{}'::jsonb |
| `created_at` | timestamp with time zone | NO | now() |
| `updated_at` | timestamp with time zone | NO | now() |

### document_sources

- Rows: 17751
- Decision: **keep** — Active application or infrastructure table.
- Active code references: `server/dashboard/intelligenceService.js`, `server/db.js`, `server/lib/database/audit.js`, `server/lib/ingestion/core/catalogRepository.js`, `server/lib/ingestion/core/healthCheck.js`
- Nullable fields: detail_url, pdf_url, legal_identifier, content_hash, text_fingerprint, pdf_hash, html_hash, source_title, source_status, file_hash, mime_type, file_size_bytes, source_type, normalized_source_name, canonical_url, raw_title, raw_status, collected_at
- Last-update signal: updated_at = 2026-07-02T13:58:57.048Z
- Indexes: `document_sources_content_hash_idx`, `document_sources_document_idx`, `document_sources_normalized_source_idx`, `document_sources_pdf_hash_idx`, `document_sources_pkey`, `document_sources_source_name_idx`, `document_sources_source_name_source_record_id_key`, `document_sources_source_record_idx`, `document_sources_source_url_idx`
- Foreign keys: `document_sources_document_id_fkey`: FOREIGN KEY (document_id) REFERENCES legislative_documents(id) ON DELETE CASCADE; `document_sources_documents_v2_fk`: FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED

| Column | Type | Nullable | Default |
|---|---|---|---|
| `id` | bigint | NO | nextval('document_sources_id_seq'::regclass) |
| `document_id` | bigint | NO |  |
| `source_name` | text | NO |  |
| `source_record_id` | text | NO |  |
| `source_url` | text | NO |  |
| `detail_url` | text | YES |  |
| `pdf_url` | text | YES |  |
| `source_priority` | integer | NO | 100 |
| `legal_identifier` | text | YES |  |
| `content_hash` | text | YES |  |
| `text_fingerprint` | text | YES |  |
| `raw_metadata` | jsonb | NO | '{}'::jsonb |
| `first_seen_at` | timestamp with time zone | NO | now() |
| `last_seen_at` | timestamp with time zone | NO | now() |
| `created_at` | timestamp with time zone | NO | now() |
| `updated_at` | timestamp with time zone | NO | now() |
| `pdf_hash` | text | YES |  |
| `html_hash` | text | YES |  |
| `source_title` | text | YES |  |
| `source_status` | text | YES |  |
| `source_metadata` | jsonb | NO | '{}'::jsonb |
| `file_hash` | text | YES |  |
| `mime_type` | text | YES |  |
| `file_size_bytes` | bigint | YES |  |
| `source_type` | text | YES |  |
| `normalized_source_name` | text | YES |  |
| `canonical_url` | text | YES |  |
| `raw_title` | text | YES |  |
| `raw_status` | text | YES |  |
| `raw_metadata_json` | jsonb | NO | '{}'::jsonb |
| `collected_at` | timestamp with time zone | YES |  |

### document_text_artifacts

- Rows: 10
- Decision: **keep** — Active application or infrastructure table.
- Active code references: `server/db.js`, `server/document/documentResearchService.js`, `server/profile/profileService.js`
- Nullable fields: language_confidence, english_summary
- Last-update signal: updated_at = 2026-07-02T09:40:25.307Z
- Indexes: `document_text_artifacts_language_idx`, `document_text_artifacts_pkey`
- Foreign keys: `document_text_artifacts_document_id_fkey`: FOREIGN KEY (document_id) REFERENCES legislative_documents(id) ON DELETE CASCADE

| Column | Type | Nullable | Default |
|---|---|---|---|
| `document_id` | bigint | NO |  |
| `language_code` | text | NO | 'und'::text |
| `script` | text | NO | 'Unknown'::text |
| `language_confidence` | numeric | YES |  |
| `original_text` | text | NO |  |
| `english_summary` | text | YES |  |
| `extraction_method` | text | NO |  |
| `ocr_used` | boolean | NO | false |
| `metadata_json` | jsonb | NO | '{}'::jsonb |
| `created_at` | timestamp with time zone | NO | now() |
| `updated_at` | timestamp with time zone | NO | now() |
| `is_bilingual` | boolean | NO | false |
| `ocr_required` | boolean | NO | false |

### document_text_chunks

- Rows: 0 (empty)
- Decision: **keep** — Normalized schema-v2 feature table; empty until the feature produces data.
- Active code references: `server/lib/database/audit.js`
- Nullable fields: translated_text, token_count, vector_reference
- Last-update signal: updated_at
- Indexes: `document_text_chunks_document_id_chunk_index_key`, `document_text_chunks_document_idx`, `document_text_chunks_pkey`
- Foreign keys: `document_text_chunks_document_id_fkey`: FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE

| Column | Type | Nullable | Default |
|---|---|---|---|
| `id` | bigint | NO | nextval('document_text_chunks_id_seq'::regclass) |
| `document_id` | bigint | NO |  |
| `chunk_index` | integer | NO |  |
| `original_text` | text | NO |  |
| `translated_text` | text | YES |  |
| `language` | text | NO | 'und'::text |
| `token_count` | integer | YES |  |
| `vector_reference` | text | YES |  |
| `metadata_json` | jsonb | NO | '{}'::jsonb |
| `created_at` | timestamp with time zone | NO | now() |
| `updated_at` | timestamp with time zone | NO | now() |

### document_topics

- Rows: 0 (empty)
- Decision: **keep** — Normalized schema-v2 feature table; empty until the feature produces data.
- Active code references: `server/lib/database/audit.js`
- Nullable fields: confidence, source
- Last-update signal: none
- Indexes: `document_topics_pkey`
- Foreign keys: `document_topics_document_id_fkey`: FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE; `document_topics_topic_id_fkey`: FOREIGN KEY (topic_id) REFERENCES topic_taxonomy(id) ON DELETE CASCADE

| Column | Type | Nullable | Default |
|---|---|---|---|
| `document_id` | bigint | NO |  |
| `topic_id` | bigint | NO |  |
| `confidence` | numeric | YES |  |
| `source` | text | YES |  |

### documents

- Rows: 17742
- Decision: **keep** — Active application or infrastructure table.
- Active code references: `server/act/actsRoute.js`, `server/bill/billsRoute.js`, `server/cli/dbVerify.js`, `server/cli/verifyRelease.js`, `server/dashboard/intelligenceService.js`, `server/document/DocumentRepository.js`, `server/document/documentComparisonService.js`, `server/document/documentsRoute.js`, `server/egazette/egazetteService.js`, `server/lib/catalogRepository.js`, `server/lib/catalogService.js`, `server/lib/database/audit.js`, `server/lib/database/quality.js`, `server/lib/ingestion/connectors/governanceSourceConnectors.js`, `server/lib/ingestion/connectors/prsConnector.js`, `server/lib/ingestion/core/catalogRepository.js`, `server/lib/prsCatalog.js`, `server/lib/vectordb.js`, `server/scripts/ingest-prs-catalog.js`, `server/server.js`, `server/test/dashboardIntelligence.test.js`, `server/test/documentComparison.test.js`, `server/test/ingestionCore.test.js`, `server/test/ingestionHealth.test.js`, `server/test/prsCatalog.test.js`, `server/test/sourceConnectors.test.js`
- Nullable fields: document_subtype, jurisdiction_level, jurisdiction, state, authority, ministry, department, category, status, year, publication_date, introduced_date, passed_date, assent_date, commencement_date, effective_date, legal_identifier, bill_number, act_number, gazette_identifier, canonical_source_id, canonical_url, primary_pdf_resource_id, search_vector
- Last-update signal: updated_at = 2026-07-02T13:59:15.575Z
- Indexes: `documents_canonical_id_key`, `documents_first_seen_idx`, `documents_jurisdiction_idx`, `documents_metadata_idx`, `documents_ministry_idx`, `documents_normalized_title_idx`, `documents_pkey`, `documents_publication_idx`, `documents_quality_idx`, `documents_research_ready_idx`, `documents_search_idx`, `documents_source_priority_idx`, `documents_state_idx`, `documents_type_idx`, `documents_updated_idx`, `documents_year_idx`
- Foreign keys: `documents_canonical_source_id_fkey`: FOREIGN KEY (canonical_source_id) REFERENCES source_registry(id) ON DELETE SET NULL; `documents_primary_pdf_resource_fk`: FOREIGN KEY (primary_pdf_resource_id) REFERENCES document_resources(id) ON DELETE SET NULL DEFERRABLE INITIALLY DEFERRED

| Column | Type | Nullable | Default |
|---|---|---|---|
| `id` | bigint | NO |  |
| `canonical_id` | text | NO |  |
| `title` | text | NO |  |
| `normalized_title` | text | NO |  |
| `document_type` | text | NO |  |
| `document_subtype` | text | YES |  |
| `jurisdiction_level` | text | YES |  |
| `jurisdiction` | text | YES |  |
| `state` | text | YES |  |
| `country` | text | NO | 'India'::text |
| `authority` | text | YES |  |
| `ministry` | text | YES |  |
| `department` | text | YES |  |
| `category` | text | YES |  |
| `status` | text | YES |  |
| `language` | text | NO | 'und'::text |
| `script` | text | NO | 'Unknown'::text |
| `is_bilingual` | boolean | NO | false |
| `year` | integer | YES |  |
| `publication_date` | date | YES |  |
| `introduced_date` | date | YES |  |
| `passed_date` | date | YES |  |
| `assent_date` | date | YES |  |
| `commencement_date` | date | YES |  |
| `effective_date` | date | YES |  |
| `legal_identifier` | text | YES |  |
| `bill_number` | text | YES |  |
| `act_number` | text | YES |  |
| `gazette_identifier` | text | YES |  |
| `source_priority` | integer | NO | 100 |
| `canonical_source_id` | bigint | YES |  |
| `canonical_url` | text | YES |  |
| `primary_pdf_resource_id` | bigint | YES |  |
| `research_ready` | boolean | NO | false |
| `visibility_status` | text | NO | 'public'::text |
| `quality_score` | numeric | NO | 0 |
| `metadata_json` | jsonb | NO | '{}'::jsonb |
| `search_vector` | tsvector | YES |  |
| `created_at` | timestamp with time zone | NO | now() |
| `updated_at` | timestamp with time zone | NO | now() |
| `first_seen_at` | timestamp with time zone | NO | now() |
| `last_seen_at` | timestamp with time zone | NO | now() |

### egazette_chats

- Rows: 1
- Decision: **legacy_archive** — Preserved for backward compatibility while additive triggers mirror data into schema v2.
- Active code references: `server/db.js`, `server/egazette/egazetteService.js`, `server/lib/database/audit.js`, `server/models/EGazetteChat.js`
- Nullable fields: gazette_number, notification_type, status, pdf_url, source_url, summary
- Last-update signal: updated_at = 2026-06-29T12:43:38.960Z
- Indexes: `egazette_chats_pkey`, `egazette_chats_user_id_gazette_id_key`, `egazette_chats_user_recent_idx`
- Foreign keys: `egazette_chats_user_id_fkey`: FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE

| Column | Type | Nullable | Default |
|---|---|---|---|
| `id` | bigint | NO | nextval('egazette_chats_id_seq'::regclass) |
| `gazette_id` | text | NO |  |
| `user_id` | bigint | NO |  |
| `gazette_title` | text | NO |  |
| `gazette_number` | text | YES |  |
| `notification_type` | text | YES |  |
| `status` | text | YES |  |
| `pdf_url` | text | YES |  |
| `source_url` | text | YES |  |
| `summary` | text | YES |  |
| `messages` | jsonb | NO | '[]'::jsonb |
| `metadata_json` | jsonb | NO | '{}'::jsonb |
| `last_message_at` | timestamp with time zone | NO | now() |
| `last_accessed_at` | timestamp with time zone | NO | now() |
| `is_active` | boolean | NO | true |
| `created_at` | timestamp with time zone | NO | now() |
| `updated_at` | timestamp with time zone | NO | now() |

### feedback_submissions

- Rows: 0 (empty)
- Decision: **keep** — Normalized schema-v2 feature table; empty until the feature produces data.
- Active code references: `server/lib/database/audit.js`
- Nullable fields: user_id
- Last-update signal: created_at
- Indexes: `feedback_submissions_pkey`
- Foreign keys: `feedback_submissions_user_id_fkey`: FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL

| Column | Type | Nullable | Default |
|---|---|---|---|
| `id` | bigint | NO | nextval('feedback_submissions_id_seq'::regclass) |
| `user_id` | bigint | YES |  |
| `feedback_type` | text | NO | 'general'::text |
| `message` | text | NO |  |
| `metadata_json` | jsonb | NO | '{}'::jsonb |
| `created_at` | timestamp with time zone | NO | now() |

### ingestion_run_items

- Rows: 2
- Decision: **keep** — Active application or infrastructure table.
- Active code references: `server/lib/database/audit.js`, `server/lib/ingestion/core/catalogRepository.js`
- Nullable fields: source_record_id, document_id, action, error_message
- Last-update signal: created_at = 2026-07-02T13:58:58.672Z
- Indexes: `ingestion_run_items_document_idx`, `ingestion_run_items_pkey`, `ingestion_run_items_run_idx`
- Foreign keys: `ingestion_run_items_document_id_fkey`: FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE SET NULL; `ingestion_run_items_run_id_fkey`: FOREIGN KEY (run_id) REFERENCES ingestion_runs(id) ON DELETE CASCADE

| Column | Type | Nullable | Default |
|---|---|---|---|
| `id` | bigint | NO | nextval('ingestion_run_items_id_seq'::regclass) |
| `run_id` | bigint | NO |  |
| `source_record_id` | text | YES |  |
| `document_id` | bigint | YES |  |
| `status` | text | NO |  |
| `action` | text | YES |  |
| `error_message` | text | YES |  |
| `metadata_json` | jsonb | NO | '{}'::jsonb |
| `created_at` | timestamp with time zone | NO | now() |

### ingestion_runs

- Rows: 60
- Decision: **keep** — Active application or infrastructure table.
- Active code references: `server/dashboard/intelligenceService.js`, `server/db.js`, `server/lib/catalogRepository.js`, `server/lib/database/audit.js`, `server/lib/ingestion/core/catalogRepository.js`, `server/lib/ingestion/core/healthCheck.js`
- Nullable fields: completed_at, collection_name
- Last-update signal: completed_at = 2026-07-02T13:58:59.199Z
- Indexes: `ingestion_runs_pkey`, `ingestion_runs_source_recent_idx`
- Foreign keys: none

| Column | Type | Nullable | Default |
|---|---|---|---|
| `id` | bigint | NO | nextval('ingestion_runs_id_seq'::regclass) |
| `source_name` | text | NO |  |
| `status` | text | NO | 'running'::text |
| `options` | jsonb | NO | '{}'::jsonb |
| `records_discovered` | integer | NO | 0 |
| `records_stored` | integer | NO | 0 |
| `resources_stored` | integer | NO | 0 |
| `errors` | jsonb | NO | '[]'::jsonb |
| `started_at` | timestamp with time zone | NO | now() |
| `completed_at` | timestamp with time zone | YES |  |
| `collection_name` | text | YES |  |
| `counters_json` | jsonb | NO | '{}'::jsonb |
| `errors_json` | jsonb | NO | '[]'::jsonb |

### intelligence_events

- Rows: 289
- Decision: **keep** — Active application or infrastructure table.
- Active code references: `server/dashboard/intelligenceService.js`, `server/db.js`, `server/document/DocumentRepository.js`, `server/lib/database/audit.js`, `server/lib/ingestion/core/catalogRepository.js`
- Nullable fields: event_key, summary, document_id, source_url, document_type, jurisdiction, authority, ministry, category, status, event_date
- Last-update signal: updated_at = 2026-07-02T13:58:57.048Z
- Indexes: `intelligence_events_document_idx`, `intelligence_events_event_key_key`, `intelligence_events_feed_idx`, `intelligence_events_pkey`
- Foreign keys: `intelligence_events_document_id_fkey`: FOREIGN KEY (document_id) REFERENCES legislative_documents(id) ON DELETE SET NULL

| Column | Type | Nullable | Default |
|---|---|---|---|
| `id` | bigint | NO | nextval('intelligence_events_id_seq'::regclass) |
| `event_key` | text | YES |  |
| `event_type` | text | NO |  |
| `title` | text | NO |  |
| `summary` | text | YES |  |
| `document_id` | bigint | YES |  |
| `source_name` | text | NO |  |
| `source_url` | text | YES |  |
| `document_type` | text | YES |  |
| `jurisdiction` | text | YES |  |
| `authority` | text | YES |  |
| `ministry` | text | YES |  |
| `category` | text | YES |  |
| `status` | text | YES |  |
| `event_date` | date | YES |  |
| `importance_score` | numeric | NO | 50 |
| `metadata_json` | jsonb | NO | '{}'::jsonb |
| `created_at` | timestamp with time zone | NO | now() |
| `updated_at` | timestamp with time zone | NO | now() |
| `first_seen_at` | timestamp with time zone | NO | now() |
| `last_seen_at` | timestamp with time zone | NO | now() |

### legislative_document_resources

- Rows: 18680
- Decision: **legacy_archive** — Preserved for backward compatibility while additive triggers mirror data into schema v2.
- Active code references: `server/dashboard/intelligenceService.js`, `server/db.js`, `server/egazette/egazetteService.js`, `server/lib/catalogRepository.js`, `server/lib/database/audit.js`, `server/lib/ingestion/core/catalogRepository.js`
- Nullable fields: label, category
- Last-update signal: updated_at = 2026-07-02T13:58:54.454Z
- Indexes: `legislative_document_resources_document_id_url_key`, `legislative_document_resources_pkey`, `legislative_resources_document_idx`
- Foreign keys: `legislative_document_resources_document_id_fkey`: FOREIGN KEY (document_id) REFERENCES legislative_documents(id) ON DELETE CASCADE

| Column | Type | Nullable | Default |
|---|---|---|---|
| `id` | bigint | NO | nextval('legislative_document_resources_id_seq'::regclass) |
| `document_id` | bigint | NO |  |
| `label` | text | YES |  |
| `resource_type` | text | NO | 'link'::text |
| `category` | text | YES |  |
| `url` | text | NO |  |
| `metadata` | jsonb | NO | '{}'::jsonb |
| `first_seen_at` | timestamp with time zone | NO | now() |
| `last_seen_at` | timestamp with time zone | NO | now() |
| `created_at` | timestamp with time zone | NO | now() |
| `updated_at` | timestamp with time zone | NO | now() |

### legislative_documents

- Rows: 17742
- Decision: **legacy_archive** — Preserved for backward compatibility while additive triggers mirror data into schema v2.
- Active code references: `server/activity/activityService.js`, `server/cli/dbVerify.js`, `server/dashboard/intelligenceService.js`, `server/db.js`, `server/document/DocumentRepository.js`, `server/egazette/egazetteService.js`, `server/lib/catalogRepository.js`, `server/lib/database/audit.js`, `server/lib/ingestion/core/catalogRepository.js`, `server/profile/profileService.js`
- Nullable fields: year, status, ministry, category, detail_url, pdf_url, source_page_url, content_fetched_at, normalized_title, authority, department, legal_identifier, bill_number, act_number, gazette_identifier, introduced_date, passed_date, enacted_date, publication_date, effective_date, canonical_source, canonical_url, content_hash, text_fingerprint, gazette_id, assent_date, commencement_date, search_vector, file_hash, mime_type, file_size_bytes, processing_status, processing_error, processed_at
- Last-update signal: updated_at = 2026-07-02T13:58:57.048Z
- Indexes: `legislative_documents_authority_idx`, `legislative_documents_canonical_id_idx`, `legislative_documents_content_hash_idx`, `legislative_documents_gazette_identifier_idx`, `legislative_documents_legal_identifier_idx`, `legislative_documents_metadata_idx`, `legislative_documents_ministry_idx`, `legislative_documents_normalized_title_idx`, `legislative_documents_pkey`, `legislative_documents_publication_idx`, `legislative_documents_scope_idx`, `legislative_documents_search_idx`, `legislative_documents_source_idx`, `legislative_documents_source_name_source_document_id_key`, `legislative_documents_status_idx`, `legislative_documents_text_fingerprint_idx`, `legislative_documents_title_idx`, `legislative_documents_type_date_idx`
- Foreign keys: none

| Column | Type | Nullable | Default |
|---|---|---|---|
| `id` | bigint | NO | nextval('legislative_documents_id_seq'::regclass) |
| `source_name` | text | NO |  |
| `source_document_id` | text | NO |  |
| `document_type` | text | NO |  |
| `jurisdiction_level` | text | NO |  |
| `jurisdiction` | text | NO |  |
| `title` | text | NO |  |
| `year` | integer | YES |  |
| `status` | text | YES |  |
| `ministry` | text | YES |  |
| `category` | text | YES |  |
| `source_url` | text | NO |  |
| `detail_url` | text | YES |  |
| `pdf_url` | text | YES |  |
| `source_page_url` | text | YES |  |
| `source_metadata` | jsonb | NO | '{}'::jsonb |
| `first_seen_at` | timestamp with time zone | NO | now() |
| `last_seen_at` | timestamp with time zone | NO | now() |
| `content_fetched_at` | timestamp with time zone | YES |  |
| `created_at` | timestamp with time zone | NO | now() |
| `updated_at` | timestamp with time zone | NO | now() |
| `canonical_id` | text | NO | ('rashtram-'::text || md5(((random())::text || (clock_timestamp())::text))) |
| `normalized_title` | text | YES |  |
| `authority` | text | YES |  |
| `department` | text | YES |  |
| `legal_identifier` | text | YES |  |
| `bill_number` | text | YES |  |
| `act_number` | text | YES |  |
| `gazette_identifier` | text | YES |  |
| `introduced_date` | date | YES |  |
| `passed_date` | date | YES |  |
| `enacted_date` | date | YES |  |
| `publication_date` | date | YES |  |
| `effective_date` | date | YES |  |
| `canonical_source` | text | YES |  |
| `canonical_url` | text | YES |  |
| `source_priority` | integer | NO | 100 |
| `content_hash` | text | YES |  |
| `text_fingerprint` | text | YES |  |
| `metadata_json` | jsonb | NO | '{}'::jsonb |
| `gazette_id` | text | YES |  |
| `assent_date` | date | YES |  |
| `commencement_date` | date | YES |  |
| `search_vector` | tsvector | YES |  |
| `file_hash` | text | YES |  |
| `mime_type` | text | YES |  |
| `file_size_bytes` | bigint | YES |  |
| `processing_status` | text | YES |  |
| `processing_error` | text | YES |  |
| `processed_at` | timestamp with time zone | YES |  |

### multi_document_chats

- Rows: 1
- Decision: **legacy_archive** — Preserved for backward compatibility while additive triggers mirror data into schema v2.
- Active code references: `server/db.js`, `server/document/documentsRoute.js`, `server/lib/database/audit.js`
- Nullable fields: comparison_id
- Last-update signal: updated_at = 2026-07-02T03:37:43.884Z
- Indexes: `multi_document_chats_pkey`, `multi_document_chats_user_id_selection_key_key`, `multi_document_chats_user_recent_idx`
- Foreign keys: `multi_document_chats_comparison_id_fkey`: FOREIGN KEY (comparison_id) REFERENCES document_comparisons(id) ON DELETE SET NULL; `multi_document_chats_user_id_fkey`: FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE

| Column | Type | Nullable | Default |
|---|---|---|---|
| `id` | bigint | NO | nextval('multi_document_chats_id_seq'::regclass) |
| `user_id` | bigint | NO |  |
| `selection_key` | text | NO |  |
| `document_ids_json` | jsonb | NO |  |
| `comparison_id` | bigint | YES |  |
| `messages` | jsonb | NO | '[]'::jsonb |
| `created_at` | timestamp with time zone | NO | now() |
| `updated_at` | timestamp with time zone | NO | now() |

### recommendations

- Rows: 0 (empty)
- Decision: **keep** — Normalized schema-v2 feature table; empty until the feature produces data.
- Active code references: `server/dashboard/intelligenceService.js`, `server/document/DocumentService.js`, `server/document/documentResearchService.js`, `server/document/documentTypes.js`, `server/document/documentsRoute.js`, `server/egazette/egazettesRoute.js`, `server/lib/database/audit.js`, `server/lib/ingestion/connectors/regulatorConnectors.js`, `server/lib/vectordb.js`
- Nullable fields: user_id, document_id, expires_at
- Last-update signal: created_at
- Indexes: `recommendations_pkey`
- Foreign keys: `recommendations_document_id_fkey`: FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE; `recommendations_user_id_fkey`: FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE

| Column | Type | Nullable | Default |
|---|---|---|---|
| `id` | bigint | NO | nextval('recommendations_id_seq'::regclass) |
| `user_id` | bigint | YES |  |
| `document_id` | bigint | YES |  |
| `recommendation_type` | text | NO |  |
| `score` | numeric | NO | 0 |
| `reason_json` | jsonb | NO | '{}'::jsonb |
| `created_at` | timestamp with time zone | NO | now() |
| `expires_at` | timestamp with time zone | YES |  |

### related_bills

- Rows: 3
- Decision: **legacy_archive** — Preserved for backward compatibility while additive triggers mirror data into schema v2.
- Active code references: `server/db.js`, `server/lib/database/audit.js`, `server/models/RelatedBills.js`
- Nullable fields: none
- Last-update signal: updated_at = 2026-06-27T14:11:37.515Z
- Indexes: `related_bills_pkey`
- Foreign keys: none

| Column | Type | Nullable | Default |
|---|---|---|---|
| `bill_id` | text | NO |  |
| `bill_title` | text | NO |  |
| `related_bills` | jsonb | NO | '[]'::jsonb |
| `last_updated` | timestamp with time zone | NO | now() |
| `created_at` | timestamp with time zone | NO | now() |
| `updated_at` | timestamp with time zone | NO | now() |

### research_chats

- Rows: 32
- Decision: **keep** — Active application or infrastructure table.
- Active code references: `server/cli/dbVerify.js`, `server/lib/database/audit.js`
- Nullable fields: legacy_chat_id, document_id, summary
- Last-update signal: updated_at = 2026-07-02T09:40:29.188Z
- Indexes: `research_chats_document_idx`, `research_chats_legacy_chat_id_key`, `research_chats_pkey`, `research_chats_user_document_idx`, `research_chats_user_idx`
- Foreign keys: `research_chats_document_id_fkey`: FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE SET NULL; `research_chats_user_id_fkey`: FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE

| Column | Type | Nullable | Default |
|---|---|---|---|
| `id` | bigint | NO | nextval('research_chats_id_seq'::regclass) |
| `legacy_chat_id` | bigint | YES |  |
| `user_id` | bigint | NO |  |
| `document_id` | bigint | YES |  |
| `document_type` | text | NO |  |
| `external_document_id` | text | NO |  |
| `title` | text | NO |  |
| `summary` | text | YES |  |
| `is_pinned` | boolean | NO | false |
| `is_active` | boolean | NO | true |
| `created_at` | timestamp with time zone | NO | now() |
| `updated_at` | timestamp with time zone | NO | now() |

### research_collection_items

- Rows: 1
- Decision: **keep** — Active application or infrastructure table.
- Active code references: `server/db.js`, `server/lib/database/audit.js`, `server/profile/profileService.js`
- Nullable fields: none
- Last-update signal: created_at = 2026-06-30T19:30:03.994Z
- Indexes: `research_collection_items_pkey`
- Foreign keys: `research_collection_items_collection_id_fkey`: FOREIGN KEY (collection_id) REFERENCES research_collections(id) ON DELETE CASCADE

| Column | Type | Nullable | Default |
|---|---|---|---|
| `collection_id` | bigint | NO |  |
| `document_type` | text | NO |  |
| `document_id` | text | NO |  |
| `title` | text | NO |  |
| `metadata_json` | jsonb | NO | '{}'::jsonb |
| `created_at` | timestamp with time zone | NO | now() |

### research_collections

- Rows: 1
- Decision: **keep** — Active application or infrastructure table.
- Active code references: `server/db.js`, `server/lib/database/audit.js`, `server/profile/profileService.js`
- Nullable fields: description
- Last-update signal: updated_at = 2026-06-30T19:29:49.229Z
- Indexes: `research_collections_pkey`
- Foreign keys: `research_collections_user_id_fkey`: FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE

| Column | Type | Nullable | Default |
|---|---|---|---|
| `id` | bigint | NO | nextval('research_collections_id_seq'::regclass) |
| `user_id` | bigint | NO |  |
| `name` | text | NO |  |
| `description` | text | YES |  |
| `created_at` | timestamp with time zone | NO | now() |
| `updated_at` | timestamp with time zone | NO | now() |

### research_messages

- Rows: 77
- Decision: **keep** — Active application or infrastructure table.
- Active code references: `server/cli/dbVerify.js`, `server/lib/database/audit.js`
- Nullable fields: external_message_id
- Last-update signal: created_at = 2026-07-02T09:40:27.761Z
- Indexes: `research_messages_chat_id_external_message_id_key`, `research_messages_chat_idx`, `research_messages_pkey`
- Foreign keys: `research_messages_chat_id_fkey`: FOREIGN KEY (chat_id) REFERENCES research_chats(id) ON DELETE CASCADE

| Column | Type | Nullable | Default |
|---|---|---|---|
| `id` | bigint | NO | nextval('research_messages_id_seq'::regclass) |
| `chat_id` | bigint | NO |  |
| `external_message_id` | text | YES |  |
| `role` | text | NO |  |
| `content` | text | NO |  |
| `sources_json` | jsonb | NO | '[]'::jsonb |
| `metadata_json` | jsonb | NO | '{}'::jsonb |
| `is_error` | boolean | NO | false |
| `created_at` | timestamp with time zone | NO | now() |

### research_notes

- Rows: 5
- Decision: **keep** — Active application or infrastructure table.
- Active code references: `server/db.js`, `server/lib/database/audit.js`, `server/models/DocumentChat.js`, `server/profile/profileService.js`
- Nullable fields: none
- Last-update signal: updated_at = 2026-07-02T05:42:39.893Z
- Indexes: `research_notes_document_idx`, `research_notes_pkey`
- Foreign keys: `research_notes_user_id_fkey`: FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE

| Column | Type | Nullable | Default |
|---|---|---|---|
| `id` | bigint | NO | nextval('research_notes_id_seq'::regclass) |
| `user_id` | bigint | NO |  |
| `document_type` | text | NO |  |
| `document_id` | text | NO |  |
| `body` | text | NO |  |
| `is_pinned` | boolean | NO | true |
| `created_at` | timestamp with time zone | NO | now() |
| `updated_at` | timestamp with time zone | NO | now() |

### saved_content

- Rows: 1
- Decision: **keep** — Active application or infrastructure table.
- Active code references: `server/db.js`, `server/profile/profileService.js`
- Nullable fields: document_type, document_id, chat_id
- Last-update signal: created_at = 2026-07-01T09:29:10.470Z
- Indexes: `saved_content_document_unique_idx`, `saved_content_pkey`, `saved_content_user_recent_idx`
- Foreign keys: `saved_content_chat_id_fkey`: FOREIGN KEY (chat_id) REFERENCES document_chats(id) ON DELETE CASCADE; `saved_content_user_id_fkey`: FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE

| Column | Type | Nullable | Default |
|---|---|---|---|
| `id` | bigint | NO | nextval('saved_content_id_seq'::regclass) |
| `user_id` | bigint | NO |  |
| `item_type` | text | NO |  |
| `document_type` | text | YES |  |
| `document_id` | text | YES |  |
| `chat_id` | bigint | YES |  |
| `title` | text | NO |  |
| `metadata_json` | jsonb | NO | '{}'::jsonb |
| `created_at` | timestamp with time zone | NO | now() |

### saved_searches

- Rows: 0 (empty)
- Decision: **keep** — Normalized schema-v2 feature table; empty until the feature produces data.
- Active code references: `server/db.js`, `server/lib/database/audit.js`, `server/profile/profileService.js`
- Nullable fields: query_text
- Last-update signal: updated_at
- Indexes: `saved_searches_pkey`, `saved_searches_user_recent_idx`
- Foreign keys: `saved_searches_user_id_fkey`: FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE

| Column | Type | Nullable | Default |
|---|---|---|---|
| `id` | bigint | NO | nextval('saved_searches_id_seq'::regclass) |
| `user_id` | bigint | NO |  |
| `name` | text | NO |  |
| `query_text` | text | YES |  |
| `filters_json` | jsonb | NO | '{}'::jsonb |
| `created_at` | timestamp with time zone | NO | now() |
| `updated_at` | timestamp with time zone | NO | now() |

### schema_migrations

- Rows: 3
- Decision: **keep** — Active application or infrastructure table.
- Active code references: `server/cli/dbVerify.js`, `server/lib/database/migrator.js`
- Nullable fields: none
- Last-update signal: applied_at = 2026-07-02T13:58:18.762Z
- Indexes: `schema_migrations_pkey`
- Foreign keys: none

| Column | Type | Nullable | Default |
|---|---|---|---|
| `migration_name` | text | NO |  |
| `checksum` | text | NO |  |
| `applied_at` | timestamp with time zone | NO | now() |

### source_collection_snapshots

- Rows: 413
- Decision: **keep** — Active application or infrastructure table.
- Active code references: `server/dashboard/intelligenceService.js`, `server/db.js`, `server/lib/catalogRepository.js`, `server/lib/ingestion/core/catalogRepository.js`
- Nullable fields: html_hash, response_status, collected_at
- Last-update signal: fetched_at = 2026-07-02T13:58:53.992Z
- Indexes: `source_collection_snapshots_pkey`, `source_snapshots_recent_idx`
- Foreign keys: none

| Column | Type | Nullable | Default |
|---|---|---|---|
| `id` | bigint | NO | nextval('source_collection_snapshots_id_seq'::regclass) |
| `source_name` | text | NO |  |
| `source_url` | text | NO |  |
| `content_sha256` | text | NO |  |
| `record_count` | integer | NO | 0 |
| `metadata` | jsonb | NO | '{}'::jsonb |
| `fetched_at` | timestamp with time zone | NO | now() |
| `html_hash` | text | YES |  |
| `response_status` | integer | YES |  |
| `collected_at` | timestamp with time zone | YES |  |
| `metadata_json` | jsonb | NO | '{}'::jsonb |

### source_connectors

- Rows: 28
- Decision: **keep** — Active application or infrastructure table.
- Active code references: `server/lib/database/audit.js`
- Nullable fields: last_validated_at
- Last-update signal: updated_at = 2026-07-02T13:30:59.203Z
- Indexes: `source_connectors_pkey`, `source_connectors_source_name_connector_name_key`
- Foreign keys: `source_connectors_source_name_fkey`: FOREIGN KEY (source_name) REFERENCES source_registry(source_name) ON DELETE CASCADE

| Column | Type | Nullable | Default |
|---|---|---|---|
| `id` | bigint | NO | nextval('source_connectors_id_seq'::regclass) |
| `source_name` | text | NO |  |
| `connector_name` | text | NO |  |
| `configuration_json` | jsonb | NO | '{}'::jsonb |
| `enabled` | boolean | NO | true |
| `last_validated_at` | timestamp with time zone | YES |  |
| `created_at` | timestamp with time zone | NO | now() |
| `updated_at` | timestamp with time zone | NO | now() |

### source_directory_entries

- Rows: 147
- Decision: **keep** — Active application or infrastructure table.
- Active code references: `server/dashboard/intelligenceService.js`, `server/db.js`, `server/lib/ingestion/core/catalogRepository.js`
- Nullable fields: jurisdiction, parent_name, official_url
- Last-update signal: updated_at = 2026-07-02T08:41:47.816Z
- Indexes: `source_directory_entries_pkey`, `source_directory_entries_scope_idx`, `source_directory_entries_source_name_entry_key_key`
- Foreign keys: none

| Column | Type | Nullable | Default |
|---|---|---|---|
| `id` | bigint | NO | nextval('source_directory_entries_id_seq'::regclass) |
| `source_name` | text | NO |  |
| `entry_key` | text | NO |  |
| `entity_type` | text | NO |  |
| `name` | text | NO |  |
| `jurisdiction` | text | YES |  |
| `parent_name` | text | YES |  |
| `official_url` | text | YES |  |
| `directory_url` | text | NO |  |
| `metadata_json` | jsonb | NO | '{}'::jsonb |
| `first_seen_at` | timestamp with time zone | NO | now() |
| `last_seen_at` | timestamp with time zone | NO | now() |
| `created_at` | timestamp with time zone | NO | now() |
| `updated_at` | timestamp with time zone | NO | now() |

### source_health

- Rows: 1
- Decision: **keep** — Active application or infrastructure table.
- Active code references: `server/lib/database/audit.js`, `server/lib/database/quality.js`, `server/lib/ingestion/core/catalogRepository.js`
- Nullable fields: reachable, parser_status, last_checked_at, last_successful_run_at, last_failed_run_at, last_error
- Last-update signal: updated_at = 2026-07-02T13:58:59.734Z
- Indexes: `source_health_pkey`
- Foreign keys: `source_health_source_name_fkey`: FOREIGN KEY (source_name) REFERENCES source_registry(source_name) ON DELETE CASCADE

| Column | Type | Nullable | Default |
|---|---|---|---|
| `source_name` | text | NO |  |
| `status` | text | NO | 'not_run'::text |
| `reachable` | boolean | YES |  |
| `parser_status` | text | YES |  |
| `records_discovered` | integer | NO | 0 |
| `records_stored` | integer | NO | 0 |
| `resources_discovered` | integer | NO | 0 |
| `last_checked_at` | timestamp with time zone | YES |  |
| `last_successful_run_at` | timestamp with time zone | YES |  |
| `last_failed_run_at` | timestamp with time zone | YES |  |
| `consecutive_failures` | integer | NO | 0 |
| `last_error` | text | YES |  |
| `metadata_json` | jsonb | NO | '{}'::jsonb |
| `updated_at` | timestamp with time zone | NO | now() |

### source_registry

- Rows: 28
- Decision: **keep** — Active application or infrastructure table.
- Active code references: `server/cli/dbVerify.js`, `server/dashboard/intelligenceService.js`, `server/lib/database/audit.js`, `server/lib/ingestion/core/catalogRepository.js`, `server/test/dashboardIntelligence.test.js`
- Nullable fields: base_url, jurisdiction, authority, public_label, internal_label, connector_name, ingestion_frequency, last_successful_run_at, last_failed_run_at, notes
- Last-update signal: updated_at = 2026-07-02T13:58:59.455Z
- Indexes: `source_registry_normalized_source_name_key`, `source_registry_pkey`, `source_registry_source_name_key`
- Foreign keys: none

| Column | Type | Nullable | Default |
|---|---|---|---|
| `id` | bigint | NO | nextval('source_registry_id_seq'::regclass) |
| `source_name` | text | NO |  |
| `normalized_source_name` | text | NO |  |
| `display_name` | text | NO |  |
| `source_type` | text | NO |  |
| `base_url` | text | YES |  |
| `country` | text | NO | 'India'::text |
| `jurisdiction` | text | YES |  |
| `authority` | text | YES |  |
| `reliability_tier` | smallint | NO | 3 |
| `public_label` | text | YES |  |
| `internal_label` | text | YES |  |
| `robots_policy` | text | NO | 'respect'::text |
| `connector_name` | text | YES |  |
| `ingestion_frequency` | text | YES |  |
| `enabled` | boolean | NO | true |
| `last_successful_run_at` | timestamp with time zone | YES |  |
| `last_failed_run_at` | timestamp with time zone | YES |  |
| `status` | text | NO | 'not_run'::text |
| `notes` | text | YES |  |
| `created_at` | timestamp with time zone | NO | now() |
| `updated_at` | timestamp with time zone | NO | now() |

### source_snapshots

- Rows: 413
- Decision: **keep** — Active application or infrastructure table.
- Active code references: none outside schema/migrations
- Nullable fields: html_hash, response_status
- Last-update signal: created_at = 2026-07-02T13:58:53.992Z
- Indexes: `source_snapshots_hash_idx`, `source_snapshots_pkey`, `source_snapshots_source_idx`
- Foreign keys: none

| Column | Type | Nullable | Default |
|---|---|---|---|
| `id` | bigint | NO |  |
| `source_name` | text | NO |  |
| `source_url` | text | NO |  |
| `content_sha256` | text | NO |  |
| `html_hash` | text | YES |  |
| `response_status` | integer | YES |  |
| `record_count` | integer | NO | 0 |
| `metadata_json` | jsonb | NO | '{}'::jsonb |
| `collected_at` | timestamp with time zone | NO |  |
| `created_at` | timestamp with time zone | NO | now() |

### system_events

- Rows: 0 (empty)
- Decision: **keep** — Normalized schema-v2 feature table; empty until the feature produces data.
- Active code references: `server/lib/database/audit.js`
- Nullable fields: none
- Last-update signal: created_at
- Indexes: `system_events_pkey`, `system_events_type_idx`
- Foreign keys: none

| Column | Type | Nullable | Default |
|---|---|---|---|
| `id` | bigint | NO | nextval('system_events_id_seq'::regclass) |
| `event_type` | text | NO |  |
| `severity` | text | NO | 'info'::text |
| `message` | text | NO |  |
| `metadata_json` | jsonb | NO | '{}'::jsonb |
| `created_at` | timestamp with time zone | NO | now() |

### topic_taxonomy

- Rows: 0 (empty)
- Decision: **keep** — Normalized schema-v2 feature table; empty until the feature produces data.
- Active code references: `server/lib/database/audit.js`
- Nullable fields: parent_id
- Last-update signal: none
- Indexes: `topic_taxonomy_pkey`, `topic_taxonomy_slug_key`
- Foreign keys: `topic_taxonomy_parent_id_fkey`: FOREIGN KEY (parent_id) REFERENCES topic_taxonomy(id) ON DELETE SET NULL

| Column | Type | Nullable | Default |
|---|---|---|---|
| `id` | bigint | NO | nextval('topic_taxonomy_id_seq'::regclass) |
| `slug` | text | NO |  |
| `name` | text | NO |  |
| `parent_id` | bigint | YES |  |
| `metadata_json` | jsonb | NO | '{}'::jsonb |

### user_activity_events

- Rows: 103
- Decision: **keep** — Active application or infrastructure table.
- Active code references: `server/activity/activityService.js`, `server/db.js`, `server/document/DocumentRepository.js`, `server/profile/profileService.js`, `server/test/activityPrivacy.test.js`
- Nullable fields: entity_type, entity_id, document_id, session_id, page_path, referrer, search_query
- Last-update signal: created_at = 2026-07-01T06:35:18.920Z
- Indexes: `user_activity_events_document_idx`, `user_activity_events_pkey`, `user_activity_events_type_idx`, `user_activity_events_user_recent_idx`
- Foreign keys: `user_activity_events_document_id_fkey`: FOREIGN KEY (document_id) REFERENCES legislative_documents(id) ON DELETE SET NULL; `user_activity_events_user_id_fkey`: FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE

| Column | Type | Nullable | Default |
|---|---|---|---|
| `id` | bigint | NO | nextval('user_activity_events_id_seq'::regclass) |
| `user_id` | bigint | NO |  |
| `event_type` | text | NO |  |
| `entity_type` | text | YES |  |
| `entity_id` | text | YES |  |
| `document_id` | bigint | YES |  |
| `session_id` | text | YES |  |
| `page_path` | text | YES |  |
| `referrer` | text | YES |  |
| `search_query` | text | YES |  |
| `filters_json` | jsonb | NO | '{}'::jsonb |
| `metadata_json` | jsonb | NO | '{}'::jsonb |
| `created_at` | timestamp with time zone | NO | now() |

### user_document_interactions

- Rows: 6
- Decision: **keep** — Active application or infrastructure table.
- Active code references: `server/activity/activityService.js`, `server/dashboard/intelligenceService.js`, `server/db.js`
- Nullable fields: none
- Last-update signal: none
- Indexes: `user_document_interactions_document_idx`, `user_document_interactions_pkey`, `user_document_interactions_user_id_document_id_interaction__key`, `user_document_interactions_user_recent_idx`
- Foreign keys: `user_document_interactions_document_id_fkey`: FOREIGN KEY (document_id) REFERENCES legislative_documents(id) ON DELETE CASCADE; `user_document_interactions_user_id_fkey`: FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE

| Column | Type | Nullable | Default |
|---|---|---|---|
| `id` | bigint | NO | nextval('user_document_interactions_id_seq'::regclass) |
| `user_id` | bigint | NO |  |
| `document_id` | bigint | NO |  |
| `interaction_type` | text | NO |  |
| `count` | integer | NO | 1 |
| `last_interacted_at` | timestamp with time zone | NO | now() |
| `metadata_json` | jsonb | NO | '{}'::jsonb |

### user_preferences

- Rows: 1
- Decision: **keep** — Active application or infrastructure table.
- Active code references: `server/lib/database/audit.js`
- Nullable fields: none
- Last-update signal: updated_at = 2026-07-01T04:50:54.068Z
- Indexes: `user_preferences_pkey`
- Foreign keys: `user_preferences_user_id_fkey`: FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE

| Column | Type | Nullable | Default |
|---|---|---|---|
| `user_id` | bigint | NO |  |
| `language` | text | NO | 'English'::text |
| `theme` | text | NO | 'system'::text |
| `timezone` | text | NO | 'Asia/Kolkata'::text |
| `notification_preferences` | jsonb | NO | '{}'::jsonb |
| `research_preferences` | jsonb | NO | '{}'::jsonb |
| `personalization_enabled` | boolean | NO | false |
| `updated_at` | timestamp with time zone | NO | now() |

### user_profiles

- Rows: 1
- Decision: **keep** — Active application or infrastructure table.
- Active code references: `server/dashboard/intelligenceService.js`, `server/db.js`, `server/document/DocumentRepository.js`, `server/lib/database/audit.js`, `server/profile/profileService.js`
- Nullable fields: username, bio, organization, designation, location, phone
- Last-update signal: updated_at = 2026-07-01T04:50:54.068Z
- Indexes: `user_profiles_pkey`, `user_profiles_username_key`
- Foreign keys: `user_profiles_user_id_fkey`: FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE

| Column | Type | Nullable | Default |
|---|---|---|---|
| `user_id` | bigint | NO |  |
| `username` | text | YES |  |
| `bio` | text | YES |  |
| `organization` | text | YES |  |
| `designation` | text | YES |  |
| `location` | text | YES |  |
| `phone` | text | YES |  |
| `timezone` | text | NO | 'Asia/Kolkata'::text |
| `language_preference` | text | NO | 'English'::text |
| `theme_preference` | text | NO | 'system'::text |
| `research_visibility` | text | NO | 'private'::text |
| `notification_preferences` | jsonb | NO | '{}'::jsonb |
| `research_interests` | jsonb | NO | '[]'::jsonb |
| `preferred_ministries` | jsonb | NO | '[]'::jsonb |
| `preferred_policy_areas` | jsonb | NO | '[]'::jsonb |
| `preferred_jurisdictions` | jsonb | NO | '[]'::jsonb |
| `preferred_document_types` | jsonb | NO | '[]'::jsonb |
| `preferred_sources` | jsonb | NO | '[]'::jsonb |
| `dashboard_widgets` | jsonb | NO | '[]'::jsonb |
| `updated_at` | timestamp with time zone | NO | now() |

### user_research_preferences

- Rows: 7
- Decision: **keep** — Active application or infrastructure table.
- Active code references: `server/activity/activityService.js`, `server/db.js`
- Nullable fields: consented_at, revoked_at, last_active_at
- Last-update signal: updated_at = 2026-07-02T05:37:46.919Z
- Indexes: `user_research_preferences_pkey`
- Foreign keys: `user_research_preferences_user_id_fkey`: FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE

| Column | Type | Nullable | Default |
|---|---|---|---|
| `user_id` | bigint | NO |  |
| `preferred_topics_json` | jsonb | NO | '[]'::jsonb |
| `preferred_jurisdictions_json` | jsonb | NO | '[]'::jsonb |
| `preferred_document_types_json` | jsonb | NO | '[]'::jsonb |
| `frequently_viewed_ministries_json` | jsonb | NO | '[]'::jsonb |
| `activity_tracking_enabled` | boolean | NO | false |
| `personalization_enabled` | boolean | NO | false |
| `consented_at` | timestamp with time zone | YES |  |
| `revoked_at` | timestamp with time zone | YES |  |
| `last_active_at` | timestamp with time zone | YES |  |
| `updated_at` | timestamp with time zone | NO | now() |

### user_sessions

- Rows: 22
- Decision: **keep** — Active application or infrastructure table.
- Active code references: `server/auth/sessionService.js`, `server/db.js`, `server/lib/database/audit.js`, `server/profile/profileService.js`
- Nullable fields: user_agent, ip_address, revoked_at
- Last-update signal: last_seen_at = 2026-07-02T13:20:54.743Z
- Indexes: `user_sessions_pkey`, `user_sessions_user_active_idx`
- Foreign keys: `user_sessions_user_id_fkey`: FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE

| Column | Type | Nullable | Default |
|---|---|---|---|
| `id` | text | NO |  |
| `user_id` | bigint | NO |  |
| `user_agent` | text | YES |  |
| `ip_address` | text | YES |  |
| `expires_at` | timestamp with time zone | NO |  |
| `last_seen_at` | timestamp with time zone | NO | now() |
| `revoked_at` | timestamp with time zone | YES |  |
| `created_at` | timestamp with time zone | NO | now() |

### users

- Rows: 8
- Decision: **keep** — Active application or infrastructure table.
- Active code references: `server/cli/verifyRelease.js`, `server/dashboard/intelligenceService.js`, `server/db.js`, `server/lib/database/audit.js`, `server/lib/vectordb.js`, `server/models/User.js`, `server/profile/profileService.js`, `server/test/activityPrivacy.test.js`
- Nullable fields: google_id, avatar, password
- Last-update signal: created_at = 2026-07-02T05:37:41.283Z
- Indexes: `users_email_key`, `users_google_id_key`, `users_pkey`
- Foreign keys: none

| Column | Type | Nullable | Default |
|---|---|---|---|
| `id` | bigint | NO | nextval('users_id_seq'::regclass) |
| `name` | text | NO |  |
| `email` | text | NO |  |
| `google_id` | text | YES |  |
| `avatar` | text | YES |  |
| `password` | text | YES |  |
| `is_admin` | boolean | NO | false |
| `created_at` | timestamp with time zone | NO | now() |

## Conclusions

- `legislative_documents` and its resource/chat companions are compatibility archives, not deletion candidates in this sprint.
- `documents`, normalized research tables, source registry/health, processing state, ingestion items, and audit tables are the long-term schema.
- Empty normalized feature tables are intentional capacity, not dead schema.
- Any future destructive cleanup requires a separate approved migration after a measured compatibility window.
