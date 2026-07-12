# Account Deletion

## User flow

Users can delete their account from profile account settings.

Requirements:

- Type `DELETE` to confirm.
- Password accounts must provide the current password.
- OAuth-only accounts do not require a password.

## API

`DELETE /api/profile`

Payload:

```json
{
  "confirmation": "DELETE",
  "password": "optional-for-oauth"
}
```

## Database behavior

The backend runs a transaction, locks the user row, verifies the password when required, deletes user-owned rows, nulls user references in audit/feedback/processing records, then deletes the `users` row.

Deleted or detached user-owned areas include:

- chats
- comparisons
- saved content
- saved searches
- research collections
- notes
- activity events
- sessions
- preferences
- profile
- recommendations ownership
- audit/feedback user references

The frontend clears auth tokens and local comparison/session state only after the API succeeds.

