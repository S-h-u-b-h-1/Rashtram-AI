# Document Detail API Hardening

Date: 2026-07-11

## Contract

`GET /api/documents/:id` now returns a resilient payload:

```json
{
  "document": {},
  "sources": [],
  "resources": [],
  "relationships": [],
  "recommendations": [],
  "readiness": {},
  "warnings": []
}
```

Existing frontend consumers can continue reading `document.*`; newer consumers can use the top-level collections.

## Defensive handling

The API now safely handles:

- malformed JSON;
- JSON stored as text;
- missing resources;
- missing sources;
- missing processing rows;
- invalid dates;
- orphan or deleted relationship targets;
- graph/recommendation/timeline failures;
- unexpected document types.

One malformed optional child row no longer crashes the whole detail response.

## Error behavior

- Missing document: HTTP `404`.
- Existing document with partial child failure: HTTP `200` plus `warnings`.
- Internal failure: sanitized HTTP `500` with `requestId`.

Raw stack traces, SQL details, provider errors, credentials, and tokens are not returned to clients.
