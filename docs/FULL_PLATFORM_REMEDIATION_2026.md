# Rashtram AI — Full Platform Remediation 2026

Updated: 5 September 2026

Baseline: [`FULL_PLATFORM_TEST_REPORT_2026.md`](./FULL_PLATFORM_TEST_REPORT_2026.md)
Baseline revision: `8bc1400`
Starting classification: **RED / PRODUCTION RELEASE NO-GO**

This is the release tracker for the 17 defects found by the full production
audit. A defect advances to `PRODUCTION_VERIFIED` only after reproduction,
root-cause confirmation, a regression test, a local fix, deployment, and a
successful production reproduction. External dependencies are recorded rather
than hidden.

## Release waves

| Release | Defects | Status |
| --- | --- | --- |
| A — Production foundation | RA-T001, RA-T002, RA-T013, RA-T014 | CODE_READY_AWAITING_PRODUCTION_STORAGE_APPROVAL |
| B — Corpus and semantic recovery | RA-T003, RA-T004 | OPEN |
| C — Source freshness | RA-T005, RA-T007 | OPEN |
| D — Intelligence quality | RA-T006, RA-T009, RA-T010 | OPEN |
| E — Outputs and UX | RA-T008, RA-T011, RA-T012, RA-T015, RA-T016, RA-T017 | OPEN |

## Defect tracker

