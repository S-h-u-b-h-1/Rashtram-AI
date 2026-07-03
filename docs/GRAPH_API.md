# Knowledge Graph API

All graph endpoints require a Rashtram AI authentication token.

## Document graph

- `GET /api/documents/:id/graph?depth=1&limit=80`
- `GET /api/documents/:id/relationships?type=AMENDS&limit=50&offset=0`
- `GET /api/documents/:id/timeline`

Responses include typed nodes, directed edges, confidence, explanation,
evidence, provenance, and truncation state.

## Search and paths

- `GET /api/graph/search?q=finance&type=act&limit=20`
- `GET /api/graph/path?from=1&to=2&maxDepth=6`
- `POST /api/graph/paths`

```json
{
  "sourceDocumentId": 1,
  "targetDocumentId": 2,
  "title": "Finance Bill to Finance Act"
}
```

## Metrics

`GET /api/graph/metrics` returns connected documents, relationships, coverage,
growth, top connected ministries, and most amended Acts.

## Errors

- `400`: invalid query, ID, relationship type, limit, or depth
- `404`: document or supported path not found
- `401`: authentication required
- `500`: database or service failure

