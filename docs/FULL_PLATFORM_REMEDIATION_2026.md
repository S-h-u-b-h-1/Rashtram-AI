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
| B — Corpus and semantic recovery | RA-T003, RA-T004 | PARTIAL |
| C — Source freshness | RA-T005, RA-T007 | DEPLOYED — production smoke healthy; feature-level live verification remains partial |
| D — Intelligence quality | RA-T006, RA-T009, RA-T010 | PARTIAL — bounded code fixes verified; live canaries pending |
| E — Outputs and UX | RA-T008, RA-T011, RA-T012, RA-T015, RA-T016, RA-T017 | OPEN |

## Defect tracker

| ID | Severity | Root cause | Files changed | Fix | Regression tests | Local result | Deployment | Production result | Status | Remaining limitation |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| RA-T001 | S1 | Production backend lacked private object-storage configuration although the verified Backblaze bucket was healthy | `server/research/sourceService.js`; `server/research/sourceRoute.js`; `server/profile/profileService.js`; `server/lib/storage/objectStorage.js`; upload UI/API files; focused tests | Added capability-aware direct upload, durable-original promotion before processing, retry-preserving extraction failures, ownership-scoped cleanup, account-delete cleanup, exact upload error contracts, and permanent deletion of every object version/delete marker | Backend upload/status/error/race/version-deletion tests; frontend size, MIME, network, retry and UI-message tests; live 1/5/10/25/49 MB, scanned and bilingual uploads | Full suite 595 pass/2 skip; 27/27 frontend; storage 25/25; build 22 routes | Workflow-test builds: backend `dpl_BHovRN7vySLYqi2dxpHuqXgSCUHK`; frontend `dpl_6fSDG3m9w1GjxdM4HkMThEugUXpW`; aliases reverified after documentation sync | Direct upload available; every valid size stored, checksum-verified, parsed, chunked, refreshed and cited; Policy Drafter used the upload; all disposable rows and every object version/delete marker removed | PRODUCTION_VERIFIED | Password-protected PDFs are rejected safely and retain the private original for retry until the user deletes it |
| RA-T002 | S1 | Generation and persistence were split: backend SSE generated only, while two independent frontend `/message` calls attempted to save the turn | `server/document/documentChatRoute.js`; `server/models/DocumentChat.js`; migrations `042` and `043`; `client/src/components/document-chat/DocumentChatLayout.jsx`; `client/src/lib/api.js`; focused tests | Backend owns session → user message → generation → assistant/citations/metadata persistence; stable request IDs make interrupted retries idempotent; conversation epochs prevent a cleared chat from being repopulated by an in-flight response | Ten live document families, two turns each, two refreshes, logout/re-login, citation restoration and exact duplicate replay | Full suite 595 pass/2 skip; 27/27 frontend | Same production deployments as RA-T001 | 10/10 multi-turn chats restored after refresh and re-login with citations; duplicate submission replayed the exact persisted answer and message count did not change | PRODUCTION_VERIFIED | None for the tested Release A persistence contract |
| RA-T003 | S1 | The readiness headline counted theoretically processable records without applying source retry controls, active-job exclusion, or actual file support; SQL `NOT IN` also excluded null legacy readiness values | Corpus recovery/audit services, worker selection, canonical resource selection, source retry controls, queue reconciliation, and focused tests | Added the exact 16-class readiness audit, null-safe selection, PDF/PolicyEdge-only eligibility, cost/source-aware bounded recovery, exact lexical probes, and explicit blocker counts | Recovery, readiness, source-circuit, queue, resource-selection, and retrieval fallback fixtures | Release B focused tests pass; bounded production validation recovered one of five distinct-source attempts and all seven chunks passed integrity/retrieval probes | Withheld: repository-wide gate has one unrelated, user-owned workspace-shell contract failure | Production database validation completed; source acquisition failed for four of five distinct hosts without retry, so broad recovery remains externally/data-quality constrained | PARTIAL | 15,147 documents are eligible for an attempt now, but 1,332 carry recorded acquisition failures; catalogue SEARCH_READY is 3,665/20,144 |
| RA-T004 | S1 | Semantic readiness flags, PostgreSQL references, Pinecone contents, namespaces, hashes, and legacy vector IDs were treated as equivalent although they are not | Semantic backfill/reconciliation services, vector identity, Pinecone adapter, audit/backfill CLIs, and focused tests | Added canonical content/version identities, exact cross-store inventory, non-destructive classifications, readiness-truth reconciliation, bounded backfill, and lexical fallback | Semantic coverage, content-hash, canonical identity, reconciliation, and Pinecone-failure fallback fixtures | Reconciled 2,010 flags to 28 exact documents, then a 25/25 canary raised exact semantic readiness to 53 with zero mismatch | Withheld: repository-wide gate has one unrelated, user-owned workspace-shell contract failure | Active Gemini namespace verified; no vector deleted; 21,460 old-namespace and 3,070 stale references remain classified | PARTIAL | Exact semantic coverage is 53/3,665 SEARCH_READY documents (1.45%); PG/Pinecone active-reference delta remains -4,481 |
| RA-T005 | S1 | Connector health mixed stale scheduler state, partial multi-collection success, upstream drift, and external TLS/access failures into ambiguous labels | Source policy/health, ingestion health/persistence, dashboard diagnostics, UIDAI and state-legislature connectors, temporal freshness safety, audit CLI and focused tests | Added cadence-aware final states, exact failure taxonomy, truthful attempt/success/change timestamps, partial-state aggregation, current-status degradation, source labels, UIDAI canonical listing repair, and a read-only 36-connector census | 95 focused connector, freshness, TLS/SSRF, temporal, PolicyEdge and source tests passed; 11-record bounded production-data canary succeeded | Release C focused suite, DB integrity, read-only audit, release verifier, lint and Webpack production build pass | Backend dpl_G7BQ4Da4xdn7eeAoxdMUiqJGZ441 and frontend dpl_DBH3oEVr5xxBBRLcgTn7c7agkHtU are Ready production deployments; aliases are live | UIDAI and PolicyEdge production-data canaries passed against production services; backend and frontend root smoke checks returned HTTP 200. Feature-level authenticated current-status checks were not run in this bounded release | PARTIAL | Digital Sansad and state legislature remain degraded; eGazette, state gazette, NMC and CBIC have external TLS-chain failures; Parliament pages require JavaScript; no unsafe bypass was added |
| RA-T006 | S2 | Recommendation/compliance relevance gating and taxonomy ranking require confirmation | `server/document/recommendationService.js`; focused recommendation/compliance tests | Preserved multi-signal relevance and authority/evidence gates; validated output/no-match contracts | Focused recommendation/compliance suites pass | Code-level verification passed | Not deployed separately; included in current production branch | Live benchmark not executed | PARTIAL | Run the frozen 75-query benchmark before production verification |
| RA-T007 | S2 | External-source extraction success was treated as authority, and user-selected web URLs were promoted to trusted evidence | External-source quality service, source service/API, retrieval authority, document chat/research routes, source label UI and focused tests | Separated fetch, extraction, verified-host/connector authority and purpose-aware evidence usability; generic web is limited for research and rejected for legal/compliance/current-status claims; low-quality official extraction is not promoted | Official government, regulator, institutional, generic, low-quality and private/unsafe fixtures pass; canonical URL host/tracking guards pass | 95/95 focused tests pass and Webpack production build succeeds | Backend dpl_G7BQ4Da4xdn7eeAoxdMUiqJGZ441 and frontend dpl_DBH3oEVr5xxBBRLcgTn7c7agkHtU are Ready production deployments; aliases resolve to these builds | Live authenticated user-URL/authority matrix was not run in this bounded release, so production verification remains outstanding | PARTIAL | Run the authenticated production URL matrix before marking PRODUCTION_VERIFIED; preserve SSRF and authority guards |
| RA-T008 | S2 | Initial research-workspace request waterfall requires profiling | None | Pending Release E | Pending | Not started | Not deployed | Not verified | OPEN | Cold workspace load exceeded 30 seconds in the baseline audit |
| RA-T009 | S2 | Comparison structured-output validation/fallback and context budget require confirmation | `server/document/documentComparisonService.js`; focused comparison/regeneration tests | Added deterministic validator rejecting empty summaries, citation-free analytical output and empty-success states; extractive fallback is explicitly partial | Comparison, regeneration and citation suites pass | Code-level verification passed | Not deployed separately; included in current production branch | Live comparison/latency canaries not executed | PARTIAL | Run the frozen 12-case comparison matrix and bounded production canaries |
| RA-T010 | S2 | Final chat response assembly/completeness validation requires confirmation | `server/retrieval/evidenceSafetyService.js`; `server/document/documentChatRoute.js`; focused evidence/streaming tests | Added deterministic dangling-promise/unfinished-output guard with one safe extractive fallback before persistence | Evidence safety, streaming, persistence and citation suites pass | Code-level verification passed | Not deployed separately; included in current production branch | Live 30-probe completeness matrix not executed | PARTIAL | Run production completeness probes and refresh/re-login persistence checks |
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

