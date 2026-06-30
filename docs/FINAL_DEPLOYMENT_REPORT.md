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
| Frontend | https://rashtram-ai.vercel.app | https://rashtram-eidx12188-shubh1s-projects.vercel.app | READY |
| Backend | https://rashtram-ai-backend.vercel.app | https://rashtram-ai-backend-qgb4lnyrd-shubh1s-projects.vercel.app | READY |

- Frontend deployment: `dpl_HRUEKY1gz9ZETE8Rzvg5DU7xFeTy`
- Backend deployment: `dpl_9cQZHTGq9ZXZdaqNoYDUP9sharyN`
- Bilingual/OCR release commit: `76ea51b`
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

## Hindi and authentication hotfix

- Confirmed the reported 500 was a four-page scanned Hindi PDF with no usable
  embedded text.
- Added bounded Gemini PDF OCR, Hindi/bilingual language detection,
  Devanagari-safe cleanup and chunking, multilingual embedding input,
  original-language citations, separate original-text/English-summary storage,
  and English/Hindi chat selection.
- Corrected stale-token precedence that caused `/api/activity` to send an old
  persistent token after a new session login.
- The production Gemini key is present as an encrypted Vercel variable.
- The processing route retains authentication protection and returns 401
  without a valid session.

## Release note

The first post-deployment verifier detected a PostgreSQL bigint/text comparison
in the new State Bill profile metric. The query was corrected with an explicit
safe cast, all backend tests and the complete release verifier passed, and the
corrected backend artifact replaced the initial deployment before this report
was finalized.
