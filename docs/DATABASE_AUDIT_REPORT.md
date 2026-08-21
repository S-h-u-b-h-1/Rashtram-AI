# Database Audit Report

Generated from the configured PostgreSQL database at 2026-08-21T07:42:01.367Z.

No tables were deleted during this audit. Legacy tables remain available while schema-v2 mirrors preserve backward compatibility.

## Inventory summary

- Tables: 69
- Empty tables: 19
- Legacy compatibility tables: 9
- Universal documents: 19949
- Strictly research-ready documents: 3138
- Low-quality records (score below 40): 38
- Missing canonical source URL: 0
- Missing primary PDF resource: 2615
- Broken resource rows: 0
- Orphan sources/resources/messages: 0/0/0
- Duplicate canonical IDs: 0
- Invalid research-ready flags: 1564

## Table inventory

| Table | Rows | Code references | Classification | Last update |
|---|---:|---:|---|---|
| `act_chats` | 0 | 7 | legacy_archive | n/a |
| `application_schema_versions` | 1 | 3 | keep | 2026-08-10T03:39:20.971Z |
| `artifact_storage_migration_items` | 3245 | 3 | keep | 2026-08-11T21:08:04.865Z |
| `artifact_storage_migration_runs` | 134 | 4 | keep | 2026-08-11T21:08:06.014Z |
| `audit_logs` | 0 | 4 | keep | n/a |
| `bill_chats` | 0 | 7 | legacy_archive | n/a |
| `bookmarks` | 0 | 4 | keep | n/a |
| `bug_reports` | 0 | 3 | keep | n/a |
| `catalog_match_reviews` | 46 | 3 | keep | 2026-08-15T14:50:43.217Z |
| `contact_requests` | 0 | 5 | legacy_archive | n/a |
| `dashboard_metrics` | 7 | 4 | keep | n/a |
| `dedupe_candidates` | 0 | 5 | keep | n/a |
| `document_artifact_objects` | 3136 | 6 | keep | 2026-08-11T21:08:04.865Z |
| `document_catalogue_audit_checkpoints` | 1 | 2 | keep | 2026-07-11T04:27:46.616Z |
| `document_chat_feedback` | 1 | 4 | keep | 2026-07-11T05:30:50.247Z |
| `document_chats` | 57 | 8 | legacy_archive | 2026-08-16T10:18:01.344Z |
| `document_comparisons` | 32 | 9 | keep | 2026-08-15T06:45:05.468Z |
| `document_metadata` | 17741 | 3 | keep | 2026-07-02T09:40:26.800Z |
| `document_processing_attempts` | 2531 | 9 | keep | 2026-08-21T07:23:06.872Z |
| `document_processing_audit_log` | 15 | 4 | keep | 2026-07-13T11:08:33.465Z |
| `document_processing_jobs` | 6419 | 14 | keep | 2026-08-21T07:23:06.630Z |
| `document_processing_stages` | 10 | 3 | keep | 2026-08-21T07:23:06.131Z |
| `document_processing_state` | 19629 | 25 | keep | 2026-08-21T07:23:06.376Z |
| `document_processing_workers` | 379 | 3 | keep | n/a |
| `document_relationships` | 1172 | 12 | keep | 2026-08-11T21:00:27.294Z |
| `document_resources` | 20573 | 21 | keep | 2026-08-20T15:06:55.247Z |
| `document_retry_domain_state` | 18 | 5 | keep | 2026-08-11T20:57:32.956Z |
| `document_sources` | 20035 | 11 | keep | 2026-08-20T15:06:55.247Z |
| `document_text_artifacts` | 3145 | 16 | keep | 2026-08-16T08:47:40.830Z |
| `document_text_chunks` | 23551 | 17 | keep | 2026-08-21T07:23:05.048Z |
| `documents` | 19949 | 75 | keep | 2026-08-20T15:06:55.293Z |
| `egazette_chats` | 1 | 7 | legacy_archive | 2026-06-29T12:43:38.960Z |
| `feedback_submissions` | 0 | 3 | keep | n/a |
| `ingestion_run_items` | 15801 | 4 | keep | 2026-08-20T15:06:55.272Z |
| `ingestion_runs` | 822 | 9 | keep | 2026-08-20T15:06:55.280Z |
| `intelligence_events` | 1766 | 6 | keep | 2026-08-20T15:06:55.247Z |
| `knowledge_edges` | 0 | 7 | keep | n/a |
| `knowledge_evidence` | 0 | 8 | keep | n/a |
| `knowledge_nodes` | 0 | 7 | keep | n/a |
| `legislative_document_resources` | 20573 | 11 | legacy_archive | 2026-08-20T15:06:55.247Z |
| `legislative_documents` | 19949 | 40 | legacy_archive | 2026-08-20T15:06:55.247Z |
| `multi_document_chats` | 3 | 6 | legacy_archive | 2026-08-15T06:51:56.365Z |
| `policy_chats` | 0 | 5 | keep | n/a |
| `policy_drafts` | 0 | 2 | keep | n/a |
| `recommendations` | 414 | 21 | keep | 2026-08-16T10:21:54.080Z |
| `related_bills` | 3 | 5 | legacy_archive | 2026-06-27T14:11:37.515Z |
| `research_chats` | 57 | 5 | keep | 2026-08-16T10:18:01.344Z |
| `research_collection_items` | 1 | 5 | keep | 2026-06-30T19:30:03.994Z |
| `research_collections` | 1 | 5 | keep | 2026-06-30T19:29:49.229Z |
| `research_messages` | 166 | 5 | keep | 2026-08-16T09:47:10.630Z |
| `research_notes` | 5 | 6 | keep | 2026-07-02T05:42:39.893Z |
| `research_query_telemetry` | 0 | 3 | keep | n/a |
| `research_source_chunks` | 0 | 2 | keep | n/a |
| `research_sources` | 0 | 2 | keep | n/a |
| `saved_content` | 1 | 3 | keep | 2026-07-01T09:29:10.470Z |
| `saved_graph_paths` | 0 | 4 | keep | n/a |
| `saved_searches` | 1 | 5 | keep | 2026-08-16T09:46:45.300Z |
| `schema_migrations` | 32 | 6 | keep | 2026-08-21T06:49:44.467Z |
| `source_collection_snapshots` | 2029 | 5 | keep | 2026-08-20T15:06:52.055Z |
| `source_directory_entries` | 148 | 4 | keep | 2026-08-16T02:58:02.473Z |
| `source_health` | 31 | 4 | keep | 2026-08-20T15:06:55.288Z |
| `source_registry` | 34 | 7 | keep | 2026-08-20T15:06:55.284Z |
| `user_activity_events` | 0 | 8 | keep | n/a |
| `user_document_interactions` | 6 | 7 | keep | n/a |
| `user_preferences` | 2 | 5 | keep | 2026-08-11T05:25:49.559Z |
| `user_profiles` | 1 | 9 | keep | 2026-08-11T05:25:49.559Z |
| `user_research_preferences` | 5 | 5 | keep | 2026-08-15T05:53:47.581Z |
| `user_sessions` | 0 | 6 | keep | n/a |
| `users` | 10 | 15 | keep | 2026-07-23T07:01:01.289Z |

## Detailed table findings

### act_chats

- Rows: 0 (empty)
- Decision: **legacy_archive** — Preserved for backward compatibility while additive triggers mirror data into schema v2.
- Active code references: `server/dashboard/intelligenceService.js`, `server/db.js`, `server/lib/database/audit.js`, `server/lib/database/capacity.js`, `server/lib/database/maintenance.js`, `server/models/ActChat.js`, `server/profile/profileService.js`
- Nullable fields: act_status, pdf_url, summary
- Last-update signal: updated_at
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
- Active code references: `server/db.js`, `server/lib/database/capacity.js`, `server/test/streamingChat.test.js`
- Nullable fields: none
- Last-update signal: updated_at = 2026-08-10T03:39:20.971Z
- Indexes: `application_schema_versions_pkey`
- Foreign keys: none

| Column | Type | Nullable | Default |
|---|---|---|---|
| `id` | smallint | NO | 1 |
| `version` | bigint | NO |  |
| `updated_at` | timestamp with time zone | NO | now() |

### artifact_storage_migration_items

- Rows: 3245
- Decision: **keep** — Active application or infrastructure table.
- Active code references: `server/cli/dbVerify.js`, `server/lib/database/capacity.js`, `server/lib/storage/artifactMigration.js`
- Nullable fields: source_sha256, object_key, error_code, error_message
- Last-update signal: updated_at = 2026-08-11T21:08:04.865Z
- Indexes: `artifact_storage_migration_it_run_id_document_id_artifact_k_key`, `artifact_storage_migration_items_pkey`, `artifact_storage_migration_items_status_idx`
- Foreign keys: `artifact_storage_migration_items_document_id_fkey`: FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE; `artifact_storage_migration_items_run_id_fkey`: FOREIGN KEY (run_id) REFERENCES artifact_storage_migration_runs(id) ON DELETE CASCADE

| Column | Type | Nullable | Default |
|---|---|---|---|
| `id` | bigint | NO | nextval('artifact_storage_migration_items_id_seq'::regclass) |
| `run_id` | bigint | NO |  |
| `document_id` | bigint | NO |  |
| `artifact_kind` | text | NO |  |
| `source_sha256` | text | YES |  |
| `object_key` | text | YES |  |
| `status` | text | NO |  |
| `error_code` | text | YES |  |
| `error_message` | text | YES |  |
| `created_at` | timestamp with time zone | NO | now() |
| `updated_at` | timestamp with time zone | NO | now() |

### artifact_storage_migration_runs

