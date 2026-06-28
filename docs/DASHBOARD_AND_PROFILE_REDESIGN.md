# Dashboard and Profile Redesign

Last reviewed: 28 June 2026

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

PDF extraction, OCR, embeddings, Gemini summaries, and Pinecone indexing remain
on demand when a user opens a supported Bill or Act. The dashboard does not
bulk-process documents.

## Official source list

| Source | Dashboard status logic | Intended intelligence |
| --- | --- | --- |
| PRS Legislative Research | Connected when stored source records or runs exist | Bills, Acts, briefs and state coverage |
| Digital Sansad | Planned until a successful run or stored record exists | Parliament business, debates and questions |
| Lok Sabha | Planned until connected | Business, questions, debates and committees |
| Rajya Sabha | Planned until connected | Bills, questions, debates and proceedings |
| eGazette of India | Connected from real ingestion records | Notifications, rules, orders and Gazettes |
| India Code | Connected from real ingestion records | Official Acts and subordinate legislation |
| Ministries & Departments | Planned until connected | Policies, schemes, guidelines and consultations |
| State Legislatures | Planned until connected | State Bills, Acts and proceedings |
| State Gazettes | Planned until connected | State notifications, rules, orders and ordinances |

No planned source is presented as a live feed. The Parliament calendar and
watchlist use explicit “planned” and “coming soon” states.

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
- eGazette records become `gazette_notification`.
- IndiaCode Acts become `act_published`.
- A Bill status change is never inferred without stored status history.
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
- real category/ministry trends;
- source health;
- recent user chats;
- empty-state flags.

### `GET /api/dashboard/source-health`

Returns all nine source groups with:

- `Fresh`, `Connected`, `Stale`, `Error`, or `Planned`;
- latest run and collection;
- last refresh;
- stored source-record count;
- snapshot URL and error count where available.

### `GET /api/profile`

Returns:

- safe user identity fields, with no password or token;
- personal Bill/Act chat, summary, and message counts;
- research-history and safely inferred opened-document counts;
- platform catalogue/PDF/resource/jurisdiction counts;
- coverage by document type;
- latest collection status;
- recent research;
- source connections.

All three endpoints use the existing JWT middleware and parameterized SQL.

## Dashboard sections

1. Parliament Intelligence Brief
2. Today in Parliament & policy feed
3. Latest Bills
4. Latest legal updates
5. Parliamentary calendar connection state
6. Trending policy areas
7. Continue research
8. Watchlist placeholder
9. Source coverage and freshness
10. Recently added documents

Source names, document types, dates, and source links remain visible in the
feed. Research links are offered only for supported Bill/Act records with PDFs.

## Profile sections

1. User identity
2. Personal research activity
3. Platform-wide coverage
4. Recent research history
5. Source connections
6. Non-destructive settings placeholders
7. Consent-based Data & Personalization controls and opted-in research insights

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
- partial data and planned-source states;
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

- scheduled Digital Sansad, Lok Sabha, Rajya Sabha, ministry, and state-source
  refreshes;
- source-specific Bill lifecycle and status-history events;
- committee meeting and parliamentary business calendars;
- watchlists and topic tracking;
- personalized alerts and email digests;
- AI-generated daily briefs after source evidence is present;
- debate summarization on demand;
- source parser/error alerts;
- secure profile editing, exports, notifications, and account deletion.
