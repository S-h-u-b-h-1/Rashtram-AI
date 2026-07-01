# Rashtram AI Final Production QA Report

Date: 1 July 2026  
Release branch: `codex/sync-shourya-rashtramai`

## Release scope

This release focuses on production truthfulness and stability. It does not add
speculative product features. The verified user story is:

1. A researcher signs in.
2. The dashboard loads current PostgreSQL-backed catalogue and source data.
3. The researcher filters and sorts Bills, Acts, Gazette records, and Policies.
4. A document is clearly labelled as source-only, PDF-available,
   research-ready, or processing-failed.
5. Grounded chat becomes available only after readable text is indexed.
6. Chats, notes, profile changes, bookmarks, and collections persist.

## Bugs found and fixed

- Newest/oldest sorting used only `publication_date`, producing visibly mixed
  year order when publication dates were absent.
- Title sorting displayed date-oriented direction labels.
- Date-range filtering existed in the API but was not exposed in the UI.
- Documents with a PDF URL were presented as research-ready before indexing.
- Failed processing was not persisted as a document readiness state.
- Single-document chat could call the model with no retrieved passages.
- Dashboard platform coverage was absent while Profile showed platform-wide
  statistics.
- Profile appeared in the main document navigation.
- Profile notes were not visible outside individual document workspaces.
- Profile editing had no explicit cancel action or notification controls.
- Feedback and bug-report entry points were missing from Profile.
- Dashboard did not periodically refresh.
- Duplicate App Router and public favicon files caused `/favicon.ico` to return
  500 in development.

## Filters and sorting

The universal document API keeps filtering and pagination server-side.
Supported fields include keyword, type, year, ministry, authority, category,
jurisdiction, status, source, PDF availability, and publication date range.

Newest/oldest ordering now uses this deterministic date precedence:

1. publication date
2. introduced date
3. passed date
4. enacted date
5. effective date
6. commencement date
7. document year
8. first seen timestamp
9. updated timestamp
10. created timestamp

Regression tests cover the complete fallback and readiness contract. The
release smoke test verifies both ascending and descending API results against
the live database.

## Dashboard

- Added compact PostgreSQL-backed coverage cards for total documents,
  Parliament Bills, State Bills, Acts, Gazette records, Policies, documents
  with PDFs, and jurisdictions.
- Retained real source freshness and latest ingestion timestamps.
- Added a safe 60-second dashboard-only refresh.
- Empty sections remain hidden or show explicit empty states.
- No estimates or projected counts are used.

## PDF readiness and chat grounding

Documents expose one of these states:

- Research Ready
- PDF Available
- Processing Failed
- Source Only
- Missing PDF

Processing status and errors persist in PostgreSQL. Catalogue rows use
“Prepare research” until indexing succeeds. Failed or missing PDFs cannot be
presented as research-ready.

Chat streams a visible “Preparing grounded response…” state. If retrieval
returns no usable text, the application responds:

> I could not find enough grounded context in this document to answer reliably.

No model call is made in that case.

## Profile and research workspace

- Profile is accessible from the bottom-left user identity block and removed
  from primary document navigation.
- Platform-wide catalogue statistics were removed from Profile.
- Name, professional details, interests, ministries, states, topics, language,
  visibility, and notification preferences remain editable and PostgreSQL
  backed.
- Email is read-only because a verified email-change flow is not implemented.
- Save, cancel, validation, success, and error states are present.
- Recent chats, saved content, collections, sessions, and research notes are
  account-specific and reload-safe.

## Feedback and bug reports

Profile now provides “Send Feedback” and “Report a Bug” forms. Both use the
existing Formspree integration, include validation, loading/error/success
states, duplicate-submission protection, page context, and a honeypot.

## Automated verification

- Backend unit/integration tests: 80 passed, 1 database-write fixture skipped.
- Frontend lint: passed.
- Next.js production build: passed for all 19 routes.
- Live PostgreSQL release smoke test: passed for dashboard, profile, Bills,
  Acts, Gazette, Policies, universal search/detail/timeline/graph, and chats.
- Browser QA: landing page, email authentication, dashboard, document filters,
  profile persistence, support forms, mobile navigation, horizontal overflow,
  and console warnings/errors checked.

## Known limitations

- A PDF can be available but not yet indexed; this is now disclosed as
  “PDF Available” and requires “Prepare research.”
- Source sites can be stale, blocked, or temporarily unavailable. The dashboard
  reports those states rather than fabricating freshness.
- Google OAuth depends on production Google Cloud redirect configuration and
  credentials; email authentication remains the deterministic fallback.
- Formspree delivery depends on the verified recipient and production endpoint.
- Full answer quality depends on OpenAI, Pinecone, and source PDF availability.

## Release recommendation

Release only after the updated backend and frontend are deployed together and
the post-deploy smoke test confirms non-zero dashboard coverage, ascending and
descending sort order, profile persistence, readiness gating, and production
runtime logs without new 5xx errors.
