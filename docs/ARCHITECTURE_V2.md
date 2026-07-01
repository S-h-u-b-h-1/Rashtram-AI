# Rashtram AI Architecture v2

Last reviewed: 30 June 2026

## Architectural objective

Rashtram AI is a universal legislative and public-policy platform. Bills,
Acts, Gazettes, rules, regulations, circulars, orders, office memoranda,
policies, consultations, committee reports, questions, debates, proceedings,
guidelines, schemes, ordinances, strategy papers, white papers, manuals,
reports, Cabinet decisions, press releases, government resolutions,
recommendations, and discussion papers share one document contract.

Adding a document type requires:

1. a source connector;
2. normalization into the universal ingestion record;
3. a type/retrieval-family mapping.

It does not require a new catalogue page, API, chat service, summary route, or
database table.

## Universal document model

`legislative_documents` is the canonical table. `DocumentRepository.mapDocument`
exposes this stable public contract:

```text
id
canonicalId
title
type
subtype
authority
jurisdiction
jurisdictionLevel
ministry
department
publicationDate
status
source
sourceUrl
pdfUrl
metadata
summary
relationships
```

Legal identifiers, Bill/Act/Gazette numbers, lifecycle dates, provenance,
content fingerprints, and canonical source identity remain available as
specialized fields. Type-specific source metadata stays inside `metadata`.
`file_hash`, `mime_type`, and `file_size_bytes` retain discovered asset
identity without requiring a bulk file download.

`source_directory_entries` separately stores ministries, departments, states,
and Union Territories. Directory entities are not fabricated as documents;
they become authorities and discovery targets for later document collection.

## Backend layers

```text
connector
  -> universal normalizer
  -> ingestion dedupe/canonical merge
  -> legislative_documents
  -> DocumentRepository
  -> DocumentService
  -> /api/documents
  -> shared catalogue / document workspace / command palette
```

### DocumentRepository

`server/document/DocumentRepository.js` owns document reads:

- `find`
- `search`
- `getById`
- `getRelated`
- `getSummary`
- `getPDF`
- `getChatHistory`
- `getRecommendations`
- `getResources`
- `getTimeline`
- `getGraph`
- `getFilterOptions`

All filters are parameterized. Pagination is bounded. Search covers the title,
legal and publication numbers, ministry, department, authority, category,
metadata, and source metadata. A stored PostgreSQL `TSVECTOR` and GIN index
provide full-text search. Optional semantic results from processed PDF chunks
are merged with lexical matches.

### DocumentService

`server/document/DocumentService.js` coordinates repository results and
optional semantic expansion. It returns the complete document workspace:
metadata, resources, summary, relationships, recommendations, timeline, and
knowledge graph.

## Universal API

All routes require authenticated access.

| Method | Route | Purpose |
| --- | --- | --- |
| `GET` | `/api/documents` | Paginated catalogue with reusable filters |
| `GET` | `/api/documents/search` | Lexical and optional semantic search |
| `GET` | `/api/documents/filters` | Available filter values |
| `GET` | `/api/documents/:id` | Complete document workspace |
| `GET` | `/api/documents/:id/summary` | Current user summary |
| `GET` | `/api/documents/:id/relationships` | Verified graph edges |
| `GET` | `/api/documents/:id/recommendations` | Ranked related reading |
| `GET` | `/api/documents/:id/timeline` | Lifecycle and relationship events |
| `GET` | `/api/documents/:id/graph` | Document/entity nodes and edges |
| `POST` | `/api/documents/chat` | Streamed one-to-five-document RAG chat |

Legacy Bill, Act, and eGazette endpoints remain compatibility surfaces. Current
catalogue UI and generic research navigation use `/api/documents`.

## Universal frontend

`DocumentExplorer` replaces separate Bill, Act, and Gazette catalogue
implementations. Configuration determines scope; rendering, search, filters,
pagination, source/PDF access, selection, and research navigation are shared.

Current views:

- Bills: `type=bill`, Parliament jurisdiction
- State Bills: `type=bill`, State jurisdiction
- Acts: `type=act`, Parliament jurisdiction
- State Acts: `type=act`, State jurisdiction
- eGazette: Gazette/subordinate-law scope
- Policies: policy, scheme, guideline, consultation, strategy, report,
  recommendation, resolution, and Cabinet-decision scope
- All documents: no type restriction

Every result opens `/app/document/:id`. `UniversalDocumentRoute` resolves the
document type from the API and renders the existing shared
`DocumentChatLayout`. Future document types therefore use the same summary,
source, notes, timeline, graph, related-document, and chat UI.

On wide screens, `DocumentChatLayout` presents a three-pane research workspace:
the official PDF, the evidence brief and document intelligence, and the
grounded conversation. Smaller screens retain the same information through a
progressively disclosed document panel. Processing failure is controlled and
retryable; it never replaces the source PDF with a blank workspace.

## Global search and command palette

