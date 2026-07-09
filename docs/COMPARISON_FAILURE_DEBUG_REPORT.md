# Comparison Failure Debug Report

Date: 9 July 2026

## Production failure reproduced before coding

Authenticated production checks showed that documents `20977` and `20976`
were both marked ready:

- `researchReady: true`
- `comparisonReady: true`
- `readinessClass: comparison_ready`
- stored chunks and embedding counts present

However, production comparison failed:

```text
POST https://rashtram-ai-backend.vercel.app/api/documents/compare
documentIds=["20977","20976"]
status=422
error="ECB Study Finds Sector-Level FDI Patterns Hidden by National Averages: No extractable text."
```

Additional readiness checks showed that `20649` and `20425` were not yet
processed and remained `pdf_available_not_processed`.

## Evidence

Direct database inspection found normalized text chunks for both ready policy
documents:

| Document | Chunks | Text length evidence | Vector references |
| --- | ---: | --- | --- |
| `20976` | 2 | chunks of about 4,482 and 1,851 chars | `policy-20976-chunk-0`, `policy-20976-chunk-1` |
| `20977` | 1 | chunk of about 4,275 chars | `policy-20977-chunk-0` |

The local post-fix service smoke successfully retrieved passages and created a
saved comparison using the same document pair:

- comparison id: `11`
- generation mode: `extractive_fallback`
- citations: `3`
- retrieval: grounded passages were available for both documents

The local smoke also exposed an AI provider configuration failure for the
embedding/generation path, which confirmed the need for a provider-independent
PostgreSQL retrieval fallback.

## Root cause

The prior comparison path treated readiness as vector-only in practice. If the
production vector/provider path returned no usable passage content, comparison
failed with `No extractable text` even when normalized PostgreSQL chunks
existed.

There was also a persistence ordering risk: processing stored normalized chunks
after vector storage in some paths. A vector-store failure could therefore
prevent the local fallback corpus from being persisted.

## Fix

The system now uses one canonical readiness contract:

```text
getDocumentReadiness(documentId)
```

That contract accepts documents that have:

- valid public catalogue/source metadata;
- successful extraction and chunking;
- non-empty PostgreSQL text chunks;
- either complete vector retrieval or verified local text retrieval; and
- no processing failure.

`POST /api/documents/:id/prepare` now returns the same readiness payload used
by document chat and comparison.

Comparison retrieval now tries vector search first and falls back to
PostgreSQL text chunks using lightweight query scoring. If the LLM comparison
provider fails after passages are retrieved, the service persists an
`extractive_fallback` comparison with citations instead of returning an
unusable error.

## Verification

Local verification completed:

```bash
npm run db:migrate --prefix server
npm run db:verify --prefix server
npm run process:audit --prefix server
npm test --prefix server
npm run lint --prefix client
npm run build --prefix client
```

Observed results:

- database verification passed;
- processing audit classified 501 documents as `comparison_ready`;
- server tests passed: 116 tests, 115 passed, 1 skipped;
- frontend lint passed;
- frontend production build passed;
- local comparison for `20977` and `20976` saved successfully with grounded
  citations.

## Production smoke result

After backend and frontend deployment, an authenticated production smoke was
run against `https://rashtram-ai-backend.vercel.app/api`.

Readiness:

| Document | Status | Research ready | Comparison ready | Retrieval mode | Chunks | Embeddings | Vector refs |
| --- | ---: | --- | --- | --- | ---: | ---: | ---: |
| `20977` | 200 | true | true | `hybrid` | 1 | 1 | 1 |
| `20976` | 200 | true | true | `hybrid` | 2 | 2 | 2 |

Comparison:

| Check | Result |
| --- | --- |
| Endpoint | `POST /api/documents/compare` |
| Documents | `["20977", "20976"]` |
| Status | `201` |
| Saved comparison id | `12` |
| Generation mode | `extractive_fallback` |
| Citations | `3` |
| Retrieval | `20977`: 1 passage, `20976`: 2 passages |
| Saved history | `GET /api/profile/comparisons` contained comparison `12` |

Post-deploy Vercel error-log checks for both backend and frontend returned no
errors in the verification window.
