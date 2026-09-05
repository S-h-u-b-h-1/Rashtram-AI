# Rashtram AI Full Production Portal Test Report — 2 September 2026

## Final classification

**FULL-PLATFORM-TEST-PARTIAL — RED — PRODUCTION RELEASE NO-GO**

The live portal was exercised end-to-end across its public pages, authenticated application, catalogue, document workspaces, grounded chat, comparisons, policy drafting, external research sources, recommendations, compliance, reports, personalization, account isolation, contact form, mobile layouts, production APIs, database integrity, and automated release gates.

The audit is classified `PARTIAL`, rather than `FULL-PLATFORM-TEST-COMPLETE`, for two explicit reasons:

1. Successful production account deletion was not executed because it irreversibly removes production records and requires explicit final approval. Two disposable QA accounts remain pending approved cleanup.
2. Google OAuth was verified through the correct redirect to Google, but an actual third-party Google account consent flow was not completed.

This run found multiple release-blocking production defects. Most importantly, private PDF upload is unavailable, generated document-chat answers are not persisted, only 16.9% of the catalogue is research-ready, semantic coverage is 13.74%, and several authoritative ingestion connectors are stale or failing.

No product implementation was changed during this audit.

## Production systems tested

| Surface | Target | Result |
| --- | --- | --- |
| Frontend | `https://rashtram-ai.vercel.app` | HTTP 200; live UI exercised |
| Backend | `https://rashtram-ai-backend.vercel.app` | Health HTTP 200; live APIs exercised |
| Deployed revision | `8bc1400` | Confirmed from the tested workspace/deployment state |
| Database | Production Neon PostgreSQL | Integrity checks passed; capacity critically high |
| AI | Gemini-backed production generation | Responsive for most chat/drafting/comparison requests |
| Retrieval | PostgreSQL lexical + optional Pinecone semantic | Lexical available; semantic coverage materially incomplete |

## Test method and data handling

- Testing was performed against the live production aliases, not mocks.
- Two synthetic accounts were registered for account-isolation and persistence tests:
  - `rashtram.qa.1788345672669.a@example.com`
  - `rashtram.qa.1788345672669.b@example.com`
- Tests covered successful, empty, invalid, unsupported, cross-account, retry, refresh, persistence, rate-limit, mobile, and degraded-provider cases where the production feature permitted them.
- One Formspree contact submission was sent with an explicit QA/test identity.
- External source tests created disposable URL-based research sources.
- Production comparisons, policy drafts, reports, watchlists, saved content, notes, and collections were created only under the disposable accounts.
- Final account deletion and cascade cleanup are pending explicit approval. Until then, these two accounts and their test records remain in production.
- A command named `process:audit` unexpectedly reconciled production readiness state while being used for read-only auditing: 465 states were updated and 196 states created. No application code was changed, but this operational side effect is recorded as a defect.

## Executive release assessment

| Area | Status | Release assessment |
| --- | --- | --- |
| Public site and navigation | Pass | Healthy |
| Registration, login, onboarding | Pass with limitation | Email/password healthy; Google consent not completed |
| Catalogue browse and search | Pass | Exact title and broad filters returned live results |
| Document detail/readiness APIs | Pass | Representative types loaded consistently |
| Document research workspace | Fail | Initial open can exceed 30 seconds |
| Grounded document chat | Fail | Answers generate, but history is not persisted |
| PDF upload | Fail | All valid production uploads failed with HTTP 503 |
| External website research | Partial | Several HTML sources work; source-quality gating is inconsistent |
| Comparison | Partial | Usually generates, but slow; one evidence-abstention result had empty analysis |
| Comparison chat | Pass | Follow-up generation and access control worked |
| Policy drafting | Partial | Generates and exports, but exported content has quality/layout defects |
| Recommendations | Fail | Common valid business problems often return no documents |
| Compliance Copilot | Fail | Common valid problems often return no evidence; an implausible query returned matches |
| Cross-state comparison | Partial | Two-state flows worked; rate limiting interrupted additional coverage |
| Research reports | Partial | Generates/exports, but PDF content contains raw objects and extraction noise |
| Personalization | Pass | Bookmark, saved search, collection, note, watchlist, and isolation worked |
| Contact form | Pass | Validation, error prevention, loading, and success submission worked |
| Mobile/responsive layouts | Pass with minor accessibility findings | No horizontal overflow at tested widths |
| Database integrity | Pass | Schema/integrity checks passed |
| Corpus readiness/freshness | Fail | Coverage and connector freshness are below pilot-safe level |
| Security controls | Pass with minor configuration issue | Isolation, auth, and SSRF controls worked |
| Automated tests | Pass | Backend 551 pass / 1 skip; frontend 18 pass |
| Production build | Partial | Webpack build passes; default Turbopack build cannot bind in this test host |

## Required audit totals

Counts below distinguish a route request from complete interactive coverage. A route can load successfully while a dependent operation—such as upload—still fails.