- Rows: 134
- Decision: **keep** — Active application or infrastructure table.
- Active code references: `server/cli/dbVerify.js`, `server/lib/database/capacity.js`, `server/lib/storage/artifactMigration.js`, `server/test/capacityPlanning.test.js`
- Nullable fields: checkpoint_document_id, completed_at
- Last-update signal: completed_at = 2026-08-11T21:08:06.014Z
- Indexes: `artifact_storage_migration_runs_pkey`
- Foreign keys: none

| Column | Type | Nullable | Default |
|---|---|---|---|
| `id` | bigint | NO | nextval('artifact_storage_migration_runs_id_seq'::regclass) |
| `mode` | text | NO |  |
| `status` | text | NO |  |
| `requested_limit` | integer | NO |  |
| `checkpoint_document_id` | bigint | YES |  |
| `attempted_count` | integer | NO | 0 |
| `verified_count` | integer | NO | 0 |
| `failed_count` | integer | NO | 0 |
| `created_at` | timestamp with time zone | NO | now() |
| `completed_at` | timestamp with time zone | YES |  |

### audit_logs

- Rows: 0 (empty)
- Decision: **keep** — Normalized schema-v2 feature table; empty until the feature produces data.
- Active code references: `server/lib/database/audit.js`, `server/lib/database/capacity.js`, `server/lib/database/maintenance.js`, `server/profile/profileService.js`
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

- Rows: 0 (empty)
- Decision: **legacy_archive** — Preserved for backward compatibility while additive triggers mirror data into schema v2.
- Active code references: `server/dashboard/intelligenceService.js`, `server/db.js`, `server/lib/database/audit.js`, `server/lib/database/capacity.js`, `server/lib/database/maintenance.js`, `server/models/BillChat.js`, `server/profile/profileService.js`
- Nullable fields: bill_status, pdf_url, summary
- Last-update signal: updated_at
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

- Rows: 0 (empty)
- Decision: **keep** — Normalized schema-v2 feature table; empty until the feature produces data.
- Active code references: `server/lib/database/audit.js`, `server/lib/database/capacity.js`, `server/lib/database/maintenance.js`, `server/profile/profileService.js`
- Nullable fields: legacy_saved_content_id, document_id, external_document_id
- Last-update signal: created_at
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
- Active code references: `server/lib/database/audit.js`, `server/lib/database/capacity.js`, `server/profile/profileService.js`
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

- Rows: 46
- Decision: **keep** — Active application or infrastructure table.
- Active code references: `server/db.js`, `server/lib/database/capacity.js`, `server/lib/ingestion/core/catalogRepository.js`
- Nullable fields: reviewed_by, reviewed_at
- Last-update signal: created_at = 2026-08-15T14:50:43.217Z
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
- Active code references: `server/contact/route.js`, `server/db.js`, `server/lib/database/audit.js`, `server/lib/database/capacity.js`, `server/lib/database/maintenance.js`
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

### dashboard_metrics

- Rows: 7
- Decision: **keep** — Active application or infrastructure table.
- Active code references: `server/lib/database/audit.js`, `server/lib/database/capacity.js`, `server/lib/database/maintenance.js`, `server/lib/database/quality.js`
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
- Active code references: `server/cli/dbVerify.js`, `server/lib/database/audit.js`, `server/lib/database/capacity.js`, `server/lib/database/quality.js`, `server/test/databaseV2.test.js`
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

### document_artifact_objects

- Rows: 3136
- Decision: **keep** — Active application or infrastructure table.
- Active code references: `server/cli/dbVerify.js`, `server/document/documentResearchService.js`, `server/document/readinessService.js`, `server/lib/database/capacity.js`, `server/lib/storage/artifactMigration.js`, `server/test/capacityPlanning.test.js`
- Nullable fields: resource_id
- Last-update signal: updated_at = 2026-08-11T21:08:04.865Z
- Indexes: `document_artifact_objects_document_id_artifact_kind_sha256_key`, `document_artifact_objects_document_idx`, `document_artifact_objects_object_key_idx`, `document_artifact_objects_pkey`, `document_artifact_objects_resource_idx`
- Foreign keys: `document_artifact_objects_document_id_fkey`: FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE; `document_artifact_objects_resource_id_fkey`: FOREIGN KEY (resource_id) REFERENCES document_resources(id) ON DELETE SET NULL

| Column | Type | Nullable | Default |
|---|---|---|---|
| `id` | bigint | NO | nextval('document_artifact_objects_id_seq'::regclass) |
| `document_id` | bigint | NO |  |
| `resource_id` | bigint | YES |  |
| `artifact_kind` | text | NO |  |
| `source_locator` | text | NO |  |
| `object_key` | text | NO |  |
| `sha256` | text | NO |  |
| `mime_type` | text | NO |  |
| `byte_size` | bigint | NO |  |
| `processing_version` | text | NO |  |
| `status` | text | NO | 'verified'::text |
| `original_retained` | boolean | NO | true |
| `verified_at` | timestamp with time zone | NO |  |
| `created_at` | timestamp with time zone | NO | now() |
| `updated_at` | timestamp with time zone | NO | now() |

### document_catalogue_audit_checkpoints

- Rows: 1
- Decision: **keep** — Active application or infrastructure table.
- Active code references: `server/document/catalogueAuditService.js`, `server/lib/database/capacity.js`
- Nullable fields: completed_at
- Last-update signal: updated_at = 2026-07-11T04:27:46.616Z
- Indexes: `document_catalogue_audit_checkpoints_pkey`
- Foreign keys: none

| Column | Type | Nullable | Default |
|---|---|---|---|
| `audit_name` | text | NO |  |
| `last_document_id` | bigint | NO | 0 |
| `total_audited` | bigint | NO | 0 |
| `started_at` | timestamp with time zone | NO | now() |
| `updated_at` | timestamp with time zone | NO | now() |
| `completed_at` | timestamp with time zone | YES |  |

### document_chat_feedback

- Rows: 1
- Decision: **keep** — Active application or infrastructure table.
- Active code references: `server/db.js`, `server/lib/database/capacity.js`, `server/models/DocumentChat.js`, `server/profile/profileService.js`
- Nullable fields: reason
- Last-update signal: updated_at = 2026-07-11T05:30:50.247Z
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

- Rows: 57
- Decision: **legacy_archive** — Preserved for backward compatibility while additive triggers mirror data into schema v2.
- Active code references: `server/dashboard/intelligenceService.js`, `server/db.js`, `server/document/DocumentRepository.js`, `server/lib/database/audit.js`, `server/lib/database/capacity.js`, `server/lib/database/maintenance.js`, `server/models/DocumentChat.js`, `server/profile/profileService.js`
- Nullable fields: status, pdf_url, source_url, summary
- Last-update signal: updated_at = 2026-08-16T10:18:01.344Z
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

- Rows: 32
- Decision: **keep** — Active application or infrastructure table.
- Active code references: `server/cli/documentsInspect.js`, `server/db.js`, `server/document/documentComparisonService.js`, `server/document/documentsRoute.js`, `server/document/processingWorkerService.js`, `server/lib/database/audit.js`, `server/lib/database/capacity.js`, `server/lib/database/maintenance.js`, `server/profile/profileService.js`
- Nullable fields: user_question
- Last-update signal: updated_at = 2026-08-15T06:45:05.468Z
- Indexes: `document_comparisons_documents_gin_idx`, `document_comparisons_pkey`, `document_comparisons_user_recent_idx`
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
| `user_question` | text | YES |  |
| `recommended_documents_json` | jsonb | NO | '[]'::jsonb |

### document_metadata

- Rows: 17741
- Decision: **keep** — Active application or infrastructure table.
- Active code references: `server/lib/database/audit.js`, `server/lib/database/capacity.js`, `server/lib/database/maintenance.js`
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

### document_processing_attempts

- Rows: 2531
- Decision: **keep** — Active application or infrastructure table.
- Active code references: `server/cli/processConsistency.js`, `server/cli/repairProcessingConsistency.js`, `server/document/readinessService.js`, `server/document/semanticBackfillService.js`, `server/document/semanticCoverageService.js`, `server/lib/database/capacity.js`, `server/lib/database/maintenance.js`, `server/test/databaseV2.test.js`, `server/test/queueWaitOverflow.test.js`
- Nullable fields: worker_id, failure_stage, failure_reason, memory_peak_bytes, queue_wait_ms, duration_ms, completed_at, pipeline_stage, failure_code, input_checksum_sha256, output_checksum_sha256, extraction_method, ai_provider, ai_model, estimated_cost_usd
- Last-update signal: completed_at = 2026-08-21T07:23:06.872Z
- Indexes: `document_processing_attempts_document_idx`, `document_processing_attempts_failure_code_idx`, `document_processing_attempts_job_id_attempt_key`, `document_processing_attempts_performance_idx`, `document_processing_attempts_pkey`, `processing_attempts_semantic_backfill_idx`
- Foreign keys: `document_processing_attempts_document_id_fkey`: FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE; `document_processing_attempts_job_id_fkey`: FOREIGN KEY (job_id) REFERENCES document_processing_jobs(id) ON DELETE CASCADE

