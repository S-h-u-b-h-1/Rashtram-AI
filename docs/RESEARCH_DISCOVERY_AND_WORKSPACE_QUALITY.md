# Research discovery and workspace quality

## Product contract

Rashtram separates catalogue discovery from evidence readiness. The catalogue remains the discovery surface for roughly 20,000 records; a record is not evidence until its readiness contract says that text and retrieval are ready.

The New Research flow therefore follows this sequence:

`full catalogue → rank the best candidates → use ready sources immediately → prepare only the most relevant unready sources on demand`

The search response is intentionally broad (`researchReady` is not added by default) and carries readiness metadata. The UI makes only ready records selectable for a grounded workspace, while unready records remain visible with a clear explanation and an official-resource preview when available.

## Bounded just-in-time preparation

After a query, New Research selects at most three high-relevance candidates that have a recoverable resource and can be prepared safely. It calls `POST /api/documents/prepare-candidates`, whose server contract clamps every request to five unique numeric catalogue IDs, checks readiness again, and queues processing with priority 95 and at most two attempts. The endpoint never marks a record ready and never performs a broad catalogue job. Manual preparation remains available for an individual source.

Suggested Documents uses the same distinction. Ready recommendations remain the evidence-safe default; relevant unready records are returned as `preparationCandidates` and rendered in a separate “Relevant records that need preparation” section. They are labelled as preparation-required and cannot be used for retrieval until the readiness contract changes.

## New Research information architecture

New Research is the starting point for work. The first screen contains one research question box, PDF/link/library source controls, and two high-value actions directly below it: Draft a Policy and Compare Documents. Historical work belongs in My Research, so the large Recent Research block was removed from the start screen. The lightweight navigation link remains available for resuming saved work.

## Comparison export

`GET /api/documents/compare/:comparisonId/pdf` exports the persisted, owner-scoped comparison result. It does not call the model again. The PDF includes the executive summary, every supported comparison dimension, limitations, and the stored citations/evidence appendix. The export is available only for an existing comparison and uses the same report PDF renderer as research briefs.

## Action audit

Visible workspace actions were checked for a real handler or route: source preview, retry/delete/add-source, comparison selection, policy drafting, report creation, timeline, relationships, notes, citation/source opening, PDF export, reload/retry processing, and panel collapse/expand. Actions that require readiness or a minimum selection are disabled with a title or adjacent explanation; unavailable catalogue records are never silently treated as evidence.

## Verification record

- Catalogue filter contract: broad by default; readiness predicates are opt-in.
- JIT limits: 3 automatic candidates from New Research; 5-ID server hard cap; queue-only with two attempts.
- Comparison export: persisted result only; PDF header and evidence appendix covered by tests.
- Frontend checks: unit tests, lint, and production build are required before release.
- Backend checks: focused contract tests plus the full suite; sandbox-only failures are recorded separately from product failures.
- Production smoke checks: public frontend availability and backend health endpoint are checked after deployment. Authenticated workflow matrices still require a browser session with valid credentials.
