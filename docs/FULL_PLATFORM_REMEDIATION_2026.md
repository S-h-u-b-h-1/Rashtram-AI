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
| A — Production foundation | RA-T001, RA-T002, RA-T013, RA-T014 | PRODUCTION_VERIFIED |
| B — Corpus and semantic recovery | RA-T003, RA-T004 | OPEN |
| C — Source freshness | RA-T005, RA-T007 | OPEN |
| D — Intelligence quality | RA-T006, RA-T009, RA-T010 | OPEN |
| E — Outputs and UX | RA-T008, RA-T011, RA-T012, RA-T015, RA-T016, RA-T017 | OPEN |

## Defect tracker

| ID | Severity | Root cause | Files changed | Fix | Regression tests | Local result | Deployment | Production result | Status | Remaining limitation |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| RA-T001 | S1 | Production backend lacked private object-storage configuration although the verified Backblaze bucket was healthy | `server/research/sourceService.js`; `server/research/sourceRoute.js`; `server/profile/profileService.js`; `server/lib/storage/objectStorage.js`; upload UI/API files; focused tests | Added capability-aware direct upload, durable-original promotion before processing, retry-preserving extraction failures, ownership-scoped cleanup, account-delete cleanup, exact upload error contracts, and permanent deletion of every object version/delete marker | Backend upload/status/error/race/version-deletion tests; frontend size, MIME, network, retry and UI-message tests; live 1/5/10/25/49 MB, scanned and bilingual uploads | Full suite 595 pass/2 skip; 27/27 frontend; storage 25/25; build 22 routes | Workflow-test builds: backend `dpl_BHovRN7vySLYqi2dxpHuqXgSCUHK`; frontend `dpl_6fSDG3m9w1GjxdM4HkMThEugUXpW`; aliases reverified after documentation sync | Direct upload available; every valid size stored, checksum-verified, parsed, chunked, refreshed and cited; Policy Drafter used the upload; all disposable rows and every object version/delete marker removed | PRODUCTION_VERIFIED | Password-protected PDFs are rejected safely and retain the private original for retry until the user deletes it |
| RA-T002 | S1 | Generation and persistence were split: backend SSE generated only, while two independent frontend `/message` calls attempted to save the turn | `server/document/documentChatRoute.js`; `server/models/DocumentChat.js`; migrations `042` and `043`; `client/src/components/document-chat/DocumentChatLayout.jsx`; `client/src/lib/api.js`; focused tests | Backend owns session → user message → generation → assistant/citations/metadata persistence; stable request IDs make interrupted retries idempotent; conversation epochs prevent a cleared chat from being repopulated by an in-flight response | Ten live document families, two turns each, two refreshes, logout/re-login, citation restoration and exact duplicate replay | Full suite 595 pass/2 skip; 27/27 frontend | Same production deployments as RA-T001 | 10/10 multi-turn chats restored after refresh and re-login with citations; duplicate submission replayed the exact persisted answer and message count did not change | PRODUCTION_VERIFIED | None for the tested Release A persistence contract |
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
| RA-T013 | S2 | `runReadinessAudit` directly executed readiness inserts, updates, sanitization writes, document flag synchronization, and dead-letter reconciliation | `server/document/readinessService.js`; `server/cli/processAudit.js`; `server/package.json`; `server/test/processAuditSafety.test.js`; `docs/DOCUMENT_PROCESSING_PIPELINE.md` | Default audit now runs inside a PostgreSQL `REPEATABLE READ READ ONLY` transaction, captures before/after fingerprints, and rejects drift; mutation moved behind the exact `--apply` flag and `process:reconcile` command | Four safety tests plus a post-deployment production fingerprint run | Full suite 595 pass/2 skip; production audit inspected 20,177 documents | Workflow-test backend build `dpl_BHovRN7vySLYqi2dxpHuqXgSCUHK`; alias reverified after documentation sync | All four before/after surfaces had identical row counts and hashes; zero creates, updates or deletes | PRODUCTION_VERIFIED | Reconciliation still requires the exact explicit `--apply` action |
| RA-T014 | S3 | Intent validation collapsed oversize into 422; missing uploads looked like storage outages; 5xx responses omitted safe codes; frontend surfaced generic fetch failures | Same upload/error files as RA-T001 plus `server/lib/storage/objectStorage.js` | Exact `413 FILE_TOO_LARGE`, `422 INVALID_DOCUMENT`, `409 NOT_READY`, and safe `503 STORAGE_UNAVAILABLE`; actionable frontend normalization | Boundary, invalid MIME/content, missing upload, unavailable storage, and browser network regression tests | Full suite 595 pass/2 skip; frontend 27/27 | Workflow-test builds: backend `dpl_BHovRN7vySLYqi2dxpHuqXgSCUHK`; frontend `dpl_6fSDG3m9w1GjxdM4HkMThEugUXpW`; aliases reverified after documentation sync | Live 413, 422 and 409 contracts returned exact codes and clear messages; live storage capability/normal uploads were healthy | PRODUCTION_VERIFIED | A real 503 outage was not induced in production; its safe public contract passed focused and full automated tests |
| RA-T015 | S3 | Some interactive controls lack accessible names | None | Pending Release E | Pending | Not started | Not deployed | Not verified | OPEN | Accessibility regression coverage is not yet installed |
| RA-T016 | S3 | Default Turbopack build was blocked by the audit host's port restrictions | None | Pending Release E | Pending | Webpack fallback passed at baseline | Not deployed | Not verified | OPEN | Must certify the default build in CI/Vercel rather than weakening the gate |
| RA-T017 | S3 | CSP retains an obsolete OpenAI connection origin | None | Pending Release E | Pending | Not started | Not deployed | Not verified | OPEN | Provider allow-list must be verified before removal |

