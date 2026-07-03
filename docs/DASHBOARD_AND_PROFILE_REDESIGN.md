# Dashboard and Profile Redesign

Last reviewed: 29 June 2026

## Product purpose

The authenticated experience now separates two different questions:

- The dashboard answers **“What should I know today?”**
- The profile answers **“What have I researched, and how much does the
  platform cover?”**

The dashboard is a legislative intelligence workspace, not a catalogue-stat
page. Personal usage and platform-wide coverage have moved to the profile,
where they are visibly separated.

## Data architecture

```text
Official and trusted sources
    -> CLI or scheduled source connectors
    -> PostgreSQL canonical catalogue + intelligence events
    -> authenticated Express APIs
    -> Next.js dashboard and profile
    -> on-demand PDF processing and research chat
```

The browser never scrapes external sites. Dashboard and profile pages only read
structured data from the Rashtram AI backend.

PDF extraction, OCR, embeddings, OpenAI summaries, and Pinecone indexing remain
on demand when a user opens a supported Bill, Act, or eGazette record. The
dashboard does not bulk-process documents.

## Official source list

| Source | Dashboard status logic | Intended intelligence |
| --- | --- | --- |
| PRS Legislative Research | Connected when stored source records or runs exist | Bills, Acts, briefs and state coverage |
| Digital Sansad | Not Run, Connected/Fresh, Degraded, or Blocked from real run evidence | Parliament business, debates and questions |
| Lok Sabha | Not Run, Connected/Fresh, Degraded, or Blocked from real run evidence | Business, questions, debates and committees |
| Rajya Sabha | Not Run, Connected/Fresh, Degraded, or Blocked from real run evidence | Bills, questions, debates and proceedings |
| eGazette of India | Connected from real ingestion records | Notifications, rules, orders and Gazettes |
| India Code | Connected from real ingestion records | Official Acts and subordinate legislation |
| Ministries & Departments | Not Run or Blocked until the official interactive directory exposes links | Policies, schemes, guidelines and consultations |
| State Legislatures | Per-portal Not Run, Connected/Fresh, Degraded, or Blocked | State Bills, Acts and proceedings |
| State Gazettes | Not Run or Blocked when the ASP.NET directory cannot be enumerated | State notifications, rules, orders and ordinances |

No not-yet-run or blocked source is presented as a live feed. The Parliament
calendar and watchlist use explicit “planned” and “coming soon” product states.

Public dashboard and profile presentation groups sources into product-safe
categories such as “Official Gazette Records” and “Parliamentary Public
Records”. Exact repositories, URLs, source IDs, hashes, parser state, and
ingestion history remain in PostgreSQL for audit and document-level
provenance. Exact source links appear only in document research/provenance
actions.

## Intelligence event model

`intelligence_events` stores:

- stable event key and event type;
- title and optional summary;
- canonical document reference;
- source name and source URL;
- document type, jurisdiction, authority, ministry, category, and status;
- event date and importance score;
- metadata and first/last-seen timestamps.

Supported event types include document additions, Act and rule publication,
Gazette notifications, ordinances, committee reports, debates, questions,
policies, consultations, and future lifecycle events.

### Conservative event rules

- New source ingestion creates an event only when it creates a new canonical
  document.
- A stored document creates `document_updated` only when a title, status, PDF,
  or legal date meaningfully changes; unchanged refreshes remain silent.
- eGazette notifications/Gazettes become `gazette_notification`; records
  explicitly identified as rules, orders, or ordinances retain those event
  types.
- IndiaCode Acts become `act_published`.
- A Bill introduction requires an explicit introduction date, and a status
  change requires stored status history.
- Existing official IndiaCode/eGazette canonical documents are backfilled from
  real stored catalogue fields.
- If no event exists, the API marks `noLiveEvents` and provides recent
  catalogue documents as an explicitly labelled fallback.

## Authenticated APIs

### `GET /api/dashboard/intelligence`

Returns:

- user greeting and current date;
- last successful refresh and freshness summary;
- deterministic brief based on stored events and source state;
- real recent-item counts for the last 24 hours and seven days;
- intelligence feed;
- recent documents;
- active Bills with safely recognized statuses;
- latest Acts, rules, regulations, notifications, Gazettes, policies,
  circulars, ordinances, and orders;
- a dedicated recent Gazette-notifications collection;
- real category/ministry trends;
- source health;
- recent user chats;
- empty-state flags.

### `GET /api/dashboard/source-health`

Returns all nine source groups with:

- `Fresh`, `Connected`, `Stale`, `Degraded`, `Blocked`, `Error`, or
  `Not Run`;
- latest run and collection;
- last refresh;
- stored source-record count;
- snapshot URL and error count where available.

### `GET /api/profile`

Returns:

- safe user identity fields, with no password or token;
- personal Bill/Act/eGazette chat, summary, and message counts;
- research-history and safely inferred opened-document counts;
- platform catalogue/PDF/resource/jurisdiction counts;
- coverage by document type;
- latest collection status;
- recent research;
- source connections.

All three endpoints use the existing JWT middleware and parameterized SQL.

## Dashboard sections

1. Today’s Parliament Intelligence Brief
2. Major legislative developments by document type
3. Live Parliament activity from verified source records
4. Latest Bills
5. Legal and Gazette updates
6. Ministry activity
7. Trending policy areas
8. Preference-aware recommended reading
9. Continue research
10. Compact source coverage and freshness
11. Recently added documents

Source names, document types, dates, and source links remain visible in the
feed. Research links are offered for supported Bill, Act, and eGazette records
with official PDFs.

## Profile sections

1. User identity
2. Personal research activity
3. Platform-wide coverage
4. Recent Gazette research and favorite Gazette categories
5. Recent research history
6. Source connections
7. Non-destructive settings placeholders
8. Consent-based Data & Personalization controls and opted-in research insights

The v1.0 account center adds editable professional details, research/language/
theme preferences, bookmarks, saved searches, pinned chats, collections,
session management, password changes, and export. See `PROFILE_SYSTEM.md`.

Dashboard counts, ministry activity, major-development counts, source status,
and recommendations come from PostgreSQL. Placeholder calendar and watchlist
cards are no longer presented as implemented functionality.

Personal activity is labelled separately from shared platform coverage so
catalogue totals cannot be mistaken for user achievements.

Activity tracking is disabled by default. When a user opts in, the profile can
show recent opened documents, topic and jurisdiction signals, viewed document
types, and recent searches. Tracking failures never block research actions.
Passwords, tokens, chat text, document contents, and secret-like metadata keys
are never accepted by the activity endpoint.

## Frontend states

Dashboard and profile implement:

- loading skeletons;
- authenticated route protection;
- empty feed and empty research states;
- partial data, not-yet-run, blocked, and degraded-source states;
- stale/error source states;
- backend error recovery links;
- desktop, tablet, and mobile navigation.

The authenticated navigation now contains Intelligence, Parliament Bills,
Parliament Acts, and Profile. Bills and Acts retain their existing components
and chat flows.

## Verification commands

```bash
npm test --prefix server
npm run lint --prefix client
npm run build --prefix client
```

The lint command now uses a committed ESLint configuration rather than the
interactive deprecated `next lint` setup prompt.

## Future improvements

- scheduled checkpointed refreshes for every implemented source;
- source-specific Bill lifecycle and status-history events;
- committee meeting and parliamentary business calendars;
- watchlists and topic tracking;
- personalized alerts and email digests;
- AI-generated daily briefs after source evidence is present;
- debate summarization on demand;
- source parser/error alerts;
- secure profile editing, exports, notifications, and account deletion.