## Release B evidence log — 5 September 2026

### RA-T003 — bounded corpus readiness recovery

- The initial exact Release B census found 20,139 public catalogue records and
  3,398 `SEARCH_READY` records. The final census found 20,144 public records and
  3,665 `SEARCH_READY`, `CHAT_READY`, and `COMPARISON_READY` records: a net gain
  of 267 independently retrievable documents during Release B.
- The apparent large-backlog/small-selector contradiction had three concrete
  causes. The old headline did not apply source cooldown/window controls or
  active-job exclusion; 4,595 stale, never-claimed system jobs were safely
  cancelled without changing user jobs; and SQL `NOT IN` silently rejected null
  legacy readiness values. Selection is now null-safe and the audit publishes
  both theoretical and currently eligible counts.
- Final exact eligibility: 15,200 theoretically processable; 15,147 eligible for
  an attempt at the census instant; 1,332 with a recorded source acquisition
  failure; 0 actively blocked by retry controls or cooldown at that instant; 2
  blocked by stale/legacy readiness state; 172 manual-review; 1,084 unsupported,
  non-PDF, non-PolicyEdge resources; and 55 already queued or claimed. These are
  diagnostic dimensions and may overlap as documented by the audit.
- The converged validation was capped at 25, one document per source, two workers,
  one attempt, and 60 minutes. Only five distinct eligible sources were available:
  one document recovered, four failed upstream acquisition (three TLS, one HTML
  response presented as PDF), and no retry was performed. The recovered document
  produced seven non-empty, source-identified chunks; all seven passed integrity,
  exact-title retrieval, phrase retrieval, FTS, chat, and comparison readiness.
