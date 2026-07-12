# Feature Audit

Date: 2026-07-12

Branch: `main`

## Scope

This audit covered the current Rashtram AI application after implementing:

- database-first policy summaries;
- account-scoped comparison tray state;
- a three-step signup personalization walkthrough;
- profile onboarding persistence fields.

## Verification commands

```bash
npm test --prefix server
npm run lint --prefix client
npm run build --prefix client
npm run db:verify --prefix server
npm run process:audit --prefix server
npm run release:verify --prefix server
npm run db:migrate --prefix server
```

## Results

| Area | Status | Evidence |
| --- | --- | --- |
| Backend unit/integration tests | Passed | 120 passed, 1 skipped |
| Client lint | Passed | `eslint .` clean |
| Client production build | Passed | Next.js generated 22 app routes |
| Database verification | Passed | strict research-ready invariant passed |
| Processing audit | Passed | 19,260 documents audited; state reconciliation completed |
| Release verification | Passed | dashboard, profile, bills, acts, gazettes, policies, document detail, search, timeline, graph, unified chats |
| Database migrations | Passed | migration registry includes `010_profile_onboarding.js` |

## Feature checks

### Policy summaries

Policy summaries now read from `document_text_artifacts.english_summary` first. If no stored summary exists but text chunks exist, the server generates the summary once through `ensureSummary`, persists it in the database, and returns the cached value on later requests. Vector metadata is now only a fallback.

### Comparison personalization

Backend comparison records were already user-scoped by `user_id`. The frontend comparison tray was not: it used a single browser `localStorage` key. It is now scoped per authenticated user:

```text
rashtram-comparison-documents:<userId>
```

The old global key is removed during hydration, and storage writes wait until the current user's key is loaded to avoid account-switch leakage.

### Signup walkthrough

Signup now has a maximum three-step flow:

1. account credentials;
2. organization, role, location, and language;
3. policy areas, document types, and jurisdiction focus.

The flow uses smooth `framer-motion` transitions, includes a visible skip button, and persists useful personalization fields through the existing profile API.

### Onboarding persistence

The `user_profiles` table now includes:

- `onboarding_completed`
- `onboarding_skipped`
- `onboarding_completed_at`

Normal profile edits do not reset these flags unless onboarding fields are explicitly included.

## Known caveats

- This was a code/build/database audit, not a full manual browser QA session.
- Google sign-up lands on the app through the existing OAuth callback. The dedicated `/app/onboarding` page exists for setup, but Google callback routing was not changed in this pass.
- Production deployment still needs to be initiated after merging/pushing if Vercel does not auto-deploy `main`.
