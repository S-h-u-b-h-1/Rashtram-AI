# Production Verification Report

Date: 2026-07-11

## Local verification completed

Passed:

```bash
npm test --prefix server
npm run lint --prefix client
npm run build --prefix client
npm run db:verify --prefix server
npm run process:audit --prefix server
npm run release:verify --prefix server
```

## Verification results

- `db:verify`: passed, strict research-ready invariant passed.
- `process:audit`: audited 19,245 rows, no new states required, no failure sanitization required.
- `release:verify`: passed dashboard, profile, bills, acts, gazettes, policies, universal document detail, search, timeline, graph, sorting, and unified chat checks.

## Pending live production verification

Direct Vercel env updates, backend deployment, and production `/health` smoke test were not completed in this run because live network/Vercel approval was blocked by the current tool usage limit.

## Required production smoke tests after deploy

1. Verify `/health` reports:
   - `aiProvider: gemini`
   - `generationAvailable: true`
   - `embeddingAvailable: true`
   - `streamingAvailable: true`
2. Open a processable unready document and verify background queue enqueue.
3. Verify a ready bill chat streams a grounded answer.
4. Verify comparison still requires comparison-ready inputs.
5. Verify recommendations still include explanation reasons.
6. Verify process status shows no spike in dead-letter failures.

## Deployment requirement

After setting Gemini production env variables, redeploy the backend. Vercel env updates are not applied to existing deployments.
