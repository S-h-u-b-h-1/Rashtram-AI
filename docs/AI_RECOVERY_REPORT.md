# AI Recovery Report

Date: 2026-07-11

## Outcome

Rashtram AI has been moved from OpenAI-default provider wiring to Gemini-first provider wiring.

The backend now supports native Gemini calls for:

- grounded generation;
- streaming generation;
- embeddings;
- scanned-PDF OCR fallback;
- provider health checks.

OpenAI remains present only as an explicit legacy fallback when `AI_PROVIDER=openai`. The default path should not use `OPENAI_API_KEY`.

## Required production environment

Set these on the backend Vercel project:

```env
AI_PROVIDER=gemini
EMBEDDING_PROVIDER=gemini
GEMINI_API_KEY=<secret>
GEMINI_MODEL=gemini-2.5-flash
GEMINI_FALLBACK_MODEL=gemini-2.5-flash
GEMINI_OCR_MODEL=gemini-2.5-flash
GEMINI_EMBEDDING_MODEL=text-embedding-004
PINECONE_INDEX_NAME=rashtram-bills
PINECONE_ACT_INDEX_NAME=rashtram-acts
PINECONE_NAMESPACE=text-embedding-004-768-v1
```

Do not place the Gemini key in `OPENAI_API_KEY`.

## Health endpoint contract

`GET /health` now reports:

- `aiProvider`
- `embeddingProvider`
- `chatModel`
- `embeddingModel`
- `generationAvailable`
- `embeddingAvailable`
- `streamingAvailable`
- provider latency in milliseconds
- sanitized provider errors

The endpoint does not expose API keys, tokens, or raw credentials.

## Implementation notes

- `server/lib/vectordb.js` now uses Gemini REST endpoints for generation, streaming, and embeddings when Gemini is configured.
- Remote embedding failures still fall back to deterministic local embeddings during document processing, but `/health` verifies remote embeddings without local fallback so production health remains truthful.
- `server/lib/pdfProcessor.js` now uses Gemini OCR for scanned PDFs by default.
- Processing metadata now records Gemini provider names instead of hardcoded OpenAI defaults.

## Verification status

Local verification passed:

- `npm test --prefix server`
- `npm run lint --prefix client`
- `npm run build --prefix client`
- `npm run release:verify --prefix server`

Safe provider configuration inspection resolves to:

- `aiProvider: gemini`
- `embeddingProvider: gemini`
- `chatModel: gemini-2.5-flash`
- `embeddingModel: text-embedding-004`

Direct live Gemini health and Vercel production verification were blocked by the current tool approval/network usage limit and must be rerun after approvals are available.
