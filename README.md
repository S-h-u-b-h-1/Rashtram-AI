# Rashtram AI

Rashtram AI is a full-stack legislative and public-policy intelligence
platform for exploring Indian Bills, Acts, Gazettes, policies, consultations,
regulatory instruments, and related official records. It preserves source
provenance, processes selected public documents on demand, creates grounded AI
summaries, and supports source-grounded chat.

## Architecture

- `client/`: Next.js 15 and React 19 web application
- `server/`: Express API, authentication, document processing, and AI services
- PostgreSQL: users, chats, related-bill cache, and the legislative catalogue
- Pinecone: vector retrieval for Bills, Acts, and universal documents
- OpenAI: multilingual embeddings, OCR, summaries, and streamed chat responses

Detailed references:

- [Project understanding](docs/PROJECT_UNDERSTANDING.md)
- [Architecture v2](docs/ARCHITECTURE_V2.md)
- [Legislative data catalogue](docs/DATA_CATALOG.md)
- [Legislative ingestion architecture](docs/LEGISLATIVE_INGESTION_ARCHITECTURE.md)
- [Policy platform architecture](docs/POLICY_PLATFORM_ARCHITECTURE.md)
- [State connector architecture](docs/STATE_CONNECTOR_ARCHITECTURE.md)
- [Source connector status](docs/SOURCE_CONNECTOR_STATUS.md)
- [Dashboard and profile redesign](docs/DASHBOARD_AND_PROFILE_REDESIGN.md)
- [Data trust and privacy](docs/DATA_TRUST_AND_PRIVACY.md)
- [Multilingual document pipeline](docs/MULTILINGUAL_DOCUMENT_PIPELINE.md)
- [OpenAI migration](docs/OPENAI_MIGRATION.md)
- [Contact form setup](docs/CONTACT_FORM_SETUP.md)

## Prerequisites

- Node.js 22
- PostgreSQL (Neon is supported)
- OpenAI API access
- Pinecone account with two 768-dimension indexes:
  - `rashtram-bills` (or the value of `PINECONE_INDEX_NAME`)
  - `rashtram-acts`
- Optional Google OAuth credentials

## Local setup

1. Select the expected Node.js version:

   ```bash
   nvm use
   ```

2. Create local environment files:

   ```bash
   cp client/.env.local.example client/.env.local
   cp server/.env.example server/.env
   ```

3. Replace placeholder values in `server/.env`.

4. Install dependencies:

   ```bash
   npm install --prefix client
   npm install --prefix server
   ```

5. Start the API:

   ```bash
   npm run start --prefix server
   ```

6. In another terminal, start the web application:

   ```bash
   npm run dev --prefix client
   ```

7. Open [http://localhost:3000](http://localhost:3000).

The API health endpoint is available at
[http://localhost:5001/health](http://localhost:5001/health).

The PostgreSQL schema is initialized automatically on the first API request.

## Legislative catalogue

Refresh the full PRS catalogue and enrich Parliament bill details:

```bash
npm run ingest:catalog --prefix server
```

Run a faster list-only refresh or inspect stored coverage:

```bash
npm run ingest:catalog-only --prefix server
npm run catalog:stats --prefix server
```

Collect small official-source samples through the universal ingestion layer:

```bash
npm run ingest:sources --prefix server -- \
  --sources=india-code,egazette --limit=10
```

The persistent catalogue includes Parliament and state bills and acts. PDF
extraction, vector indexing, and AI summaries remain on demand.

## Google OAuth

When using Google login, configure this authorized callback URL:

```text
http://localhost:5001/api/auth/google/callback
```

Use the deployed API URL instead when running in production.

## Vercel deployment

Deploy `client/` and `server/` as separate Vercel projects:

- Frontend project root: `client`
- Backend project root: `server`

Set `NEXT_PUBLIC_API_URL` on the frontend to the backend production URL with
the `/api` suffix.

Set `NEXT_PUBLIC_FORMSPREE_CONTACT_ENDPOINT` on the frontend to the verified
Formspree form endpoint. See `docs/CONTACT_FORM_SETUP.md`.

The backend requires these encrypted Vercel environment variables:

- `DATABASE_URL`
- `JWT_SECRET`
- `CLIENT_URL`
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `GOOGLE_CALLBACK_URL`
- `OPENAI_API_KEY`
- `OPENAI_MODEL`
- `OPENAI_FALLBACK_MODEL`
- `OPENAI_OCR_MODEL`
- `OPENAI_EMBEDDING_MODEL`
- `EMBEDDING_PROVIDER=openai`
- `PINECONE_API_KEY`
- `PINECONE_INDEX_NAME`
- `PINECONE_ACT_INDEX_NAME`
- `PINECONE_NAMESPACE=openai-text-embedding-3-large-768-v1`

## Security

Never commit `.env` or `.env.local` files. Rotate any credential that has been
shared publicly or committed previously.
# Rashtram AI — current engineering status

Rashtram AI is an advanced prototype of an AI-assisted Indian government, legislative, regulatory and policy research platform. The current priority is corpus reliability: authoritative source ingestion, provenance preservation, processing quality, citation-backed retrieval, comparison readiness and operational observability.

Current evidence from the production-linked database audit on 2026-07-13:

- 19,307 canonical documents
- 17,514 documents with PDFs
- 1,485 research-ready documents
- 1,485 comparison-ready documents
- 17,118 processable backlog
- 47.4% current processing failure rate

Do not treat catalogued documents as research-ready unless the readiness pipeline marks them ready.

Key docs:

- `docs/CURRENT_PLATFORM_AUDIT.md`
- `docs/CANONICAL_DOCUMENT_MODEL.md`
- `docs/SOURCE_REGISTRY.md`
- `docs/INGESTION_ARCHITECTURE.md`
- `docs/PROCESSING_PIPELINE.md`
- `docs/RESEARCH_READINESS.md`
- `docs/RESEARCH_EVALUATION_FRAMEWORK.md`
- `docs/OPERATIONS_RUNBOOK.md`
- `docs/DEPLOYMENT_GUIDE.md`
- `docs/DATA_SOURCE_LIMITATIONS.md`
