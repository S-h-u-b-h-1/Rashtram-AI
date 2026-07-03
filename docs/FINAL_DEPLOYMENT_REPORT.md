# Final Deployment Report

Date: 30 June 2026

Release status: deployed and verified.

## Release contents

- Dedicated State Bills module.
- Dedicated State Acts module and structured Bills/Acts navigation.
- First-class policy sub-libraries for national, state, scheme, guideline,
  memorandum, consultation, circular, framework, report, and white-paper
  research.
- Simplified evidence-first dashboard grouped by genuine document families.
- Confidence-gated recommendations and coverage-gated trends.
- Three-pane PDF, evidence brief, and research-chat workspace with controlled
  processing failure and retry.
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
| Frontend | https://rashtram-ai.vercel.app | https://rashtram-fej5rkb6t-shubh1s-projects.vercel.app | READY |
| Backend | https://rashtram-ai-backend.vercel.app | https://rashtram-ai-backend-ojsd6w8ec-shubh1s-projects.vercel.app | READY |

- Frontend deployment: `dpl_GVN3N919egK1Ay6GM77YKhngvgig`
- Backend deployment: `dpl_7SoqWc52dFNER1mTHJifRnot7if9`
- Release candidate commit: `8f39fd9`
- Bilingual/OCR release commit: `76ea51b`
- Branch: `codex/sync-shourya-rashtramai`

## Production verification

- Backend `/health`: HTTP 200, PostgreSQL connected, Gemini configured.
- Frontend `/`: HTTP 200.
- Frontend `/app/state-bills`: HTTP 200.
- Frontend `/app/state-acts`: HTTP 200.
- Unauthenticated document and dashboard API requests: controlled HTTP 401.
- Public landing, Sign In, and Sign Up pages: rendered without console errors,
  error overlays, or horizontal overflow at 390 px.
- Release verification: passed every Dashboard, Profile, catalogue, detail,
  search, timeline, graph, and unified-chat check.
- Automated gates: 76 backend tests passed, one database-write fixture skipped
  intentionally, frontend lint passed, and the 19-route production build
  completed.
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
