# Rashtram AI v1.0 Release Report

Release date: 29 June 2026

## Production deployment

| Service | Production URL | Deployment | Status |
| --- | --- | --- | --- |
| Frontend | https://rashtram-ai.vercel.app | `dpl_5bpwBeDK6Dy1nNgzM81Xc6HpaUFB` | Ready |
| Backend | https://rashtram-ai-backend.vercel.app | `dpl_EmDhck8W6bZeGynD2DcN98bHeY2m` | Ready |

The backend `/health` endpoint returned HTTP 200 with PostgreSQL connected and
Gemini selected. The production landing page rendered in a real browser with no
console warnings or errors. Vercel error scans for both new deployments found
no error logs in the post-deployment window.

## Features completed

- Bills, Acts, and eGazette now use one shared frontend component system and
  one generic `/api/document-chat` backend contract.
- Unified chat supports streamed Markdown answers, typed passage citations,
  follow-up suggestions, regeneration, copy, feedback, summaries, related
  documents, research notes, chat pinning, bookmarks, source/PDF access, and
  Markdown export.
- Existing type-specific chat routes and data remain available for backward
  compatibility. Legacy conversations are idempotently backfilled into
  `document_chats`.
- The profile is now an editable account center with identity, professional
  details, research preferences, saved content, saved searches, collections,
  password changes, privacy controls, exports, and session management.
- Research analytics use consented PostgreSQL activity records and cover
  document activity, searches, reading time, preferred research dimensions,
  weekly/monthly activity, streaks, summaries, chats, and messages.
- The dashboard has a clearer hierarchy for the daily brief, major
  developments, verified Parliament activity, legal updates, ministry
  activity, trends, continued research, recommendations, and compact source
  health.
- New session-aware JWTs can be revoked while existing valid JWTs remain
  compatible during rollout. IP addresses are not retained in session records.
- Google OAuth is registered only when its credentials are configured, so
  missing optional OAuth configuration cannot crash the server.

## Catalogue snapshot

Production PostgreSQL after v1.0 bounded ingestion:

- Canonical documents: **17,561**
- Documents with official PDF URLs: **17,245**
- Jurisdictions represented: **32**
- Canonical source families: **4**

### Counts by source

| Source | Documents | Documents with PDF URLs |
| --- | ---: | ---: |
| PRS Legislative Research | 17,544 | 17,228 |
| India Code | 10 | 10 |
| eGazette of India | 10 | 10 |
| State Legislatures | 6 | 6 |

### Counts by document type

| Type | Documents |
| --- | ---: |
| Bill | 9,605 |
| Act | 7,948 |
| Notification | 4 |
| Circular | 1 |
| Committee report | 1 |
| Gazette | 1 |
| Other | 1 |

Counts are queried from PostgreSQL. The product does not use projected or
hardcoded catalogue totals.

## Connector verification

Runs 26–34 sampled every requested source family.

| Connector | v1.0 result |
| --- | --- |
| PRS | 3 discovered/stored; 3 safe updates or merges; 4 PDF resources |
| India Code | Connected; valid empty current sample |
| eGazette | 3 discovered/stored; 1 inserted; 2 safe merges/source additions; 3 PDF resources |
| State Legislatures | 3 discovered/stored; 3 safe updates or merges; 3 PDF resources |
| Digital Sansad | Blocked: timeout/access control |
| Lok Sabha | Blocked: JavaScript-only listing hydration |
| Rajya Sabha | Blocked: malformed headers and JavaScript-only listing hydration |
| Ministries | Blocked: HTTP 403 on the current official directory |
| State Gazettes | Blocked: interactive ASP.NET catalogue without a stable listing |

The health run reported three fresh sources, one valid no-data sample, and five
blocked sources. Every blocked reason was persisted; no inaccessible source was
represented with fabricated records or fake downloads.

## Duplicate verification

- Exact duplicate groups: **0**
- Probable-title review groups: **1,085**, covering **2,379** documents
- Pending match reviews: **1**

Probable-title groups are review candidates, not confirmed duplicates. Many
represent historically related Bill and Ordinance titles in the PRS corpus.
New sample records passed through source-ID, legal-identity, URL, content/PDF
hash, and fuzzy-title reconciliation before insert or merge.

## Performance and reliability

- One shared chat bundle and generic persistence path replace three drifting
  implementations.
- Canonical document context uses a bounded five-minute cache.
- Existing PDF chunks and summaries are reused before processing.
- Catalogue reads remain paginated and parameterized.
- New indexes cover document chat lookup, saved content, publication dates,
  ministry filtering, source identity, and session access.
- PostgreSQL uses the existing connection pool.
- Session `last_seen_at` writes are throttled to once per five minutes.
- Chat answers continue to stream rather than waiting for a complete model
  response.

## Verification results

- Backend: **61 tests**, **60 passed**, **0 failed**, **1 optional
  transaction-backed fixture skipped**
- Frontend lint: passed
- Next.js production build: passed; all 16 pages generated
- Unified chat, profile, dashboard, search, authentication, privacy,
  ingestion, deduplication, and bounded-performance tests: passed
- Production-backed authenticated smoke test: passed for dashboard, profile,
  Bills, Acts, eGazette, and unified chat history
- Local browser verification: landing and sign-in rendered without browser
  errors; protected profile access redirected to sign-in
- Production browser verification: landing page rendered without browser
  warnings or errors
- Backend production health: HTTP 200, database connected, Gemini configured
- Google OAuth initiation: HTTP 302 with the production backend callback URI
- Post-deployment Vercel error scans: clean

## Database and privacy changes

The release adds generic document chats, research notes, chat feedback, user
profiles, saved content, saved searches, collections and collection items, and
revocable user sessions. Migrations are idempotent and run through the existing
database bootstrap.

Activity tracking remains allowlisted, sanitized, bounded, and consent-based.
Query strings, secret-like metadata keys, raw chat contents, and session IP
addresses are not used as behavioural analytics.

## Known limitations and roadmap

- Five official source families currently block stable automated collection.
  Scheduled retries should remain polite; adapters should expand only when
  stable official pages, feeds, sitemaps, or documented APIs become available.
- The probable-title queue needs editorial review and improved historical PRS
  type normalization. It must not be bulk-merged automatically.
- Page-number-aware citations, shared organization collections with role-based
  access, and background processing for very large PDFs are future work.
- Dashboard modules can deepen as committee, debate, question, rules,
  regulation, policy, and ministry coverage grows from verified public records.
- Error tracking/drains beyond Vercel runtime logs remain an observability
  opportunity for the next release.

## Architecture references

- `DOCUMENT_CHAT_ARCHITECTURE.md`
- `PROFILE_SYSTEM.md`
- `DASHBOARD_AND_PROFILE_REDESIGN.md`
- `DATA_TRUST_AND_PRIVACY.md`
- `LEGISLATIVE_INGESTION_ARCHITECTURE.md`
- `SOURCE_CONNECTOR_STATUS.md`
