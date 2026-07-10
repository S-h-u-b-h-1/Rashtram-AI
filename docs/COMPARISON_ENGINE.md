# Grounded Document Comparison Engine

Rashtram AI compares two to five research-ready catalogue documents across
Bills, Acts, policies, reports, Gazette records, rules, regulations, circulars,
orders, notifications, and schemes.

## Readiness and retrieval

A document can be compared only when it has a valid title and public source,
an accessible PDF/text/HTML resource, successful extraction, stored chunks,
no processing error, and a verified retrieval path. The preferred retrieval
path is vector search. When the embedding/vector provider is unavailable but
PostgreSQL has normalized text chunks, the comparison engine uses the local
text chunk fallback and marks the document as `retrieval_mode = local_text` or
`hybrid`. Both `documents.research_ready` and `documents.comparison_ready`
must be true. Source-only PolicyEdge records do not become comparable until
their article text has been fetched, chunked, persisted, and verified.

The API returns specific `422` errors for unavailable PDFs, pending extraction,
failed processing, missing extractable text, or an unavailable research
workspace. It never falls back to title-only generation.

As of 9 July 2026, the comparison readiness check is canonicalized through
`getDocumentReadiness(documentId)`. It rejects records that are marked ready in
metadata but lack normalized processing evidence in
`document_processing_state` and `document_text_chunks`. It accepts either:

- complete vector readiness: stored chunks, vector references, embeddings, and
  retrieval verification; or
- fallback readiness: stored chunks with original text plus verified local
  PostgreSQL retrieval when the vector provider is unavailable.

This fixed two previous failure modes:

- policy records could show Compare actions before retrievable grounded
  content existed; and
- vector/provider failures could make a ready document compare as
  `No extractable text` even though PostgreSQL chunks were present.

The engine retrieves passages independently per document, labels them as
`D1-C1`, `D2-C1`, and so on, generates structured analysis using only those
passages, attaches source snippets, and persists the result.

If the generation provider fails after grounded passages have been retrieved,
the engine persists an `extractive_fallback` comparison assembled from the
retrieved snippets. The fallback includes citations and retrieval metadata so
the UI still receives a grounded, saved comparison instead of a broken request.

## API

`POST /api/documents/compare`

```json
{
  "documentIds": ["1", "2"],
  "comparisonMode": "full",
  "language": "auto",
  "userQuestion": "How do the compliance duties differ?"
}
```

Modes are `summary`, `clause`, `impact`, `timeline`, `compliance`, and `full`.
Languages are `auto`, `english`, and `hindi`. Legacy mode names remain
accepted.

Additional endpoints:

- `GET /api/documents/:id/readiness`
- `POST /api/documents/:id/prepare`
- `POST /api/documents/recommend-for-comparison`
- `GET /api/documents/compare/:comparisonId`
- `DELETE /api/documents/compare/:comparisonId`
- `GET /api/profile/comparisons`

Comparisons are scoped to the authenticated user. Rashtram AI is a research
assistant, not a legal authority.

The recommendation endpoint accepts one to five selected document IDs. With
one selection it finds similar, same-ministry/state, graph-connected, and
semantically related documents. With multiple selections it also ranks
documents that bridge the selection. Recommendation cards expose confidence,
reason, readiness, and Add to Compare only for comparison-ready records.

Recommendation payloads include the readiness class, processing status,
extraction status, embedding status, chunk count, embedding count, and disabled
reason so the frontend can show Prepare for Research / View Source rather than
a broken Compare button.

The document explorer uses the same canonical prepare endpoint for all
document types. When a selected document is processable but not yet comparison
ready, the action becomes `Prepare & compare`; after preparation it refreshes
the readiness state before adding the document to the comparison tray.

The comparison tray and `/app/compare?ids=...` route must not trust persisted
client state. Hydrated tray selections are refreshed through
`GET /api/documents/:id/readiness`, and URL-selected comparisons validate
canonical readiness before auto-running or enabling "Run with these settings."
If any selected document lacks chunks or verified retrieval, the page shows the
canonical reason and blocks comparison instead of sending a doomed request.
# 2026-07-10 Recovery Update

Comparison remains gated by canonical backend readiness. The processing fixes
increase the set of legitimately comparison-ready documents without faking
readiness: extracted chunks and verified retrieval are still required.

Processing batches used to be able to process unrelated queued documents, which
made type-specific comparison backfills unreliable. Worker claiming is now
scoped to selected batch document IDs.