| Required measure | Result |
| --- | ---: |
| Overall status | **RED** |
| User-facing feature groups discovered | 42 |
| Feature groups substantially exercised | 37 |
| Feature groups incomplete/blocked | 5 |
| Frontend pages discovered | 22 |
| Frontend page routes requested | 22 |
| Frontend routes interactively exercised | 20 |
| Backend route definitions discovered | 153 |
| Live API request assertions recorded in the main harness | 183 |
| Major live API families exercised | 18 |
| Production documents inspected | 20 |
| Document types used in detail/chat checks | 9 |
| Chat questions asked | 21 |
| Comparison pairs generated | 6 |
| Policy drafts generated | 3 |
| DOCX files structurally and visually validated | 3 |
| PDF files successfully uploaded | 0 |
| PDF upload attempts | 7 (blocked by storage/size gate) |
| Public external URLs tested | 9, plus invalid and private-network cases |
| Compliance/recommendation problem scenarios tested | 10 plus invalid input |
| Current-status/freshness queries | 3 |
| Mobile application routes checked | 7 |
| Viewport widths checked | 8 |
| Issues logged | 17 |
| S0 | 0 |
| S1 | 5 |
| S2 | 8 |
| S3 | 4 |
| S4 | 0 |

Incomplete/blocked feature groups were: successful account deletion, completed third-party Google consent, successful PDF upload and post-upload research, all requested malicious/corrupt upload variants, and a complete ten-domain Compliance Copilot matrix without rate-limit interruption.

## Top 10 production blockers

1. `RA-T001`: private PDF storage/upload unavailable.
2. `RA-T002`: document-chat responses disappear after refresh.
3. `RA-T003`: only 16.9% of public catalogue records are research-ready.
4. `RA-T004`: only 13.74% of ready records have active semantic coverage.
5. `RA-T005`: authoritative freshness connectors are stale, blocked, or failing.
6. `RA-T006`: recommendations/compliance retrieval fails common real problems and admits implausible matches.
7. `RA-T009`: comparison is slow and can produce a citation-rich but analytically empty result.
8. `RA-T008`: a document workspace can take roughly 37 seconds to open.
9. `RA-T011`: research-report PDFs expose raw JSON, extraction noise, and unsynthesized passages.
10. `RA-T012`: policy-draft DOCX exports can be incomplete or expose internal labels.

## Complete feature coverage table

| # | Discovered feature | Production exercise | Status | Limitation/defect |
| ---: | --- | --- | --- | --- |
| 1 | Public home | Desktop load/navigation/assets | Pass | None material |
| 2 | Product page | Desktop load/navigation | Pass | None material |
| 3 | Solutions page | Desktop load/navigation | Pass | None material |
| 4 | Pricing page | Desktop load/navigation | Pass | None material |
| 5 | Contact form | Empty, invalid email, one QA submit | Pass | Recipient delivery cannot be independently observed |
| 6 | Signup | Two live API registrations; page route requested | Pass | Full unauthenticated browser walkthrough not repeated |
| 7 | Login/logout/session | Valid/invalid login, protected routes, redirects | Pass | Google consent incomplete |
| 8 | Google OAuth | Redirect and callback target inspected | Partial | No consent completion |
| 9 | Onboarding | Complete and skip | Pass | None material |
| 10 | Profile | Load/export and isolation | Pass | Successful deletion pending |
| 11 | Account deletion | Contract validation only | Incomplete | Irreversible live action awaiting approval |
| 12 | Dashboard | Stats/intelligence/source health/operations/quality | Pass | Data reveals corpus/freshness defects |
| 13 | Document library | Browse/search/exact/no-result/pagination | Pass | Initial results can take several seconds |
| 14 | Bills | Browse/detail/chat representative | Pass | Low readiness coverage globally |
| 15 | Acts | Browse/detail/chat representative | Pass | Low readiness coverage globally |
| 16 | Policies | Browse/detail/chat representative | Pass | Low readiness coverage globally |
| 17 | eGazette | Browse/detail/chat representative | Partial | Connector freshness failure |
| 18 | Rules | Detail/chat representative | Partial | Chat answer truncation |
| 19 | Regulations | Detail/chat representative | Pass | None in representative record |
| 20 | Notifications | Detail/chat bilingual representative | Pass | None in representative record |
| 21 | Circulars | Detail/chat representative | Pass | None in representative record |
| 22 | Reports | Detail/chat representative | Partial | Chat/report rendering defects |
| 23 | State Bills | Live page and endpoint behavior | Partial | Full state/filter matrix not completed |
| 24 | State Acts | Live page and endpoint behavior | Partial | Full state/filter matrix not completed |
| 25 | Document detail | Metadata/summary/readiness/source/timeline/graph | Pass | Some recommendation lists empty |
| 26 | Document workspace | Live open/mobile | Fail | Approximately 37-second initial open |
| 27 | Document chat | 21 questions across nine types | Fail | Responses not persisted |
| 28 | Multi-document chat | Page/context and comparison follow-up paths | Partial | Dedicated full multi-turn matrix not completed |
| 29 | Study shelf external link | HTML/PDF/invalid/private/quality cases | Partial | Official-source rejects and weak quality gate |
| 30 | Study shelf PDF upload | Sizes and browser flow | Fail | Storage HTTP 503 blocks downstream testing |
| 31 | Policy Drafter | Catalogue/external/mixed; DOCX | Partial | Export completeness defects; no Markdown endpoint |
| 32 | Comparison | Six pair types, refresh/regenerate/chat | Partial | Slow; one empty analytical result |
| 33 | Related reading | Representative recommendations across document types | Fail | Empty or weakly relevant recommendations |
| 34 | Recommendation wizard | Ten realistic/negative prompts | Fail | Common cases return zero; implausible case returns results |
| 35 | Compliance Copilot | Common, import, employment, negative prompts | Fail | Sparse evidence and relevance defect |
| 36 | Cross-state comparison | Two state-pair generations | Partial | Additional coverage rate-limited |
| 37 | Knowledge graph | Graph/detail/search/empty/malformed paths | Pass | Wrong-parameter request correctly returned 400 |
| 38 | Amendment/timeline | Timeline and current/amendment questions | Partial | Freshness connectors prevent comprehensive current verification |
| 39 | Watchlists/alerts | Create/list/refresh/isolation/invalid | Pass | Successful delete not separately repeated |
| 40 | Research reports | Single/multi/current, reload/PDF/isolation | Partial | Export content-quality defects |
| 41 | Notes/saves/collections | Create/duplicate/invalid/delete/isolation/export | Pass | Final cascade cleanup pending |
| 42 | Processing/readiness operations | Status, DB, semantic and connector audits | Fail | Coverage/freshness/vector defects |

