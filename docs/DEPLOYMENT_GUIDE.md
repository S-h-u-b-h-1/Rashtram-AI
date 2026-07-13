# Deployment Guide

## Required server environment

See `server/.env.example`.

Required:

- `DATABASE_URL`
- `JWT_SECRET`
- `CLIENT_URL`
- `AI_PROVIDER`
- `GEMINI_API_KEY` when Gemini is primary
- `GEMINI_MODEL`
- `GEMINI_EMBEDDING_MODEL`
- `EMBEDDING_PROVIDER`
- `PINECONE_API_KEY`
- `PINECONE_INDEX_NAME`
- `PINECONE_ACT_INDEX_NAME`

Optional:

- Google OAuth variables
- OpenAI fallback variables
- ingestion/cron secrets
- processing concurrency controls

## Required client environment

See `client/.env.local.example`.

Required:

- `NEXT_PUBLIC_API_URL`

Optional:

- `NEXT_PUBLIC_FORMSPREE_CONTACT_ENDPOINT`

## Verification before deploy

```bash
npm test --prefix server
npm run lint --prefix client
npm run build --prefix client
npm run db:migrate --prefix server
npm run db:verify --prefix server
npm run release:verify --prefix server
```

Do not deploy if migrations, DB verification, release verification, or production build fail.

## Production checks

- Verify `/api/auth/me` returns 401 without a token.
- Verify authenticated onboarding/profile flows.
- Verify a known research-ready document opens with citations.
- Verify comparison rejects non-ready documents.
- Verify source-health and processing-status jobs return bounded results.