- This proves the recovery and lexical-readiness contract, but not broad corpus
  recovery. RA-T003 remains `PARTIAL` because the production bottleneck is now
  predominantly source acquisition/data quality rather than chunking or lexical
  retrieval logic.

### RA-T004 — semantic truth and bounded active-namespace recovery

- Canonical target: Gemini `gemini-embedding-001`, dimension 768, namespace
  `gemini-embedding-001-768-v1`. Before final reconciliation, 2,010 documents
  were flagged semantic-ready but only 28 satisfied the complete cross-store
  truth contract. Readiness flags were reconciled to 28/28 with zero mismatch.
- The single permitted 25-document semantic canary reused stored chunks only and
  did not download, OCR, or prepare documents. It processed 25/25 successfully,
  generated 218 embeddings, and recorded zero failures. Exact semantic readiness
  rose from 28 to 53 documents with zero mismatch.
- Final active-namespace inventory: 8,633 PostgreSQL chunk references plus 9
  routing references; 4,161 Pinecone vectors (409 bill, 3,752 act); reference
  delta -4,481. Diagnostics: 1,079 active-semantic chunks, 21,460 old-namespace,
  3,070 stale, 4,484 PostgreSQL references missing in Pinecone, and 3 vector-only
  records that remain `STILL_REFERENCED`. No vector was classified safe to delete,
  and no destructive cleanup occurred.
