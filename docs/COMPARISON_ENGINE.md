# Grounded Document Comparison Engine

Rashtram AI compares two to five research-ready catalogue documents across
Bills, Acts, policies, reports, Gazette records, rules, regulations, circulars,
orders, notifications, and schemes.

## Readiness and retrieval

A document can be compared only when it has a valid title and public source,
an accessible PDF/text resource, successful extraction, stored chunks,
successful embeddings, no processing error, and
`documents.research_ready = true`.

The API returns specific `422` errors for unavailable PDFs, pending extraction,
failed processing, missing extractable text, or an unavailable research
workspace. It never falls back to title-only generation.

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

- `GET /api/documents/compare/:comparisonId`
- `DELETE /api/documents/compare/:comparisonId`
- `GET /api/profile/comparisons`

Comparisons are scoped to the authenticated user. Rashtram AI is a research
assistant, not a legal authority.