## Frontend route coverage

All 22 discovered page routes were requested. Twenty were also used interactively; Login and Signup were route-checked while authenticated and their core operations were exercised through the production authentication API.

`/`, `/product`, `/solutions`, `/pricing`, `/contact`, `/login`, `/signup`, `/app`, `/app/onboarding`, `/app/profile`, `/app/document/[id]`, `/app/bill-chat`, `/app/act-chat`, `/app/egazette`, `/app/egazette-chat/[id]`, `/app/compare`, `/app/multi-document-chat`, `/app/policy-drafter`, `/app/recommend`, `/app/state-bills`, `/app/state-acts`, and `/app/graph/[id]`.

## Major live API families exercised

At least 183 assertions were recorded across: `/api/auth`, `/api/onboarding`, `/api/profile`, `/api/dashboard`, `/api/documents`, `/api/document-chat`, `/api/bills`, `/api/acts`, `/api/egazettes`, `/api/policies`, `/api/research-sources`, `/api/policy-drafts`, `/api/recommendations`, `/api/product-intelligence`, `/api/graph`, `/api/activity`, `/api/contact`, and backend health/operations endpoints.

Internal cron execution and destructive catalogue repair endpoints were inspected but not deliberately invoked as product features.

## Document-combination matrix

| Comparison ID | Combination | Readiness | Approx. first generation | Reload | Regeneration | Follow-up chat | Outcome |
| ---: | --- | --- | ---: | --- | --- | --- | --- |
| 77 | PDF-backed/PDF-backed | non-semantic/non-semantic | 26 s | Pass | Twice, 20 s class | Pass | Usable but no similarities/stakeholders |
| 78 | HTML/PDF | semantic/semantic | 26.8 s | Pass | Twice, 19–22 s | Pass | Most complete tested result |
| 79 | HTML/PDF | semantic/non-semantic | 1.6 s | Pass | Not material | Pass | Evidence abstention; all analytical arrays empty |
| 80 | Bill/Act | mixed | 24.2 s | Pass | Exercised in comparison suite | Pass | Comparison generated; some impact fields empty |
| 81 | Policy/Report | semantic-ready pair | 24.5 s | Pass | Exercised in comparison suite | Pass | Sparse similarities, otherwise generated |
| 82 | Unrelated pair | mixed | 21.9 s | Pass | Exercised in comparison suite | Pass | No relationship invented, but sparse analysis |

The available six pairs covered PDF/PDF, HTML/PDF, semantic/semantic, semantic/non-semantic, non-semantic/non-semantic, Bill/Act, Policy/Report, related, and unrelated behavior. Separate HTML/HTML, Act/Amendment, old/new, large/normal, repaired/normal, and English/bilingual comparisons were not all independently completed; this is one reason the audit is partial.

## Performance observations

| Operation | Observed live result | Assessment |
| --- | ---: | --- |
| Frontend root response | ~0.48 s | Healthy |
| Backend health | ~1.97 s | Acceptable but not fast |
| Dashboard | ~0.70 s | Acceptable |
| Dashboard intelligence | ~0.94 s | Acceptable |
| Source health | ~0.33 s | Good |
| Operations dashboard | ~1.51 s | Acceptable |
| Research quality | ~0.40 s | Good |
| Document library first results | ~7 s in browser | Slow |
| Document workspace usable | ~37 s | Unacceptable |
| Chat answer total | ~0.45–8 s typical | Good to acceptable |
| False-premise chat | ~28.4 s | Slow |
| Comparison first generation | ~21.9–26.8 s typical | Slow |
| Comparison regeneration | ~19–22 s | Slow |
| Comparison follow-up chat | ~3.8 s | Acceptable |
| Policy draft total | ~10–13 s | Acceptable; streaming feedback still important |
| Research report generation | ~0.7–1.5 s | Fast, but output quality is weak |
| External source extraction | Source-dependent | Several worked; official sources often rejected |
| PDF processing | Not measurable | Blocked before upload by storage HTTP 503 |

## Detailed feature coverage

### 1. Authentication, onboarding, and profile

