# Research Readiness Growth Report

Date: 2026-07-11

## Baseline

Before this sprint, production status was approximately:

- total documents: 19,245
- research-ready: 934
- comparison-ready: 934
- processable backlog: 17,743

Post-verification database state:

- total documents audited: 19,245
- research-ready: 1,008
- comparison-ready: 1,008

## Growth mechanism

This sprint focuses on growth infrastructure, not a forced full-corpus backfill.

Readiness should now grow through:

1. automatic enqueue when users open processable unready documents;
2. bounded worker batches;
3. retriable failure repair;
4. catalogue audit classification;
5. safe local retrieval fallback where vector provider access is unavailable.

## Safety rule

Readiness count must increase only when processing and retrieval verification are real.

`comparison_ready` must not be set unless:

- usable chunks exist;
- retrieval path exists;
- retrieval verification succeeds;
- document is not hidden/quarantined/low-quality.

## Recommended first production batch

After Gemini health is green:

```bash
npm run documents:repair --prefix server -- \
  --limit=50 \
  --concurrency=2 \
  --source-concurrency=2
```

Then inspect:

```bash
npm run process:status --prefix server
npm run release:verify --prefix server
```
