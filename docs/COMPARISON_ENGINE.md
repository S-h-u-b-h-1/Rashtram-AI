# Grounded Document Comparison Engine

Rashtram AI compares two to five research-ready catalogue documents across
Bills, Acts, policies, reports, Gazette records, rules, regulations, circulars,
orders, notifications, and schemes.

## Readiness and retrieval

A document can be compared only when it has a valid title and public source,
an accessible PDF/text/HTML resource, successful extraction, stored chunks,
successful embeddings, no processing error, and successful retrieval
verification. Both `documents.research_ready` and
`documents.comparison_ready` must be true. Source-only PolicyEdge records do
not become comparable until their article text has been fetched, chunked,
embedded, stored, and verified.

The API returns specific `422` errors for unavailable PDFs, pending extraction,
failed processing, missing extractable text, or an unavailable research
workspace. It never falls back to title-only generation.

As of 9 July 2026, the comparison readiness check intentionally rejects
records that are marked ready in metadata but lack normalized processing
evidence in `document_processing_state`, `document_text_chunks`, and vector
references. This fixed the previous failure mode where policy records could
show Compare actions before retrievable grounded content existed.

The engine retrieves passages independently per document, labels them as
`D1-C1`, `D2-C1`, and so on, generates structured analysis using only those
passages, attaches source snippets, and persists the result.

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
