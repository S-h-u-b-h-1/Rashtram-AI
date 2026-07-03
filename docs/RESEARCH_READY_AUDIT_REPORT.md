# Research Readiness Audit Report

Audit date: 3 July 2026

## Catalogue baseline

Migration `006_full_research_readiness.js` was applied and the self-healing,
set-based audit classified all 17,744 normalized catalogue documents:

| Classification | Documents |
| --- | ---: |
| `pdf_available_not_processed` | 17,314 |
| `source_only` | 375 |
| `invalid_or_quarantined` | 38 |
| `comparison_ready` | 16 |
| `unsupported_file_type` | 1 |

All 16 comparison-ready records are also research-ready. They have 137 stored
chunks and 137 recorded embeddings. The audit stores an exact reason for every
non-ready record; it does not infer readiness from PDF availability. The final
audit also created state rows for three catalogue documents ingested after the
original state migration.

## Findings and fixes

- The old state did not distinguish PDF, chunking, retrieval, research, and
  comparison readiness. Migration 006 adds the missing stage and failure data.
- PDF/source audit logic initially referenced fields on the normalized table
  that remain in the legacy resource table. The query now joins the correct
  source.
- Readiness promotion now requires accessible source material, successful
  extraction/chunking/embedding, positive chunk counts, no processing error,
  and a live retrieval probe.
- Original-language chunks and vector references are persisted in PostgreSQL;
  original Hindi is not replaced by the English summary.
- Private/local source URLs and non-PDF bytes are rejected before processing.
- Permanent and retriable failures are classified separately and retain their
  stage, reason, provider diagnostics, and retry count.
- User-opened non-ready documents no longer create an empty chat or a false
  “prepared” assistant message.

## Backfill validation

The initial bounded production batch correctly failed closed because the
configured Pinecone API variable was empty. Ten documents were recorded as
`processing_failed_retriable`; none was incorrectly promoted. The encrypted
production variable and ignored local variable were then repaired. Both
five-document retry batches completed successfully: 10 ready, 0 failed, and
131 new chunks. Research-ready and comparison-ready counts increased from 6
to 16.

## Remaining limits

- 17,314 PDFs represent a substantial provider-cost and processing backlog.
  They should be processed in observed batches, not in a single release job.
- OCR quality depends on scan resolution and the configured OCR model.
- A durable background worker is still preferable to request-bound processing
  for large PDFs.
- `source_only` records remain searchable and visible but cannot enter grounded
  research until extractable content becomes available.