| Column | Type | Nullable | Default |
|---|---|---|---|
| `id` | bigint | NO | nextval('document_processing_attempts_id_seq'::regclass) |
| `job_id` | bigint | NO |  |
| `document_id` | bigint | NO |  |
| `worker_id` | text | YES |  |
| `attempt` | integer | NO |  |
| `status` | text | NO |  |
| `failure_stage` | text | YES |  |
| `failure_reason` | text | YES |  |
| `stage_metrics_json` | jsonb | NO | '{}'::jsonb |
| `usage_json` | jsonb | NO | '{}'::jsonb |
| `memory_peak_bytes` | bigint | YES |  |
| `queue_wait_ms` | integer | YES |  |
| `duration_ms` | integer | YES |  |
| `started_at` | timestamp with time zone | NO | now() |
| `completed_at` | timestamp with time zone | YES |  |
| `pipeline_stage` | text | YES |  |
| `failure_code` | text | YES |  |
| `retry_eligible` | boolean | NO | true |
| `failure_detail_json` | jsonb | NO | '{}'::jsonb |
| `input_checksum_sha256` | text | YES |  |
| `output_checksum_sha256` | text | YES |  |
| `extraction_method` | text | YES |  |
| `ai_provider` | text | YES |  |
| `ai_model` | text | YES |  |
| `estimated_cost_usd` | numeric | YES |  |

### document_processing_audit_log

- Rows: 15
- Decision: **keep** — Active application or infrastructure table.
- Active code references: `server/cli/repairProcessingConsistency.js`, `server/lib/database/capacity.js`, `server/lib/database/maintenance.js`, `server/test/databaseV2.test.js`
- Nullable fields: none
- Last-update signal: created_at = 2026-07-13T11:08:33.465Z
- Indexes: `document_processing_audit_log_action_idx`, `document_processing_audit_log_document_idx`, `document_processing_audit_log_pkey`
- Foreign keys: `document_processing_audit_log_document_id_fkey`: FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE

| Column | Type | Nullable | Default |
|---|---|---|---|
| `id` | bigint | NO | nextval('document_processing_audit_log_id_seq'::regclass) |
| `document_id` | bigint | NO |  |
| `action` | text | NO |  |
| `previous_state_json` | jsonb | NO | '{}'::jsonb |
| `new_state_json` | jsonb | NO | '{}'::jsonb |
| `evidence_json` | jsonb | NO | '{}'::jsonb |
| `performed_by` | text | NO | 'system'::text |
| `created_at` | timestamp with time zone | NO | now() |

### document_processing_jobs

- Rows: 6419
- Decision: **keep** — Active application or infrastructure table.
- Active code references: `server/cli/documentReadiness.js`, `server/cli/documentsInspect.js`, `server/cli/processConsistency.js`, `server/cli/processRetryable.js`, `server/cli/repairProcessingConsistency.js`, `server/cli/runDownloadRecoveryBatch.js`, `server/document/catalogueAuditService.js`, `server/document/processingWorkerService.js`, `server/document/readinessService.js`, `server/document/semanticBackfillService.js`, `server/lib/database/capacity.js`, `server/lib/database/maintenance.js`, `server/profile/profileService.js`, `server/test/databaseV2.test.js`
- Nullable fields: requested_by, failure_reason, started_at, completed_at, worker_id, source_host, claimed_at, heartbeat_at, duration_ms, queue_wait_ms, memory_peak_bytes, failure_code, pipeline_stage, input_checksum_sha256, output_checksum_sha256, extraction_method, worker_version, estimated_cost_usd, retry_decision, retry_after_seconds, circuit_opened_at
- Last-update signal: updated_at = 2026-08-21T07:23:06.630Z
- Indexes: `document_processing_jobs_active_idx`, `document_processing_jobs_claim_idx`, `document_processing_jobs_failure_code_idx`, `document_processing_jobs_pkey`, `document_processing_jobs_queue_idx`, `document_processing_jobs_retry_decision_idx`, `document_processing_jobs_source_idx`
- Foreign keys: `document_processing_jobs_document_id_fkey`: FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE; `document_processing_jobs_requested_by_fkey`: FOREIGN KEY (requested_by) REFERENCES users(id) ON DELETE SET NULL

| Column | Type | Nullable | Default |
|---|---|---|---|
| `id` | bigint | NO | nextval('document_processing_jobs_id_seq'::regclass) |
| `document_id` | bigint | NO |  |
| `requested_by` | integer | YES |  |
| `status` | text | NO | 'queued'::text |
| `priority` | integer | NO | 50 |
| `attempt` | integer | NO | 0 |
| `failure_reason` | text | YES |  |
| `metadata_json` | jsonb | NO | '{}'::jsonb |
| `queued_at` | timestamp with time zone | NO | now() |
| `started_at` | timestamp with time zone | YES |  |
| `completed_at` | timestamp with time zone | YES |  |
| `updated_at` | timestamp with time zone | NO | now() |
| `worker_id` | text | YES |  |
| `source_host` | text | YES |  |
| `max_attempts` | integer | NO | 3 |
| `next_attempt_at` | timestamp with time zone | NO | now() |
| `claimed_at` | timestamp with time zone | YES |  |
| `heartbeat_at` | timestamp with time zone | YES |  |
| `duration_ms` | integer | YES |  |
| `queue_wait_ms` | integer | YES |  |
| `stage_metrics_json` | jsonb | NO | '{}'::jsonb |
| `usage_json` | jsonb | NO | '{}'::jsonb |
| `memory_peak_bytes` | bigint | YES |  |
| `failure_code` | text | YES |  |
| `retry_eligible` | boolean | NO | true |
| `pipeline_stage` | text | YES |  |
| `input_checksum_sha256` | text | YES |  |
| `output_checksum_sha256` | text | YES |  |
| `extraction_method` | text | YES |  |
| `worker_version` | text | YES |  |
| `estimated_cost_usd` | numeric | YES |  |
| `retry_decision` | text | YES |  |
| `retry_after_seconds` | integer | YES |  |
| `circuit_opened_at` | timestamp with time zone | YES |  |

### document_processing_stages

- Rows: 10
- Decision: **keep** — Active application or infrastructure table.
- Active code references: `server/cli/dbVerify.js`, `server/document/processingStageService.js`, `server/test/databaseV2.test.js`
- Nullable fields: job_id, failure_category, failure_reason, input_hash, output_hash, duration_ms, started_at, completed_at
- Last-update signal: updated_at = 2026-08-21T07:23:06.131Z
- Indexes: `document_processing_stages_document_id_stage_key`, `document_processing_stages_job_idx`, `document_processing_stages_pkey`, `document_processing_stages_resume_idx`
- Foreign keys: `document_processing_stages_document_id_fkey`: FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE; `document_processing_stages_job_id_fkey`: FOREIGN KEY (job_id) REFERENCES document_processing_jobs(id) ON DELETE SET NULL

| Column | Type | Nullable | Default |
|---|---|---|---|
| `id` | bigint | NO | nextval('document_processing_stages_id_seq'::regclass) |
| `document_id` | bigint | NO |  |
| `job_id` | bigint | YES |  |
| `stage` | text | NO |  |
| `status` | text | NO | 'pending'::text |
| `attempt_count` | integer | NO | 0 |
| `failure_category` | text | YES |  |
| `failure_reason` | text | YES |  |
| `retryable` | boolean | NO | true |
| `input_hash` | text | YES |  |
| `output_hash` | text | YES |  |
| `processor_version` | text | NO |  |
| `duration_ms` | integer | YES |  |
| `metadata_json` | jsonb | NO | '{}'::jsonb |
| `started_at` | timestamp with time zone | YES |  |
| `completed_at` | timestamp with time zone | YES |  |
| `created_at` | timestamp with time zone | NO | now() |
| `updated_at` | timestamp with time zone | NO | now() |

### document_processing_state

- Rows: 19629
- Decision: **keep** — Active application or infrastructure table.
- Active code references: `server/cli/dbVerify.js`, `server/cli/documentReadiness.js`, `server/cli/downloadAlternatives.js`, `server/cli/downloadFailures.js`, `server/cli/processBacklog.js`, `server/cli/processConsistency.js`, `server/cli/processFailures.js`, `server/cli/processPolicyBatch.js`, `server/cli/processRetryable.js`, `server/cli/repairProcessingConsistency.js`, `server/cli/researchEval.js`, `server/cli/researchReadyAudit.js`, `server/cli/runDownloadRecoveryBatch.js`, `server/document/DocumentRepository.js`, `server/document/catalogueAuditService.js`, `server/document/processingStageService.js`, `server/document/processingWorkerService.js`, `server/document/readinessService.js`, `server/document/recommendationService.js`, `server/document/semanticBackfillService.js`, `server/document/semanticCoverageService.js`, `server/lib/database/audit.js`, `server/lib/database/capacity.js`, `server/lib/database/maintenance.js`, `server/lib/database/quality.js`
- Nullable fields: error_message, embedding_provider, ai_provider, last_processed_at, language, script, failure_stage, failure_reason, readiness_reason, last_attempted_at, retrieval_verified_at, failure_code, pipeline_stage, input_checksum_sha256, output_checksum_sha256, extraction_method, worker_version, estimated_cost_usd, capabilities_updated_at
- Last-update signal: updated_at = 2026-08-21T07:23:06.376Z
- Indexes: `document_processing_readiness_idx`, `document_processing_retry_idx`, `document_processing_state_capabilities_idx`, `document_processing_state_failure_code_idx`, `document_processing_state_pipeline_stage_idx`, `document_processing_state_pkey`, `document_processing_state_retrieval_verified_idx`, `document_processing_state_semantic_backlog_idx`
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
| `pdf_status` | text | NO | 'unknown'::text |
| `chunking_status` | text | NO | 'not_started'::text |
| `research_ready` | boolean | NO | false |
| `comparison_ready` | boolean | NO | false |
| `embeddings_count` | integer | NO | 0 |
| `text_length` | integer | NO | 0 |
| `language` | text | YES |  |
| `script` | text | YES |  |
| `is_bilingual` | boolean | NO | false |
| `retry_count` | integer | NO | 0 |
| `failure_stage` | text | YES |  |
| `failure_reason` | text | YES |  |
| `failure_details_json` | jsonb | NO | '{}'::jsonb |
| `readiness_class` | text | NO | 'source_only'::text |
| `readiness_reason` | text | YES |  |
| `last_attempted_at` | timestamp with time zone | YES |  |
| `retrieval_mode` | text | NO | 'unknown'::text |
| `retrieval_verified` | boolean | NO | false |
| `retrieval_verified_at` | timestamp with time zone | YES |  |
| `failure_code` | text | YES |  |
| `retry_eligible` | boolean | NO | true |
| `pipeline_stage` | text | YES |  |
| `input_checksum_sha256` | text | YES |  |
| `output_checksum_sha256` | text | YES |  |
| `extraction_method` | text | YES |  |
| `extraction_quality_json` | jsonb | NO | '{}'::jsonb |
| `worker_version` | text | YES |  |
| `estimated_cost_usd` | numeric | YES |  |
| `catalogued` | boolean | NO | false |
| `resource_ready` | boolean | NO | false |
| `text_ready` | boolean | NO | false |
| `search_ready` | boolean | NO | false |
| `semantic_ready` | boolean | NO | false |
| `chat_ready` | boolean | NO | false |
| `capability_comparison_ready` | boolean | NO | false |
| `capabilities_updated_at` | timestamp with time zone | YES |  |

