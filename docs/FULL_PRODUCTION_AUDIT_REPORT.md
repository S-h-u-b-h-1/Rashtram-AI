# Full Production Audit Report

Audit date: 3 July 2026

## Scope

The release audit covered the universal document model, migrations, catalogue
deduplication, PDF safety, multilingual extraction/OCR, chunking, embeddings,
Pinecone retrieval, readiness gates, chat initialization, comparison,
recommendations, knowledge graph integration, filters, sorting, search,
dashboard intelligence, profile data, contact/feedback infrastructure,
scheduled ingestion, source health, and Vercel configuration.

## Defects found and fixed

### Data and infrastructure

- Added explicit research/comparison readiness, stage states, counts, language,
  failure classification, attempts, and diagnostic details.
- Added an idempotent processing-job table and prioritized bounded CLI.
- Replaced session-level PostgreSQL advisory locks with transaction-scoped
  locks. Session locks are unsafe through Neon transaction pooling and had
  left an idle backend blocking application and audit processes.
- Fixed readiness audit joins to use the real PDF/MIME source columns.
- Added normalized PostgreSQL chunk/vector-reference persistence.
- Added URL protocol/private-network checks and PDF signature validation.

### Product truthfulness

- A PDF, text artifact, or generated summary no longer implies readiness.
- Non-ready document pages do not auto-create chats or fake welcome messages.
- Prepare for Research shows progress/failure and promotes only after retrieval
  succeeds.
- Research and comparison controls expose exact disabled reasons.
- Catalogue filters now include research-ready and comparison-ready states.
- Dashboard readiness metrics come from PostgreSQL rather than hardcoded data.

### Recommendations and comparison

- Related Bill requests are type-scoped and use ministry, department,
  jurisdiction/state, category, year, title/legal identifiers, graph edges,
  semantic retrieval, profile preferences, popularity, recency, quality, and
  readiness.
- Duplicate, selected, quarantined, low-quality, and non-ready candidates are
  excluded by default.
- Comparison recommendations accept one to five selected documents, identify
  bridge candidates, apply graph boosts, explain their signals, and expose only
  comparison-ready Add to Compare actions.
- The exact empty Related Bills copy is:
  “No closely related Bills are available yet.”

## Verification completed

- Database migration 006 applied successfully.
- Full readiness audit completed for all 17,744 documents.
- Safe backfill processed 10/10 retried documents, added 131 chunks, and
  increased research/comparison-ready totals from 6 to 16.
- Final readiness state contains 137 chunks and 137 embeddings.
- Server tests: 112 passed, 1 integration fixture intentionally skipped.
- Client lint passed.
- Next.js production build passed with all 21 routes generated.
- Initial backfill failed closed on an empty Pinecone secret and recorded the
  failures without false readiness promotion.

## Production verification

- Backend deployment `dpl_A8Qsq6iTZ4MQPJFjwmFCc2gTaZkW` is READY and aliased
  to `https://rashtram-ai-backend.vercel.app`.
- Frontend deployment `dpl_DhR1oGHCinaAkX7wcLb67HSZfmGF` is READY and aliased
  to `https://rashtram-ai.vercel.app`.
- Backend `/health` returned `status=OK`, `database=connected`, and
  `aiProvider=openai`.
- The landing page returned HTTP 200, title `Rashtram AI`, the official
  favicon returned HTTP 200, and no console warnings/errors were observed.
- Unauthenticated `/app` access redirected truthfully to the production login
  page.
- A 390px production viewport had no horizontal overflow.
- Frontend and backend Vercel error-log scans found no errors in the first
  30 minutes after deployment.
- Live recommendation validation returned a relevant GST amendment Bill for a
  selected GST Bill and returned an honest empty result for a weak broadcasting
  comparison match.

An authenticated end-to-end chat/comparison browser session was not performed
because the verification browser had no test account session. The same newly
processed documents passed the server-side retrieval probe that gates both
features; authenticated manual smoke testing remains recommended.

## Remaining limitations

- Processing the full PDF backlog is an ongoing controlled operation, not a
  safe single deployment step.
- Request-bound Prepare for Research should be moved to a durable worker for
  large/OCR-heavy documents.
- Recommendation quality is bounded by sparse current graph (about 1.2%
  catalogue coverage) and research-ready coverage; metadata fallback remains
  active and reasons remain explicit.
- Provider credentials previously shared in chat should be rotated.

## Duplicate audit

The required duplicate-candidate audit completed and found 1,085 grouped title
candidates covering 2,379 records. These are review candidates, not safe
automatic deletions: many groups intentionally contain a Bill and Ordinance
with the same normalized subject/year. Runtime recommendations already exclude
same normalized-title/type/year/jurisdiction candidates, and ingestion retains
the tested exact-before-fuzzy deduplication rules. A supervised catalogue
cleanup remains necessary; this release does not destructively merge ambiguous
legal records.