- A forced Pinecone/embedding failure fixture using the active Gemini contract
  returned verified PostgreSQL lexical evidence with `vectorDegraded: true`.
  `SEARCH_READY`, chat, and comparison therefore remain independent of vectors.
- RA-T004 remains `PARTIAL`: reconciliation and bounded backfill are verified,
  but broad backfill and a 75% target were deliberately excluded from this release.

### Release B local and production-data gates

- Release B focused suite: 51/51 passed. Frontend: 27/27 passed. Lint: 0 errors
  and 8 pre-existing warnings. Next.js Webpack production build completed all 22
  routes. The default Turbopack build remains blocked by the already tracked host
  port restriction.
- The final repository-wide backend run retained one failure outside Release B:
  `application shells constrain viewport overflow without blocking content
  scrolling`. User-owned, uncommitted Release E workspace redesign files are
  present and the modified shell no longer contains the class asserted by that
  contract. Release B did not modify, stage, or overwrite those files. Because
  the full-suite gate is therefore red, commit and deployment were withheld.
- Database integrity passed all parity, provenance, orphan, readiness, schema and
  migration checks. `process:audit` inspected 20,182 rows in read-only mode; all
  four before/after fingerprints matched and mutations were zero.
- Frontend production dependencies reported zero vulnerabilities. Backend retains
  the pre-existing moderate `qs@6.15.3` advisory recorded in Release A.
- The general release verifier passed dashboard, profile, catalogue families,
  universal search/detail, timeline, graph, date ordering, and chat-history checks.
- No Release B commit or deployment was created because the user-required
  repository-wide green-suite condition was not met.

## Release C evidence log — 5 September 2026

Release C was bounded to RA-T005 and RA-T007. It did not restart corpus or
semantic recovery, change recommendation/comparison behavior, or modify the
workspace redesign. Investigation and validation completed in approximately 42
minutes, below the four-hour release ceiling.

### RA-T005 — authoritative-source freshness and connector reliability

- The read-only baseline covered all 36 configured connectors. Normalized state
  before the bounded repairs was: 15 `FRESH`, 0 `DELAYED`, 0 `STALE`, 7
  `BLOCKED_EXTERNAL`, 8 `DEGRADED`, 0 `ERROR`, and 6 `NO_DATA`. The final census
  was: 16 `FRESH`, 0 `DELAYED`, 0 `STALE`, 7 `BLOCKED_EXTERNAL`, 7 `DEGRADED`,
  0 `ERROR`, and 6 `NO_DATA`.
- P0 results: India Code is `DEGRADED/HTTP_404` because its configured route no
  longer resolves and no stable official replacement was found within three
  bounded alternatives; eGazette is `BLOCKED_EXTERNAL/TLS_CERTIFICATE_FAILURE`;
  Digital Sansad is `DEGRADED/TIMEOUT`; Lok Sabha and Rajya Sabha are
  `DEGRADED/JAVASCRIPT_REQUIRED`; the state-legislature aggregate is
  `DEGRADED/TIMEOUT`; and state gazette is
  `BLOCKED_EXTERNAL/TLS_CERTIFICATE_FAILURE`.
- P1 results: RBI, SEBI, PIB and PRS are `FRESH`; NMC and CBIC are
  `BLOCKED_EXTERNAL/TLS_CERTIFICATE_FAILURE`; UIDAI moved from
  `DEGRADED/HTTP_404` to `FRESH` after its official listing path was updated from
  the retired endpoint to `/en/circulars`.
