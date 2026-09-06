# Research discovery and workspace quality

> Superseded by [the 6 September completion audit](COMPLETION_AUDIT_2026_09_06.md), which distinguishes live, local-only, partial and blocked work. Historical claims below are not current verification evidence.

## Completion audit — 6 September 2026 (in progress)

This audit supersedes earlier unverified completion/deployment statements below.
The live read-only snapshot initially contained 20,200 catalogue records and 3,496
ready records; a later snapshot contained 20,203 and 3,497 while normal ingestion
continued. Discovery must never describe the full count as evidence-ready.

Corrections in this pass: a single relevance-ranked home result contract, no
ready-first concatenation, shared discovery groups in Suggested Documents,
server-validated automatic preparation of at most three relevant trusted sources,
actual scoped background-worker dispatch, retained job attempt budgets,
uncached status polling, public/quarantine readiness gating, selected-source
handoff to quick actions, and lossless persisted comparison exports with Hindi fonts.

Read-only `process:audit`: zero missing states, eight existing canonical/state
flag mismatches, six failed jobs eligible for dead-letter reconciliation, zero
unsafe failure rows. Before/after database fingerprints matched; no reconciliation
was applied. These are not being represented as a clean production integrity pass.

Five read-only discovery baseline totals (ms): lending 2553, battery 1597, SaaS
5258, food 1364, Tamil Nadu factory 2242. First measured revised totals: 800,
2400, 2308, 1490, 1770. These are single-run diagnostics, not percentile or causal
performance claims. Food and factory false negatives were found and corrected.
Exact digital-lending and battery-waste regulatory coverage remains limited;
unrelated state lending laws and general industrial news must not fill that gap.

Server regression run: 635 pass, zero fail, two skipped (disposable database
fixtures unavailable). Frontend build and lint passed. Authenticated production
verification, scoped JIT canaries, final PDF visual inspection and deployment
identity verification are pending; this pass is not yet classified complete.

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
