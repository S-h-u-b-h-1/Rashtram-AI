# Data Trust and Privacy

Last reviewed: 28 June 2026

## Public source branding policy

Rashtram AI presents its catalogue publicly as government-verified public
legislative data, public legal and policy documents, official public records,
and trusted legislative references.

Dashboard, profile, landing, and product pages use grouped descriptions:

- Verified Legislative References
- Parliamentary Public Records
- Official Gazette Records
- Official Acts Repositories
- Public Policy & State Records

The public interface does not advertise scraper paths, parser selectors,
internal API endpoints, connector implementation, database table names, or
request mechanics. Exact source links remain available when a user opens a
document, requests provenance, or needs the original legal record.

Rashtram AI is a research product, not a legal authority. Original government
and public records remain the final reference.

## Internal provenance policy

Public simplification does not remove evidence. PostgreSQL retains:

- exact source name, stable source record ID, and source URL;
- canonical URL and PDF URL;
- source metadata and related resources;
- HTML, PDF, content, and text hashes when available;
- first-seen, last-seen, and update timestamps;
- ingestion runs, source snapshots, counters, and errors;
- deduplication decisions and manual-review candidates.

Source priority affects canonical presentation but never deletes the attached
source record.

## Deduplication

Matching remains layered:

1. exact source identity;
2. scoped legal identifiers;
3. PDF/content SHA-256;
4. normalized text fingerprint;
5. same-year, same-type, same-jurisdiction title similarity.

Scores at or above `0.92` can merge, `0.80–0.92` are queued for review, and
lower scores create a separate canonical document. Bills and enacted Acts stay
separate and may be connected by a relationship.

## Connector and collection safety

All collection runs through CLI or scheduled ingestion. The browser and
dashboard never scrape external sites.

Collectors:

- respect robots rules;
- identify the catalogue user agent;
- throttle requests by host;
- retry transient failures;
- capture response hashes and errors;
- avoid CAPTCHA, authentication, and access-control bypasses.

`npm run ingest:health --prefix server` performs read-only sample checks. It
does not write catalogue data, download PDFs, invoke AI, or fill Pinecone.
Health distinguishes an implemented connector that has not run (`Not Run`)
from a source that is technically inaccessible (`Blocked`). Blocked reasons
are retained internally, and public source cards continue to use grouped
source branding.

PDF downloading is disabled by default. Bounded verification can be enabled
with `--download-pdfs=true`, `--max-pdfs`, and `--pdf-storage`. URL-only mode
hashes bytes transiently; filesystem mode requires an explicit storage
directory. Unconfigured database or object storage is rejected rather than
silently storing files.

## Consent-based user activity

Activity collection is disabled by default for every user. The authenticated
profile contains the control that enables or pauses future collection.
Personalized suggestions have a separate toggle and require activity history.

When enabled, the allowlisted activity model may store:

- dashboard and profile views;
- document, Bill, Act, summary, source, and research actions;
- searches and selected filters;
- chat start/message events without message text;
- session-scoped random identifiers;
- page path without query strings;
- bounded topic, ministry, jurisdiction, and document-type metadata.

Aggregates support Continue Research, recent opened documents, top topics,
jurisdiction signals, viewed document types, and future recommendations.

## Data not collected

The activity endpoint rejects or strips:

- passwords and passcodes;
- authentication, OAuth, or API tokens;
- cookies and credentials;
- API keys and secrets;
- chat message text;
- document contents;
- URL query strings and fragments;
- unbounded JSON or unsupported event types.

Tracking is authenticated, rate-limited, parameterized, size-bounded, and
non-blocking in the UI. Activity data is not sold or exposed as public product
data.

## Storage model

- `user_activity_events` is the append-only allowlisted event ledger.
- `user_document_interactions` stores per-document interaction counts.
- `user_research_preferences` stores consent state, bounded preference
  signals, and last activity.

All rows are tied to the user with cascading account deletion. Disabling
tracking stops future writes; it does not silently destroy historical data.

## Export and deletion

The profile currently shows non-destructive export and activity-deletion
placeholders. Secure authenticated export and deletion workflows remain future
work. They must include identity re-verification, audit logging, rate limits,
and explicit confirmation before release.

## Dashboard fallback rules

The dashboard reads stored PostgreSQL events and documents only:

- source-supported events are preferred;
- meaningful catalogue changes use `document_updated`;
- unchanged refreshes do not create activity;
- Bill introduction and status-change events require explicit source dates or
  a real stored status transition;
- empty event feeds fall back to clearly labelled recent catalogue records;
- unavailable sources are shown as not run, stale, degraded, blocked, or
  unavailable without projected counts;
- no Parliament agenda or news item is invented.