| ID | Severity | Root cause | Files changed | Fix | Regression tests | Local result | Deployment | Production result | Status | Remaining limitation |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| RA-T001 | S1 | Production backend has no `OBJECT_STORAGE_*` variables; the configured private Backblaze bucket itself is healthy | `server/research/sourceService.js`; `server/research/sourceRoute.js`; `server/profile/profileService.js`; `server/lib/storage/objectStorage.js`; upload UI/API files; focused tests | Added capability-aware direct upload, durable-original promotion before processing, retry-preserving extraction failures, ownership-scoped cleanup, account-delete cleanup, exact upload error contracts, and permanent deletion of every object version/delete marker | Backend upload/status/error/race/version-deletion tests; frontend size, MIME, network, 413/422/503, retry and UI-message tests; live storage write/read/checksum/version-delete smoke | Storage smoke passed with zero versions or delete markers left; 25/25 stored references verified; backend 594 pass/2 skip; frontend 27 pass; lint 0 errors; Webpack build 22 routes | Not deployed | Bucket is verified healthy; Production Vercel still has no `OBJECT_STORAGE_*` variables and bucket CORS/lifecycle has not been changed | BLOCKED_EXTERNAL | Explicit approval is required to transmit the existing storage credentials to Vercel Production and apply private-bucket upload configuration; files over 3 MB remain blocked until then |
| RA-T002 | S1 | Generation and persistence were split: backend SSE generated only, while two independent frontend `/message` calls attempted to save the turn | `server/document/documentChatRoute.js`; `server/models/DocumentChat.js`; migrations `042` and `043`; `client/src/components/document-chat/DocumentChatLayout.jsx`; `client/src/lib/api.js`; focused tests | Backend owns session → user message → generation → assistant/citations/metadata persistence; stable request IDs make interrupted retries idempotent; conversation epochs prevent a cleared chat from being repopulated by an in-flight response | Eight document families, refresh/re-login identity, citations, cross-account isolation, concurrent duplicate replay, clear/generate race, persistence failure, and client contract tests | Backend 594 pass/2 skip; frontend 27 pass; lint 0 errors; Webpack build 22 routes | Not deployed | Awaiting migration and backend-first deployment, then frontend deployment and live refresh/re-login verification | FIXED_LOCALLY | Production verification pending |
| RA-T003 | S1 | Corpus acquisition/extraction backlog; 14,982 records had no valid chunks at baseline | None | Pending Release B | Pending | Not started | Not deployed | Not verified | OPEN | Only 16.9% of the public catalogue was research-ready at baseline |
| RA-T004 | S1 | Semantic namespace/reference drift and incomplete vector coverage | None | Pending Release B | Pending | Not started | Not deployed | Not verified | OPEN | Pinecone remains optional; lexical readiness must remain usable |
| RA-T005 | S1 | Connector-specific URL, TLS, access-control, and scheduling failures | None | Pending Release C | Pending | Not started | Not deployed | Not verified | OPEN | Several authoritative sources are stale, blocked, or unavailable |
| RA-T006 | S2 | Recommendation/compliance relevance gating and taxonomy ranking require confirmation | None | Pending Release D | Pending | Not started | Not deployed | Not verified | OPEN | Common valid problems return no results; implausible input can match |
| RA-T007 | S2 | External-source extraction success is not sufficiently separated from authority/quality | None | Pending Release C | Pending | Not started | Not deployed | Not verified | OPEN | Generic HTML can pass while some official pages fail |
| RA-T008 | S2 | Initial research-workspace request waterfall requires profiling | None | Pending Release E | Pending | Not started | Not deployed | Not verified | OPEN | Cold workspace load exceeded 30 seconds in the baseline audit |
| RA-T009 | S2 | Comparison structured-output validation/fallback and context budget require confirmation | None | Pending Release D | Pending | Not started | Not deployed | Not verified | OPEN | Comparison can be slow or return an analytically empty product |
| RA-T010 | S2 | Final chat response assembly/completeness validation requires confirmation | None | Pending Release D | Pending | Not started | Not deployed | Not verified | OPEN | Some answers end after promising a supporting passage |
| RA-T011 | S2 | Report field normalization and PDF serialization permit raw/noisy structures | None | Pending Release E | Pending | Not started | Not deployed | Not verified | OPEN | Raw JSON, mojibake, and passage dumps appeared in exports |
| RA-T012 | S2 | Draft semantic validation and DOCX serialization permit incomplete content | None | Pending Release E | Pending | Not started | Not deployed | Not verified | OPEN | Empty/truncated sections and an internal source label appeared in exports |
| RA-T013 | S2 | `runReadinessAudit` directly executed readiness inserts, updates, sanitization writes, document flag synchronization, and dead-letter reconciliation | `server/document/readinessService.js`; `server/cli/processAudit.js`; `server/package.json`; `server/test/processAuditSafety.test.js`; `docs/DOCUMENT_PROCESSING_PIPELINE.md` | Default audit now runs inside a PostgreSQL `REPEATABLE READ READ ONLY` transaction, captures before/after fingerprints, and rejects drift; mutation moved behind the exact `--apply` flag and `process:reconcile` command | Four safety tests: read-only SQL/fingerprint, drift fail-closed, explicit reconciliation, exact CLI flag parsing | Complete backend suite 594 pass, 2 intentional skips, 0 fail; configured DB audit reported 20,177 documents, zero creates/updates/deletes, and identical hashes for all four fingerprinted surfaces | Not deployed | Local command verified against configured database; production alias not yet updated | FIXED_LOCALLY | Release A deployment and post-deployment production fingerprint test remain |
| RA-T014 | S3 | Intent validation collapsed oversize into 422; 5xx error responses omitted safe machine codes; frontend surfaced generic fetch failures | Same upload/error files as RA-T001 | Exact `413 FILE_TOO_LARGE`, `422 INVALID_DOCUMENT`, `503 STORAGE_UNAVAILABLE`; safe public codes preserved and rendered as actionable messages | Boundary, invalid MIME/PDF, unavailable storage, and browser network regression tests | All Release A local gates pass | Not deployed | Production currently remains on the old contract | FIXED_LOCALLY | Production verification pending deployment |
| RA-T015 | S3 | Some interactive controls lack accessible names | None | Pending Release E | Pending | Not started | Not deployed | Not verified | OPEN | Accessibility regression coverage is not yet installed |
| RA-T016 | S3 | Default Turbopack build was blocked by the audit host's port restrictions | None | Pending Release E | Pending | Webpack fallback passed at baseline | Not deployed | Not verified | OPEN | Must certify the default build in CI/Vercel rather than weakening the gate |
| RA-T017 | S3 | CSP retains an obsolete OpenAI connection origin | None | Pending Release E | Pending | Not started | Not deployed | Not verified | OPEN | Provider allow-list must be verified before removal |