### document_processing_workers

- Rows: 379
- Decision: **keep** — Active application or infrastructure table.
- Active code references: `server/document/processingWorkerService.js`, `server/document/readinessService.js`, `server/lib/database/capacity.js`
- Nullable fields: current_document_id
- Last-update signal: none
- Indexes: `document_processing_workers_pkey`
- Foreign keys: `document_processing_workers_current_document_id_fkey`: FOREIGN KEY (current_document_id) REFERENCES documents(id) ON DELETE SET NULL

| Column | Type | Nullable | Default |
|---|---|---|---|
| `worker_id` | text | NO |  |
| `status` | text | NO | 'idle'::text |
| `concurrency` | integer | NO | 1 |
| `current_document_id` | bigint | YES |  |
| `processed_count` | integer | NO | 0 |
| `failed_count` | integer | NO | 0 |
| `started_at` | timestamp with time zone | NO | now() |
| `heartbeat_at` | timestamp with time zone | NO | now() |
| `metadata_json` | jsonb | NO | '{}'::jsonb |

### document_relationships

- Rows: 1172
- Decision: **keep** — Active application or infrastructure table.
- Active code references: `server/cli/verifyGraph.js`, `server/db.js`, `server/document/DocumentRepository.js`, `server/document/processingWorkerService.js`, `server/document/recommendationService.js`, `server/egazette/egazetteService.js`, `server/graph/knowledgeGraphService.js`, `server/graph/relationshipEngine.js`, `server/lib/database/audit.js`, `server/lib/database/capacity.js`, `server/lib/ingestion/core/catalogRepository.js`, `server/test/knowledgeLayerV1.test.js`
- Nullable fields: source_name, confidence, source_url, relationship_strength, relationship_source, explanation, source_document_id, target_document_id
- Last-update signal: updated_at = 2026-08-11T21:00:27.294Z
- Indexes: `document_relationships_confidence_idx`, `document_relationships_evidence_gin_idx`, `document_relationships_from_document_id_to_document_id_rela_key`, `document_relationships_from_idx`, `document_relationships_pkey`, `document_relationships_source_type_strength_idx`, `document_relationships_target_type_strength_idx`, `document_relationships_to_idx`
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
| `relationship_strength` | numeric | YES |  |
| `relationship_source` | text | YES |  |
| `explanation` | text | YES |  |
| `relationship_evidence` | jsonb | NO | '{}'::jsonb |
| `source_document_id` | bigint | YES |  |
| `target_document_id` | bigint | YES |  |

### document_resources

- Rows: 20573
- Decision: **keep** — Active application or infrastructure table.
- Active code references: `server/cli/dbVerify.js`, `server/cli/documentReadiness.js`, `server/cli/documentsInspect.js`, `server/cli/downloadAlternatives.js`, `server/cli/downloadFailures.js`, `server/cli/processConsistency.js`, `server/cli/processFailures.js`, `server/cli/processRetryable.js`, `server/cli/researchReadyAudit.js`, `server/document/DocumentRepository.js`, `server/document/catalogueAuditService.js`, `server/document/readinessContract.js`, `server/document/readinessService.js`, `server/document/recommendationService.js`, `server/lib/database/audit.js`, `server/lib/database/capacity.js`, `server/lib/database/cockroachSqlCompat.js`, `server/lib/database/legacySyncService.js`, `server/lib/database/maintenance.js`, `server/lib/database/quality.js`, `server/test/databaseMaintenance.test.js`
- Nullable fields: source_id, label, mime_type, file_extension, file_size, language, hash_sha256, last_checked_at
- Last-update signal: updated_at = 2026-08-20T15:06:55.247Z
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

### document_retry_domain_state

- Rows: 18
- Decision: **keep** — Active application or infrastructure table.
- Active code references: `server/cli/runDownloadRecoveryBatch.js`, `server/document/processingWorkerService.js`, `server/document/sourceRetryPolicy.js`, `server/lib/database/capacity.js`, `server/test/databaseV2.test.js`
- Nullable fields: cooldown_until, last_request_at, last_success_at, last_failure_at, last_status_code, last_failure_code, last_failure_reason
- Last-update signal: updated_at = 2026-08-11T20:57:32.956Z
- Indexes: `document_retry_domain_state_cooldown_idx`, `document_retry_domain_state_pkey`
- Foreign keys: none

| Column | Type | Nullable | Default |
|---|---|---|---|
| `source_host` | text | NO |  |
| `policy_json` | jsonb | NO | '{}'::jsonb |
| `circuit_state` | text | NO | 'closed'::text |
| `cooldown_until` | timestamp with time zone | YES |  |
| `window_started_at` | timestamp with time zone | NO | now() |
| `window_attempts` | integer | NO | 0 |
| `window_failures` | integer | NO | 0 |
| `consecutive_failures` | integer | NO | 0 |
| `total_attempts` | bigint | NO | 0 |
| `total_successes` | bigint | NO | 0 |
| `total_failures` | bigint | NO | 0 |
| `last_request_at` | timestamp with time zone | YES |  |
| `last_success_at` | timestamp with time zone | YES |  |
| `last_failure_at` | timestamp with time zone | YES |  |
| `last_status_code` | integer | YES |  |
| `last_failure_code` | text | YES |  |
| `last_failure_reason` | text | YES |  |
| `circuit_activations` | integer | NO | 0 |
| `metadata_json` | jsonb | NO | '{}'::jsonb |
| `created_at` | timestamp with time zone | NO | now() |
| `updated_at` | timestamp with time zone | NO | now() |

### document_sources

- Rows: 20035
- Decision: **keep** — Active application or infrastructure table.
- Active code references: `server/cli/dbVerify.js`, `server/dashboard/intelligenceService.js`, `server/db.js`, `server/document/DocumentRepository.js`, `server/lib/database/audit.js`, `server/lib/database/capacity.js`, `server/lib/database/legacySyncService.js`, `server/lib/database/maintenance.js`, `server/lib/ingestion/core/catalogRepository.js`, `server/lib/ingestion/core/healthCheck.js`, `server/test/sourceIdentity.test.js`
- Nullable fields: detail_url, pdf_url, legal_identifier, content_hash, text_fingerprint, pdf_hash, html_hash, source_title, source_status, file_hash, mime_type, file_size_bytes, source_type, normalized_source_name, canonical_url, raw_title, raw_status, collected_at
- Last-update signal: updated_at = 2026-08-20T15:06:55.247Z
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

- Rows: 3145
- Decision: **keep** — Active application or infrastructure table.
- Active code references: `server/cli/dbVerify.js`, `server/cli/downloadFailures.js`, `server/cli/processFailures.js`, `server/cli/repairProcessingConsistency.js`, `server/cli/runDownloadRecoveryBatch.js`, `server/db.js`, `server/document/documentResearchService.js`, `server/document/readinessService.js`, `server/graph/relationshipEngine.js`, `server/lib/database/capacity.js`, `server/lib/database/legacySyncService.js`, `server/lib/database/maintenance.js`, `server/lib/storage/artifactMigration.js`, `server/policy/draftRoute.js`, `server/profile/profileService.js`, `server/test/capacityPlanning.test.js`
- Nullable fields: language_confidence, english_summary, pdf_quality_class, extracted_text_sha256
- Last-update signal: updated_at = 2026-08-16T08:47:40.830Z
- Indexes: `document_text_artifacts_extracted_hash_idx`, `document_text_artifacts_language_idx`, `document_text_artifacts_pkey`
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
| `summary_json` | jsonb | NO | '{}'::jsonb |
| `pdf_quality_class` | text | YES |  |
| `pdf_quality_json` | jsonb | NO | '{}'::jsonb |
| `extracted_text_sha256` | text | YES |  |

### document_text_chunks

