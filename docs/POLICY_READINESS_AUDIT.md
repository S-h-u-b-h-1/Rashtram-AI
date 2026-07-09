# Policy Readiness Audit

Audit date: 9 July 2026

## Summary

Policies now use the same readiness contract as the rest of Rashtram AI:
Research and Compare require actual retrievable content, not catalogue
metadata. PolicyEdge records are treated as extractable HTML sources and are
processed through the document research pipeline before promotion.

## Current counts

| Metric | Count |
| --- | ---: |
| Total policy records | 1,168 |
| Policy records with PDF resources | 0 |
| Policy records with PDF/text/HTML resources | 67 |
| Research-ready policies | 42 |
| Comparison-ready policies | 42 |
| Source-extractable but unprocessed policies | 1,092 |
| Permanent failed policies | 33 |
| PDF-available-not-processed policies | 1 |

Readiness classes:

| Readiness class | Policies |
| --- | ---: |
| `source_extractable_not_processed` | 1,092 |
| `comparison_ready` | 42 |
| `processing_failed_permanent` | 33 |
| `pdf_available_not_processed` | 1 |

Top recorded failure:

| Failure stage | Failure reason | Policies |
| --- | --- | ---: |
| `pdf` | `404 status code (no body)` | 33 |

## Processing result

The policy-specific processor was run against PolicyEdge source records:

```bash
npm run process:policies --prefix server -- --limit=25
```

Result:

| Metric | Count |
| --- | ---: |
| Requested | 25 |
| Selected | 25 |
| Ready | 25 |
| Failed | 0 |

A prior 10-record smoke run produced 9 ready and 1 transient `terminated`
failure; the failed record was then retried successfully in the 25-record
batch.

After `npm run process:audit --prefix server`, whole-corpus readiness was:

| Metric | Count |
| --- | ---: |
| Total documents | 19,216 |
| Research-ready documents | 501 |
| Comparison-ready documents | 501 |
| Stored chunks | 7,174 |
| Stored embeddings | 7,174 |

## What was fixed

- Policy ingestion no longer sets `research_ready` or `comparison_ready`
  directly.
- Policy readiness no longer bypasses normalized processing state.
- PolicyEdge article pages are stored as `source_html` artifacts and processed
  through cleanup, language detection, chunking, embedding, vector storage, and
  retrieval verification.
- Prepare for Research accepts PolicyEdge source documents even when no PDF
  exists.
- Comparison readiness rejects any policy without successful processing,
  chunks, a verified retrieval path, and readiness flags.
- If vector retrieval/provider configuration fails but PostgreSQL chunks exist,
  policy comparison uses local text retrieval instead of failing with
  `No extractable text`.
- Recommendation payloads now expose readiness details so the UI can avoid
  broken Compare actions.

## Next processing plan

1. Correct production AI provider variables so generation and embeddings use a
   supported model/base URL pair.
2. Continue bounded policy batches:

   ```bash
   npm run process:policies --prefix server -- --limit=25
   ```

3. Run the readiness audit after each batch:

   ```bash
   npm run process:audit --prefix server
   npm run process:status --prefix server
   ```

4. Review the 33 permanent policy failures that were classified from 404
   responses before requeueing them.
5. Keep source-only policies searchable with View Source, but do not show
   Research/Compare until processing succeeds.
