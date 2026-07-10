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
jurisdiction, department, category and type, year/session, title similarity,
legal identifiers, semantic similarity, opted-in user preferences, recent
usage/popularity, recency, quality, research readiness, and comparison
readiness. Graph relationship type and explanation are retained when present.
Results contain a normalized score, confidence, reason, and signal names.
Low-confidence results stay behind a “More” action.

## APIs and product integration

- `GET /api/documents/:id/recommendations`
- `POST /api/documents/recommend-for-comparison`
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

For a Bill, the related-document request is type-scoped to Bills. The selected
Bill, duplicates, invalid/quarantined records, and non-ready records are
excluded. If no candidate clears the confidence threshold, the product shows:
“No closely related Bills are available yet.”

Comparison recommendations accept one to five selected IDs. Candidates that
match more than one selected document receive a bounded bridge boost; verified
graph links receive a separate bounded boost. Only `comparison_ready`
candidates can be added.
# 2026-07-10 Recovery Update

Recommendation quality depends on readiness and valid source coverage. This
sprint fixed readiness promotion for documents whose extraction succeeds but
AI-provider summary/question generation fails. As more documents are processed
through the fallback-safe pipeline, recommendations can include more genuinely
research-ready and comparison-ready candidates.
