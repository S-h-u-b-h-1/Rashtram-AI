# Data Quality Framework

Last verified: 2 July 2026

## Quality score

Each normalized document receives a score from 0 to 100:

| Evidence | Points |
|---|---:|
| Non-empty title | 15 |
| Canonical source URL | 15 |
| PDF resource | 15 |
| Publication date or year | 10 |
| Ministry or authority | 10 |
| Jurisdiction | 10 |
| Accessible resource | 10 |
| Successful processing | 10 |
| Successful extraction | 5 |
| Pending duplicate warning | -20 |

Scores are evidence-based and recalculated by `db:verify` and after scheduled
ingestion. Records below 40 are retained internally with
`visibility_status=low_quality`; records without a source URL are
`internal_only`.

## Integrity rules

- Canonical document IDs are unique.
- Source identity is unique by source name and source record ID.
- Resource identity is unique per document and URL.
- Normalized resources, messages, and source rows must not be orphaned.
- Research readiness uses processing evidence, not PDF presence alone.
- Exact duplicate canonical IDs are a release blocker.
- Ambiguous fuzzy matches are reviewed rather than silently merged.

## Current verified baseline

- 17,742 normalized documents with exact legacy ID parity.
- 17,751 source records.
- 18,681 normalized resources.
- 32 normalized research chats and 77 messages.
- 28 registered sources/connectors.
- Zero orphan sources, resources, or research messages.
- Zero duplicate canonical IDs.
- Zero invalid research-ready flags.
- Six strictly research-ready documents.
- 38 historical regulator navigation/category artifacts are preserved but
  quarantined with `visibility_status=hidden_invalid`.
- 408 documents have no primary PDF; these remain discoverable when a valid
  source exists but are not research-ready.

The complete table-by-table evidence is in `DATABASE_AUDIT_REPORT.md`.
