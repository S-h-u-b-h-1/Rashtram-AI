# Policy and Document Recommendation Engine

The engine identifies real, public-valid catalogue records for document
research and business/compliance questions. It never creates document titles
or recommends records outside PostgreSQL.

## Eligibility and scoring

Primary recommendations require `visibility_status = public`,
`quality_score >= 40`, a title, canonical source URL, and
`research_ready = true`. Quarantined artifacts, broken sources,
duplicate-title records, and low-quality records are excluded.

Signals include verified relationships, ministry/authority, state and
jurisdiction, category and type, full-text similarity, legal identifiers,
semantic similarity, opted-in user preferences, recency, quality, and research
readiness. Results contain a normalized score, confidence, reason, and signal
names. Low-confidence results stay behind a “More” action.

## APIs and product integration

- `GET /api/documents/:id/recommendations`
- `POST /api/recommendations/problem`
- `GET /api/recommendations/recent`
- `GET /api/profile/recommendations`

The problem endpoint accepts a problem, industry, states, company size, topic,
document types, and limit. It returns eligible catalogue records, reasons,
compliance themes, suggested questions, and the legal-research disclaimer.

Recommendations appear in document/chat research, comparison follow-up
reading, the dashboard, profile, and `/app/recommend`. Tracking uses the
consent-aware activity system. Recommendation snapshots expire after 30 days.

Sparse research-ready coverage can correctly return no result. Semantic
scoring degrades to catalogue signals if vector retrieval is unavailable.
Rashtram AI provides research assistance, not legal advice.