## Release A evidence log

### RA-T001 / RA-T014 — private uploads and error contract

- The approved private Backblaze/S3 configuration was transmitted to the backend
  Vercel project without printing values. Production inspection by name only
  confirmed `OBJECT_STORAGE_PROVIDER`, `OBJECT_STORAGE_ENDPOINT`,
  `OBJECT_STORAGE_BUCKET`, `OBJECT_STORAGE_ACCESS_KEY_ID`,
  `OBJECT_STORAGE_SECRET_ACCESS_KEY`, `OBJECT_STORAGE_REGION`, and
  `OBJECT_STORAGE_FORCE_PATH_STYLE`.
- The private bucket now allows production and localhost browser origins for
  signed `PUT` requests only. Public read remains disabled. Lifecycle read-back
  confirmed two-day abandoned-intent expiry, two-day non-current-version expiry,
  one-day incomplete-multipart cleanup, and Backblaze-native orphan delete-marker
  cleanup.
- The live capability endpoint returned HTTP 200, `directUpload: true`,
  `storageStatus: available`, a 52,428,800-byte limit, checksum enforcement, and
  durable-original retention.
- Exact live upload matrix: 1, 5, 10, 25 and 49 MiB. Every file received a 201
  intent, a successful production-origin CORS preflight, a successful signed
  private upload, HTTP 200 processing, database checksum equality, durable-object
  byte/checksum equality, `ready` state, extracted text, two chunks, two page
  coordinates, and persistence after a refreshed source-list request.
- The scanned PDF completed with `selective_ocr`, one citation-ready page chunk,
  and `ocrUsed: true`. The bilingual PDF completed with `selective_ocr`, language
  `hi-en`, one page-aware chunk, and original-language text retained in the
  extracted source.
- A password-protected PDF was safely rejected with HTTP 422 and no chunks; its
  checksum-verified private original remained available for an explicit retry or
  user deletion. A renamed HTML file claiming to be PDF returned HTTP 422
  `INVALID_DOCUMENT` and retained no object.
- A 50 MiB + 1 byte intent returned HTTP 413 `FILE_TOO_LARGE` with the clear 50 MB
  message. Invalid MIME and invalid file content returned HTTP 422
  `INVALID_DOCUMENT`. Processing an intent before the signed upload arrived
  returned HTTP 409 `NOT_READY` after commit `c58358a`. The safe 503
  `STORAGE_UNAVAILABLE` contract is covered by focused and full automated tests;
  a real provider outage was deliberately not induced against production.