- Rows: 23551
- Decision: **keep** — Active application or infrastructure table.
- Active code references: `server/cli/dbVerify.js`, `server/cli/documentReadiness.js`, `server/cli/documentsInspect.js`, `server/cli/researchEval.js`, `server/cli/researchReadyAudit.js`, `server/cli/runDownloadRecoveryBatch.js`, `server/document/catalogueAuditService.js`, `server/document/documentResearchService.js`, `server/document/readinessContract.js`, `server/document/readinessService.js`, `server/document/semanticBackfillService.js`, `server/document/semanticCoverageService.js`, `server/lib/database/audit.js`, `server/lib/database/capacity.js`, `server/lib/database/maintenance.js`, `server/test/databaseMaintenance.test.js`, `server/test/embeddingContentHashCache.test.js`
- Nullable fields: translated_text, token_count, vector_reference, content_hash, embedding_namespace, chunk_sha256, embedding_input_sha256
- Last-update signal: updated_at = 2026-08-21T07:23:05.048Z
- Indexes: `document_text_chunks_chunk_sha_idx`, `document_text_chunks_content_hash_idx`, `document_text_chunks_document_id_chunk_index_key`, `document_text_chunks_document_idx`, `document_text_chunks_namespace_document_idx`, `document_text_chunks_original_text_fts_idx`, `document_text_chunks_pkey`
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
| `content_hash` | text | YES |  |
| `embedding_namespace` | text | YES |  |
| `chunk_sha256` | text | YES |  |
| `embedding_input_sha256` | text | YES |  |

### documents

- Rows: 19949
- Decision: **keep** — Active application or infrastructure table.
- Active code references: `server/act/actsRoute.js`, `server/bill/billsRoute.js`, `server/cli/backfillSemanticCoverage.js`, `server/cli/dbVerify.js`, `server/cli/documentReadiness.js`, `server/cli/documentsInspect.js`, `server/cli/downloadAlternatives.js`, `server/cli/downloadFailures.js`, `server/cli/ingestPolicyEdge.js`, `server/cli/processBacklog.js`, `server/cli/processConsistency.js`, `server/cli/processFailures.js`, `server/cli/processPolicyBatch.js`, `server/cli/processRetryable.js`, `server/cli/repairProcessingConsistency.js`, `server/cli/researchEval.js`, `server/cli/researchReadyAudit.js`, `server/cli/runDownloadRecoveryBatch.js`, `server/cli/verifyProcessingConfig.js`, `server/cli/verifyRelease.js`, `server/dashboard/intelligenceService.js`, `server/document/DocumentRepository.js`, `server/document/catalogueAuditService.js`, `server/document/documentComparisonService.js`, `server/document/documentsRoute.js`, `server/document/failureTaxonomy.js`, `server/document/processingWorkerService.js`, `server/document/readinessService.js`, `server/document/recommendationService.js`, `server/document/semanticBackfillService.js`, `server/document/semanticCoverageService.js`, `server/egazette/egazetteService.js`, `server/evaluation/ragEvalV1.js`, `server/evaluation/researchBenchmarks.js`, `server/graph/knowledgeGraphService.js`, `server/graph/relationshipEngine.js`, `server/lib/catalogRepository.js`, `server/lib/catalogService.js`, `server/lib/database/audit.js`, `server/lib/database/capacity.js`, `server/lib/database/cockroachSqlCompat.js`, `server/lib/database/legacySyncService.js`, `server/lib/database/maintenance.js`, `server/lib/database/quality.js`, `server/lib/ingestion/connectors/governanceSourceConnectors.js`, `server/lib/ingestion/connectors/prsConnector.js`, `server/lib/ingestion/core/catalogRepository.js`, `server/lib/ingestion/core/healthCheck.js`, `server/lib/ingestion/core/sourceIdentity.js`, `server/lib/pdfProcessor.js`, `server/lib/prsCatalog.js`, `server/lib/storage/artifactMigration.js`, `server/lib/vectordb.js`, `server/policy/draftRoute.js`, `server/retrieval/evidenceSafetyService.js`, `server/retrieval/researchCache.js`, `server/scripts/ingest-prs-catalog.js`, `server/server.js`, `server/test/capacityPlanning.test.js`, `server/test/cockroachMigrationAudit.test.js`, `server/test/dashboardIntelligence.test.js`, `server/test/databaseMaintenance.test.js`, `server/test/documentComparison.test.js`, `server/test/ingestionCore.test.js`, `server/test/ingestionHealth.test.js`, `server/test/knowledgeLayerV1.test.js`, `server/test/ocrFailureClassification.test.js`, `server/test/processingConfigPreflight.test.js`, `server/test/profileUiContract.test.js`, `server/test/prsCatalog.test.js`, `server/test/ragEvalV1.test.js`, `server/test/retrievalEngineV3.test.js`, `server/test/semanticCoverageV1.test.js`, `server/test/sourceConnectors.test.js`, `server/test/sourceIdentity.test.js`
- Nullable fields: document_subtype, jurisdiction_level, jurisdiction, state, authority, ministry, department, category, status, year, publication_date, introduced_date, passed_date, assent_date, commencement_date, effective_date, legal_identifier, bill_number, act_number, gazette_identifier, canonical_source_id, canonical_url, primary_pdf_resource_id, search_vector, source_specific_id, alternate_title, source_authority_tier, original_source_page, original_file_url, object_storage_path, file_checksum_sha256, retrieval_date, last_source_update_at, expiry_date, regulator, sector, topic, legislative_status, notification_number, gazette_number, session, version, parent_document_id, extraction_version, content_fingerprint_sha256
- Last-update signal: updated_at = 2026-08-20T15:06:55.293Z
- Indexes: `documents_canonical_id_key`, `documents_comparison_ready_idx`, `documents_content_fingerprint_sha256_idx`, `documents_first_seen_idx`, `documents_jurisdiction_idx`, `documents_ministry_idx`, `documents_pkey`, `documents_publication_idx`, `documents_quality_idx`, `documents_regulator_idx`, `documents_research_ready_idx`, `documents_sector_topic_idx`, `documents_source_specific_idx`, `documents_state_idx`, `documents_type_idx`, `documents_updated_idx`, `documents_year_idx`
- Foreign keys: `documents_canonical_source_id_fkey`: FOREIGN KEY (canonical_source_id) REFERENCES source_registry(id) ON DELETE SET NULL; `documents_parent_document_id_fkey`: FOREIGN KEY (parent_document_id) REFERENCES documents(id) ON DELETE SET NULL; `documents_primary_pdf_resource_fk`: FOREIGN KEY (primary_pdf_resource_id) REFERENCES document_resources(id) ON DELETE SET NULL DEFERRABLE INITIALLY DEFERRED

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
| `comparison_ready` | boolean | NO | false |
| `source_specific_id` | text | YES |  |
| `alternate_title` | text | YES |  |
| `source_authority_tier` | text | YES |  |
| `original_source_page` | text | YES |  |
| `original_file_url` | text | YES |  |
| `object_storage_path` | text | YES |  |
| `file_checksum_sha256` | text | YES |  |
| `retrieval_date` | timestamp with time zone | YES |  |
| `last_source_update_at` | timestamp with time zone | YES |  |
| `expiry_date` | date | YES |  |
| `regulator` | text | YES |  |
| `sector` | text | YES |  |
| `topic` | text | YES |  |
| `legislative_status` | text | YES |  |
| `notification_number` | text | YES |  |
| `gazette_number` | text | YES |  |
| `session` | text | YES |  |
| `version` | text | YES |  |
| `parent_document_id` | bigint | YES |  |
| `validation_status` | text | NO | 'unverified'::text |
| `extraction_version` | text | YES |  |
| `content_fingerprint_sha256` | text | YES |  |

### egazette_chats

- Rows: 1
- Decision: **legacy_archive** — Preserved for backward compatibility while additive triggers mirror data into schema v2.
- Active code references: `server/db.js`, `server/egazette/egazetteService.js`, `server/lib/database/audit.js`, `server/lib/database/capacity.js`, `server/lib/database/maintenance.js`, `server/models/EGazetteChat.js`, `server/profile/profileService.js`
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
- Active code references: `server/lib/database/audit.js`, `server/lib/database/capacity.js`, `server/profile/profileService.js`
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

- Rows: 15801
- Decision: **keep** — Active application or infrastructure table.
- Active code references: `server/lib/database/audit.js`, `server/lib/database/capacity.js`, `server/lib/database/maintenance.js`, `server/lib/ingestion/core/catalogRepository.js`
- Nullable fields: source_record_id, document_id, action, error_message
- Last-update signal: created_at = 2026-08-20T15:06:55.272Z
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

- Rows: 822
- Decision: **keep** — Active application or infrastructure table.
- Active code references: `server/dashboard/intelligenceService.js`, `server/db.js`, `server/lib/catalogRepository.js`, `server/lib/database/audit.js`, `server/lib/database/capacity.js`, `server/lib/database/maintenance.js`, `server/lib/ingestion/core/catalogRepository.js`, `server/lib/ingestion/core/healthCheck.js`, `server/test/ingestionRunReaper.test.js`
- Nullable fields: completed_at, collection_name
- Last-update signal: completed_at = 2026-08-20T15:06:55.280Z
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

- Rows: 1766
- Decision: **keep** — Active application or infrastructure table.
- Active code references: `server/dashboard/intelligenceService.js`, `server/db.js`, `server/document/DocumentRepository.js`, `server/lib/database/audit.js`, `server/lib/database/capacity.js`, `server/lib/ingestion/core/catalogRepository.js`
- Nullable fields: event_key, summary, document_id, source_url, document_type, jurisdiction, authority, ministry, category, status, event_date
- Last-update signal: updated_at = 2026-08-20T15:06:55.247Z
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

### knowledge_edges

