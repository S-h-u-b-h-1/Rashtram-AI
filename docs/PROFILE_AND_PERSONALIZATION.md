# Profile and Personalization

## Data flow

Onboarding and profile updates write account preference data into normalized user-owned tables:

- `user_profiles` stores display/profile data and dashboard preference arrays.
- `user_preferences` stores language, timezone, notifications, and research preference JSON.
- `user_research_preferences` stores recommendation-oriented JSON arrays.

## Dashboard usage

`GET /api/dashboard/intelligence` reads `user_profiles` to rank recommended reading by matching:

- ministry
- policy area/topic
- jurisdiction
- document type

The response now also includes:

```json
{
  "personalization": {
    "enabled": true,
    "role": "student",
    "topics": [],
    "documentTypes": []
  },
  "onboarding": {
    "completed": true,
    "skipped": false
  }
}
```

The frontend dashboard uses this metadata to show a personalization prompt or a personalized context line.

## Comparison workspace isolation

The frontend comparison tray is stored under:

`rashtram:comparison-selection:<userId>`

Legacy keys are removed on load:

- `rashtram-comparison-documents`
- `rashtram-comparison-documents:<userId>`

Server-side comparison history is already fetched through `/api/profile/comparisons`, which scopes records by `req.user.id`.

