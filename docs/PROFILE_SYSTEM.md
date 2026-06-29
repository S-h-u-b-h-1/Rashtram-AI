# Profile and Research Account System

Last reviewed: 29 June 2026

## Scope

The v1.0 profile is an account center combining editable identity, research
preferences, consent controls, analytics, saved work, exports, password
management, and session visibility.

## Editable profile

`user_profiles` stores username, bio, organization, designation, location,
phone, timezone, language, theme, research visibility, notifications,
research interests, preferred ministries/policy areas/jurisdictions/document
types/sources, and dashboard widgets.

The user name and photo URL remain on `users`. Photo URLs must use HTTP or
HTTPS. Usernames are unique and limited to letters, numbers, and underscores.

## Saved research

- `saved_content`: bookmarks, pinned documents, and pinned chats;
- `saved_searches`: named queries and filters;
- `research_collections` and `research_collection_items`: user folders;
- `research_notes`: private notes attached to a document.

Conversation and profile exports are authenticated. Session records are
excluded from downloaded profile data.

## Research analytics

PostgreSQL calculates documents opened, sessions, searches, Bill/Act/Gazette
conversations, summaries, messages, weekly/monthly activity, most active day,
research streak, and reading time.

Reading time uses the elapsed time between consecutive opted-in events within
one session, capped at 30 minutes per interval. No arbitrary engagement
multiplier is used.

Favorite topics, ministries, states, and document types use consented
interaction data. Tracking disabled means behavioral events are not written.

## Security and sessions

New logins receive a JWT ID backed by `user_sessions`. Middleware rejects
revoked or expired sessions while existing pre-v1 JWTs remain valid until
their normal expiry.

Users can inspect/revoke browser sessions and change or create a password.
Password changes revoke all sessions. Google-only users can create a password;
password users must provide the current password.

## APIs

| Method | Route | Purpose |
| --- | --- | --- |
| `GET` | `/api/profile` | Identity, analytics and saved work |
| `PATCH` | `/api/profile` | Update profile/preferences |
| `PATCH` | `/api/profile/password` | Change password |
| `POST` | `/api/profile/saved` | Bookmark/pin |
| `DELETE` | `/api/profile/saved/:id` | Remove saved item |
| `POST` | `/api/profile/saved-searches` | Save query/filters |
| `POST` | `/api/profile/collections` | Create collection |
| `POST` | `/api/profile/collections/:id/items` | Add document |
| `DELETE` | `/api/profile/sessions/:id` | Revoke session |
| `GET` | `/api/profile/export` | Download research/account JSON |

## Limitations

Photo management currently uses a URL rather than managed object storage.
Notification preferences are stored but outbound delivery is not enabled.
Organization visibility remains a preference until organization membership
and role-based access controls are introduced.
