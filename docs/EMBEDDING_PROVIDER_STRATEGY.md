# Embedding Provider Strategy

Rashtram AI supports three embedding providers:

- `gemini` for Google Gemini embeddings.
- `openai` for OpenAI-compatible embeddings.
- `local` for deterministic hash embeddings used only as an explicit fallback or offline recovery mode.

Production should use Gemini unless a controlled migration is being run.

## Required environment

```bash
AI_PROVIDER=gemini
GEMINI_API_KEY=...
EMBEDDING_PROVIDER=gemini
GEMINI_EMBEDDING_MODEL=gemini-embedding-001
PINECONE_API_KEY=...
PINECONE_INDEX_NAME=rashtram-bills
PINECONE_ACT_INDEX_NAME=rashtram-acts
```

The vector namespace defaults to:

```text
<embedding-model>-768-v1
```

Set `PINECONE_NAMESPACE` only for a deliberate migration or rollback.

## Fallback policy

Remote embedding failures are not silently converted to local embeddings unless one of these is set:

```bash
EMBEDDING_FALLBACK_PROVIDER=local
```

or the legacy flag:

```bash
EMBEDDING_ALLOW_LOCAL_FALLBACK=true
```

If local fallback is enabled, recovered documents are marked with:

- `embedding_status = fallback`
- `retrieval_mode = hybrid`

This prevents provider-independent readiness from being mistaken for high-quality remote vector readiness.

## Bounded recovery command

Use dry-run first:

```bash
npm run embeddings:recover --prefix server -- --limit=25 --source=prsindia --dry-run
```

Recover a bounded set:

```bash
npm run embeddings:recover --prefix server -- --limit=25 --source=prsindia --provider=gemini --time-limit=900
```

Recover specific partial documents:

```bash
npm run embeddings:recover --prefix server -- --document-id=390 --provider=gemini
```

Useful filters:

- `--only-missing`: chunks without a vector reference.
- `--only-stale`: chunks whose stored embedding metadata does not match the configured provider/model/dimension.
- `--all`: re-embed selected documents even if metadata already matches.
- `--cost-limit=0.25`: stop before exceeding the configured estimate. This requires `EMBEDDING_RECOVERY_COST_PER_1K_TOKENS`.
- `--time-limit=600`: stop after the bounded runtime.

The command operates at document granularity. It does not mark a document recovered after only a subset of chunks.

## Verification

After a recovery run:

```bash
npm run db:verify --prefix server
npm run research:ready-audit --prefix server
npm run eval:research --prefix server -- --limit=50 --top-k=10 --retrieval-only
```

Do not claim model-generated answer quality unless `eval:research` runs without `--retrieval-only` and the report shows `mode: "model_generated_provider"` for generated rows.
