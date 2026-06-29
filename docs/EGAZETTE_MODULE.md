# eGazette Module

Last reviewed: 29 June 2026

## Purpose

The eGazette module makes official Gazette records a first-class Rashtram AI
research surface alongside Bills and Acts. It provides:

- a searchable, filterable, server-paginated Gazette catalogue;
- verified metadata, official PDF, and source links;
- on-demand PDF extraction, chunking, and vector indexing;
- a structured Gemini research brief;
- evidence-grounded, streaming document chat with retrieved passage citations;
- persistent user chat history and profile/dashboard integration;
- related-document and recommendation context.

Catalogue ingestion remains separate from AI processing. Collectors store
metadata and official URLs in PostgreSQL. A PDF is downloaded and indexed only
after an authenticated user opens that Gazette research workspace.

As of v1.0, Gazette chat uses the same `DocumentChatLayout`,
`document_chats`, and `/api/document-chat` pipeline as Bills and Acts. The
Gazette-specific endpoints below remain as compatibility routes for older
clients. See `DOCUMENT_CHAT_ARCHITECTURE.md`.

## User experience

Authenticated workspace navigation is ordered Dashboard, Bills, Acts,
eGazette, and Profile.

`/app/egazette` contains a responsive desktop table and mobile cards. Search
covers title, Gazette and notification identifiers, ministry, department,
authority, stored source metadata, and already indexed PDF text. Filters cover ministry, department,
notification type, Gazette type, jurisdiction, year, publication-date range,
source, and PDF availability. Sorting and pagination are performed by the
server.

Each row provides **Open** and **Research** for the Gazette workspace, **PDF**
when an official PDF exists, and **Source** for the canonical public record.

`/app/egazette-chat/[id]` presents:

- typed Gazette metadata and provenance;
- the saved or generated structured summary;
- persistent chat history;
- streaming answers grounded in Pinecone-retrieved PDF chunks;
- visible cited passage previews;
- suggested follow-up questions, regenerate, and clear controls;
- explicit catalogue relationships and heuristic recommendations.

When a Gazette has no official PDF, the metadata and provenance remain
available, but grounded document chat is disabled rather than silently using
unverified context.

## Backend APIs

All endpoints use the existing JWT middleware.

| Method | Endpoint | Purpose |
| --- | --- | --- |
| `GET` | `/api/egazettes` | Catalogue search, filters, sorting, pagination |
| `GET` | `/api/egazettes/filters` | Available filter values |
| `GET` | `/api/egazettes/:id` | Detail, resources, relationships, recommendations |
| `POST` | `/api/process-egazette` | On-demand official PDF processing |
| `GET` | `/api/egazette-summary?gazetteId=…` | Cached vector summary |
| `POST` | `/api/egazette-chat/session` | Create or refresh a persistent session |
| `GET` | `/api/egazette-chat/history` | One history or recent Gazette chats |
| `POST` | `/api/egazette-chat/message` | Persist a user or assistant message |
| `PATCH` | `/api/egazette-chat/summary` | Persist the generated summary |
| `DELETE` | `/api/egazette-chat/history` | Clear messages for one Gazette |
| `POST` | `/api/egazette-chat` | Stream an evidence-grounded answer |

The processing and session endpoints accept a Gazette ID but do not trust
browser-supplied PDF URLs, titles, or source metadata. They reload the
canonical record from PostgreSQL before writing or downloading anything.

## PostgreSQL model

Gazette records reuse `legislative_documents`; no parallel catalogue is
created. Relevant typed fields include:

- `document_type`, `gazette_identifier`, `legal_identifier`;
- `ministry`, `department`, `authority`, `category`;
- `publication_date`, `effective_date`, `year`;
- `jurisdiction_level`, `jurisdiction`;
- `canonical_source`, `canonical_url`, `pdf_url`;
- `source_metadata`, `metadata_json`, provenance timestamps.

`egazette_chats` stores one active chat per `(user_id, gazette_id)` with title,
identifiers, status, official links, summary, messages, metadata, and recent
access/message timestamps. Its structure follows the established Bill and Act
chat models while keeping those existing tables compatible.

## RAG and AI flow

```text
open Gazette workspace
    -> load canonical PostgreSQL record
    -> check Gazette ID in Pinecone namespace
       -> exists: reuse chunks and summary
       -> absent:
          -> fetch canonical official PDF
          -> extract and clean text
          -> create overlapping sentence chunks
          -> create embeddings in batches
          -> write Gazette-filtered vectors
          -> generate and cache structured summary
    -> user asks a question
    -> embed query
    -> retrieve top Gazette-ID-filtered chunks
    -> stream Gemini answer with [Passage N] labels
    -> display and persist answer plus cited passage metadata
```

The configured Gazette index can use `PINECONE_EGAZETTE_INDEX_NAME`. If it is
not set, the module uses the existing Act index with the shared namespace and a
strict `gazetteId` metadata filter. This provides backward-compatible
deployment without bulk migration.

The structured summary covers operative changes, affected authorities and
persons, related legislation, dates, definitions, duties, procedures,
penalties, enforcement, and identifiable related documents. Its prompt
prohibits invention and explicitly marks absent evidence.

## Dashboard, profile, and activity

The dashboard returns `recentGazetteNotifications`, based only on stored
Gazette records, and renders a dedicated recent-notifications section.

The profile separates personal Gazette research from platform coverage:

- Gazette chats, summaries, and messages;
- Gazette documents opened through consent-based activity tracking;
- recent Gazette research;
- favorite Gazette categories derived from opted-in activity;
- platform-wide Gazette catalogue counts.

Generic privacy-safe activity events are reused with
`entity_type = "gazette"`. Chat text, PDF text, tokens, passwords, and secrets
are never sent to the activity endpoint.

## Intelligence events

New Gazette catalogue records emit the most specific supported event:

- `gazette_notification`
- `rule_published`
- `ordinance_published`
- `government_order`

A meaningful update to an eGazette record emits `notification_updated`.
Unchanged refreshes remain silent.

## Recommendations and relationships

Verified relationships come from `document_relationships` with confidence and
provenance retained. When explicit relationships are unavailable, the detail
API offers conservative recommendations using shared ministry, authority,
jurisdiction, and meaningful normalized-title terms. These suggestions are
visually distinguished from verified relationships.

## Configuration and verification

The module uses existing PostgreSQL, Gemini, Pinecone, JWT, and frontend API
environment variables. `PINECONE_EGAZETTE_INDEX_NAME` is optional. No
credentials are committed to the repository.

Automated coverage includes Gazette record mapping, parameterized filters,
scope rules, event types, dashboard/profile mappings, the existing regression
suite, frontend lint, and a production build. Production checks should cover
backend health, authentication rejection, authenticated catalogue/detail
responses, frontend route rendering, and one readable PDF chat flow.
