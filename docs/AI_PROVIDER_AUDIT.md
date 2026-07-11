# AI Provider Audit

Date: 2026-07-11

Branch: `main`

## Scope

This audit records the production migration from OpenAI-backed runtime configuration to Gemini-backed generation, streaming, OCR, and embeddings.

Secrets are intentionally not listed. Credential values were not committed and are not reproduced in this report.

## Final provider configuration

| Variable | Production status | Notes |
| --- | --- | --- |
| `AI_PROVIDER` | configured | `gemini` |
| `EMBEDDING_PROVIDER` | configured | `gemini` |
| `GEMINI_API_KEY` | configured | Present as a Vercel environment secret/sensitive value |
| `GEMINI_MODEL` | configured | `gemini-2.5-flash` |
| `GEMINI_FALLBACK_MODEL` | configured | `gemini-2.5-flash` |
| `GEMINI_OCR_MODEL` | configured | `gemini-2.5-flash` |
| `GEMINI_EMBEDDING_MODEL` | configured | `gemini-embedding-001` |
| `PINECONE_API_KEY` | configured | Present as a Vercel environment secret/sensitive value |
| `PINECONE_INDEX_NAME` | configured | `rashtram-bills` |
| `PINECONE_ACT_INDEX_NAME` | configured | `rashtram-acts` |
| `PINECONE_NAMESPACE` | configured | `gemini-embedding-001-768-v1` |
| `DATABASE_URL` | configured | Present; health check reports connected |
| `JWT_SECRET` | configured | Present |
| `CRON_SECRET` | configured | Present |

Preview and development environments were also updated with the Gemini provider/model variables. Production runtime verification is the source of truth because pulled sensitive values are masked by Vercel.

## Embedding model correction

The requested initial embedding model was `text-embedding-004` with namespace `text-embedding-004-768-v1`.

Production health verification showed Gemini API `v1beta` rejected `text-embedding-004` for `embedContent`. The deployed runtime now normalizes Gemini embedding configuration to:

- Model: `gemini-embedding-001`
- Dimension: `768`
- Namespace: `gemini-embedding-001-768-v1`

This avoids mixing OpenAI vectors and Gemini vectors in the same Pinecone namespace.

## Pinecone compatibility

Verified index compatibility:

| Index | Exists | Dimension | Metric | Status |
| --- | --- | ---: | --- | --- |
| `rashtram-bills` | yes | 768 | cosine | Ready |
| `rashtram-acts` | yes | 768 | cosine | Ready |

The namespace is versioned by provider/model/dimension to prevent incompatible vector mixing.

## Production health verification

Production backend alias:

- `https://rashtram-ai-backend.vercel.app`

Deployment verified:

- Deployment ID: `dpl_7gdQLzSwyuoTu7ALDsSt7psQ75RH`
- Deployment URL: `https://rashtram-ai-backend-onxbnrw32-shubh1s-projects.vercel.app`
- Alias: `https://rashtram-ai-backend.vercel.app`

`GET /health?forceAiCheck=1` reported:

| Check | Result |
| --- | --- |
| Database | connected |
| AI provider | gemini |
| Embedding provider | gemini |
| Chat model | `gemini-2.5-flash` |
| Embedding model | `gemini-embedding-001` |
| Generation available | true |
| Embedding available | true |
| Streaming available | true |
| Embedding latency | 166 ms |
| Generation latency | 4308 ms |
| Streaming latency | 9649 ms |

The health response is sanitized and does not expose secrets or raw provider payloads.

## Streaming smoke verification

Authenticated production document-chat SSE smoke for bill `3646` returned:

| Signal | Result |
| --- | --- |
| HTTP status | 200 |
| Content type | `text/event-stream; charset=utf-8` |
| Frames | 10 |
| Metadata frames | 1 |
| Content frames | 7 |
| Done frames | 1 |
| Done sentinel | present |

The server streamed incremental content frames and did not wait to emit only a complete response.

## Current limitations

- OpenAI environment variables may still exist in Vercel as historical configuration, but runtime health confirms Gemini is active.
- Full five-type production processing verification is not complete. The first bounded smoke selected two valid bills and three problematic large/scanned records.
- Controlled 25-50 document backfill must remain blocked until five-type smoke succeeds.
- Frontend visual verification could not be completed after production access was blocked by the local app usage limit.

## Rollback plan

If Gemini production behavior regresses:

1. Set `AI_PROVIDER` and `EMBEDDING_PROVIDER` back to the prior provider only if matching credentials and vector namespaces are valid.
2. Do not reuse the Gemini namespace for non-Gemini embeddings.
3. Redeploy the backend.
4. Run `GET /health?forceAiCheck=1`.
5. Run a one-document authenticated SSE smoke.
6. Resume only bounded processing after health and streaming pass.
