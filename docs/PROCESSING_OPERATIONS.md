# Processing Operations

Date: 2026-07-11

## Safe commands

Catalogue classification:

```bash
npm run documents:audit --prefix server -- --batch-size=500
npm run documents:audit --prefix server -- --batch-size=5000 --resume
```

Targeted inspection:

```bash
npm run documents:inspect --prefix server -- 186 3646 20833
```

Controlled repair:

```bash
npm run documents:repair --prefix server -- --classification=processable_unprocessed --limit=100
npm run documents:repair --prefix server -- --classification=retriable_failure --limit=100
```

Status:

```bash
npm run process:status --prefix server
```

## Guardrails

- Do not bulk-process the full corpus inside request handlers.
- Use queue leasing, heartbeat, bounded concurrency, and retry limits.
- Preserve chunks and extracted text if later embedding or summary generation fails.
- Treat local PostgreSQL text chunks as a valid retrieval fallback when vector storage is unavailable.
- Clear stale ready flags when canonical retrieval evidence fails.
- Keep Gemini vectors in a versioned namespace: `gemini-embedding-001-768-v1`.
- Do not mix OpenAI/local fallback vectors and Gemini vectors in the same Pinecone namespace.
- Do not start the 25-50 document controlled backfill until five-type smoke processing succeeds.
- Stop a batch early if failures are dominated by large scanned PDFs, oversized downloads, provider errors, or repeated database connectivity errors.

## Gemini production processing status

Production is configured for Gemini generation, streaming, OCR, and embeddings.

Current production vector configuration:

| Setting | Value |
| --- | --- |
| Embedding provider | `gemini` |
| Embedding model | `gemini-embedding-001` |
| Embedding dimension | 768 |
| Pinecone bill index | `rashtram-bills` |
| Pinecone act index | `rashtram-acts` |
| Pinecone metric | cosine |
| Namespace | `gemini-embedding-001-768-v1` |

`text-embedding-004` was not usable through the production Gemini embedding endpoint, so the runtime now normalizes Gemini embeddings to `gemini-embedding-001`.

### Bounded smoke result

The first bounded smoke processed two bill records successfully:

| Document ID | Type | Result | Chunks | Embeddings | Retrieval |
| --- | --- | --- | ---: | ---: | --- |
| `243` | bill | completed | 2 | 2 | verified |
| `1642` | bill | completed | 2 | 2 | verified |

The same smoke also found real corpus limits:

| Document ID | Type | Result | Reason |
| --- | --- | --- | --- |
| `20437` | act | failed permanent | scanned PDF too large for inline OCR |
| `20575` | report | failed retriable | content length exceeded configured download limit |
| `23272` | regulation | queued at last check | not processed before access was blocked |

Do not treat this as a completed five-type smoke. Select smaller replacement records and complete the five required types before backfill.

## Recovery pattern

1. Audit catalogue state.
2. Inspect incident IDs.
3. Repair only a bounded class and limit.
4. Re-run readiness audit.
5. Verify `db:verify`, `process:status`, and `release:verify`.

## 2026-07-13 document acquisition hardening

Document acquisition now uses a central downloader/validator path:

- URL validation rejects missing, malformed, unsupported-protocol, and private-network URLs.
- Downloads use bounded redirects, bounded bytes, stable user-agent, retry/backoff, and temp-file cleanup.
- PDF validation rejects HTML responses, zero-byte files, unsupported content, truncated downloads, encrypted PDFs, and checksum mismatches.
- The processing pipeline stores download attempts, final URL, checksum, and validation diagnostics in stage metrics.
- Historical download failures are normalized into `DOWNLOAD_*` failure codes.

Current live download failure report:

```bash
npm run download:failures --prefix server -- --limit=1000 --sample=0
```

Current live retry dry run:

```bash
npm run process:retryable --prefix server -- --stage=download --limit=25 --dry-run
```

Current live alternative-source dry run:

```bash
npm run download:alternatives --prefix server -- --dry-run --limit=25
```

As of 2026-07-13, the alternative-source dry run found no deterministic safe replacements in the reviewed sample. Recovery should therefore focus on bounded retries for `DOWNLOAD_SERVER_ERROR` records and connector/source repair for permanent failures.
