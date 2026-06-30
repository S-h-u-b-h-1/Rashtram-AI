# Production Verification Report

Date: 30 June 2026

## Automated checks

| Check | Result |
|---|---|
| Backend test suite | 71 pass, 0 fail, 1 intentional skip |
| Frontend ESLint | Pass |
| Next.js production build | Pass, 18 routes |
| Git whitespace validation | Pass |
| Ministry policy source health | Connected and parser valid |
| Policy ingestion | 36/36 stored, 0 errors |
| PostgreSQL health | Connected |
| Full release verifier | Pass across Dashboard, Profile, catalogues, document research, and chat |

## Browser checks

- Home and Contact pages loaded meaningful content.
- No console warnings/errors or framework error overlays.
- No desktop horizontal overflow.
- No horizontal overflow at 390 × 844.
- Contact form exposes labelled required fields and a real submission endpoint.
- Protected workspace routes redirect unauthenticated users to Sign In.

## Data checks

- Catalogue: 17,679 documents.
- PDF URL coverage: 17,298.
- Jurisdictions: 32.
- Exact duplicate groups: 0.
- One pending ambiguous match remains queued for human review rather than being
  auto-merged.

## Deployment smoke checks

- `https://rashtram-ai.vercel.app`: HTTP 200.
- `https://rashtram-ai.vercel.app/app/state-bills`: HTTP 200.
- `https://rashtram-ai.vercel.app/contact`: HTTP 200.
- `https://rashtram-ai-backend.vercel.app/health`: HTTP 200 with PostgreSQL
  connected.
- Frontend and backend 30-minute production error scans: no runtime errors.

Immutable deployment details are recorded in `FINAL_DEPLOYMENT_REPORT.md`.
