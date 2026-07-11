# Production AI Migration Report

Date: 2026-07-11

Branch: `main`

## Executive status

Production backend is deployed from `main` with Gemini active for generation, streaming, OCR, and embeddings. Health, embedding compatibility, Pinecone dimensions, and authenticated SSE streaming were verified.

The rollout is not fully complete because the five-document processing smoke did not produce five successful document types, and production network access became unavailable before replacement candidates and the controlled backfill could be completed.

## Code and deployment

| Item | Result |
| --- | --- |
| Base implementation | `4108765 feat(platform): implement scalable processing infrastructure and AI reliability` |
| Rollout fix commit | `12c587b chore: complete Gemini production rollout and verification` |
| Backend deployment | `dpl_7gdQLzSwyuoTu7ALDsSt7psQ75RH` |
| Production alias | `https://rashtram-ai-backend.vercel.app` |

The rollout fix normalized Gemini embeddings to `gemini-embedding-001` because production health showed `text-embedding-004` was unavailable for the Gemini embedding endpoint.

## Runtime configuration

| Area | Final value |
| --- | --- |
| Generation provider | Gemini |
| Embedding provider | Gemini |
| Chat model | `gemini-2.5-flash` |
| Fallback model | `gemini-2.5-flash` |
| OCR model | `gemini-2.5-flash` |
| Embedding model | `gemini-embedding-001` |
| Embedding dimension | 768 |
| Pinecone bill index | `rashtram-bills` |
| Pinecone act index | `rashtram-acts` |
| Pinecone namespace | `gemini-embedding-001-768-v1` |

Secrets are stored in Vercel and local env files only. No secret values were committed.

## Production health

`GET /health?forceAiCheck=1` returned a healthy provider report:

- Database connected.
- AI provider: `gemini`.
- Embedding provider: `gemini`.
- Generation available: true.
- Embedding available: true.
- Streaming available: true.
- Health response is sanitized.

Observed provider latency:

| Operation | Latency |
| --- | ---: |
| Embedding | 166 ms |
| Generation | 4308 ms |
| Streaming | 9649 ms |

## Pinecone verification

| Index | Dimension | Metric | Status |
| --- | ---: | --- | --- |
| `rashtram-bills` | 768 | cosine | Ready |
| `rashtram-acts` | 768 | cosine | Ready |

The namespace includes provider/model/dimension so old OpenAI vectors and new Gemini vectors are not mixed.

## Document processing smoke

First bounded smoke results:

| Document ID | Type | Title | Result | Chunks | Embeddings | Retrieval | Final readiness | Duration |
| --- | --- | --- | --- | ---: | ---: | --- | --- | ---: |
| `243` | bill | The Special Protection Group (Amendment) Bill, 2019 | completed | 2 | 2 | verified | comparison_ready | 28747 ms |
| `1642` | bill | The Maharashtra Land Revenue Code (Second Amendment) Bill, 2026 | completed | 2 | 2 | verified | comparison_ready | 30468 ms |
| `20437` | act | The Government of NCT of Delhi Act 1991 | failed permanent | 0 | 0 | false | processing_failed_permanent | 11957 ms |
| `20575` | report | Ease of Doing Research & Development in India | failed retriable | 0 | 0 | false | processing_failed_retriable | 17495 ms |
| `23272` | regulation | Reference consolidated file including corrigendum | queued | 0 | 0 | false | processing_failed_retriable at last check | not started |

Failure reasons were sanitized:

- Large scanned PDF exceeded inline OCR limits.
- Download/content size exceeded configured limit.

Because five-type smoke did not pass, the controlled 25-50 document backfill was intentionally not started.

## Queue and readiness snapshot

After the bounded smoke:

| Metric | Value |
| --- | ---: |
| Total documents | 19245 |
| Research-ready | 1085 |
| Comparison-ready | 1085 |
| Processable backlog | 17486 |
| Chunks | 11501 |
| Embeddings | 11501 |
| Queued jobs | 1294 |
| Running jobs | 0 |
| Failed jobs | 391 |
| Dead-letter jobs | 67 |
| Completed jobs | 1085 |

## Verified commands

Completed successfully before this report:

```bash
npm test --prefix server
npm run lint --prefix client
npm run build --prefix client
```

Production verification completed before access was blocked:

- Vercel environment audit and Gemini configuration.
- Backend production deployment.
- Production health check.
- Pinecone index compatibility check.
- Authenticated SSE streaming smoke.
- Bounded document processing smoke.

## Remaining required verification

The following items remain open and must be completed before calling the rollout fully done:

1. Select replacement low-risk documents and complete five successful processing types:
   - Parliament Bill
   - State Bill
   - Act
   - Policy
   - Gazette-family
2. Verify authenticated chat on one newly processed document.
3. Verify comparison between two newly processed documents.
4. Verify automatic enqueue from production document open flow.
5. Run a controlled 25-50 document backfill only after smoke succeeds.
6. Run:
   - `npm run db:verify --prefix server`
   - `npm run process:audit --prefix server`
   - `npm run release:verify --prefix server`
7. Check production backend and frontend Vercel logs.
8. Verify the production frontend UI states and console behavior.

## Known limitations

- Large scanned PDFs still need an asynchronous OCR path rather than inline OCR.
- Some source downloads can exceed the configured content limit.
- Existing queue contains older OpenAI-tagged failed rows; new Gemini processing records provider/model/namespace metadata separately.
- Development Vercel environment is useful for provider variables, but production health is the authoritative check because sensitive values are masked when pulled.

## Rollback and safety controls

- Do not run full-corpus processing.
- Keep concurrency bounded during backfill.
- Stop backfill if failure rate is high.
- Keep Gemini vectors in `gemini-embedding-001-768-v1`.
- Do not overwrite old provider namespaces.
- Re-run health and one authenticated SSE smoke after any provider/env change.
