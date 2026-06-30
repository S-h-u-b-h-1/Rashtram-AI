# Final Deployment Report

Date: 30 June 2026

Release status: deployed and verified.

## Release contents

- Dedicated State Bills module.
- Simplified evidence-first dashboard and real-data Demo Mode.
- Confidence-gated recommendations and coverage-gated trends.
- Expanded official policy coverage.
- Accurate null-status handling.
- Profile research analytics including State Bills, saves, bookmarks, and
  reading history.
- Working contact request storage.
- Removal of projected, placeholder, and decorative statistics.
- Source-aware public Product and Solutions language.

## Deployment record

| Service | Production alias | Immutable deployment | Status |
|---|---|---|---|
| Frontend | https://rashtram-ai.vercel.app | https://rashtram-3npnajfsi-shubh1s-projects.vercel.app | READY |
| Backend | https://rashtram-ai-backend.vercel.app | https://rashtram-ai-backend-jg58y0vni-shubh1s-projects.vercel.app | READY |

- Frontend deployment: `dpl_B59g3EY5cDC32eR4XGR5SGQxjoS5`
- Backend deployment: `dpl_BGfF6L55gyRjLAiUuiYTAPv3gL4K`
- Release commit: `0a033f5`
- Profile verification fix: `0ad0122`
- Branch: `codex/sync-shourya-rashtramai`

## Production verification

- Backend `/health`: HTTP 200, PostgreSQL connected, Gemini configured.
- Frontend `/`: HTTP 200.
- Frontend `/app/state-bills`: HTTP 200.
- Frontend `/contact`: HTTP 200.
- Production Sign In page: rendered without console errors, overlay, or overflow.
- Release verification: passed every Dashboard, Profile, catalogue, detail,
  search, timeline, graph, and unified-chat check.
- Frontend runtime errors in the final 30-minute scan: none.
- Backend runtime errors in the final 30-minute scan: none.

## Release note

The first post-deployment verifier detected a PostgreSQL bigint/text comparison
in the new State Bill profile metric. The query was corrected with an explicit
safe cast, all backend tests and the complete release verifier passed, and the
corrected backend artifact replaced the initial deployment before this report
was finalized.