- Rows: 0 (empty)
- Decision: **keep** — Normalized schema-v2 feature table; empty until the feature produces data.
- Active code references: `server/cli/dbVerify.js`, `server/graph/knowledgeLayerService.js`, `server/lib/database/audit.js`, `server/lib/database/capacity.js`, `server/lib/database/maintenance.js`, `server/test/databaseV2.test.js`, `server/test/knowledgeLayerV1.test.js`
- Nullable fields: confidence, model_version
- Last-update signal: updated_at
- Indexes: `knowledge_edges_pkey`, `knowledge_edges_source_idx`, `knowledge_edges_source_node_id_relationship_type_target_nod_key`, `knowledge_edges_target_idx`
- Foreign keys: `knowledge_edges_source_node_id_fkey`: FOREIGN KEY (source_node_id) REFERENCES knowledge_nodes(id) ON DELETE CASCADE; `knowledge_edges_target_node_id_fkey`: FOREIGN KEY (target_node_id) REFERENCES knowledge_nodes(id) ON DELETE CASCADE

| Column | Type | Nullable | Default |
|---|---|---|---|
| `id` | bigint | NO | nextval('knowledge_edges_id_seq'::regclass) |
| `source_node_id` | bigint | NO |  |
| `relationship_type` | text | NO |  |
| `target_node_id` | bigint | NO |  |
| `verification_status` | text | NO | 'MODEL_EXTRACTED'::text |
| `confidence` | numeric | YES |  |
| `generation_method` | text | NO | 'deterministic'::text |
| `model_version` | text | YES |  |
| `metadata_json` | jsonb | NO | '{}'::jsonb |
| `created_at` | timestamp with time zone | NO | now() |
| `updated_at` | timestamp with time zone | NO | now() |

### knowledge_evidence

- Rows: 0 (empty)
- Decision: **keep** — Normalized schema-v2 feature table; empty until the feature produces data.
- Active code references: `server/cli/dbVerify.js`, `server/document/semanticBackfillService.js`, `server/graph/knowledgeLayerService.js`, `server/lib/database/audit.js`, `server/lib/database/capacity.js`, `server/lib/database/maintenance.js`, `server/test/databaseV2.test.js`, `server/test/knowledgeLayerV1.test.js`
- Nullable fields: knowledge_node_id, knowledge_edge_id, document_id, chunk_id, resource_id, owner_user_id, page_start, page_end, section_label, clause_label, source_url
- Last-update signal: created_at
- Indexes: `knowledge_evidence_document_idx`, `knowledge_evidence_edge_hash_idx`, `knowledge_evidence_edge_idx`, `knowledge_evidence_node_hash_idx`, `knowledge_evidence_node_idx`, `knowledge_evidence_owner_idx`, `knowledge_evidence_pkey`
- Foreign keys: `knowledge_evidence_chunk_id_fkey`: FOREIGN KEY (chunk_id) REFERENCES document_text_chunks(id) ON DELETE CASCADE; `knowledge_evidence_document_id_fkey`: FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE; `knowledge_evidence_knowledge_edge_id_fkey`: FOREIGN KEY (knowledge_edge_id) REFERENCES knowledge_edges(id) ON DELETE CASCADE; `knowledge_evidence_knowledge_node_id_fkey`: FOREIGN KEY (knowledge_node_id) REFERENCES knowledge_nodes(id) ON DELETE CASCADE; `knowledge_evidence_owner_user_id_fkey`: FOREIGN KEY (owner_user_id) REFERENCES users(id) ON DELETE CASCADE; `knowledge_evidence_resource_id_fkey`: FOREIGN KEY (resource_id) REFERENCES document_resources(id) ON DELETE SET NULL

| Column | Type | Nullable | Default |
|---|---|---|---|
| `id` | bigint | NO | nextval('knowledge_evidence_id_seq'::regclass) |
| `knowledge_node_id` | bigint | YES |  |
| `knowledge_edge_id` | bigint | YES |  |
| `document_id` | bigint | YES |  |
| `chunk_id` | bigint | YES |  |
| `resource_id` | bigint | YES |  |
| `owner_user_id` | bigint | YES |  |
| `page_start` | integer | YES |  |
| `page_end` | integer | YES |  |
| `section_label` | text | YES |  |
| `clause_label` | text | YES |  |
| `evidence_span` | text | NO |  |
| `evidence_hash` | text | NO |  |
| `source_url` | text | YES |  |
| `created_at` | timestamp with time zone | NO | now() |

### knowledge_nodes

- Rows: 0 (empty)
- Decision: **keep** — Normalized schema-v2 feature table; empty until the feature produces data.
- Active code references: `server/cli/dbVerify.js`, `server/graph/knowledgeLayerService.js`, `server/lib/database/audit.js`, `server/lib/database/capacity.js`, `server/lib/database/maintenance.js`, `server/test/databaseV2.test.js`, `server/test/knowledgeLayerV1.test.js`
- Nullable fields: description, authority_id, effective_from, effective_to, model_version, owner_user_id
- Last-update signal: updated_at
- Indexes: `knowledge_nodes_discovery_fts_idx`, `knowledge_nodes_pkey`, `knowledge_nodes_private_identity_idx`, `knowledge_nodes_public_identity_idx`, `knowledge_nodes_status_idx`
- Foreign keys: `knowledge_nodes_authority_id_fkey`: FOREIGN KEY (authority_id) REFERENCES legislative_documents(id) ON DELETE SET NULL; `knowledge_nodes_owner_user_id_fkey`: FOREIGN KEY (owner_user_id) REFERENCES users(id) ON DELETE CASCADE

| Column | Type | Nullable | Default |
|---|---|---|---|
| `id` | bigint | NO | nextval('knowledge_nodes_id_seq'::regclass) |
| `node_type` | text | NO |  |
| `canonical_name` | text | NO |  |
| `normalized_name` | text | NO |  |
| `description` | text | YES |  |
| `jurisdiction` | text | NO | 'unspecified'::text |
| `authority_id` | bigint | YES |  |
| `effective_from` | date | YES |  |
| `effective_to` | date | YES |  |
| `verification_status` | text | NO | 'MODEL_EXTRACTED'::text |
| `generation_method` | text | NO | 'deterministic'::text |
| `model_version` | text | YES |  |
| `owner_user_id` | bigint | YES |  |
| `metadata_json` | jsonb | NO | '{}'::jsonb |
| `created_at` | timestamp with time zone | NO | now() |
| `updated_at` | timestamp with time zone | NO | now() |

### legislative_document_resources

- Rows: 20573
- Decision: **legacy_archive** — Preserved for backward compatibility while additive triggers mirror data into schema v2.
- Active code references: `server/cli/ingestPolicyEdge.js`, `server/dashboard/intelligenceService.js`, `server/db.js`, `server/document/documentResearchService.js`, `server/egazette/egazetteService.js`, `server/lib/catalogRepository.js`, `server/lib/database/audit.js`, `server/lib/database/capacity.js`, `server/lib/database/legacySyncService.js`, `server/lib/database/maintenance.js`, `server/lib/ingestion/core/catalogRepository.js`
- Nullable fields: label, category
- Last-update signal: updated_at = 2026-08-20T15:06:55.247Z
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

- Rows: 19949
- Decision: **legacy_archive** — Preserved for backward compatibility while additive triggers mirror data into schema v2.
- Active code references: `server/activity/activityService.js`, `server/cli/cockroachBootstrapAudit.js`, `server/cli/dbVerify.js`, `server/cli/documentReadiness.js`, `server/cli/documentsInspect.js`, `server/cli/downloadAlternatives.js`, `server/cli/downloadFailures.js`, `server/cli/ingestPolicyEdge.js`, `server/cli/processBacklog.js`, `server/cli/processFailures.js`, `server/cli/processPolicyBatch.js`, `server/cli/processRetryable.js`, `server/cli/researchEval.js`, `server/cli/researchReadyAudit.js`, `server/cli/runDownloadRecoveryBatch.js`, `server/dashboard/intelligenceService.js`, `server/db.js`, `server/document/DocumentRepository.js`, `server/document/catalogueAuditService.js`, `server/document/processingWorkerService.js`, `server/document/readinessService.js`, `server/document/recommendationService.js`, `server/document/semanticBackfillService.js`, `server/document/semanticCoverageService.js`, `server/egazette/egazetteService.js`, `server/graph/knowledgeGraphService.js`, `server/graph/knowledgeLayerService.js`, `server/graph/relationshipEngine.js`, `server/lib/catalogRepository.js`, `server/lib/database/audit.js`, `server/lib/database/capacity.js`, `server/lib/database/legacySyncService.js`, `server/lib/database/maintenance.js`, `server/lib/ingestion/core/catalogRepository.js`, `server/policy/draftRoute.js`, `server/policy/policyService.js`, `server/profile/profileService.js`, `server/test/databaseMaintenance.test.js`, `server/test/databaseV2.test.js`, `server/test/sourceIdentity.test.js`
- Nullable fields: year, status, ministry, category, detail_url, pdf_url, source_page_url, content_fetched_at, normalized_title, authority, department, legal_identifier, bill_number, act_number, gazette_identifier, introduced_date, passed_date, enacted_date, publication_date, effective_date, canonical_source, canonical_url, content_hash, text_fingerprint, gazette_id, assent_date, commencement_date, search_vector, file_hash, mime_type, file_size_bytes, processing_status, processing_error, processed_at
- Last-update signal: updated_at = 2026-08-20T15:06:55.247Z
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

- Rows: 3
- Decision: **legacy_archive** — Preserved for backward compatibility while additive triggers mirror data into schema v2.
- Active code references: `server/db.js`, `server/document/documentsRoute.js`, `server/lib/database/audit.js`, `server/lib/database/capacity.js`, `server/lib/database/maintenance.js`, `server/profile/profileService.js`
- Nullable fields: comparison_id
- Last-update signal: updated_at = 2026-08-15T06:51:56.365Z
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

### policy_chats