| Test | Result | Evidence |
| --- | --- | --- |
| Register two users | Pass | Both returned HTTP 201 |
| Valid login | Pass | HTTP 200 and authenticated profile available |
| Invalid login | Pass | Rejected with HTTP 400 |
| Current-user session | Pass | `/auth/me` returned the correct account |
| Complete onboarding | Pass | Account A completed onboarding, HTTP 200 |
| Skip onboarding | Pass | Account B skipped, HTTP 200 |
| Cross-account data isolation | Pass | Comparisons/reports/collections/watchlists were inaccessible to the other account |
| Profile export | Pass | Export returned HTTP 200, approximately 24 KB |
| Delete-account validation | Automated pass only | Exact `DELETE` confirmation and password validation are covered by tests |
| Successful live deletion | Not completed | Pending explicit approval for irreversible cleanup |
| Google OAuth redirect | Partial pass | HTTP 302 to Google with the expected production callback; consent was not completed |

### 2. Dashboard, catalogue, browse, filters, and search

Production catalogue observations:

| Metric | Observed |
| --- | ---: |
| Public catalogue records | 20,086 |
| Bills | 969 |
| Acts | 540 |
| Gazettes | 40 |
| Policies | 1,159 |

Search behavior verified:

- Exact search for **The Taxation Laws (Amendment) Bill, 2025** returned one exact record.
- Broad searches returned plausible result volumes: `taxation` 294, `2025` 1,217, `RBI` 285, and `Finance` 544.
- A deliberately nonexistent phrase returned zero records.
- The live document-library UI reduced to the exact record and showed page 1 of 1.
- Main browse pages for Bills, Acts, Policies, eGazette, State Bills, and State Acts loaded.
- A private-network URL was rejected with HTTP 422; malformed URLs were rejected.
- Unauthenticated access to protected catalogue/application APIs returned HTTP 401.

### 3. Document types and readiness surfaces

Representative production records were exercised for Bill, Act, Policy, Gazette, Rule, Regulation, Notification, Circular, and Report. For each representative record, document detail, summary, readiness, relationships, recommendations, timeline, and graph endpoints were requested.

All tested endpoint families returned HTTP 200 for the representative records. Readiness varied significantly: some records were lexical-only, while Act, PolicyEdge HTML, Regulation, Notification, Circular, and Report examples were semantic-ready. Recommendation lists were empty for several otherwise prepared document types.

### 4. Grounded document chat

Twenty-one live questions were asked across document types, including:

- source fact and section questions;
- summary, authority, dates, and timeline;
- analysis and critique;
- business and government perspectives;
- hypothetical consequences;
- false-premise rejection;
- current status and amendment status.

Positive behavior:

- Answers generally began in approximately 0.45–8 seconds.
- The false premise was rejected instead of being adopted.
- Current-status questions abstained when a current authoritative source could not be verified.
- Perspective and hypothetical answers generally distinguished analysis from source fact.
- Citations were returned.

Failures:

- Generated assistant responses were not saved. After generation, `/document-chat/history` returned `chat: null` for both accounts. Refresh therefore loses the generated conversation.
- The false-premise case took approximately 28.4 seconds.
- Rule, Report, and Gazette answers ended with “The strongest supporting passage … is:” without displaying the promised passage.
- Opening a document workspace stayed on “Opening the research workspace…” for more than 30 seconds and completed only after roughly 37 seconds.

### 5. External links and private PDF sources

Ready external HTML sources included PIB, RBI, NITI Aayog, PolicyEdge, and even `example.com`. The latter demonstrates that domain/content quality gating is too permissive. Some official pages were rejected as low quality or failed to ingest, including Legislative Department, SEBI, and MeitY examples.

All valid PDF upload sizes tested—approximately 1 MB, 5 MB, 10 MB, 25 MB, and just under 50 MB—failed at upload-intent creation with HTTP 503:

> Private document storage is temporarily unavailable.

The live browser showed the less actionable message “Upload failed / Failed to fetch.” A file over the 50 MB limit returned HTTP 422 instead of the expected payload-too-large status. Corrupt-PDF and HTML-renamed-as-PDF validation could not be reached because storage failed first.

### 6. Document comparison and comparison chat

Six live comparison combinations were created, covering:

- lexical-only versus lexical-only;
- semantic-ready versus semantic-ready;
- semantic-ready versus lexical-only;
- Bill versus Act;
- Policy versus Report;
- deliberately unrelated documents.

Positive behavior:

- All six create requests returned successfully.
- Reload persisted the comparison.
- AI regeneration worked on tested comparisons.
- Cross-account access returned HTTP 404.
- Comparison follow-up chat returned a grounded answer.
- Selecting the same document twice was rejected with HTTP 400.

Failures and limitations:

- Typical first generation took approximately 21.9–26.8 seconds; regeneration took approximately 19–22 seconds.
- One mixed-readiness comparison returned `generationMode: evidence_abstention`, included 15 citations, but every analytical array was empty. Its executive summary was an evidence dump rather than an actual comparison.
- Several generated comparisons lacked similarities, stakeholders, compliance impact, or implementation impact despite having retrieved evidence.

### 7. Policy drafting

Three live drafts were generated from catalogue-only, external-source-only, and mixed evidence. Generation took approximately 10–13 seconds. Drafts persisted, reloaded, and exported as valid DOCX files. The previous `[object Object]` rendering regression was not reproduced.

Export quality defects found during rendered-page inspection:

