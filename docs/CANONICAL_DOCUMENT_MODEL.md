# Canonical Document Model

## Purpose

The canonical document model represents Bills, Acts, Rules, Regulations, Gazette notifications, Circulars, Policies, Reports, Consultation papers, Parliamentary records, Ministry documents, Regulatory documents, State documents, and secondary research without creating one table per source.

## Primary tables

- `documents`: canonical document identity, metadata, provenance, readiness, quality, and search vector.
- `source_registry`: source authority, connector, schedule, and health metadata.
- `document_sources`: source-specific observations of a canonical document.
- `document_resources`: PDFs, HTML pages, source pages, and other resources.
- `document_text_artifacts`: raw text, cleaned text, summaries, language metadata, and PDF quality metadata.
- `document_chunks`: citation-bearing retrieval chunks.
- `document_processing_state`: current processing/readiness state.
- `document_processing_jobs`: queue rows.
- `document_processing_attempts`: worker attempts and metrics.
- `document_relationships`: graph and legal/policy relationships.

## Canonical fields

Core identity:

- `id`
- `canonical_id`
- `source_specific_id`
- `title`
- `alternate_title`
- `normalized_title`
- `document_type`
- `document_subtype`

Provenance:

- `canonical_source_id`
- `source_authority_tier`
- `original_source_page`
- `canonical_url`
- `original_file_url`
- `object_storage_path`
- `file_checksum_sha256`
- `retrieval_date`
- `last_source_update_at`
- `metadata_json`

Dates and legal identifiers:

- `publication_date`
- `introduced_date`
- `passed_date`
- `assent_date`
- `commencement_date`
- `effective_date`
- `expiry_date`
- `legal_identifier`
- `bill_number`
- `act_number`
- `notification_number`
- `gazette_number`
- `gazette_identifier`
- `session`
- `version`

Jurisdiction and authority:

- `country`
- `jurisdiction_level`
- `jurisdiction`
- `state`
- `authority`
- `ministry`
- `department`
- `regulator`
- `sector`
- `topic`
- `category`

Lifecycle:

- `status`
- `legislative_status`
- `parent_document_id`
- `visibility_status`
- `validation_status`
- `extraction_version`

Research controls:

- `language`
- `script`
- `is_bilingual`
- `research_ready`
- `comparison_ready`
- `quality_score`
- `source_priority`

## Authority tiers

- Tier A: authoritative legal/regulatory records and official records.
- Tier B: official government publications and official explanatory communications.
- Tier C: recognised institutional or academic research.
- Tier D: secondary commentary.

Tier D must never be treated as the primary legal basis for an answer.

## Migration

`server/migrations/012_source_authority_and_canonical_provenance.js` adds the missing canonical provenance columns and authority-tier indexes. It is additive and backward-compatible.

## Remaining implementation work

- Populate new canonical fields in every connector.
- Store object-storage paths when object storage is introduced.
- Increase file checksum coverage.
- Use authority tiers consistently in all retrieval rankers.
- Add explicit supersession/amendment validation flows.