- Document chat used the uploaded source, persisted its response, and returned a
  page-level user-source citation. Policy Drafter used the same upload, streamed
  10,382 characters, cited one selected source, and persisted draft 16 during the
  disposable test.
- Cleanup ran only after every signed URL's expiry safety window. Eleven source
  rows were removed. All versions and delete markers for all sixteen tracked
  temporary/durable keys were permanently removed and re-listed as zero. Eight
  disposable test accounts and their chats/draft were deleted; verification found
  zero remaining user or private-data rows.
- A final independent storage verification completed write, head, read-back byte
  equality, SHA-256 equality, version-aware permanent deletion and absence check;
  25/25 retained production object references were readable and checksum-valid.

### RA-T002 — durable generated-chat lifecycle

- Ten live production workspaces were tested: Act, Bill, Gazette, Rule, Policy,
  Report, Regulation, Ordinance, Guideline, and Recommendation.
- Each workspace generated a grounded initial answer, persisted it with citations,
  survived a history refresh, generated a grounded follow-up, and survived a
  second refresh. This produced twenty verified generated turns.
- The browser-equivalent logout/login boundary was tested by discarding the first
  session token, confirming unauthenticated history returned 401, signing in
  again, and reloading all ten workspaces. Ten of ten conversations and all
  assistant citations were restored.
- An exact duplicate Act request reused the same request ID. Production returned
  `replayed: true`, the answer text matched byte-for-byte, persistence remained
  acknowledged, and the stored message count did not increase.
- The production test therefore confirms the backend-owned lifecycle: session,
  user turn, generation, assistant text/citations/metadata, persistence
  acknowledgement, and replay-safe completion.

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
- Post-deployment production verification repeated that result: 20,177 processing
  rows and documents, 20,177 legacy rows, and 6,023 processing jobs retained
  identical before/after fingerprints; `unchanged: true` and all mutation counts
  were zero.
- Reconciliation remains available only through the exact `--apply` flag or the
  deliberately named `process:reconcile` command.

## Release A production gate — 5 September 2026

- Backend: 597 tests discovered; 595 passed; 2 intentional environment-gated
  skips; 0 failed.
- Frontend: 27/27 tests passed.
- Lint: 0 errors; 8 pre-existing warnings outside Release A.
- Production compilation: Next.js Webpack build completed all 22 routes.
- Default Turbopack compilation remains blocked by this audit host's operating-
  system restriction on worker port binding; this is the already tracked
  RA-T016 Release E environment limitation. Vercel's production build completed
  successfully for both projects.
- Database integrity: all schema, parity, provenance, orphan, readiness and
  migration checks passed; migration 043 is current.
- General release verifier passed dashboard, profile, all catalogue families,
  universal documents/search, timeline, graph, date sorting and chat history.
- Security audit: frontend production dependencies reported zero vulnerabilities.
  Backend retains one pre-existing moderate `qs@6.15.3` advisory through Express;
  it is recorded for dependency maintenance rather than hidden in Release A.
- Functional workflow-test deployments were backend
  `dpl_BHovRN7vySLYqi2dxpHuqXgSCUHK` and frontend
  `dpl_6fSDG3m9w1GjxdM4HkMThEugUXpW`. After the evidence-only documentation
  sync, both Git-connected production aliases were reverified on their newest
  Ready deployments and returned HTTP 200.
- Forced production health check: database connected; Gemini generation,
  embeddings and streaming available; `gemini-2.5-flash` generation latency
  491 ms, embedding latency 178 ms, and streaming probe latency 475 ms.
- Release classification: `RELEASE_A_PRODUCTION_VERIFIED` for RA-T001, RA-T002,
  RA-T013 and RA-T014. Release B was not started.

## Status definitions

`OPEN`, `IN_PROGRESS`, `FIXED_LOCALLY`, `DEPLOYED`, `PRODUCTION_VERIFIED`,
`PARTIAL`, `BLOCKED_EXTERNAL`.