- An external-source draft ended with an empty “Risks and Mitigations” table.
- A mixed-source draft contained a bullet truncated at `employee/` before the next heading.
- References exposed the internal source label `user_source`.
- No Markdown export endpoint was found.

### 8. Recommendations, Compliance Copilot, and cross-state research

Recommendation tests for NBFC regulation, battery compliance, food regulation, insurance, and tax work for chartered accountants returned HTTP 200 but zero recommendations, commonly with `D_PRIMARY_SOURCE_MISSING`. A SaaS scenario returned two secondary-only matches.

Compliance tests for the same common scenarios also often returned zero evidence and zero recommendations. Import and employment scenarios produced results. A deliberately implausible request about lunar mining in Delhi returned two recommendations and two evidence items, showing weak relevance gating.

Two cross-state comparisons completed successfully. A subsequent generation request hit the live rate limiter and returned HTTP 429, verifying rate-limit handling but preventing complete additional-state coverage in that session.

### 9. Research reports and downloads

Single-document, multi-document, and current-status reports were generated and persisted. Reload, PDF download, invalid input, and cross-account access control were verified.

Rendered PDF inspection found:

- raw JSON objects printed as Timeline bullets;
- mojibake/extraction noise in a single-document report;
- very long raw passage dumps where synthesized key provisions were expected;
- a “Current Position” section containing only document titles instead of a current-status conclusion.

### 10. Personalization and user-owned data

The following live actions passed:

- bookmark creation and duplicate idempotency;
- invalid bookmark rejection;
- saved search creation/deletion;
- collection creation and adding an item;
- cross-account collection protection;
- note creation, history retrieval, and deletion;
- watchlists for regulator, topic, jurisdiction, and document;
- per-account watchlist and alert isolation;
- profile export.

HTML/script-like strings were stored as data and did not execute during observed flows. The stored test records remain pending approved account cleanup.

### 11. Contact and public pages

The Contact page passed empty-form validation, invalid-email validation, disabled/loading behavior, and one marked production QA submission. The configured success message appeared.

Public Home, Product, Solutions, Pricing, and Contact pages loaded without broken images or horizontal overflow. Authenticated visits to Login and Signup redirected to the application as expected.

### 12. Mobile and responsive behavior

The application was checked at widths 320, 360, 375, 390, 412, 430, and 768 pixels across dashboard, document library, document workspace, comparison, recommendations, policy drafting, and profile. No horizontal overflow was observed.

Minor accessibility debt remains: one to two interactive elements on several tested screens lacked an accessible label.

## Database, readiness, and freshness status

### Capacity

| Metric | Observed |
| --- | ---: |
| Database bytes used | 501,694,464 |
| Previously configured capacity threshold | 501,809,152 |
| Approximate usage against threshold | 99.98% |
| Neon platform maximum reported by plan tooling | 16 TB |

The database passed integrity verification and the latest migration was `041`, but the working capacity threshold is effectively exhausted and requires immediate operational clarification/relief.

### Corpus readiness

| Metric | Observed |
| --- | ---: |
| Total catalogue | 20,124 |
| Public catalogue | 20,086 |
| Search/chat/comparison-ready | 3,398 (16.9%) |
| Not ready | 16,688 |
| Automatically recoverable | 16,583 |
| Manual intervention | 105 |
| Records with no valid chunks | 14,982 |
| Artifact/chunk documents | 3,405 |
| Total chunks | 24,699 |

### Semantic coverage

| Metric | Observed |
| --- | ---: |
| Active semantic documents | 467 |
| Ready documents without active semantic vectors | 2,931 |
| Semantic coverage | 13.74% |
| Namespace mismatch records | 1,453 |
| Stale vectors | 11,080 |

Pinecone health reported low active occupancy in both configured namespaces. PostgreSQL lexical retrieval remains usable, but semantic recall is not representative of the prepared corpus.

### Connector freshness

Connector state at audit time: 17 connected, 5 unavailable, 8 blocked, 3 behind upstream, and 3 no-data.

Material freshness failures included:

- India Code returning HTTP 404, last successful ingestion 18 August;
- eGazette failing TLS certificate verification, last successful ingestion 15 July;
- Digital Sansad/Parliament sources blocked or timing out;
- state legislature data stale since 16 August;
- state gazette blocked;
- PolicyEdge, PIB, and RBI behind upstream;
- UIDAI stale/unavailable;
- CBIC and NMC certificate failures;
- IRDAI/PFRDA blocked by robots;
- NCLT blocked by CAPTCHA as designed.

The portal must not claim complete current-status verification while these authoritative connectors are stale or unavailable.

### Complete connector/freshness table

This table records the state returned by the production source-health surface during this run. “Connected” means the connector was operational at the health-check layer; it does not prove complete corpus coverage.

