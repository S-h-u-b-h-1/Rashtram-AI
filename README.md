# Rashtram AI

Rashtram AI is a full-stack legislative and public-policy intelligence
platform for exploring Indian Bills, Acts, Gazettes, policies, consultations,
regulatory instruments, and related official records. It preserves source
provenance, processes selected public documents on demand, creates grounded AI
summaries, and supports source-grounded chat.

## Architecture

- `client/`: Next.js 15 and React 19 web application
- `server/`: Express API, authentication, document processing, and AI services
- PostgreSQL: users, workspaces, processing state, provenance, and catalogue data
- Pinecone and local-text fallback: versioned document retrieval paths
- Gemini-first AI services for embeddings, OCR, summaries, and streamed chat;
  OpenAI-compatible operation is an explicit configured alternative

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
- Gemini API access for the current production-compatible AI path, or an
  explicitly configured compatible provider
- Pinecone account with provider/model/dimension-versioned namespaces when
  vector retrieval is enabled
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

The backend requires encrypted database and authentication variables plus the
variables for the explicitly selected AI provider. See
[`docs/DEPLOYMENT_GUIDE.md`](docs/DEPLOYMENT_GUIDE.md) for the canonical list.
The current production path uses:

- `DATABASE_URL`
- `JWT_SECRET`
- `CLIENT_URL`
- `AI_PROVIDER=gemini`
- `EMBEDDING_PROVIDER=gemini`
- `GEMINI_API_KEY`
- Gemini generation, OCR, and embedding model variables
- `PINECONE_API_KEY`
- `PINECONE_INDEX_NAME`
- `PINECONE_ACT_INDEX_NAME`
- A provider/model/dimension-specific `PINECONE_NAMESPACE`

Google OAuth variables are optional. Set
`NEXT_PUBLIC_GOOGLE_AUTH_ENABLED=true` on the frontend only when the backend
OAuth client and callback are configured and verified.

## Security

Never commit `.env` or `.env.local` files. Rotate any credential that has been
shared publicly or committed previously.
# Rashtram AI — current engineering status

Rashtram AI is an advanced prototype of an AI-assisted Indian government, legislative, regulatory and policy research platform. The current priority is corpus reliability: authoritative source ingestion, provenance preservation, processing quality, citation-backed retrieval, comparison readiness and operational observability.

Current evidence from the production-linked database audit on 2026-07-13
(refresh these numbers before reusing them in external reports):

- 19,307 canonical documents
- 17,514 documents with PDFs
- 1,602 research-ready documents
- 1,602 comparison-ready documents
- 16,997 processable backlog
- 45.8% processing-attempt failure rate (historical attempts, not the
  percentage of catalogue records permanently unusable)
- 1,113 probable duplicate groups remain unresolved
- PDF checksum coverage is currently incomplete

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
