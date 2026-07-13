# Deduplication Analysis

Date: 2026-07-13

The current catalogue contains duplicate risk that must be handled before research claims are presented as canonical.

## Current baseline

The latest audit recorded:

| Metric | Value |
|---|---:|
| Probable duplicate groups | 1,113 |
| Documents in probable duplicate groups | 2,442 |
| Pending match reviews | 26 |

This means duplicate handling is not complete. The system should not claim a fully canonical legal corpus yet.

## Why duplicates exist

Expected causes:

- PRS, India Code, Gazette, ministry, and regulator records can refer to the same instrument.
- A bill, amended bill, enacted act, gazette notification, and secondary explainer may share title fragments.
- Source metadata is inconsistent across providers.
- Some records have missing file hashes or content fingerprints.
- State and central sources may use similar titles for different instruments.

## Current canonical evidence fields

Migration `012_source_authority_and_canonical_provenance.js` added canonical/provenance fields such as:

- `source_specific_id`
- `source_authority_tier`
- `original_source_page`
- `original_file_url`
- `file_checksum_sha256`
- `retrieved_at`
- `last_source_update_at`
- `parent_document_id`
- `validation_status`

Migration `013_processing_failure_taxonomy.js` adds processing traceability fields that help dedupe decisions:

- input/output checksums
- extraction method
- extraction quality JSON
- worker version
- failure code/stage

Migration `014_document_content_fingerprint.js` adds `content_fingerprint_sha256` for duplicate analysis based on processed text fingerprints when that signal is available.

## Safe dedupe rule

Do not automatically merge records only by title.

Candidate duplicate evidence should be ordered:

1. exact `file_checksum_sha256`
2. exact `content_fingerprint_sha256`
3. same official source identifier plus source authority tier
4. same gazette/notification/act/bill number plus date/jurisdiction
5. high-title similarity plus matching ministry/jurisdiction/year

Only the first two are safe for automated grouping. The rest should remain review candidates.

## Product behavior until dedupe is complete

For search, comparison, and chat:

- prefer authoritative sources over secondary sources;
- show original source snippets and citations;
- avoid hiding duplicates automatically;
- prefer records with file checksum and retrieval verification;
- expose duplicate warnings in internal diagnostics.

## Diagnostic command

Use:

```bash
npm run process:consistency --prefix server
```

This reports duplicate fingerprint groups and readiness contradictions.

## Remaining work

- Increase checksum coverage during ingestion and processing.
- Add review workflow for probable duplicates.
- Add source-specific canonical merge decisions.
- Store merge decisions as explicit provenance operations, not silent deletes.
- Use authority tier and canonical parent/child relationships in retrieval ranking.