| Connector | Observed state | Freshness/failure evidence |
| --- | --- | --- |
| PRS India | Connected | Fresh through 1 September |
| India Code | Unavailable | HTTP 404; last successful run 18 August |
| eGazette | Unavailable | TLS certificate verification failure; last success 15 July |
| Digital Sansad | Blocked | Access timeout/control |
| Lok Sabha | Blocked | Static/access path blocked; last useful run 28 June |
| Rajya Sabha | Blocked | Access control/upstream failure |
| State Legislatures | Blocked/stale | Last successful coverage 16 August |
| State Gazettes | Blocked | Upstream access failure |
| Ministry directory | Connected | Directory endpoint operational |
| National Portal / india.gov.in | Connected | Listing endpoint operational |
| State directory | Connected | Directory endpoint operational |
| State Policy | Connected | Connector operational; coverage not comprehensive |
| NITI Aayog | Connected | HTML source succeeded in live study-source test |
| MyGov | Connected | Health surface operational |
| NDAP | No data | No usable current ingestion data in health output |
| OGD India | No data | No usable current ingestion data in health output |
| Ministry of Environment | Connected | Health surface operational |
| PolicyEdge | Behind upstream | Three-run lag/degraded state; individual HTML test succeeded |
| PIB | Behind upstream | Two-run lag and duplicate-key ingestion error observed |
| RBI | Behind upstream | Three-run lag; individual HTML test succeeded |
| SEBI | Connected/degraded extraction | Connector health available; tested page failed quality extraction |
| TRAI | Connected | Health surface operational |
| UIDAI | Unavailable/stale | Last useful state 9 August |
| CERC | Connected | Health surface operational |
| IRDAI | Blocked | robots/access restriction |
| PFRDA | Blocked | robots/access restriction |
| NMC | Unavailable | Certificate failure |
| AICTE | Connected but stale | Last useful state 15 July |
| UGC | Connected | Health surface operational |
| Election Commission | No data | No usable current ingestion data in health output |
| NCLAT | Connected | Health surface operational |
| GST Council | Connected | Health surface operational |
| CBDT | Connected | Health surface operational |
| CBIC | Unavailable | Certificate failure |
| CCI | Connected | Health surface operational |
| NCLT | Blocked by design | CAPTCHA/anti-automation control |

## Defect register

### Defect evidence and regression matrix

The following matrix supplies the common fields required for every defect. Root-cause entries identify the most probable subsystem, not a confirmed code diagnosis, because this run intentionally did not modify or debug product implementation.

| ID | Route/API | Affected records | Network/log/screen evidence | Probable root-cause area | User + research/safety impact | Required regression |
| --- | --- | --- | --- | --- | --- | --- |
| RA-T001 | `/app/document/[id]`, `POST /api/research-sources/upload-intent` | User PDFs; representative workspace document 186 | HTTP 503 for every valid size; browser “Failed to fetch” | Object-storage production configuration/capability gate | Users cannot study private evidence; drafting/comparison upload promises are unavailable | Upload 1/5/10/25/49 MB, persist, process, cite, refresh, delete |
| RA-T002 | `POST /api/document-chat`, `GET /api/document-chat/history` | 186, 23779, 20835, 20425, 44, 24766, 20438, 20515, 24562 | Generation 200 followed by `chat: null` on two accounts | Session/message persistence transaction or route mismatch | Research work disappears; citations and audit trail are lost | Generate multi-turn chat, refresh, re-login, verify exact message/citation persistence |
| RA-T003 | `/api/documents/*`, processing/readiness operations | Corpus-wide | 3,398/20,086 ready; 14,982 without chunks | Acquisition/extraction backlog and readiness reconciliation | Most records cannot be researched; catalogue availability is misleading | Random stratified readiness sample plus recoverable-batch completion |
| RA-T004 | Semantic/hybrid retrieval services | Corpus-wide | 467 active semantic docs; 1,453 namespace mismatches; 11,080 stale vectors | Pinecone namespace migration/reconciliation | Weak recall and inconsistent related-document discovery | PG/Pinecone reconciliation, semantic and lexical fallback benchmarks |
| RA-T005 | `/api/dashboard/source-health`, current-status retrieval | Corpus-wide | 5 unavailable, 8 blocked, 3 behind upstream, 3 no-data | Connector URLs, TLS, robots, adapters, upstream scheduling | Current legal status may be incomplete or stale | Per-connector freshness fixture and stale-source disclosure in current-status answers |
| RA-T006 | `POST /api/recommendations/problem`, `POST /api/product-intelligence/compliance` | Query-derived | Common scenarios return 0; lunar-mining query returns 2 | Relevance gating, taxonomy, normative-passage ranking | Researchers get no help for real problems or misleading help for implausible ones | Positive/negative domain benchmark with minimum precision/recall gates |
| RA-T007 | `POST /api/research-sources/url` | User sources 6–10 | `example.com` ready; official pages rejected 422 | HTML quality/authority classification | Low-authority text can be treated as evidence while official sources are excluded | Authority-weighted URL corpus including official, generic, JS-heavy, blocked pages |
| RA-T008 | `/app/document/186` and its initial API waterfall | Document 186 | “Opening…” for >30 s; usable at ~37 s | Sequential initial data waterfall/cold functions | Core research entry feels broken and risks abandonment | Cold/warm browser budget with progressive-shell assertion (<4 s usable) |
| RA-T009 | `POST /api/documents/compare`, regeneration routes | Comparison IDs 77–82, especially 79 | 21.9–26.8 s; ID 79 all analytical arrays empty | Generation schema validation/fallback and oversized context | Users wait and may receive a non-comparison presented as success | Pair matrix with non-empty analytical minimums, bounded retry, latency budget |
| RA-T010 | Document-chat generation/rendering | 44, 20425, 24562 | Answer ends after “passage … is:” | Prompt completion/render-part assembly | Citation UX promises evidence it does not show | Final-answer completeness validator across every document type |
| RA-T011 | `GET /api/product-intelligence/reports/:id/pdf` | Report IDs 6–8 | Rendered pages show raw JSON, mojibake, passage dumps | Report normalization/template serialization | Exported research looks unreliable and can misstate evidence | Render-and-inspect fixtures for timeline objects, Unicode, synthesis, current status |
| RA-T012 | `GET /api/policy-drafts/:id/export.docx` | Draft IDs 13–15 | Empty table, truncated bullet, `user_source` label | Draft section validation/DOCX serializer | Incomplete institutional documents may be circulated | DOCX semantic validator plus rendered-page assertions |
| RA-T013 | `npm run process:audit` | 661 readiness rows affected | 465 updates and 196 creates during audit | Command defaults combine audit and reconciliation | Operators can mutate production unintentionally | Read-only snapshot before/after test; mutation only with explicit `--apply` |
| RA-T014 | Upload API/UI | Oversize and storage-failure payloads | 422 instead of 413; generic browser error | Error mapping and frontend fetch handling | Users cannot distinguish size error from outage | Status/message contract tests for 413/422/503 |
| RA-T015 | Multiple `/app/*` screens | UI-wide | 1–2 unnamed controls on several mobile screens | Missing accessible name/label | Keyboard/screen-reader users lack reliable control context | Axe/accessibility-name gate for interactive elements |
| RA-T016 | `npm run build --prefix client` | Build-wide | Turbopack local port bind `EPERM`; Webpack build passes | Test-host sandbox/Turbopack behavior | Default build not independently certified in this host | Run default build in CI/Vercel and archive build output |
| RA-T017 | Production CSP headers | Site-wide | `connect-src` still permits `api.openai.com` | Stale security header configuration | Unnecessary external connection permission | Header snapshot test aligned to active provider allow-list |