- Rows: 0 (empty)
- Decision: **keep** — Active application or infrastructure table.
- Active code references: `server/dashboard/intelligenceService.js`, `server/db.js`, `server/models/PolicyChat.js`, `server/profile/profileService.js`, `server/test/databaseV2.test.js`
- Nullable fields: category, status, source_url, summary
- Last-update signal: updated_at
- Indexes: `policy_chats_pkey`, `policy_chats_user_id_policy_id_key`, `policy_chats_user_recent_idx`
- Foreign keys: `policy_chats_user_id_fkey`: FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE

| Column | Type | Nullable | Default |
|---|---|---|---|
| `id` | bigint | NO | nextval('policy_chats_id_seq'::regclass) |
| `policy_id` | text | NO |  |
| `user_id` | bigint | NO |  |
| `policy_title` | text | NO |  |
| `category` | text | YES |  |
| `status` | text | YES |  |
| `source_url` | text | YES |  |
| `summary` | text | YES |  |
| `messages` | jsonb | NO | '[]'::jsonb |
| `metadata_json` | jsonb | NO | '{}'::jsonb |
| `last_message_at` | timestamp with time zone | NO | now() |
| `last_accessed_at` | timestamp with time zone | NO | now() |
| `is_active` | boolean | NO | true |
| `created_at` | timestamp with time zone | NO | now() |
| `updated_at` | timestamp with time zone | NO | now() |

### policy_drafts

- Rows: 0 (empty)
- Decision: **keep** — Active application or infrastructure table.
- Active code references: `server/cli/dbVerify.js`, `server/policy/draftRoute.js`
- Nullable fields: error_message
- Last-update signal: updated_at
- Indexes: `policy_drafts_pkey`, `policy_drafts_user_recent_idx`
- Foreign keys: `policy_drafts_user_id_fkey`: FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE

| Column | Type | Nullable | Default |
|---|---|---|---|
| `id` | bigint | NO | nextval('policy_drafts_id_seq'::regclass) |
| `user_id` | bigint | NO |  |
| `title` | text | NO |  |
| `brief_json` | jsonb | NO | '{}'::jsonb |
| `document_ids_json` | jsonb | NO | '[]'::jsonb |
| `source_ids_json` | jsonb | NO | '[]'::jsonb |
| `draft_text` | text | NO | ''::text |
| `citations_json` | jsonb | NO | '[]'::jsonb |
| `status` | text | NO | 'processing'::text |
| `error_message` | text | YES |  |
| `created_at` | timestamp with time zone | NO | now() |
| `updated_at` | timestamp with time zone | NO | now() |

### recommendations

- Rows: 414
- Decision: **keep** — Active application or infrastructure table.
- Active code references: `server/cli/downloadAlternatives.js`, `server/cli/verifyGraph.js`, `server/dashboard/intelligenceService.js`, `server/document/DocumentService.js`, `server/document/documentResearchService.js`, `server/document/documentTypes.js`, `server/document/documentsRoute.js`, `server/document/processingWorkerService.js`, `server/document/recommendationService.js`, `server/egazette/egazettesRoute.js`, `server/lib/database/audit.js`, `server/lib/database/capacity.js`, `server/lib/database/maintenance.js`, `server/lib/ingestion/connectors/regulatorConnectors.js`, `server/lib/vectordb.js`, `server/profile/profileService.js`, `server/profile/route.js`, `server/recommendation/recommendationsRoute.js`, `server/server.js`, `server/test/profileUiContract.test.js`, `server/test/recommendationService.test.js`
- Nullable fields: user_id, document_id, expires_at
- Last-update signal: created_at = 2026-08-16T10:21:54.080Z
- Indexes: `recommendations_document_score_idx`, `recommendations_expiry_idx`, `recommendations_pkey`, `recommendations_user_recent_idx`
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
- Active code references: `server/db.js`, `server/lib/database/audit.js`, `server/lib/database/capacity.js`, `server/lib/database/maintenance.js`, `server/models/RelatedBills.js`
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

- Rows: 57
- Decision: **keep** — Active application or infrastructure table.
- Active code references: `server/cli/dbVerify.js`, `server/lib/database/audit.js`, `server/lib/database/capacity.js`, `server/lib/database/maintenance.js`, `server/profile/profileService.js`
- Nullable fields: legacy_chat_id, document_id, summary
- Last-update signal: updated_at = 2026-08-16T10:18:01.344Z
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
- Active code references: `server/db.js`, `server/lib/database/audit.js`, `server/lib/database/capacity.js`, `server/lib/database/maintenance.js`, `server/profile/profileService.js`
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
- Active code references: `server/db.js`, `server/lib/database/audit.js`, `server/lib/database/capacity.js`, `server/lib/database/maintenance.js`, `server/profile/profileService.js`
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

- Rows: 166
- Decision: **keep** — Active application or infrastructure table.
- Active code references: `server/cli/dbVerify.js`, `server/lib/database/audit.js`, `server/lib/database/capacity.js`, `server/lib/database/maintenance.js`, `server/test/databaseMaintenance.test.js`
- Nullable fields: external_message_id
- Last-update signal: created_at = 2026-08-16T09:47:10.630Z
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
- Active code references: `server/db.js`, `server/lib/database/audit.js`, `server/lib/database/capacity.js`, `server/lib/database/maintenance.js`, `server/models/DocumentChat.js`, `server/profile/profileService.js`
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

### research_query_telemetry

- Rows: 0 (empty)
- Decision: **keep** — Active application or infrastructure table.
- Active code references: `server/cli/dbVerify.js`, `server/retrieval/researchTelemetry.js`, `server/test/databaseV2.test.js`
- Nullable fields: none
- Last-update signal: created_at
- Indexes: `research_query_telemetry_created_idx`, `research_query_telemetry_pkey`, `research_query_telemetry_query_id_key`, `research_query_telemetry_type_created_idx`
- Foreign keys: none

| Column | Type | Nullable | Default |
|---|---|---|---|
| `id` | bigint | NO | nextval('research_query_telemetry_id_seq'::regclass) |
| `query_id` | uuid | NO |  |
| `query_type` | text | NO |  |
| `query_planner_version` | text | NO |  |
| `privacy_scope` | text | NO |  |
| `metadata_latency_ms` | integer | NO | 0 |
| `fts_latency_ms` | integer | NO | 0 |
| `vector_latency_ms` | integer | NO | 0 |
| `graph_latency_ms` | integer | NO | 0 |
| `fusion_latency_ms` | integer | NO | 0 |
| `rerank_latency_ms` | integer | NO | 0 |
| `generation_latency_ms` | integer | NO | 0 |
| `verification_latency_ms` | integer | NO | 0 |
| `lexical_candidate_count` | integer | NO | 0 |
| `vector_candidate_count` | integer | NO | 0 |
| `fused_candidate_count` | integer | NO | 0 |
| `final_evidence_count` | integer | NO | 0 |
| `source_authority_distribution` | jsonb | NO | '{}'::jsonb |
| `top_scores` | jsonb | NO | '[]'::jsonb |
| `evidence_sufficiency_level` | text | NO | 'UNKNOWN'::text |
| `citations_generated` | integer | NO | 0 |
| `citations_verified` | integer | NO | 0 |
| `unsupported_claims_removed` | integer | NO | 0 |
| `abstained` | boolean | NO | false |
| `fallback_used` | boolean | NO | false |
| `tokens_in` | integer | NO | 0 |
| `tokens_out` | integer | NO | 0 |
| `model` | text | NO |  |
| `embedding_model` | text | NO |  |
| `retrieval_version` | text | NO |  |
| `cache_status` | text | NO |  |
| `flags_json` | jsonb | NO | '{}'::jsonb |
| `created_at` | timestamp with time zone | NO | now() |

### research_source_chunks

- Rows: 0 (empty)
- Decision: **keep** — Active application or infrastructure table.
- Active code references: `server/cli/dbVerify.js`, `server/research/sourceService.js`
- Nullable fields: search_vector
- Last-update signal: created_at
- Indexes: `research_source_chunks_pkey`, `research_source_chunks_search_idx`, `research_source_chunks_source_id_chunk_index_key`, `research_source_chunks_source_idx`
- Foreign keys: `research_source_chunks_source_id_fkey`: FOREIGN KEY (source_id) REFERENCES research_sources(id) ON DELETE CASCADE

| Column | Type | Nullable | Default |
|---|---|---|---|
| `id` | bigint | NO | nextval('research_source_chunks_id_seq'::regclass) |
| `source_id` | bigint | NO |  |
| `chunk_index` | integer | NO |  |
| `content` | text | NO |  |
| `metadata_json` | jsonb | NO | '{}'::jsonb |
| `search_vector` | tsvector | YES |  |
| `created_at` | timestamp with time zone | NO | now() |

### research_sources

- Rows: 0 (empty)
- Decision: **keep** — Active application or infrastructure table.
- Active code references: `server/cli/dbVerify.js`, `server/research/sourceService.js`
- Nullable fields: source_url, file_name, mime_type, object_key, checksum_sha256, size_bytes, language_code, error_message
- Last-update signal: updated_at
- Indexes: `research_sources_pkey`, `research_sources_user_recent_idx`
- Foreign keys: `research_sources_user_id_fkey`: FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE

| Column | Type | Nullable | Default |
|---|---|---|---|
| `id` | bigint | NO | nextval('research_sources_id_seq'::regclass) |
| `user_id` | bigint | NO |  |
| `title` | text | NO |  |
| `source_type` | text | NO |  |
| `source_url` | text | YES |  |
| `file_name` | text | YES |  |
| `mime_type` | text | YES |  |
| `object_key` | text | YES |  |
| `checksum_sha256` | text | YES |  |
| `size_bytes` | bigint | YES |  |
| `language_code` | text | YES |  |
| `status` | text | NO | 'ready'::text |
| `error_message` | text | YES |  |
| `content_text` | text | NO | ''::text |
| `metadata_json` | jsonb | NO | '{}'::jsonb |
| `created_at` | timestamp with time zone | NO | now() |
| `updated_at` | timestamp with time zone | NO | now() |

