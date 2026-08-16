# Policy drafting workspace

The Policy Drafter is available at `/app/policy-drafter` for authenticated researchers.

## Workflow

1. Add a public policy page, official PDF, or research paper in **Sources**, or upload a PDF for study.
2. Select research-ready policy and report records from the **Rashtram library**.
3. Describe the policy problem, intended audience, geography, and any requirements.
4. Generate a draft. The response streams progressively and is saved to the signed-in user's `policy_drafts` record.

The generated document includes problem evidence, objectives, target groups, options, a recommended approach, implementation, institutional responsibilities, funding, monitoring, risks, consultation questions, and evidence notes. The prompt explicitly separates facts from recommendations and labels missing evidence as **To be validated**.

## Authority and provenance

Catalogue records retain their title, document type, authority, ministry, date, and source URL. Uploaded and external sources remain account-scoped and are labelled as user study sources. Independent research is never presented as an official government position. The evidence list is returned with every draft and stored with the draft metadata.

## API

- `GET /api/policy-drafts` — list the signed-in user's drafts.
- `GET /api/policy-drafts/:draftId` — load one draft.
- `POST /api/policy-drafts/generate` — stream a draft from `{ title, objective, audience, geography, requirements, documentIds, sourceIds, responseLanguage }`.
- `DELETE /api/policy-drafts/:draftId` — remove a draft and its metadata.

Migration `028_policy_drafts.js` creates the account-scoped draft table. Large source files remain in configured object storage; only bounded extracted context and the user's generated draft are persisted in Postgres.
