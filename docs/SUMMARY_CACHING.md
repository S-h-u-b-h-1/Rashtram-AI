# Summary Caching

## Goal

Policy and document summaries should not be regenerated every time a document page is prepared or opened. The system should store generated summaries and reuse them.

## Current behavior

Policy summaries are served database-first:

1. Load `document_text_artifacts.english_summary`.
2. If missing, generate through the summary pipeline.
3. Store the generated summary in `document_text_artifacts`.
4. Fall back to vector metadata only if no cached/generated summary is available.

## Storage

Primary storage:

- `document_text_artifacts.original_text`
- `document_text_artifacts.english_summary`
- `document_text_artifacts.language`

The multilingual pipeline preserves original Hindi or bilingual text separately from English summaries.

## Operational rule

Processing jobs should create or refresh summaries once, then document detail/readiness APIs should read cached summaries. Regeneration should be explicit or triggered only when source text changes.

