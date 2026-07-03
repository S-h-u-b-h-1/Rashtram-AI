# Policy Documents Module

Last verified: 2 July 2026

The Policies view is a scope of the universal document system, not a separate
table. Policies, schemes, guidelines, consultations, strategy papers, reports,
memoranda, circulars, resolutions, and Cabinet decisions use
`legislative_documents`, `document_sources`, and
`legislative_document_resources`.

Current real coverage includes 20 NITI reports, 15 PIB releases, 36
environment-ministry PDFs, 15 Haryana policy/regulatory PDFs, 2 MyGov
consultations, populated regulator samples, and 12 attributed Policy Edge
secondary records.

The shared catalogue filters source type, ministry, state/jurisdiction, year,
document type, language, category, source, date range, and PDF availability.
PDF processing, OCR, embedding, summaries, and chat occur only when a user
opens or researches a document. Ingestion never triggers bulk AI work.

The UI uses PostgreSQL records only. Missing coverage produces an empty state
or source-health limitation, never a projected count or synthetic update.
