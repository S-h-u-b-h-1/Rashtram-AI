# Onboarding Architecture

## Purpose

Onboarding collects a small set of useful personalization data at signup without blocking the product forever. The flow is capped at three steps and includes a skip action.

## Frontend

- Main route: `/app/onboarding`
- Signup also uses the same onboarding API for its 3-step setup.
- Route guard:
  - unauthenticated users go to `/login`
  - authenticated users with `onboarding.required = true` go to `/app/onboarding`
  - users who complete or skip onboarding can access the app

## API contract

`GET /api/auth/me` returns:

```json
{
  "user": {},
  "profile": {},
  "preferences": {},
  "onboarding": {
    "completed": false,
    "skipped": false,
    "completedAt": null,
    "required": true,
    "legacyUser": false
  }
}
```

Onboarding endpoints:

- `GET /api/onboarding` returns the same account-state contract.
- `PUT /api/onboarding` saves progress without completing.
- `POST /api/onboarding/complete` saves and marks complete.
- `POST /api/onboarding/skip` marks skipped and stores minimal defaults.

## Stored fields

Profile:

- name
- organization
- role
- designation
- location
- timezone

Preferences:

- preferredLanguage
- primaryUse
- preferredTopics
- preferredDocumentTypes
- preferredJurisdictions
- preferredStates
- preferredMinistries
- industries
- researchDescription
- notificationPreferences

## Database tables

- `users`
- `user_profiles`
- `user_preferences`
- `user_research_preferences`

Migration `011_profile_role_and_preference_sync.js` adds profile role support and an onboarding lookup index.

