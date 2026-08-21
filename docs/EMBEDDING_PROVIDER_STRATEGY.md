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
npm run semantic:backfill --prefix server -- --limit=25 --source=prsindia --dry-run
```

Recover a bounded set:

```bash
npm run semantic:backfill --prefix server -- --limit=25 --source=prsindia
```

Recover specific partial documents:

```bash
npm run semantic:backfill --prefix server -- --document-id=390 --limit=1
```

Useful filters:

- `--priority=P0|P1|P2|P3`: process one deterministic priority tier.
- `--document-id=390`: explicitly target one public search-ready document.
- `--source=india-code`: limit selection to a source identity.
- `--max-chunks=100`: exclude unexpectedly large documents from an automatic batch.
- `--group-size=5`: recheck capacity between bounded groups.
- `--dry-run`: estimate chunk reuse and embedding input without writing.

The command operates at document granularity. It does not mark a document recovered after only a subset of chunks.

## Verification

After a recovery run:

```bash
npm run db:verify --prefix server
npm run research:ready-audit --prefix server
npm run eval:research --prefix server -- --limit=50 --top-k=10 --retrieval-only
```

Do not claim model-generated answer quality unless `eval:research` runs without `--retrieval-only` and the report shows `mode: "model_generated_provider"` for generated rows.
