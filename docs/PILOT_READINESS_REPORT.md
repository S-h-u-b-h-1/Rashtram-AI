# Rashtram AI Pilot Readiness Report

Date: 2026-07-10

## Current readiness

Rashtram AI is ready for constrained early pilots where facilitators guide users toward research-ready documents. The system has a real corpus, grounded retrieval, comparison, recommendations, source health, profile/workspace history, and operational audit tooling.

It should not yet be sold as a fully autonomous full-corpus legal/policy research platform. The biggest limitations are provider/model configuration and remaining unprocessed backlog.

## Who can use it now

Good early pilot users:

- Rishihood faculty and researchers
- Policy researchers and think tanks
- Law students
- CA firms researching regulatory circulars, tax, RBI/SEBI/GST material
- MSME/business users exploring compliance documents

Use cases that work best:

- Researching ready Bills, Acts, Policies, and Gazette-family records
- Comparing two to five ready documents
- Viewing source-grounded snippets/citations
- Tracking research/comparison history in profile
- Exploring related/recommended documents with readiness indicators

## Best demo flows

Use verified ready IDs from the latest processing run:

| Flow | Suggested IDs |
| --- | --- |
| Act research | `961`, `10489` |
| Policy research | `20981`, `20983` |
| Gazette/regulation research | `20602`, `23271` |
| Bill comparison | recently processed `3605`, `3606`, `3608` or earlier verified `1910`, `1999` |

Recommended demo sequence:

1. Open dashboard and show real corpus/ready/source-health numbers.
2. Open a ready document detail page.
3. Show readiness badge and source/PDF link.
4. Ask a grounded chat question.
5. Compare two ready documents.
6. Show citations/snippets and profile history.
7. Explain that non-ready documents can be prepared, but research/compare stays disabled until verification passes.

## Coverage

Current verified state:

- Total documents: 19,237
- Research-ready: 761
- Comparison-ready: 761
- Chunks: 9,900
- Embeddings/local retrieval entries: 9,900

Coverage is strongest for:

- PRS Bills and state Bills
- selected Acts
- policy-source pages
- Gazette-family documents with accessible PDFs
- regulator/ministry sources that expose crawlable PDFs or HTML

Coverage gaps:

- large PDF backlog,
- blocked official portals,
- duplicate state legislative variants,
- source-only records not yet extractable,
- large/scanned PDFs requiring stronger OCR/worker capacity.

## Commercial positioning for early pilots

Position as:

- “grounded Indian public policy and legislative research workspace”
- “source-backed document chat and comparison”
- “pilot corpus with expanding coverage”

Do not position as:

- full legal advice,
- complete India-wide legislation database,
- guaranteed AI answer engine for every document,
- replacement for professional legal/compliance review.

## Pricing experiments

Suggested pilot packages:

1. University/research pilot
   - fixed institutional pilot fee,
   - capped users,
   - corpus/reporting feedback loop.

2. CA/compliance pilot
   - small paid cohort,
   - RBI/SEBI/GST/Companies Act workflow focus,
   - premium support for specific document sets.

3. Think-tank/policy pilot
   - project-based corpus preparation,
   - comparison/report workflows,
   - source provenance and export needs.

## Current limitations to disclose

- AI provider/model configuration is degraded; fallback is extractive and grounded but less polished.
- Full corpus is not research-ready yet.
- Some official sources are blocked by robots, CAPTCHA, JavaScript-only listings, certificates, or government portal behavior.
- Duplicate catalogue groups remain and require review.
- Some PDFs are broken, inaccessible, too large, scanned, or unsuitable for inline OCR.

## Next milestones

1. Fix production provider/model configuration.
2. Scale ready corpus past 1,000 documents with controlled batches.
3. Add dashboard cards that clearly separate total corpus, ready corpus, and source health.
4. Add clearer recommendation explanations in UI.
5. Build duplicate-review/merge workflow for PRS and India Code variants.
6. Add stronger OCR/offline worker support for scanned and large PDFs.
7. Create pilot feedback capture and usage analytics report.