### RA-T001 — Private PDF upload is completely unavailable

- **Severity:** S1 / release blocker
- **Feature:** Study shelf / private documents
- **Steps:** Sign in, open a research workspace, choose “Add a PDF to study,” upload a valid PDF.
- **Expected:** Upload starts, document is stored and prepared.
- **Actual:** Upload-intent returns HTTP 503; UI shows “Upload failed / Failed to fetch.”
- **Evidence:** Reproduced with valid PDFs from 1 MB through just under 50 MB.
- **Recommendation:** Restore production object storage configuration and preserve the backend error message in UI.

### RA-T002 — Generated document-chat history is not persisted

- **Severity:** S1 / release blocker
- **Feature:** Document chat
- **Steps:** Ask a grounded question, wait for the answer, refresh/reload chat history.
- **Expected:** User and assistant messages remain available.
- **Actual:** Generation returns HTTP 200, but history returns `chat: null` on both test accounts.
- **Recommendation:** Make message/session persistence part of the same durable generation lifecycle and fail visibly if persistence fails.

### RA-T003 — Only 16.9% of the catalogue is research-ready

- **Severity:** S1
- **Feature:** Research readiness
- **Actual:** 3,398 of 20,086 public records are ready; 14,982 lack valid chunks.
- **Impact:** Most catalogue records cannot support chat, comparison, or drafting.
- **Recommendation:** Run the recoverable readiness backlog in controlled batches and monitor database/object-storage growth.

### RA-T004 — Semantic coverage is only 13.74% and vector state is inconsistent

- **Severity:** S1
- **Feature:** Semantic retrieval
- **Actual:** 467 active semantic documents, 2,931 ready without active semantic vectors, 1,453 namespace mismatches, 11,080 stale vectors.
- **Recommendation:** Reconcile namespaces, remove/rebuild stale vectors, and verify active-vector occupancy against ready documents.

### RA-T005 — Authoritative freshness connectors are stale or failing

- **Severity:** S1
- **Feature:** Current-status and ingestion
- **Actual:** eGazette, India Code, Parliament, state sources, and regulator sources show TLS, 404, robot, timeout, or upstream lag failures.
- **Impact:** “Current” legal/policy answers cannot be comprehensively verified.
- **Recommendation:** Repair certificate/URL adapters, implement connector-specific alerts, and expose freshness limitations to users.

### RA-T006 — Recommendations and compliance retrieval fail common valid problems

- **Severity:** S2
- **Feature:** Business recommendations / Compliance Copilot
- **Actual:** Several common NBFC, battery, food, insurance, and tax scenarios return no results; an implausible lunar-mining query returns matches.
- **Recommendation:** Recalibrate relevance gates using prepared summaries/entities and add positive/negative benchmark fixtures.

### RA-T007 — External-source quality gate is inconsistent

- **Severity:** S2
- **Feature:** Add website link
- **Actual:** `example.com` is accepted as research-ready while some official government/regulator pages are rejected.
- **Recommendation:** Weight authority and content extraction separately; avoid treating successful HTML extraction as evidence quality.

### RA-T008 — Document research workspace can take over 30 seconds to open

- **Severity:** S2
- **Feature:** Document workspace
- **Actual:** The live page remained on “Opening the research workspace…” for roughly 37 seconds.
- **Recommendation:** Profile the initial waterfall, parallelize independent calls, and render usable metadata/chat shell before secondary panels finish.