### saved_content

- Rows: 1
- Decision: **keep** — Active application or infrastructure table.
- Active code references: `server/db.js`, `server/lib/database/capacity.js`, `server/profile/profileService.js`
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

### saved_graph_paths

- Rows: 0 (empty)
- Decision: **keep** — Active application or infrastructure table.
- Active code references: `server/db.js`, `server/graph/knowledgeGraphService.js`, `server/lib/database/capacity.js`, `server/profile/profileService.js`
- Nullable fields: title
- Last-update signal: updated_at
- Indexes: `saved_graph_paths_pkey`, `saved_graph_paths_user_id_source_document_id_target_documen_key`, `saved_graph_paths_user_recent_idx`
- Foreign keys: `saved_graph_paths_source_document_id_fkey`: FOREIGN KEY (source_document_id) REFERENCES legislative_documents(id) ON DELETE CASCADE; `saved_graph_paths_target_document_id_fkey`: FOREIGN KEY (target_document_id) REFERENCES legislative_documents(id) ON DELETE CASCADE; `saved_graph_paths_user_id_fkey`: FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE

| Column | Type | Nullable | Default |
|---|---|---|---|
| `id` | bigint | NO | nextval('saved_graph_paths_id_seq'::regclass) |
| `user_id` | integer | NO |  |
| `source_document_id` | bigint | NO |  |
| `target_document_id` | bigint | NO |  |
| `path_json` | jsonb | NO | '{}'::jsonb |
| `title` | text | YES |  |
| `created_at` | timestamp with time zone | NO | now() |
| `updated_at` | timestamp with time zone | NO | now() |

### saved_searches

- Rows: 1
- Decision: **keep** — Active application or infrastructure table.
- Active code references: `server/db.js`, `server/lib/database/audit.js`, `server/lib/database/capacity.js`, `server/lib/database/maintenance.js`, `server/profile/profileService.js`
- Nullable fields: query_text
- Last-update signal: updated_at = 2026-08-16T09:46:45.300Z
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

- Rows: 32
- Decision: **keep** — Active application or infrastructure table.
- Active code references: `server/cli/dbVerify.js`, `server/lib/database/capacity.js`, `server/lib/database/maintenance.js`, `server/lib/database/migrationLock.js`, `server/lib/database/migrator.js`, `server/test/migrationLock.test.js`
- Nullable fields: none
- Last-update signal: applied_at = 2026-08-21T06:49:44.467Z
- Indexes: `schema_migrations_pkey`
- Foreign keys: none

| Column | Type | Nullable | Default |
|---|---|---|---|
| `migration_name` | text | NO |  |
| `checksum` | text | NO |  |
| `applied_at` | timestamp with time zone | NO | now() |

### source_collection_snapshots

- Rows: 2029
- Decision: **keep** — Active application or infrastructure table.
- Active code references: `server/dashboard/intelligenceService.js`, `server/db.js`, `server/lib/catalogRepository.js`, `server/lib/database/capacity.js`, `server/lib/ingestion/core/catalogRepository.js`
- Nullable fields: html_hash, response_status, collected_at
- Last-update signal: fetched_at = 2026-08-20T15:06:52.055Z
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

### source_directory_entries

- Rows: 148
- Decision: **keep** — Active application or infrastructure table.
- Active code references: `server/dashboard/intelligenceService.js`, `server/db.js`, `server/lib/database/capacity.js`, `server/lib/ingestion/core/catalogRepository.js`
- Nullable fields: jurisdiction, parent_name, official_url
- Last-update signal: updated_at = 2026-08-16T02:58:02.473Z
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

- Rows: 31
- Decision: **keep** — Active application or infrastructure table.
- Active code references: `server/lib/database/audit.js`, `server/lib/database/capacity.js`, `server/lib/database/quality.js`, `server/lib/ingestion/core/catalogRepository.js`
- Nullable fields: reachable, parser_status, last_checked_at, last_successful_run_at, last_failed_run_at, last_error
- Last-update signal: updated_at = 2026-08-20T15:06:55.288Z
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

- Rows: 34
- Decision: **keep** — Active application or infrastructure table.
- Active code references: `server/cli/dbVerify.js`, `server/dashboard/intelligenceService.js`, `server/lib/database/audit.js`, `server/lib/database/capacity.js`, `server/lib/database/legacySyncService.js`, `server/lib/ingestion/core/catalogRepository.js`, `server/test/dashboardIntelligence.test.js`
- Nullable fields: base_url, jurisdiction, authority, public_label, internal_label, connector_name, ingestion_frequency, last_successful_run_at, last_failed_run_at, notes, source_domain, authority_tier, refresh_schedule, last_attempted_refresh_at, parser_version, source_terms_or_usage_notes
- Last-update signal: updated_at = 2026-08-20T15:06:55.284Z
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
| `source_domain` | text | YES |  |
| `authority_tier` | text | YES |  |
| `supported_document_types` | jsonb | NO | '[]'::jsonb |
| `refresh_schedule` | text | YES |  |
| `last_attempted_refresh_at` | timestamp with time zone | YES |  |
| `documents_discovered` | integer | NO | 0 |
| `documents_added` | integer | NO | 0 |
| `documents_updated` | integer | NO | 0 |
| `failure_count` | integer | NO | 0 |
| `health_status` | text | NO | 'not_run'::text |
| `parser_version` | text | YES |  |
| `source_terms_or_usage_notes` | text | YES |  |

### user_activity_events

- Rows: 0 (empty)
- Decision: **keep** — Active application or infrastructure table.
- Active code references: `server/activity/activityService.js`, `server/db.js`, `server/document/semanticBackfillService.js`, `server/document/semanticCoverageService.js`, `server/graph/knowledgeGraphService.js`, `server/lib/database/capacity.js`, `server/profile/profileService.js`, `server/test/activityPrivacy.test.js`
- Nullable fields: entity_type, entity_id, document_id, session_id, page_path, referrer, search_query
- Last-update signal: created_at
- Indexes: `user_activity_events_document_idx`, `user_activity_events_document_recent_idx`, `user_activity_events_pkey`, `user_activity_events_type_idx`, `user_activity_events_user_recent_idx`
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
- Active code references: `server/activity/activityService.js`, `server/dashboard/intelligenceService.js`, `server/db.js`, `server/document/processingWorkerService.js`, `server/document/recommendationService.js`, `server/lib/database/capacity.js`, `server/profile/profileService.js`
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

- Rows: 2
- Decision: **keep** — Active application or infrastructure table.
- Active code references: `server/lib/database/audit.js`, `server/lib/database/capacity.js`, `server/lib/database/maintenance.js`, `server/onboarding/onboardingService.js`, `server/profile/profileService.js`
- Nullable fields: none
- Last-update signal: updated_at = 2026-08-11T05:25:49.559Z
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
- Active code references: `server/dashboard/intelligenceService.js`, `server/db.js`, `server/document/recommendationService.js`, `server/lib/database/audit.js`, `server/lib/database/capacity.js`, `server/lib/database/maintenance.js`, `server/models/User.js`, `server/onboarding/onboardingService.js`, `server/profile/profileService.js`
- Nullable fields: username, bio, organization, designation, location, phone, onboarding_completed_at, role
- Last-update signal: updated_at = 2026-08-11T05:25:49.559Z
- Indexes: `user_profiles_onboarding_idx`, `user_profiles_pkey`, `user_profiles_username_key`
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
| `onboarding_completed` | boolean | NO | false |
| `onboarding_skipped` | boolean | NO | false |
| `onboarding_completed_at` | timestamp with time zone | YES |  |
| `role` | text | YES |  |

### user_research_preferences

- Rows: 5
- Decision: **keep** — Active application or infrastructure table.
- Active code references: `server/activity/activityService.js`, `server/db.js`, `server/lib/database/capacity.js`, `server/onboarding/onboardingService.js`, `server/profile/profileService.js`
- Nullable fields: consented_at, revoked_at, last_active_at
- Last-update signal: updated_at = 2026-08-15T05:53:47.581Z
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

- Rows: 0 (empty)
- Decision: **keep** — Normalized schema-v2 feature table; empty until the feature produces data.
- Active code references: `server/auth/sessionService.js`, `server/db.js`, `server/lib/database/audit.js`, `server/lib/database/capacity.js`, `server/lib/database/maintenance.js`, `server/profile/profileService.js`
- Nullable fields: user_agent, ip_address, revoked_at
- Last-update signal: last_seen_at
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

- Rows: 10
- Decision: **keep** — Active application or infrastructure table.
- Active code references: `server/cli/cockroachBootstrapAudit.js`, `server/cli/verifyRelease.js`, `server/dashboard/intelligenceService.js`, `server/db.js`, `server/document/readinessService.js`, `server/lib/database/audit.js`, `server/lib/database/capacity.js`, `server/lib/database/maintenance.js`, `server/lib/vectordb.js`, `server/models/User.js`, `server/onboarding/onboardingService.js`, `server/profile/profileService.js`, `server/test/activityPrivacy.test.js`, `server/test/profileUiContract.test.js`, `server/test/queueWaitOverflow.test.js`
- Nullable fields: google_id, avatar, password
- Last-update signal: created_at = 2026-07-23T07:01:01.289Z
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
