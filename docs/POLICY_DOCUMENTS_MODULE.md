# Policy Documents Module

Last verified: 9 July 2026

The Policies view is a scope of the universal document system, not a separate
table. Policies, schemes, guidelines, consultations, strategy papers, reports,
memoranda, circulars, resolutions, and Cabinet decisions use
`legislative_documents`, `document_sources`, and
`legislative_document_resources`.

Current real policy coverage includes 1,168 policy records. Most recent policy
coverage comes from PolicyEdge source articles. These are treated as
extractable HTML sources rather than pretending that a PDF exists.

The shared catalogue filters source type, ministry, state/jurisdiction, year,
document type, language, category, source, date range, and PDF availability.
PDF/HTML processing, OCR where applicable, embedding, summaries, and chat occur
only when a user opens/researches a document or an operator runs a bounded
processing batch. Ingestion never marks records research-ready by itself.

Policy readiness currently follows the same strict contract as Bills, Acts,
Gazette records, and reports:

- source-only records remain searchable and expose View Source;
- PolicyEdge records with source URLs show Prepare for Research until their
  article text has been fetched and indexed;
- Research and Compare appear only after chunks, embeddings, and retrieval
  verification exist;
- failed policies keep their source link and show the failure reason.

The dedicated operator command for PolicyEdge-backed policies is:

```bash
npm run process:policies --prefix server -- --limit=25
```

This command bypasses the generic global queue selection so policy batches do
not accidentally claim older queued Bill jobs.

The UI uses PostgreSQL records only. Missing coverage produces an empty state
or source-health limitation, never a projected count or synthetic update.
