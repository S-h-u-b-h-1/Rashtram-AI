# Document Processing Pipeline

## Readiness contract

Rashtram AI treats catalogue visibility, PDF availability, processing success,
research readiness, and comparison readiness as separate facts. A document is
not research-ready merely because it has a PDF or a summary.

`research_ready` requires:

- a public accessible PDF, text, or HTML resource;
- successful extraction;
- stored text chunks;
- an embedding for every stored chunk;
- no processing error; and
- a successful retrieval probe after vector storage.

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
7. Generate multilingual embeddings.
8. Store vectors in Pinecone and normalized chunks/vector references in
   PostgreSQL.
9. Generate and store an English summary separately from original text.
10. Probe retrieval using the stored vectors.
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

## Queue and operational commands

Processing requests are recorded in `document_processing_jobs`. Active jobs
are unique per document, priorities are bounded, attempts are recorded, and
the CLI processes documents sequentially to avoid overloading official
sources or model/vector providers.

```bash
npm run process:audit --prefix server
npm run process:status --prefix server
npm run process:documents --prefix server -- --limit=100 --only-unprocessed
npm run process:documents --prefix server -- --type=bill --limit=100
npm run process:documents --prefix server -- --type=state_bill --limit=100
npm run process:documents --prefix server -- --type=act --limit=100
npm run process:documents --prefix server -- --retry-failed
```

The batch order prioritizes interacted-with documents, comparison selections,
Bills, Acts, policies, Gazette records, graph-connected records, quality, and
recency. Use small batches first after any provider or pipeline change.

## Required server configuration

- `DATABASE_URL`
- `OPENAI_API_KEY`
- `OPENAI_MODEL`
- `OPENAI_EMBEDDING_MODEL`
- `OPENAI_OCR_MODEL`
- `PINECONE_API_KEY`
- `PINECONE_INDEX_NAME`
- `PINECONE_ACT_INDEX_NAME`
- `PINECONE_NAMESPACE`

Secrets belong in ignored local env files and encrypted deployment variables.
Empty provider variables are configuration failures and must not trigger
readiness promotion.

## Known operational limitation

The user-triggered Prepare for Research endpoint records a queue job but
currently performs that job within the request. Large/OCR-heavy PDFs can exceed
serverless request duration. The CLI is the reliable bounded backfill path;
moving queue consumption to a durable background worker is recommended before
running large unattended production batches.
