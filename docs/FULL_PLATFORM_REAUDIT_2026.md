# Rashtram AI — Production Re-audit 2026

**Re-audit date:** 24 August 2026  
**Branch:** `main`  
**Frontend:** https://rashtram-ai.vercel.app  
**Backend:** https://rashtram-ai-backend.vercel.app  
**Frontend deployment:** `dpl_9HWdKrr9MSTpbxKL96Dtqx1dKm65` — Ready  
**Backend deployment:** `dpl_ANptfBDmYCTHp59XcfBaRcAELYdv` — Ready  
**Classification:** **RASHTRAM-PRODUCTION-COMPLETION-PARTIAL**

## Outcome

The platform is deployed and its principal user workflows are online. The reproduced trust regressions in compliance grounding, current-status wording, comparison-chat citation delivery, and knowledge discovery are fixed and verified in production. PolicyEdge ingestion and HTML research processing also succeeded on new live records.

The platform is not honestly classifiable as fully complete. Comparison generation still took 21.8 seconds in the final production smoke and returned a relatively sparse top-level comparison. Active Gemini semantic coverage is 457 of 3,390 search-ready documents (13.48%). India Code, eGazette, and Digital Sansad remain unhealthy for upstream reasons. Those limitations affect breadth and freshness, although PostgreSQL lexical retrieval continues to keep search-ready documents usable.

## Production verification

| Workflow | Result | Evidence |
|---|---:|---|
| Frontend public alias | PASS | Exact alias opened in browser; title `Rashtram AI`; researcher copy, source links, navigation and CTAs rendered |
| Backend health | PASS | HTTP 200; Neon connected; Gemini generation, embedding and streaming available |
| Compliance Copilot | PASS-safe | EV-battery/Gujarat smoke abstained with zero invented obligations |
| Current-status chat | PASS-safe | Eight retrieved sources; selected Bill status described as unverified, not asserted current |
| Comparison chat | PASS | Completed with 12 source objects preserved through final SSE metadata |
| Comparison generation | PASS/PERFORMANCE-AMBER | HTTP 201, Gemini output (no fallback), 17 citations, persisted and account-cleaned; 21.8 seconds |
| Related reading | PASS/limited sample | One grounded recommendation returned for production document 30 in 1.5 seconds |
| Knowledge discovery | PASS/limited corpus | HTTP 200 and stable empty-safe shape; knowledge population remains sparse |
| PolicyEdge catalogue | PASS | 5/5 stored: 4 inserted, 1 merged, zero errors |
| PolicyEdge HTML processing | PASS | Four new reports ready; 20 chunks; no PDF required |
| Account cleanup | PASS | Temporary smoke accounts deleted; prior release-QA query confirmed zero leftovers |

## Data and retrieval state

- Database size after recovery canary: 498,442,240 bytes.
- Storage guard: Healthy; bulk processing allowed.
- Search-ready documents: 3,390.
- Active Gemini semantic documents: 457 (13.48%).
- Search-ready without active semantic coverage: 2,933.
- PostgreSQL/Pinecone active-namespace reference delta: 5.
- Newly prepared PolicyEdge HTML reports: 4/4.
- Five-document semantic canary: 3 promoted, 2 safely not promoted.
- Invalid research-ready, ready-without-chunks, multiple-active-jobs, and comparison-without-research invariants: 0.
- Non-retryable records incorrectly marked retriable: reduced from 344 to 0.
- Remaining state/document flag differences: 196 non-ready legacy records.
- Retryable records beyond max attempts: 377; retained for explicit operational policy rather than silently discarded.

## Freshness status

| Source | Final sampled status | Action |
|---|---|---|
| PRS India | Fresh/connected | No missing sampled records |
| PolicyEdge | Reachable; sampled gap repaired | Bounded catalogue ingestion and four-record HTML preparation completed |
| India Code | Degraded/unavailable | Endpoint returned 404; current-status answers must not imply complete verification |
| eGazette | Degraded/unavailable | Certificate-chain failure; current-status guard remains active |
| Digital Sansad | Blocked | Access timeout/control; current-status guard remains active |

## Release gates

| Gate | Result |
|---|---:|
| Backend tests | 545 passed, 0 failed, 1 skipped |
| Frontend tests | 16 passed, 0 failed |
| Frontend lint | 0 errors, 8 warnings |
| Next.js production build | PASS with webpack |
| Vercel frontend deployment | Ready; public alias explicitly promoted |
| Vercel backend deployment | Ready; public alias points to new release |
| Browser smoke | PASS |
| Database integrity high-risk invariants | PASS |

The default Next.js Turbopack build could not bind an internal helper port inside the managed local sandbox. Running the same production build with webpack succeeded, and Vercel's production build is Ready. This is recorded as a test-environment limitation, not hidden as a product success.

## Remaining work before a broad external legal/compliance pilot

1. Reduce comparison latency and expand verified analytical section density across a representative pair matrix.
2. Run the semantic backfill in capacity-guarded batches until coverage is materially higher; do not sacrifice lexical readiness on provider failure.
3. Restore or replace the India Code, eGazette, and Digital Sansad connector paths and re-run freshness checks.
4. Establish a continuous processing worker/cron and measure throughput rather than relying on manual canaries.
5. Resolve the 196 legacy non-ready flag differences and explicitly expire or requeue the 377 exhausted retryable records.
6. Populate verified knowledge nodes/edges; a non-crashing empty endpoint is not knowledge coverage.
7. Close the official non-PolicyEdge HTML extraction fixtures, PDF repair backlog, taxonomy/duplicate cleanup, and remaining frontend warnings.

## Final judgement

The deployed product is substantially safer than the audited baseline and is suitable for controlled internal research QA. It is not yet a fully comprehensive or real-time legal research system. The remaining limitations are now explicit, measurable, and fail-safe: blocked freshness does not become a current factual claim, semantic failure does not remove lexical retrieval, and weak compliance evidence does not become an obligation.
