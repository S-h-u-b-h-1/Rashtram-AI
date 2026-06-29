# Unified Document Chat Architecture

Last reviewed: 29 June 2026

## Purpose

Rashtram AI v1.0 uses one research-chat architecture for Bills, Acts, and
eGazette documents. The same contract is future-ready for policies, committee
reports, rules, notifications, circulars, and debates.

Legacy Bill, Act, and eGazette endpoints remain available for compatibility,
but current pages use `/api/document-chat` and the shared `document-chat`
component system.

## Frontend architecture

All three routes render `DocumentChatRoute` and `DocumentChatLayout`:

- `/app/bill-chat?bill=…`
- `/app/act-chat?act=…`
- `/app/egazette-chat/[id]`

Shared components are `DocumentChatLayout`, `ChatHeader`, `ChatSidebar`,
`ChatHistory`, `ChatMessage`, `ChatInput`, `CitationCard`,
`DocumentSummaryPanel`, `SuggestedQuestions`, `RelatedDocuments`,
`ResearchNotes`, and `SourcePanel`.

Capabilities are identical across supported types: streamed Markdown answers,
passage citations, follow-ups, regeneration, copy, feedback, notes, pinning,
bookmarks, exports, metadata, summaries, official PDF/source links, verified
relationships, and suggested related reading.

Raw HTML is not enabled in chat Markdown. Headings, lists, tables, links, and
code blocks remain supported without model-generated browser markup.

## Backend architecture

`DocumentChat` is the generic persistence model. A conversation is uniquely
identified by `(user_id, document_type, document_id)`.

`documentResearchService` provides canonical PostgreSQL lookup; resource,
relationship, and recommendation retrieval; a five-minute bounded metadata
cache; type-specific vector adapter selection; on-demand PDF processing;
summary reuse; and document-ID-filtered retrieval.

| Type | Pinecone filter | Index |
| --- | --- | --- |
| Bill | `billId` | Bill index |
| Act | `actId` | Act index |
| Gazette | `gazetteId` | Gazette index/fallback namespace |

The service never accepts a browser-supplied PDF URL. It reloads the verified
canonical document and official PDF URL from PostgreSQL.

## API routes

All routes require JWT middleware.

| Method | Route | Purpose |
| --- | --- | --- |
| `GET` | `/api/document-chat/document/:type/:id` | Metadata and relationships |
| `POST` | `/api/document-chat/process` | Reuse/create PDF index and summary |
| `POST` | `/api/document-chat/session` | Create/update conversation |
| `GET` | `/api/document-chat/history` | Conversation, notes, or recent chats |
| `POST` | `/api/document-chat/message` | Persist message |
| `PATCH` | `/api/document-chat/summary` | Persist summary |
| `PATCH` | `/api/document-chat/pin` | Pin/unpin chat |
| `DELETE` | `/api/document-chat/history` | Clear conversation |
| `POST` | `/api/document-chat/notes` | Add private note |
| `DELETE` | `/api/document-chat/notes/:id` | Remove note |
| `POST` | `/api/document-chat/feedback` | Save response feedback |
| `GET` | `/api/document-chat/export` | Export Markdown |
| `POST` | `/api/document-chat` | Stream grounded answer |

## Data and migration

`document_chats` stores document identity, official links, summary, messages,
metadata, pinned/active state, and access timestamps. `research_notes` and
`document_chat_feedback` are separate tables.

Existing `bill_chats`, `act_chats`, and `egazette_chats` are idempotently
backfilled into `document_chats`. Legacy tables and endpoints are retained.

## On-demand RAG flow

```text
open document
  -> canonical PostgreSQL lookup
  -> vector existence check
  -> reuse existing chunks/summary, or:
       download official PDF
       extract and clean text
       create overlapping chunks
       embed in bounded batches
       upsert typed vectors
       generate structured summary
  -> retrieve six typed passages
  -> label [Passage N]
  -> stream Gemini answer
  -> persist answer and citations
```

Bulk PDF processing remains prohibited.

## Testing and roadmap

Tests cover the generic type allowlist, adapter contract, deterministic local
embeddings, parameterized search, privacy, ingestion, dashboard, and profile
regressions. The production build proves all three chat routes share one
bundle.

Future work includes page-number citations, organization-shared collections
with role-based access, background workers for very large PDFs, and portable
legal citation formats.
