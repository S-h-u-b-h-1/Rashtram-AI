# Rashtram AI: Project Understanding

Last reviewed: 27 June 2026

## 1. Executive understanding

Rashtram AI is an evidence-oriented research workspace for Indian legislation.
Its central job is to help a user move from a large bill or act to a reliable
working understanding of that document.

The product combines five capabilities:

1. **Legislative discovery** — find Parliament bills and acts by title, status,
   or year.
2. **Document preparation** — download a source PDF, extract its text, divide it
   into overlapping semantic chunks, and store searchable vectors.
3. **Grounded research chat** — retrieve the most relevant chunks for a
   question and stream a Gemini answer based on that context.
4. **Research continuity** — retain summaries, messages, and recent work for
   each authenticated user.
5. **National legislative catalogue** — reconcile the same bill, act, rule,
   notification, Gazette, policy, or proceeding across official and secondary
   sources while retaining complete provenance.

The product should be understood as a research assistant, not an authoritative
legal database or a substitute for the source legislation. PRS remains the
largest populated source, while IndiaCode and eGazette now have working
official-source collectors. Original official PDFs remain the final reference.

## 2. Intended users and jobs

The interface and workflow fit several related user groups:

- policy researchers preparing briefs and comparisons;
- students and academics studying legislative change;
- legal and public-affairs teams triaging new legislation;
- journalists or civic researchers looking for accessible explanations;
- institutional teams building an internal memory of policy research.

The primary job-to-be-done is:

> Select a legislative document, understand its purpose and major provisions,
> ask precise follow-up questions, inspect the supporting context, and return
> later without losing the research thread.

## 3. System architecture

```text
Browser / Next.js client
        |
        | HTTPS + JWT
        v
Express API on Vercel
   |        |         |
   |        |         +--> PRS, IndiaCode, eGazette, Sansad and official sites
   |        |
   |        +--> Gemini generation
   |
   +--> PostgreSQL / Neon
   |      users, chats, legislative catalogue, ingestion history
   |
   +--> Pinecone
          bill and act text chunks, embeddings, generated summaries
```

### Frontend

- **Framework:** Next.js 15 App Router and React 19.
- **Design:** responsive editorial interface using Tailwind CSS, Framer Motion,
  and a shared warm-ivory/deep-ink visual system.
- **Authentication state:** React context reads a JWT from local or session
  storage and verifies it with the API.
- **Application navigation:** dashboard, Parliament bills, and Parliament acts.
- **Chat:** separate bill and act workspaces with streamed responses, saved
  messages, summaries, and source snippets.

Important frontend locations:

- `client/src/app/page.js` — public landing page.
- `client/src/app/login/page.js` and `signup/page.js` — authentication.
- `client/src/app/app/page.js` — authenticated application shell.
- `client/src/components/Bills.jsx` and `Acts.jsx` — discovery lists.
- `client/src/app/app/bill-chat/page.js` and `act-chat/page.js` — research chat.
- `client/src/context/AuthContext.jsx` — client authentication lifecycle.
- `client/src/lib/api.js` — API calls and SSE stream parsing.

### Backend

- **Framework:** Express 5 on Node.js 22.
- **Runtime role:** authentication, catalogue access, document processing,
  retrieval, AI generation, and chat persistence.
- **Database access:** direct parameterized PostgreSQL queries through `pg`.
- **Schema strategy:** idempotent `CREATE TABLE IF NOT EXISTS` statements are
  executed during the first database connection.

Important backend locations:

- `server/server.js` — Express composition and route registration.
- `server/db.js` — PostgreSQL pool and schema.
- `server/lib/catalogService.js` — database-backed catalogue queries.
- `server/lib/prsCatalog.js` — PRS collection and parsing.
- `server/lib/ingestion/core/` — source-neutral fetching, normalization,
  deduplication, canonical merging, persistence, and run auditing.
- `server/lib/ingestion/connectors/` — source-specific acquisition adapters.
- `server/cli/` — ingestion, coverage, duplicate, and review operations.
- `server/lib/pdfProcessor.js` — PDF extraction and text chunking.
- `server/lib/vectordb.js` — embeddings, Pinecone access, retrieval, and Gemini.
- `server/models/` — PostgreSQL-backed compatibility models.