- The representative five-state legislature probe returned nine official
  records, nine PDFs, four snapshots, three collection errors and one explicit
  no-crawlable-PDF diagnostic. It exhausted the five-fetch connector cap before
  per-state attribution was exposed, so the result is reported honestly as an
  aggregate. A confirmed aggregation defect was fixed: one blocked state can no
  longer hide records returned by other states or mark the entire connector as
  blocked.
- P2/external restrictions were classified without bypass: IRDAI and PFRDA are
  `ROBOTS_BLOCK`; NCLT is `CAPTCHA_BLOCK`; AICTE is `TIMEOUT`; Election
  Commission is `HTML_STRUCTURE_CHANGED`; and NMC/CBIC/eGazette/state-gazette
  retain their observed TLS-chain failures. Certificate verification was not
  disabled, no CAPTCHA/WAF/robots control was circumvented, and failed hosts
  were not repeatedly probed.
- The exact taxonomy now distinguishes DNS, TLS certificate/protocol, HTTP,
  robots, CAPTCHA, WAF, timeout, redirect, JavaScript, authentication, URL/API/
  HTML drift, PDF discovery/content type, parser/quality, scheduler, duplicate,
  retired-source and unknown failures. Source-specific cadence determines
  `FRESH`, `DELAYED`, and `STALE`; externally imposed failures produce
  `BLOCKED_EXTERNAL`.
- The bounded mutation canaries used 11 of the permitted 50 records. UIDAI
  discovered and persisted one new official record with one resource and no
  error, bringing its corpus to 32. PolicyEdge discovered and persisted ten
  records without PDF processing, AI, or vectors, bringing its canonical corpus
  to 1,288 and clearing the sampled upstream drift. No corpus-wide processing or
  semantic backfill ran.
- Connector persistence and dashboard diagnostics now surface expected cadence,
  authority label, last attempt, last success, last document/change seen, exact
  failure, consecutive failures, cooldown and final freshness state. Current-
  status verification cannot report fully verified when its relevant connector
  is stale, degraded, blocked, erroneous, or has no data; it returns a concise
  partial/unverified limitation instead.

### RA-T007 — external-source authority and extraction quality

- External sources now carry four independent dimensions: fetch status
  (`SUCCESS/BLOCKED/FAILED`), extraction status
  (`GOOD/PARTIAL/LOW_QUALITY/FAILED`), verified authority class, and evidence
  status (`USABLE/LIMITED/NOT_USABLE`). Fetch success alone no longer confers
  legal authority.
- Authority comes from configured connector identity and verified official host,
  not words such as “ministry” or “authority” in page content. The supported
  classes are official primary, regulatory, government, legislature, government
  policy, institutional secondary, academic, trusted secondary, generic web,
  and unknown. Public UI labels remain plain-language: Official government
  source, Regulatory source, Institutional research, or External web source.
- A good generic web extraction remains limited for ordinary research and is
  excluded from legal, compliance, and current-status evidence with an explicit
  limitation. A low-quality official extraction remains not usable; official
  hostname does not rescue failed evidence. User-uploaded PDFs preserve their
  user-source identity, while a user-selected generic URL is no longer promoted
  to trusted evidence merely because the user selected it.
- Canonical external URLs may follow a successful same-host redirect and remove
  tracking parameters. A cross-host page-declared canonical URL is rejected in
  favor of the verified fetched host. Private, loopback, malformed, and unsafe
  URLs retain the SSRF guard and return the public quality contract without
  leaking internal network details.

### Release C gates and disposition

- Focused Release C gate: 95/95 passed, including connector failure/freshness,
  TLS and access-control classification, SSRF, authority, extraction quality,
  canonical URLs, current-status degradation, PolicyEdge HTML, temporal safety,
  and Release A external-source/upload regressions.
- Full backend gate: 645/646 passed. The sole failure is the pre-existing,
  unrelated workspace-shell contract requiring
  `h-full overflow-y-auto overscroll-contain`; Release C did not modify that
  user-owned redesign file.
