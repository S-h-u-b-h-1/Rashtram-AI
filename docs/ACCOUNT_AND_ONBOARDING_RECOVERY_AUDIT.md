# Account and Onboarding Recovery Audit

Date: 2026-07-12

## Scope

This audit covers the signup/onboarding account lifecycle, personalization data flow, comparison workspace scoping, summary caching, and account deletion behavior.

## Findings fixed

- New accounts could be created without a canonical account-state contract for the frontend.
- Signup and onboarding were writing through profile update paths instead of a dedicated onboarding API.
- Comparison workspace selection used a user-scoped key, but not the requested canonical key.
- Dashboard personalization was available through recommendation ranking but not exposed explicitly to the UI.
- Account deletion already performed database deletes; this audit confirms that the UI and API route call the transactional backend path.

## Implemented recovery

- Added `GET /api/auth/me` as the canonical authenticated account-state endpoint.
- Added onboarding endpoints:
  - `GET /api/onboarding`
  - `PUT /api/onboarding`
  - `POST /api/onboarding/skip`
  - `POST /api/onboarding/complete`
- Added persistent `role` support to `user_profiles`.
- Synchronized onboarding/profile data into:
  - `user_profiles`
  - `user_preferences`
  - `user_research_preferences`
- Updated frontend auth context to expose:
  - `user`
  - `profile`
  - `preferences`
  - `onboarding`
- Updated protected route guards so required onboarding redirects to `/app/onboarding`.
- Updated comparison storage to `rashtram:comparison-selection:<userId>` with legacy migration.
- Exposed dashboard `personalization` and `onboarding` metadata.

## Verification checklist

- New email signup redirects into a 3-step setup and persists completion.
- Google/new authenticated users are gated into `/app/onboarding` until they complete or skip.
- Skipped onboarding stores `onboarding_skipped = true`.
- Completed onboarding stores profile and research preferences.
- Dashboard shows whether it is personalized.
- Comparison selections are isolated per user.
- Account deletion removes the account via `DELETE /api/profile`.