## Release A evidence log

### RA-T001 / RA-T014 — private uploads and error contract

- Production capability response reported `directUpload: false`.
- The backend Production environment contained no `OBJECT_STORAGE_*` variable.
- The local protected configuration targets the existing private Backblaze
  bucket. A disposable object completed write, metadata/head, read-back byte
  equality, SHA-256 verification, and permanent version-aware deletion. The
  post-delete inventory contained zero versions and zero delete markers.
- Twenty-five existing object references were checked and all twenty-five were
  readable and checksum-valid.
- This confirms a missing Production Vercel configuration, not a storage-provider
  outage.
- Local code now enforces the advertised 50 MB boundary and preserves safe,
  actionable `413`, `422`, and `503` contracts through the UI.
- A compatibility path keeps PDFs up to 3 MB usable when direct upload is
  unavailable. Extraction failure preserves the durable private original and
  exposes a retry action rather than silently deleting the user's file.
- Upload creation, completion, retry, cleanup, deletion, and account deletion
  share ownership-scoped lifecycle locks. Slow storage operations do not run
  inside the short upload-reservation transaction, and signed upload URLs remain
  tracked until they expire so a late write cannot create an orphan.
- Durable direct uploads above 3 MB remain blocked until the verified credentials
  are explicitly approved for Production Vercel and bucket CORS/lifecycle is
  applied.

### RA-T002 — durable generated-chat lifecycle

- Confirmed the production-generation route did not own persistence; the client
  independently saved user and assistant messages after the SSE completed.
- The backend now creates/finds the session, saves the user message, generates,
  saves the assistant response with citations and metadata, acknowledges the
  durable turn, and only then completes the stream.
- A stable request ID addresses both optimistic and persisted messages, making a
  network retry idempotent rather than duplicating the turn.
- A conversation epoch now prevents Clear from racing with an in-flight
  generation and restoring messages that the user already removed.
- The frontend removed duplicate save requests, rejects a completed stream that
  lacks a persistence acknowledgement, reuses the exact failed request for a
  safe retry, and clears stale cached history only after persistence is
  confirmed.

### RA-T013 — read-only processing audit

- Reproduced baseline behavior: the prior default command created 196 readiness
  states and updated 465.
- Confirmed root cause: the function invoked by `process:audit` was a
  reconciliation routine containing `INSERT` and `UPDATE` statements.
- New default contract: diagnostics use only `SELECT` statements inside a
  database-enforced read-only, repeatable-read transaction.
- Fingerprinted mutation surfaces: `document_processing_state`, readiness flags
  in `documents`, processing errors in `legislative_documents`, and processing
  job status fields.
- Configured-database verification on 5 September: 20,177 documents were
  audited; before/after row counts and hashes matched across all four protected
  surfaces; the command explicitly reported zero created, updated, or deleted
  rows.
- Reconciliation remains available only through the exact `--apply` flag or the
  deliberately named `process:reconcile` command.

## Release A local gate — 5 September 2026

- Backend: 596 tests discovered; 594 passed; 2 intentional environment-gated
  skips; 0 failed.
- Frontend: 27/27 tests passed.
- Lint: 0 errors; 8 pre-existing warnings outside Release A.
- Production compilation: Next.js Webpack build completed all 22 routes.
- Default Turbopack compilation remains blocked by this audit host's operating-
  system restriction on worker port binding; this is the already tracked
  RA-T016 Release E environment limitation, not a Release A compile failure.
- Production environment inspection exposed names only and confirmed that no
  `OBJECT_STORAGE_*` variables exist on `rashtram-ai-backend`.
- Release classification: `RELEASE_A_CODE_READY` and
  `PRODUCTION_STORAGE_CONFIG_AWAITING_USER_APPROVAL`.

## Status definitions

`OPEN`, `IN_PROGRESS`, `FIXED_LOCALLY`, `DEPLOYED`, `PRODUCTION_VERIFIED`,
`PARTIAL`, `BLOCKED_EXTERNAL`.