- Frontend gate: 38/39 passed. Its sole failure is another unrelated workspace
  mobile contract expecting `min-h-9` while the current redesigned chat composer
  uses larger `min-h-11` touch controls. Release C did not change the composer.
- Lint completed with zero errors and eight pre-existing warnings. The Next.js
  production build compiled successfully and generated all 27 routes.
- Database verification passed all parity, orphan, readiness, identity, schema
  and migration checks. The verifier normalized quality metadata on 11 existing
  records as part of its established gate behavior. The separately enforced
  read-only `process:audit` inspected 20,193 documents and 6,894 processing jobs;
  all four before/after hashes and row counts were identical and mutation counts
  were zero. The general release verifier passed every catalogue, dashboard,
  profile, search/detail, timeline, graph, ordering, and chat-history check.
- Frontend production dependencies reported zero vulnerabilities. Backend keeps
  the previously recorded moderate `qs` advisory; dependency changes are outside
  Release C and the finding was not hidden.
- The two unrelated UX contracts were reconciled in the bounded follow-up: the
  workspace shell now asserts independent contained scrolling and the mobile
  composer contract matches the redesigned 44px controls. The safe Release C
  commits were pushed to `main`; backend deployment
  `dpl_G7BQ4Da4xdn7eeAoxdMUiqJGZ441` and frontend deployment
  `dpl_DBH3oEVr5xxBBRLcgTn7c7agkHtU` are Ready and their production aliases
  resolve to the new builds. Root smoke checks returned HTTP 200 for both
  aliases and the live frontend contains the simplified “What you get” copy.
- RA-T005 and RA-T007 remain `PARTIAL`, not `PRODUCTION_VERIFIED`: the deployed
  code is healthy and production-data canaries passed, but the authenticated
  feature-level current-status and user-URL authority matrices were not run in
  this bounded release. Release D must not begin automatically.

## Release D evidence log — 5 September 2026

Release D was bounded to RA-T006, RA-T009 and RA-T010. No corpus recovery,
vector backfill, connector repair or UX redesign was performed. The existing
implementation already contained the relevance taxonomy, authority gating,
comparison section backfill, citation verification and one-attempt repair
paths. This release added deterministic final-output contracts:

- Chat answers are checked before persistence for empty output, dangling
  promised passages/lists and unfinished structures. A single safe action
  replaces an invalid provider ending with already-retrieved extractive
  evidence; no repair loop is possible.
- Comparisons are checked after section backfill and citation verification.
  An empty summary or citation-free/analytically empty result is converted to
  an explicit evidence-abstention state rather than persisted as `SUCCESS`.
  Extractive fallbacks are reported as `PARTIAL_EVIDENCE`.
- Focused regression tests cover the new validators alongside recommendation,
  compliance, comparison, regeneration, citation, streaming and persistence
  suites.

### Bounded results

- Focused Release D suites passed (recommendation/compliance, comparison and
  regeneration, evidence safety, streaming, persistence and citation).
- Full backend suite was attempted. Five failures were environmental: four
  local-listener `EPERM` restrictions and one external DNS resolution failure;
  none was a Release D assertion regression.
- No authenticated production benchmark credentials were available in this
  run, so the maximum live canary matrices were not executed. No claim of
  production verification is made.

### Release D disposition

RA-T006 = `PARTIAL` (code-level relevance/evidence contracts pass; live
benchmark not executed). RA-T009 = `PARTIAL` (empty-success guard and bounded
fallback are implemented and tested; live latency/comparison canaries not
executed). RA-T010 = `PARTIAL` (deterministic completeness guard and safe
fallback are implemented and tested; live completeness matrix not executed).
Release E was not started.

## Status definitions

`OPEN`, `IN_PROGRESS`, `FIXED_LOCALLY`, `DEPLOYED`, `PRODUCTION_VERIFIED`,
`PARTIAL`, `BLOCKED_EXTERNAL`.