### RA-T009 — Comparison is slow and can return an empty analytical product

- **Severity:** S2
- **Feature:** Comparison
- **Actual:** Typical creation takes 21.9–26.8 seconds. One result had 15 citations but zero similarities, differences, findings, stakeholders, compliance, impacts, timeline, or authorities.
- **Recommendation:** Treat empty structured comparison output as a failed generation, retry a bounded analytical prompt, and stream progress/results.

### RA-T010 — Some chat answers promise but omit the strongest supporting passage

- **Severity:** S2
- **Feature:** Document chat
- **Actual:** Rule, Report, and Gazette answers end with a colon and no passage.
- **Recommendation:** Validate rendered answer completeness before sending the final event.

### RA-T011 — Research-report PDFs expose raw structures and extraction noise

- **Severity:** S2
- **Feature:** Research reports
- **Actual:** Raw JSON timeline objects, mojibake, passage dumps, and weak current-status synthesis appear in exported PDFs.
- **Recommendation:** Normalize structured fields before templating and reject low-quality extracted text from final prose.

### RA-T012 — Policy-draft DOCX exports contain incomplete sections

- **Severity:** S2
- **Feature:** Policy drafting export
- **Actual:** Empty risk table, truncated bullet, and internal `user_source` label.
- **Recommendation:** Add export validation for empty tables, truncated tokens, and internal metadata labels.

### RA-T013 — A command named `process:audit` mutates production state

- **Severity:** S2 / operational safety
- **Feature:** Operations tooling
- **Actual:** Audit execution updated 465 readiness states and created 196 states.
- **Recommendation:** Make audit commands read-only by default; require an explicit `--apply` flag for reconciliation.

### RA-T014 — Upload errors use inconsistent status and user messaging

- **Severity:** S3
- **Feature:** PDF upload
- **Actual:** Over-limit upload returns HTTP 422 rather than 413; browser hides actionable storage failure behind “Failed to fetch.”

### RA-T015 — Some mobile controls lack accessible names

- **Severity:** S3
- **Feature:** Accessibility
- **Actual:** One or two unnamed interactive elements were detected on several tested research screens.

### RA-T016 — Default Turbopack production build cannot be certified in this test host

- **Severity:** S3 / test-environment limitation
- **Feature:** Release build
- **Actual:** Default build fails when Turbopack attempts to bind a local port (`EPERM`); `next build --webpack` succeeds for all 22 pages.
- **Recommendation:** Verify the default build in CI/Vercel and retain the successful Webpack fallback evidence.

### RA-T017 — Content Security Policy retains obsolete OpenAI connection permission

- **Severity:** S3
- **Feature:** Security configuration
- **Actual:** `connect-src` includes `https://api.openai.com` although production generation is Gemini-based.
- **Recommendation:** Remove provider origins that are no longer used.

## Security and privacy verification

Passed controls:

- protected endpoints reject unauthenticated requests;
- cross-account comparisons, reports, collections, watchlists, alerts, and chat data are isolated;
- private-network/SSRF URL input is rejected;
- duplicate and invalid payloads are rejected;
- rate limiting returns HTTP 429;
- no private API key or token was exposed in rendered pages or recorded responses;
- stored HTML/script-like text did not execute during observed flows;
- dependency audits reported zero known vulnerabilities.

Not fully exercised:

- malicious PDF/prompt-injection upload, because all uploads fail before storage;
- successful account-deletion cascade, pending approval;
- third-party Google consent, because no production Google identity was supplied for the test.

## Automated release gates

| Gate | Result |
| --- | --- |
| Backend tests | 552 total: 551 passed, 1 intentional skip, 0 failed |
| Frontend tests | 18 passed, 0 failed |
| Frontend lint | 0 errors, 8 warnings |
| Server dependency audit | 0 known vulnerabilities |
| Client dependency audit | 0 known vulnerabilities |
| Database integrity verification | Passed, 0 failed checks |
| Next.js Webpack production build | Passed, all 22 pages generated |
| Default Turbopack build | Environment-blocked by local port `EPERM` |

## Required release actions

### Immediate / S1

1. Restore private object storage and verify real PDF upload, processing, refresh, and deletion.
2. Repair durable document-chat persistence and run refresh/re-login tests.
3. Recover the automatically recoverable readiness backlog without breaching capacity limits.
4. Reconcile Pinecone namespaces and stale vectors.
5. Repair authoritative connector freshness, especially eGazette, India Code, Parliament, and state sources.

### Before pilot expansion / S2

1. Recalibrate recommendations and Compliance Copilot with benchmark queries.
2. Prevent empty comparison products and reduce first-use latency.
3. Validate report and policy-draft exports before release.
4. Reduce document-workspace startup latency.
5. Make operational audit commands read-only.

## Outstanding cleanup and completion criteria

This report can be upgraded from `PARTIAL` only after:

- explicit approval is received to delete the two disposable QA production accounts;
- successful deletion, cascade cleanup, old-token rejection, and post-deletion login failure are verified;
- the remaining Google OAuth limitation is either accepted as an external test limitation or completed with an authorized test identity.

Until the S1 defects are fixed and retested, the production portal should be considered suitable for controlled engineering evaluation only, not a broad researcher/think-tank pilot.