## 4. Core data flows

### 4.1 Authentication

Email registration:

1. Validate name, email, and password.
2. Hash the password with bcrypt.
3. Store the user in PostgreSQL.
4. Return a 24-hour JWT.

Google authentication:

1. Redirect to Google OAuth.
2. Find or create a user using Google ID or email.
3. Sign the same 24-hour JWT.
4. Redirect to the frontend with the token.

Every protected API request validates issuer, audience, expiry, and signature.

### 4.2 Catalogue collection and reconciliation

The catalogue process now:

1. Collects source records through a connector.
2. Records hashes and provenance for every source page.
3. Normalizes titles, types, dates, identifiers, authorities, and scope.
4. Matches exact source identity, legal IDs, hashes, fingerprints, and finally
   same-year title similarity.
5. Merges high-confidence matches into one canonical document.
6. Retains every source version and linked resource.
7. Queues uncertain fuzzy matches for manual review.
8. Records run scope, counters, errors, and completion state.

Collection is idempotent. Re-running it updates current fields and
`last_seen_at` without duplicating a source record. Existing PRS numeric
document IDs remain stable for frontend and Pinecone compatibility.

### 4.3 Document preparation

Processing happens when a user opens a document that is not yet in Pinecone:

1. Resolve the PDF URL.
2. Download and parse the PDF.
3. Clean whitespace and control characters.
4. Split content into approximately 4,500-character chunks with overlap.
5. Generate 768-dimensional embeddings.
6. Store vectors in the bill or act index namespace.
7. Generate a summary and attach it to chunk metadata.

The default embedding provider is the local deterministic hash embedding. A
Gemini embedding provider can be enabled through environment configuration.

### 4.4 Grounded chat

For each question:

1. Embed the user query.
2. Filter Pinecone by the selected bill or act ID.
3. Retrieve the five nearest chunks.
4. Build a context-only prompt.
5. Stream Gemini output to the browser using Server-Sent Events.
6. Return source snippets and relevance scores.
7. Persist the user and assistant messages in the user's PostgreSQL chat.

### 4.5 Research persistence

Bill and act chats are unique per user/document pair. Reopening the document
reactivates the same research thread. Chats support:

- message append;
- summary updates;
- clearing messages;
- soft deletion through `is_active`;
- recent-chat lists and dashboard counts.

## 5. Storage model

### PostgreSQL

| Table | Purpose |
| --- | --- |
| `users` | Password and Google-authenticated user accounts |
| `bill_chats` | Bill metadata, summary, and message history per user |
| `act_chats` | Act metadata, summary, and message history per user |
| `related_bills` | Seven-day related-bill result cache |
| `legislative_documents` | Persistent national and state catalogue |
| `document_sources` | Every source-specific version of a canonical document |
| `legislative_document_resources` | Original texts, briefs, reports, and links |
| `document_relationships` | Typed links between related legal/policy documents |
| `catalog_match_reviews` | Human review queue for uncertain duplicate matches |
| `source_collection_snapshots` | Source page hashes and collection provenance |
| `ingestion_runs` | Auditable collection history and failures |

### Pinecone

- bill index: `rashtram-bills` by default;
- act index: `rashtram-acts` by default;
- namespace depends on the embedding provider and model;
- metadata includes document ID, title, content, chunk number, total chunks,
  source PDF, summary, and processing timestamp.

The PostgreSQL catalogue is the system of record for document discovery.
Pinecone is the derived retrieval index for documents that have been processed.

## 6. API surface

### Authentication

- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/getuser`
- `GET /api/auth/google`
- `GET /api/auth/google/callback`

### Catalogue

- `GET /api/bills`
- `GET /api/bills/status`
- `GET /api/bills/pdf`
- `GET /api/bills/relatedBills`
- `GET /api/acts`
- `GET /api/acts/years`

Catalogue endpoints now read the persistent PostgreSQL catalogue rather than
scraping PRS during a user request.

### Processing and research

- `POST /api/process-bill`
- `GET /api/bill-summary`
- `POST /api/chat`
- `POST /api/process-act`
- `GET /api/act-summary`
- `POST /api/act-chat`

### Persistence and dashboard

- `/api/bill-chats/*`
- `/api/act-chats/*`
- `GET /api/dashboard`
- `GET /health`

## 7. Security posture

Existing controls:

- bcrypt password hashing;
- short-lived signed JWTs with issuer and audience;
- input validation and length limits;
- parameterized SQL;
- Helmet response headers;
- CORS allow-list;
- general and authentication rate limits;
- server-only environment variables;
- no committed secret files.

Areas that should be strengthened:

1. Move authentication from browser storage and OAuth query parameters to
   secure, HTTP-only, same-site cookies.
2. Add CSRF protection when cookie authentication is introduced.
3. Add explicit authorization for operational/admin endpoints.
4. Add data-retention controls and account deletion.
5. Avoid returning raw internal AI/provider error messages to clients.
6. Add dependency and secret scanning to CI.

## 8. Current strengths

- The product has a coherent end-to-end research loop.
- Retrieval is filtered to the selected document, reducing cross-document
  hallucination.
- Chat history and summaries survive browser sessions.
- Public document discovery is independent of source availability at request
  time.
- The catalogue has canonical identity, source-specific identity, official
  source priority, collection provenance, and an auditable review queue.
- AI generation streams progressively and supports model fallback.
- The frontend is responsive and substantially clearer than the inherited UI.

## 9. Current limitations

### Product

- The UI exposes Parliament documents only, although state data is now stored.
- Related bills depend on already-processed vectors, not the entire catalogue.
- Source snippets do not yet provide exact PDF page/section citations.
- There is no team workspace, export, annotation, or shared research model.

### Data

- PRS is a high-value secondary source but not the final legal authority.
- Official-source adapters beyond IndiaCode/eGazette are conservative directory
  collectors until stable structured APIs or feeds are confirmed.
- Some historical records do not include a PDF or ministry.
- Catalogue metadata is complete to the extent exposed by source pages; full
  PDF text is processed on demand rather than copied wholesale into PostgreSQL.
- Scanned PDFs fall back to bounded Gemini PDF OCR. If both native extraction
  and OCR fail, processing returns a clear 422 response and retains catalogue
  metadata and source access.

### AI and retrieval

- Summaries are generated from only the first few chunks in the current
  processing route, so long documents may be underrepresented.
- The local hash embedding is inexpensive and deterministic but less semantic
  than a modern learned embedding model.
- There are no retrieval or answer-quality evaluations.
- Pinecone writes and Gemini generation occur in request paths and may exceed
  serverless time limits for large PDFs.

### Engineering

- Backend tests currently cover catalogue parsing but not all routes.
- Schema changes are embedded in application startup rather than versioned
  migrations.
- No background worker or durable job queue exists.
- No scheduled catalogue refresh is configured.
- Observability is primarily console logs and Vercel runtime logs.

## 10. Recommended roadmap

### Highest priority

1. Add a scheduled daily multi-source refresh with alerting on source/parser
   changes.
2. Expose state bills and acts through jurisdiction filters in the UI.
3. Move PDF processing to a durable background job.
4. Add page-aware extraction and citations.
5. Replace query-parameter JWT OAuth handoff with an HTTP-only session cookie.

### Quality and trust

6. Generate summaries from full-document map/reduce or hierarchical chunks.
7. Add an evaluation set for retrieval accuracy, groundedness, and citation
   correctness.
8. Show source links, retrieval excerpts, dates, and confidence transparently.
9. Add OCR fallback for scanned documents.

### Scale and maintainability

10. Introduce versioned database migrations.
11. Add structured logging, error monitoring, and ingestion dashboards.
12. Add catalogue freshness and processing-state fields to the frontend.
13. Cache frequently requested list/filter queries.
14. Add admin controls for reprocessing and source correction.

## 11. Definition of success

Rashtram AI succeeds when a researcher can answer:

- What does this document do?
- Which provisions matter for my question?
- What changed, when, and for whom?
- What source passage supports the answer?
- How does this document relate to previous or parallel legislation?

The system should make those answers faster while keeping the original source,
provenance, and uncertainty visible.
