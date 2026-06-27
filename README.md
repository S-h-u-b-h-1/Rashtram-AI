# Rashtram AI

Rashtram AI is a full-stack parliamentary research application for exploring
Indian bills and acts. It retrieves public records from PRS India, processes
the associated PDFs, creates AI summaries, and supports source-grounded chat.

## Architecture

- `client/`: Next.js 15 and React 19 web application
- `server/`: Express API, authentication, document processing, and AI services
- PostgreSQL: users, chats, related-bill cache, and the legislative catalogue
- Pinecone: separate vector indexes for bills and acts
- Gemini: embeddings, summaries, and streamed chat responses

Detailed references:

- [Project understanding](docs/PROJECT_UNDERSTANDING.md)
- [Legislative data catalogue](docs/DATA_CATALOG.md)
- [Legislative ingestion architecture](docs/LEGISLATIVE_INGESTION_ARCHITECTURE.md)
- [Dashboard and profile redesign](docs/DASHBOARD_AND_PROFILE_REDESIGN.md)

## Prerequisites

- Node.js 22
- PostgreSQL (Neon is supported)
- Gemini API access
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

The backend requires these encrypted Vercel environment variables:

- `DATABASE_URL`
- `JWT_SECRET`
- `CLIENT_URL`
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `GOOGLE_CALLBACK_URL`
- `GEMINI_API_KEY`
- `GEMINI_MODEL`
- `GEMINI_EMBEDDING_MODEL`
- `PINECONE_API_KEY`
- `PINECONE_INDEX_NAME`
- `PINECONE_ACT_INDEX_NAME`

## Security

Never commit `.env` or `.env.local` files. Rotate any credential that has been
shared publicly or committed previously.
