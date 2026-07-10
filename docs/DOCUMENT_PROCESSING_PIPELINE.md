# Document Processing Pipeline

## Readiness contract

Rashtram AI treats catalogue visibility, PDF availability, processing success,
research readiness, and comparison readiness as separate facts. A document is
not research-ready merely because it has a PDF or a summary.

`research_ready` requires:

- a public accessible PDF, text, or HTML resource;
- successful extraction;
- stored text chunks;
- either an embedding/vector reference for every stored chunk or verified local
  PostgreSQL text-chunk retrieval;
- no processing error; and
- a successful retrieval probe after vector storage or local text fallback.

`comparison_ready` currently uses the same strict retrieval contract. This is
intentional: comparison is grounded in retrieved passages and must never fall
back to catalogue metadata or a title-only model response.

## Processing stages

1. Validate the source URL and reject local/private network destinations.
2. Download the source and validate the PDF signature.
3. Extract native PDF text.
4. Use OCR when native text is insufficient and OCR is supported.
5. Preserve original Hindi/English text and detect language/script.
6. Normalize and chunk with Hindi-aware sentence boundaries.
7. Generate multilingual embeddings in count- and token-bounded batches.
8. Store normalized chunks in PostgreSQL before remote vector storage, then
   store vectors/vector references when the provider is available.
9. Generate and store an English summary separately from original text.
10. Probe retrieval using stored vectors first, with PostgreSQL chunk retrieval
    as the fallback.
11. Promote the document only after the probe succeeds.

Every failure records its stage, bounded reason, diagnostic metadata, attempt
count, and readiness classification. A failed document remains searchable and
its official source/PDF stays visible.

## Readiness classifications

- `research_ready`
- `comparison_ready`
- `pdf_available_not_processed`
- `processing_pending`
- `processing_failed_retriable`
- `processing_failed_permanent`
- `ocr_required`
- `unsupported_file_type`
- `missing_pdf`
- `source_only`
- `invalid_or_quarantined`

The canonical state is stored in `document_processing_state`; the strict
product gates are mirrored to `documents.research_ready` and
`documents.comparison_ready`.

PolicyEdge policy records are a supported HTML-source path. They start as
`source_extractable_not_processed`, are fetched through the PolicyEdge
connector, are stored as `source_html` text artifacts, and are promoted only
after chunk persistence and retrieval verification succeed. Vector persistence
is still preferred, but local text retrieval is accepted as an explicit
fallback when the embedding/vector provider is unavailable.

## Canonical readiness and preparation

`getDocumentReadiness(documentId)` is the single server-side readiness
contract used by:

- `GET /api/documents/:id/readiness`
- `POST /api/documents/:id/prepare`
- document chat processing
- document comparison validation
- frontend `Prepare & compare`

The readiness response includes `researchReady`, `comparisonReady`,
`canPrepare`, `status`, `reason`, `requirements`, chunk/vector counts,
`embeddingStatus`, `retrievalMode`, and failure metadata. The frontend should
use this response directly instead of inferring readiness from catalogue fields
alone.

## Queue and operational commands

Processing requests are recorded in `document_processing_jobs`. Active jobs
are unique per document, priorities are bounded, and concurrent workers use
atomic `SKIP LOCKED` claims. PostgreSQL stores checkpoints, worker heartbeats,
attempt metrics, delayed retries, and dead-letter outcomes. Per-source
concurrency prevents the worker pool from overloading official hosts.

```bash
npm run process:audit --prefix server
npm run process:status --prefix server
npm run process:documents --prefix server -- --limit=100 --only-unprocessed
npm run process:documents --prefix server -- --type=bill --limit=100
npm run process:documents --prefix server -- --type=state_bill --limit=100
npm run process:documents --prefix server -- --type=act --limit=100
npm run process:documents --prefix server -- --retry-failed
npm run process:documents --prefix server -- --limit=500 --resume --concurrency=3
npm run process:policies --prefix server -- --limit=25
```

The batch order prioritizes interacted-with documents, comparison selections,
recommendations, graph degree, policies, Bills, Acts, Gazette records, recency,
quality, and PDF-size cost efficiency. Use small batches first after any
provider or pipeline change.

Use `process:policies` for bounded PolicyEdge readiness batches. It selects
policy records with `source_extractable_not_processed` or retriable processing
failure states and calls the same Prepare for Research service used by the
application.

Chunks retain estimated page range, structural type, section/article/rule ID,
section title, clause ID, source URL, original language, extraction method, and
PDF quality class. Citations expose those fields in chat and comparison.

## Required server configuration

- `DATABASE_URL`
- `OPENAI_API_KEY`
- `OPENAI_MODEL`
- `OPENAI_EMBEDDING_MODEL`
- `EMBEDDING_BATCH_TOKEN_BUDGET` (defaults to a conservative 240,000)
- `OPENAI_OCR_MODEL`
- `PINECONE_API_KEY`
- `PINECONE_INDEX_NAME`
- `PINECONE_ACT_INDEX_NAME`
- `PINECONE_NAMESPACE`

Secrets belong in ignored local env files and encrypted deployment variables.
Empty provider variables are configuration failures and must not trigger
readiness promotion.

If a remote generation or embedding provider is temporarily unavailable, the
processor may use deterministic local fallbacks for summaries/embeddings so
source extraction and persistence can continue. These fallbacks are explicitly
logged. They are an operational resilience path, not a substitute for fixing
production AI provider configuration.

When vector storage fails after extraction, normalized chunks remain in
PostgreSQL and the document may still be promoted with
`embedding_status = fallback` and `retrieval_mode = local_text` after retrieval
verification succeeds. This prevents provider outages from discarding usable
official text.

## Known operational limitation

The user-triggered Prepare for Research endpoint records a queue job but
currently performs that job within the request. Large/OCR-heavy PDFs can exceed
serverless request duration. The durable PostgreSQL queue is consumed by the
bounded CLI worker pool and scheduled GitHub Actions workflow for unattended
backfills; the request path should remain limited to individual documents.
# 2026-07-10 Recovery Update

The processing pipeline now treats AI summary/question generation as
non-critical. If provider generation fails after text extraction, Rashtram AI
creates an extractive summary from source text, stores original chunks, and
allows local text retrieval fallback. This prevents provider billing/model
errors from blocking research readiness for otherwise valid documents.

Typed processing batches are scoped to the jobs selected by that batch unless
`--resume` is explicitly used. `--type=gazette` now covers the full Gazette
family: `gazette`, `notification`, `rule`, `regulation`, `order`, `circular`,
and `ordinance`.