`GlobalCommandPalette` is mounted once in `WorkspaceShell` and opens with
Command-K or Control-K. It searches:

- all document types;
- recent document chats;
- application pages and commands.

It uses `/api/documents/search`, so command-palette results and catalogue
results cannot drift into separate search implementations.

## Universal chat and retrieval

`DocumentChatLayout`, `DocumentChat`, and `/api/document-chat` remain the
single-document conversation system. `documentTypes.js` maps every supported
type to one of the currently provisioned retrieval families:

```text
bill -> Bill vector index
act -> Act vector index
all other legal/public-policy instruments -> universal legal-instrument index
```

The family mapping is an infrastructure detail. Public APIs use canonical
document types and IDs.

Cross-document chat accepts one to five canonical IDs. The server:

1. loads each canonical document;
2. retrieves bounded passages using its mapped retrieval family;
3. labels every passage with its document title and source;
4. streams one OpenAI response grounded across the selected set.

The browser never supplies PDF URLs to the processing pipeline.
Policy and regulator documents use the same on-demand legal-instrument
retrieval family; catalogue collection never triggers OCR, embedding, or AI
generation.

## Universal summaries

`generateDocumentSummary(type, content)` is the only summarization entry point.
Type guidance is declarative. Bills emphasize clauses and legislative stage;
Acts emphasize rights, duties, authorities, enforcement, and commencement;
rules and regulations emphasize delegated authority and compliance; policies,
consultations, committee reports, questions, debates, guidelines, and schemes
have corresponding evidence-focused guidance.

All summaries instruct the model to use supplied text only and state when
evidence is absent.

## Relationship graph and timeline

`document_relationships` stores verified document-to-document edges such as:

- amends
- repeals
- implements
- refers to
- supersedes
- related

The API also derives document-to-authority, document-to-ministry, and
document-to-jurisdiction edges. State jurisdictions and committee metadata are
represented as explicit state and committee nodes. Relationship direction is
preserved for edges such as `amends`, `repeals`, `implements`, `refers_to`,
`supersedes`, and `uses`. The document workspace exposes the bounded one-hop
graph and provides links back into the generic document route.

The timeline combines canonical lifecycle dates, verified intelligence events,
and dated related documents. It supports Bill introduction, committee/debate
events, passage, assent, enactment, Gazette publication, rules, notifications,
and amendments when those facts exist. Missing stages are not fabricated.

## Recommendations

Recommendations rank:

- verified graph relationships;
- shared type, ministry, authority, category, and jurisdiction;
- user-preferred ministries, topics, jurisdictions, and document types;
- recent verified Parliament/intelligence activity;
- the user’s prior document activity.

The document workspace also suggests the user’s existing research chats when
their documents share verified relationships, ministries, authorities,
categories, or jurisdictions with the current record. The source record and
relationship provenance remain available for verification.

## Collections

Existing `research_collections` and `research_collection_items` store generic
`document_type` and `document_id` values. They are already independent of Bill,
Act, or Gazette tables and therefore support every current and future type.

## National governance intelligence

The dashboard API returns independent, evidence-backed feeds for latest Bills,
Acts, policies, Gazette notifications, ministry updates, state updates,
regulator updates, committee activity, public consultations, and Cabinet
decisions. Empty feeds render explicit empty states rather than synthetic
activity.

The profile distinguishes personal research from platform coverage. It reports
policy conversations and catalogue-wide policy/regulator coverage alongside
the dynamically discovered ministry, department, state, and Union Territory
directory.

## Performance

- Full-text search uses a generated `TSVECTOR` and GIN index.
- JSON metadata uses a GIN index.
- Type/date, authority/date, ministry/date, source/date, chat, and relationship
  indexes support common access paths.
- Search and list limits are bounded to 100 records per request.
- Semantic search is optional and falls back to PostgreSQL without hiding the
  failure.
- Document context uses the existing bounded five-minute cache.
- PDF chunks and summaries are reused before processing.
- Cross-document retrieval is capped at five documents and twelve passages.
- The frontend ships one catalogue component and one document workspace.
- Unused Bill-, Act-, and Gazette-specific client API wrappers were removed;
  the browser uses only the universal document and chat clients.

## Compatibility and deprecation

Legacy routes and models are retained for existing bookmarks and clients:

- `/api/bills`
- `/api/acts`
- `/api/egazettes`
- type-specific processing, summary, and chat-management endpoints

They are compatibility adapters, not extension points. New application code
must use `DocumentRepository`, `/api/documents`, and the shared document
components. Legacy removal requires a measured client-usage migration and is
not part of this compatibility-preserving sprint.

## Testing

The required regression gates are:

- universal type aliases and retrieval mapping;
- parameterized repository filters;
- stable universal document mapping;
- Bills, Acts, and Gazette compatibility;
- search and semantic fallback;
- single- and cross-document chat;
- dashboard, profile, authentication, privacy, ingestion, and dedupe tests;
- frontend lint and production build;
- production-backed `/api/documents` smoke verification.
