# Rashtram AI — Complete Production Platform Audit 2026

**Audit date:** 24 August 2026  
**Production window:** approximately 10:25–11:40 IST  
**Frontend:** https://rashtram-ai.vercel.app  
**Backend:** https://rashtram-ai-backend.vercel.app  
**Repository revision audited:** `0670537cb143b3d96d2184cb224ece19ef78f835` on `main`  
**Frontend deployment:** `dpl_FitXidxmKKABqqtGujxCV26reGfv` — Ready  
**Backend deployment:** `dpl_7igc1W2qLMgPpzRGTXURcYJMWvpW` — Ready  
**Audit classification:** **FULL-PLATFORM-AUDIT-PARTIAL**  
**Production classification:** **RED**

## 1. Executive conclusion

Rashtram AI is online, its core catalogue is accessible, account isolation worked in the tested resources, database integrity checks pass, and the automated backend/frontend suites are strong. However, the product is not ready for a broad external research or compliance pilot without remediation.

The reason for the RED classification is not general site availability. It is trustworthiness and completeness in the workflows where users rely on Rashtram AI for research judgement:

1. Compliance Copilot accepted unrelated Gujarat and EU material as sufficient evidence for an Indian battery-recycling question.
2. A current-status answer contradicted the production document metadata for the selected Bill.
3. Comparison chat generated a grounded answer but lost all source objects before the frontend received the final result.
4. Document comparison is slow and often degrades into verifier disclaimers and raw passage dumps rather than an informative analytical comparison.
5. Related reading returned no recommendations for 19 of 20 sampled records.
6. Knowledge discovery returns HTTP 500.
7. Processing is effectively stalled: 15,505 processable records remain, no workers were active, and the measured attempt failure rate is 62.26%.
8. Only 454 of 3,390 search-ready documents are semantically ready in the active Gemini namespace (13.39%).

The platform can support controlled internal QA. It should not yet be represented as a fully reliable, comprehensive, current legal/compliance research system.

## 2. Audit method and boundaries

The audit used:

- production browser walkthroughs on desktop, 390×844, 360×800, and 768×1024;
- three isolated QA accounts, all deleted after testing;
- cross-account access attempts for chats, comparisons, drafts, watchlists, reports, and study sources;
- direct production API checks;
- a 20-document recommendation sample;
- six compliance scenarios;
- a two-document comparison and comparison-chat flow;
- one policy draft and one research report;
- PDF upload, invalid-upload, PolicyEdge HTML, official PIB HTML, and private-network URL checks;
- connector, corpus, processing, PDF-quality, semantic, capacity, consistency, release, and database reports;
- Vercel deployment inspection and one-hour runtime log review;
- backend tests, frontend tests, lint, dependency audit, and production builds.

No application defect was fixed and no deployment was made. QA-created accounts and artifacts were deleted. A final database query confirmed zero remaining audit users, sources, reports, comparisons, drafts, and watchlists.

### Known audit gaps

This report is classified PARTIAL rather than COMPLETE because the following could not be fully exercised without external side effects, third-party access, or a much longer corpus campaign:

- Google OAuth end-to-end, including the Google consent screen;
- delivery of a real contact email to the institutional recipient;
- every legacy Bill/Act/Gazette chat path as a separate UI flow;
- every one of 19,980 catalogue records;
- every pair among comparison-ready records;
- accessibility testing with physical assistive technology;
- sustained concurrency/load testing and multi-region latency;
- upstream source completeness against every authoritative website;
- disaster recovery and point-in-time restore execution;
- email alert delivery because no email notification provider is exposed by the tested watchlist flow.

## 3. Production status

| Surface | Status | Evidence |
|---|---:|---|
| Frontend alias | GREEN | HTTP/UI available; Vercel deployment Ready |
| Backend alias | GREEN | APIs available; Vercel deployment Ready |
| Runtime logs | GREEN/limited | No 5xx observed in the sampled one-hour window except the reproduced knowledge-search 500; most traffic was audit traffic |
| Database integrity | GREEN | All database verifier checks passed; migration 041 is current |
| Database capacity | GREEN | 498,221,056 bytes used; reported provider maximum 16 TiB; bulk processing guard allows work |
| Core research reliability | RED | Compliance, current-status, comparison, citations, recommendations, and corpus readiness defects |
| Release recommendation | RED | Internal QA only until S1 items are closed and regression-tested |

## 4. Frontend route matrix

| Route | Purpose | Production result | Classification |
|---|---|---|---|
| `/` | Landing page | Loaded; simplified researcher copy present; mobile no horizontal overflow | GREEN |
| `/contact` | Contact form | Route/build present; real email not submitted | NOT FULLY TESTED |
| `/login` | Email/Google sign-in | Email sign-in works; validation and labels present; Google external flow not tested | AMBER |
| `/signup` | Registration | Three QA accounts registered; password validation exercised indirectly | GREEN |
| `/pricing` | Pricing | Route/build present; visual-only audit | AMBER |
| `/product` | Product page | Route/build present; visual-only audit | AMBER |
| `/solutions` | Solutions page | Route/build present; visual-only audit | AMBER |
| `/app` | Research Desk/catalogue | Loads, personalizes, searches and filters; stale freshness narrative and weak recommendations | RED |
| `/app/document/[id]` | Universal research workspace | Chat, persistence, PDF report, citations, sidebars and mobile layout work; current status can be wrong | RED |
| `/app/compare` | Comparison | Generation/regeneration works but slow and analytically weak; comparison chat loses source objects | RED |
| `/app/policy-drafter` | Evidence-backed drafting | Generated/persisted readable text; no `[object Object]`; mobile no overflow | GREEN/limited sample |
| `/app/recommend` | Problem-based recommendation | Route works; broader related-reading system is mostly empty and compliance relevance is unsafe | RED |
| `/app/profile` | Profile, saves, collections, export, deletion | Profile, export, save/remove, account deletion work; mobile no overflow | GREEN |
| `/app/onboarding` | Three-step onboarding | Complete and skip paths work | GREEN |
| `/app/multi-document-chat` | Multi-source chat | Core API exercised through comparison chat; standalone UI not fully exercised | AMBER |
| `/app/graph/[id]` | Document graph | Standard graph endpoints work; knowledge discovery 500 and knowledge tables empty | RED |
| `/app/egazette` | Gazette library | Route/build and catalogue API work; source connector currently Error | RED |
| `/app/egazette-chat/[id]` | Gazette chat | Route/build present; not separately generated in this audit | NOT FULLY TESTED |
| `/app/bill-chat` | Legacy Bill chat | Route/build present; universal chat tested instead | AMBER |
| `/app/act-chat` | Legacy Act chat | Route/build present; universal chat tested instead | AMBER |
| `/app/state-bills` | State Bills library | Route/build present; upstream State Legislature connector Blocked | RED |
| `/app/state-acts` | State Acts library | Route/build present; shallow production corpus | AMBER |

## 5. Core feature matrix

| Feature | Result | Notes |
|---|---:|---|
| Registration/login/logout | PASS | Email flow worked; invalid login returned bounded error |
| Onboarding complete/skip | PASS | Profile personalization saved and skip succeeded |
| Cross-account isolation | PASS (sampled) | B could not access A comparison, draft, report, watchlist, sources, or chat |
| Account deletion | PASS | Wrong password rejected; valid DELETE removed accounts and dependent QA data |
| Catalogue browsing | PASS | 19,942 public records shown by the main public query |
| Search | PASS | “Taxation Laws” reduced results; no-result query returned cleanly |
| Filters | PASS with data defects | Type filter worked; source/ministry/type taxonomy is inconsistent |
| Dashboard | PASS with stale intelligence | UI works, but “latest verified event” remains 15 July despite newer catalogue records |
| Document detail | PASS with temporal defect | Readiness/summary/source UI works; status sources disagree |
| Document chat | FAIL for current-status trust | Grounded fact and false-premise rejection were good; current status contradicted metadata |
| Chat streaming | PASS/slow | Immediate placeholder; first token ~2.4 s in document chat; no duplicate messages |
| Chat persistence | PASS/slow | Persisted across reload; history took roughly 8–9 s to appear |
| Citations | PASS in document chat | Citation passages displayed and false premise was rejected |
| Comparison generation | FAIL quality/performance | ~17 s; sparse/disclaimer-heavy output; raw passage dumps |
| Comparison regeneration | PASS mechanics | Version advanced atomically and scope stayed fixed |
| Comparison chat | FAIL citation delivery | AI answer completed in ~6.6 s but frontend received zero sources |
| Policy drafting | PASS (one sample) | 6,642-character draft, persisted ready; readable text; no object stringification |
| Research report | PASS (one sample) | 14 evidence units; JSON retrieval and 35,522-byte PDF export worked |
| PDF upload | PASS | Valid upload worked; invalid/HTML payload rejected |
| External PolicyEdge HTML | PASS | 7,646 normalized characters; structured HTML extraction ready |
| External official HTML | FAIL/limited | Representative PIB and RBI pages rejected as low-quality text |
| SSRF protection | PASS | Private/internal URL rejected |
| Related reading | FAIL | 19/20 sampled documents returned zero recommendations |
| Compliance Copilot | FAIL safety | One realistic scenario accepted unrelated evidence as obligations |
| Cross-state comparison | PASS-safe but empty | Returned 200 and zero evidence for Maharashtra/Gujarat labour query; did not invent a difference |
| Watchlists | PASS mechanics | Create/list/refresh/delete and isolation worked; no matching alert was generated |
| Saved content | PASS | Create/delete worked |
| Saved searches | PASS | Create worked; cleaned by account deletion |
| Collections | PASS | Create and add item worked; cleaned by account deletion |
| Notes | PASS | Create/delete worked |
| Profile export | PASS | 22,766-byte JSON export returned |
| Standard graph search | PASS | Returned five results for Finance |
| Knowledge discovery | FAIL | `/api/graph/knowledge/search` returned HTTP 500 |
| Amendment tracker | PASS/limited | Endpoint returned 200 for document 30; selected record had no verified timeline chain |
| Contact delivery | NOT TESTED | Avoided sending a real institutional email during audit |

## 6. Backend API matrix

| API group | Authentication | Tested result | Notes |
|---|---:|---:|---|
| `/api/auth/*` | Mixed | PASS | Register/login/me; unauth protected route 401; Google external flow excluded |
| `/api/dashboard/*` | Required | PASS with data issues | Intelligence, operations, source health, quality returned 200 |
| `/api/documents` and `/search` | Required in production app | PASS | Pagination/search/filter contract works |
| `/api/documents/:id/*` | Required | MIXED | Detail/readiness/timeline/graph 200; recommendations mostly empty |
| `/api/document-chat/*` | Required | MIXED | Chat/persistence/notes/export work; temporal answer defect |
| `/api/documents/compare*` | Required | MIXED | Generate/get/regenerate/delete work; quality/performance defect |
| `/api/documents/chat` | Required | FAIL citations | Final SSE metadata clears sources |
| `/api/policy-drafts/*` | Required | PASS sample | Generate/get/delete/isolation |
| `/api/research-sources/*` | Required | MIXED | Upload and PolicyEdge HTML pass; official HTML extraction inconsistent |
| `/api/recommendations/problem` | Required | RED by downstream QA | Compliance and dashboard samples reveal weak relevance gating |
| `/api/product-intelligence/compliance` | Required | FAIL safety | Unrelated evidence accepted in one scenario |
| `/api/product-intelligence/cross-state-comparison` | Required | PASS-safe/empty | Zero evidence, no fabricated difference |
| `/api/product-intelligence/watchlists` | Required | PASS | CRUD subset, refresh, isolation |
| `/api/product-intelligence/reports` | Required | PASS sample | Create/get/PDF/isolation |
| `/api/graph/search` | Required | PASS | Five results |
| `/api/graph/knowledge/search` | Required | FAIL | HTTP 500 |
| `/api/profile/*` | Required | PASS | Preferences, save, collection, export, deletion |
| `/api/activity/*` | Required | Static/unit coverage | Privacy/allowlist tests pass; no raw question storage in platform notes |
| `/api/internal/cron/*` | Secret/internal | NOT INVOKED | No production mutation authorized during audit |
| Legacy Bills/Acts/Gazette/Policy APIs | Mixed | PASS shallow | Release verifier returned records; separate generation not exhaustive |

## 7. Document and corpus matrix

### 7.1 Catalogue composition

| Type | Catalogue count |
|---|---:|
| Bills | 9,619 |
| Acts | 7,961 |
| Policy | 1,172 |
| Press releases | 411 |
| Notifications | 229 |
| Reports | 162 |
| Regulations | 137 |
| Other | 75 |
| Consultation papers | 59 |
| Rules | 51 |
| Circulars | 44 |
| Remaining types | 60 |
| **Total canonical documents** | **19,980** |

Counts differ by scope: 19,980 canonical documents, 19,942 public semantic-audit catalogue rows, 19,784 processing-state rows, and 19,677 capability-catalogued rows. These differences may be intentional visibility/state boundaries, but no user-facing explanation exists.

### 7.2 Readiness by major type

| Type | Search ready | Active semantic | Semantic backlog | Assessment |
|---|---:|---:|---:|---|
| Bill | 1,518 | 48 | 1,470 | RED |
| Act | 474 | 29 | 445 | RED |
| Policy | 1,167 | 163 | 1,004 | RED |
| Report | 122 | 121 | 1 | GREEN |
| Regulation | 41 | 38 | 3 | GREEN |
| Gazette | 1 | 0 | 1 | RED |
| Notification | 3 | 3 | 0 | Numerically green, extremely low coverage |
| Rule | 1 | 0 | 1 | RED |
| **All search-ready** | **3,390** | **454** | **2,936** | **RED** |

Search/chat can fall back to PostgreSQL lexical retrieval; semantic readiness is not required for basic research. Nevertheless, related reading, discovery, and nuanced retrieval are materially constrained by this coverage.

### 7.3 Representative document-state matrix

The following production records were inspected directly in PostgreSQL on 24 August 2026. This verifies that readiness is not inferred from a single legacy flag.

| ID | Type/source | Content path | Search | Semantic | Chat/compare | Observed state |
|---:|---|---|---:|---:|---:|---|
| 24425 | Act / PRS | English PDF text | Yes | Yes | Yes/Yes | Ready, hybrid, 2 chunks |
| 24686 | Bill / PRS | Hindi PDF + page OCR | Yes | Yes | Yes/Yes | Ready, FTS, 24 chunks |
| 1553 | Ordinance / PRS | English PDF text | Yes | No | Yes/Yes | Ready; lexical fallback remains available |
| 44 | Rule / PRS | Bilingual PDF text | Yes | No | Yes/Yes | Ready; semantic capability absent |
| 23453 | Regulation / UIDAI | English PDF text | Yes | Yes | Yes/Yes | Ready, 8 chunks |
| 20438 | Notification / eGazette | Bilingual PDF text | Yes | Yes | Yes/Yes | Ready, 1 chunk |
| 20425 | Gazette / eGazette | Bilingual PDF text | Yes | No | Yes/Yes | Ready, 617 chunks; semantic capability absent |
| 23457 | Circular / UIDAI | English PDF text | Yes | Yes | Yes/Yes | Ready, 3 chunks |
| 24229 | Order / NMC | Gemini OCR, bilingual | Yes | Yes | Yes/Yes | Ready, 1 chunk |
| 22021 | Policy / PolicyEdge | Structured HTML | Yes | Yes | Yes/Yes | Ready, FTS, 3 chunks |
| 24765 | Report / PolicyEdge | Structured HTML | Yes | Yes | Yes/Yes | Ready, FTS, 7 chunks |
| 20705 | Strategy paper / NITI Aayog | English PDF text | Yes | Yes | Yes/Yes | Ready, 90 chunks |
| 20435 | Committee report / state legislature | English PDF text | Yes | Yes | Yes/Yes | Ready, 1 chunk |
| 20808 | Consultation paper / TRAI | English PDF text | Yes | Yes | Yes/Yes | Ready, 1 chunk |
| 23360 | Press release / PIB | Bilingual PDF text | Yes | Yes | Yes/Yes | Ready, 1 chunk |
| 24102 | Scheme / PIB | Link only | No | No | No/No | No processing state; not research-ready |
| 292 | Bill / PRS | No usable artifact | No | No | No/No | Failed, non-retryable, `SUMMARY_PROVIDER_ERROR` |

Readiness edge cases were also checked explicitly: document 107 is search- and semantic-ready; document 1 is search-ready but non-semantic; document 292 is failed/manual-review. No queued example was returned by the direct representative-state query even though aggregate queue telemetry reports 4,648 queued states, another sign that queue/state contracts need reconciliation.

### 7.4 PDF quality sample

Read-only audit of 500 search-ready PDFs:

| Class | Count |
|---|---:|
| Good | 428 |
| Suspicious | 61 |
| Likely corrupted | 4 |
| Severely corrupted | 7 |
| Mixed quality | 60 |

Three P0 and 69 P1 repair candidates were identified. Examples include a fully suspicious 17-page Arunachal Pradesh Fire & Emergency Services Bill and several one/two-page 2026 state Bills with zero usable pages.

## 8. Comparison QA matrix

| Scenario | Documents | Result |
|---|---|---|
| Initial AI comparison | Taxation Laws Amendment Bill 2025 vs 2026 taxation Bill | Generated in ~17 s; verifier disclaimer and raw source passages dominated output |
| Regeneration | Same immutable pair | Version advanced to 2; generation mode remained AI; scope preserved |
| Analytical follow-up | Same pair | 4,452-character verified answer; 12 factual premises and 10 analytical traces; 18 unsupported claims repaired to zero |
| Citation delivery | Same pair | FAIL: answer referenced passages but returned source count was zero |
| Cross-account read | User B requesting User A comparison | 404 as expected |
| Deletion | User A deletes comparison | 200; subsequent cleanup verified |

Only one real pair was deeply exercised, so comparison quality conclusions are high-confidence for the reproduced failure but not statistically representative of every possible pair.

### 8.1 Comparison combination coverage

| Combination | Production exercise | Outcome |
|---|---:|---|
| Related Bill vs Bill, both research-ready | Deep | Generated/regenerated/chat-tested; quality, latency, and citation defects reproduced |
| Same jurisdiction but unrelated | Indirect only | Compliance/recommendation relevance failed; comparison generator not exercised |
| Completely unrelated | Not run | Remains untested |
| PDF vs PDF | Deep | Covered by the Bill pair |
| HTML vs PDF | Not run | Both individual content paths were validated, but not compared together |
| HTML vs HTML | Not run | PolicyEdge readiness validated, pair comparison not run |
| Semantic vs semantic | Deep | Covered by the selected pair’s ready evidence path |
| Semantic vs lexical-only | Not run | Representative records identified (for example IDs 107 and 1), but no comparison mutation run |
| Lexical-only vs lexical-only | Not run | Remains untested |
| Ready vs non-ready | UI/readiness only | Non-ready records correctly lack capability in the sampled state matrix; generator rejection not exercised |
| English vs Hindi/bilingual | Readiness only | Hindi OCR Bill 24686 verified ready; no bilingual pair generated |
| Old vs recent / potential supersession | Chat only | Temporal contradiction reproduced on document 30; pair comparison not run |

This incomplete combination coverage is a primary reason for the `FULL-PLATFORM-AUDIT-PARTIAL` classification.

## 9. Compliance QA matrix

| Scenario | Expected | Actual | Result |
|---|---|---|---|
| NBFC digital lending | Primary RBI/legal evidence or abstention | Abstained | PASS-safe |
| EV battery recycling in Gujarat | Relevant Indian/state environmental obligations | EU ELV report plus unrelated Gujarat salaries and human-sacrifice legislation accepted as sufficient | **FAIL-S1** |
| Food manufacturing in West Bengal | Relevant FSSAI/state evidence or abstention | Abstained | PASS-safe |
| Insurance intermediary in Maharashtra | IRDAI/official evidence or abstention | Abstained | PASS-safe |
| SaaS personal data | Current DPDP law/current applicability | Used 2023 Bill and 2022 draft; current-primary gap remained | FAIL-currentness |
| Generic business in India | Request specificity/abstain | Marked completed with mining/tourism material and no obligations | FAIL-relevance |

The passing unit fixtures do not reflect production retrieval behavior. Production-level recommendation candidates can still bypass the intended legal relevance threshold.

## 10. Source connector freshness

| Status | Count | Sources |
|---|---:|---|
| Fresh | 20 | PRS, Ministries directory, Environment Ministry, NITI, PIB, MyGov, National Portal, State Policy, PolicyEdge, RBI, SEBI, TRAI, CCI, CERC, NMC, UGC, NCLAT, GST Council, CBDT, state directory |
| Blocked | 9 | Digital Sansad, Lok Sabha, Rajya Sabha, India Code, State Legislatures, State Gazettes, UIDAI, PFRDA, NCLT |
| Degraded | 4 | IRDAI, AICTE, Election Commission, CBIC |
| Error | 1 | eGazette |
| Not run | 2 | NDAP, OGD India |

“Connected” must not be presented as synonymous with fresh or complete. Several essential authoritative sources are blocked, degraded, empty, or failing.

## 11. Processing, retrieval, and knowledge layer

### Processing

- 19,784 records have processing state.
- 3,390 are research/comparison ready.
- 15,505 are in the processable backlog.
- 4,648 jobs are queued; zero were running at audit time.
- 719 jobs are failed and 109 are dead-lettered.
- 1,767 of 2,838 attempts failed (62.26%).
- Approximate queue wait was 181 million ms (~50 hours).
- Throughput was approximately 4.1 documents/hour, with an estimated completion horizon above 3,700 hours.
- Download stage: 1,320/1,320 sampled stage attempts failed.
- Summary stage: 326/326 failed and were marked permanent.

### Consistency

The production consistency audit found:

- 196 document/state flag mismatches;
- 377 retryable jobs exceeding maximum attempts;
- 344 non-retryable jobs still marked retriable;
- no invalid ready-without-chunks state;
- no multiple active jobs;
- no comparison-ready-without-ready-state records.

### Semantic retrieval

- Active provider/model: Gemini `gemini-embedding-001`, 768 dimensions.
- Active semantic coverage: 454/3,390 search-ready documents (13.39%).
- PostgreSQL active vector chunk references: 3,164.
- Pinecone active records: 3,177; delta 13, marked unhealthy.
- 1,457 search-ready documents remain on an old/unversioned namespace.
- 11,095 stale vector references were identified.
- `rashtram-bills`: active Gemini namespace 371 of 10,032 vectors.
- `rashtram-acts`: active Gemini namespace 2,806 of 5,734 vectors.

### Knowledge layer

- Legacy relationship table contains 1,174 relationships.
- Knowledge nodes, edges, and evidence tables contain zero rows.
- Dashboard graph coverage reports only 484 connected documents (~2.4%).
- Source-verified relationship count is zero.
- Knowledge discovery API returns HTTP 500.

## 12. Database and storage

| Metric | Result |
|---|---:|
| Database size | 498,221,056 bytes (~475 MiB) |
| Provider maximum reported | 17,592,186,044,416 bytes (16 TiB) |
| Canonical documents | 19,980 |
| Research-ready documents | 3,390 |
| Chunk rows | 24,664 |
| Artifact rows | 3,397 |
| Largest relation | `document_text_chunks`, ~162 MB total |
| Legacy mirror | ~55.4 MB |
| Database verifier | PASS |
| Migration | 041 current |

Capacity is no longer the immediate blocker it was on the prior 512 MiB tier. At current measured density, 10,000 prepared documents project to roughly 918 MB expected under the current architecture, with a wide high estimate of ~1.37 GB.

Private upload object storage was not configured in the production source-upload response. Extracted text was retained in PostgreSQL, but original-file durability is reduced. This should be treated as an availability/recovery gap, not a data-loss event observed during the audit.

## 13. Performance observations

| Operation | Observed |
|---|---:|
| Catalogue first page API | ~0.58 s |
| Search/filter APIs | ~0.3–0.6 s |
| Document-chat first visible token | ~2.4 s |
| Document-chat total sampled answer | ~2.9 s |
| Chat history visible after reload | ~8–9 s |
| Comparison initial generation | ~17 s |
| Comparison-chat first token | ~6.5 s |
| Comparison-chat total | ~6.6 s |
| Policy draft first content/final | ~5.7 s |
| Research report generation | ~1.6 s |
| PolicyEdge external extraction | ~2.1 s |

Production telemetry over 24 hours reports average comparison generation at 14.3 s, 14 fallbacks among 55 comparison queries, and 192 unsupported claims removed. The observed comparison latency is therefore consistent with platform telemetry, not an isolated browser delay.

## 14. Responsive and accessibility audit

- Landing, login, dashboard, document workspace, comparison, policy drafter, recommendation, and profile were checked at 390 px.
- Dashboard and document workspace were additionally checked at 360 px and 768 px.
- No horizontal document overflow was detected at the tested widths.
- Login controls have explicit accessible names; logo alt text is “Rashtram AI”.
- Mobile navigation exposes open/close controls and the research workspace uses mobile drawer/bottom-sheet components.
- No browser console errors were present in the final sampled mobile session.
- Frontend tests explicitly cover mobile navigation, bottom sheets, composer safe-area behavior, and responsive recommendation grids.

Limitations: no VoiceOver/TalkBack run, no automated WCAG contrast scan, and no full keyboard-only traversal of every route.

## 15. Security and privacy

### Passed

- Cross-account resource reads/deletes were rejected in every sampled ownership test.
- Invalid/private/internal source URLs were rejected, reducing SSRF risk.
- Invalid PDF and HTML-disguised-as-PDF uploads were rejected.
- Account deletion requires exact `DELETE` confirmation and current password.
- Raw 5xx messages are sanitized by tests and production returned generic internal error text.
- Activity tests confirm secret-like metadata/query strings are stripped and personalization requires consent.
- `npm audit --omit=dev` reported zero known vulnerabilities for both client and server.
- Tracked secret-pattern matches were examples, fixtures, or sanitization regexes; no live key was identified in tracked source.

### Gaps

- Third-party OAuth was not end-to-end tested.
- No penetration test, DAST, sustained rate-limit test, or dependency provenance/SBOM audit was performed.
- Production source uploads reported object storage unconfigured.
- The compliance relevance defect is a safety issue even though it is not an authorization vulnerability.

## 16. Automated release gates

| Gate | Result |
|---|---:|
| Backend tests | PASS — 542 passed, 1 skipped, 0 failed |
| Frontend tests | PASS — 15 passed, 0 failed |
| ESLint | PASS with 8 warnings |
| Default `next build` (Turbopack) | ENVIRONMENT FAILURE — helper process could not bind a local port |
| `next build --webpack` | PASS — all 22 routes generated |
| Database verifier | PASS — 0 failed checks |
| Release verifier | PASS |
| Retrieval V3 CI benchmark | PASS baseline regression |
| Production reliability canary | PASS dry-run; 20 long documents sampled |
| PolicyEdge HTML audit | PASS — 1,258/1,262 search-ready; 3/3 live probes parsed |
| PDF-quality sample | COMPLETE — 500 documents; quality defects recorded |
| Processing consistency | COMPLETE — inconsistencies recorded |
| Semantic audit | COMPLETE — unhealthy active namespace coverage recorded |
| Server dependency audit | PASS — 0 known vulnerabilities |
| Client dependency audit | PASS — 0 known vulnerabilities |

The default build failure is attributed to the local audit sandbox restriction because the Webpack production build completed successfully. It is not classified as a production defect.

## 17. Issue register

Severity definitions: **S0** data breach/system-wide outage; **S1** core workflow unsafe or materially broken; **S2** important degraded behavior; **S3** minor/polish.

| ID | Severity | Area | Reproduction/evidence | User impact | Recommended owner |
|---|---:|---|---|---|---|
| RA-001 | S1 | Compliance | Ask for EV battery recycling obligations in Gujarat | Unrelated EU and Gujarat criminal/allowance records become “obligations” | Retrieval/Safety |
| RA-002 | S1 | Current status | Ask document 30 whether it is now an Act/pending | Answer says introduction stage while document metadata says Passed | Temporal/Data |
| RA-003 | S1 | Comparison citations | Run comparison chat on IDs 30/24066 | Answer references passages; final client source count becomes zero | Full-stack |
| RA-004 | S1 | Comparison quality | Generate comparison 71 | Slow, disclaimer-heavy, raw passage dumps, sparse analysis | AI/Retrieval |
| RA-005 | S1 | Processing | Run production process status | 15,505 backlog, zero workers, 62.26% failure rate | Data platform |
| RA-006 | S1 | Related reading | Sample 20 records | 19 return zero recommendations | Retrieval/Product |
| RA-007 | S1 | Knowledge discovery | GET `/graph/knowledge/search?q=taxation` | HTTP 500 | Backend/Graph |
| RA-008 | S1 | Semantic coverage | Run semantic audit | 13.39% coverage; both indexes low-occupancy | AI infrastructure |
| RA-009 | S1 | Source freshness | Source-health endpoint | 9 Blocked, 4 Degraded, 1 Error, 2 Not Run | Connectors |
| RA-010 | S2 | Processing consistency | Run consistency audit | 196 flag mismatches; 377 over-retried; 344 retry flags wrong | Data platform |
| RA-011 | S2 | Compliance currentness | SaaS personal-data scenario | Relies on Bills/draft rather than verified current Act position | Safety/Temporal |
| RA-012 | S2 | Cross-state coverage | Maharashtra vs Gujarat labour query | 200 response with zero evidence; feature cannot answer realistic query | Retrieval |
| RA-013 | S2 | PDF quality | Audit 500 PDFs | 72 non-good; 11 corrupt/severe; 69 P1 candidates | Processing/OCR |
| RA-014 | S2 | External sources | Add representative official PIB and RBI pages | 422 low-quality extraction; PolicyEdge succeeds | Ingestion |
| RA-015 | S2 | Metadata taxonomy | Inspect filters/source counts | `policyedge`/`policy-edge`, ministry case/name variants | Data quality |
| RA-016 | S2 | Duplicate corpus | Catalogue stats | 1,184 probable groups covering 2,586 documents; 50 pending reviews | Data quality |
| RA-017 | S2 | Type classification | Bill filter/search | Ordinance-titled records appear as Bills | Data quality |
| RA-018 | S2 | Dashboard freshness | Dashboard intelligence | Latest verified event remains 15 July while newer records exist | Product/Data |
| RA-019 | S2 | Benchmark validity | Research quality endpoint | Only five auto-generated fixtures; temporal/conflict metrics null | QA/AI |
| RA-020 | S2 | Performance | Compare/chat/history timings | 14–17 s comparisons, 6.5 s comparison-chat first token, slow history | Full-stack |
| RA-021 | S2 | Object storage | Upload external source/PDF | Warning says object storage unconfigured | Infrastructure |
| RA-022 | S2 | Corpus count contract | Compare stats/readiness/API | 19,980/19,942/19,784/19,677 totals without scope explanation | Data/API |
| RA-023 | S2 | Knowledge graph coverage | DB/metrics | New knowledge tables empty; ~2.4% connected; 0 source-verified edges | Graph/Data |
| RA-024 | S2 | Temporal metadata | Document 30 detail | Status exists but timeline is empty and summary says “as introduced” | Data/Temporal |
| RA-025 | S3 | Frontend quality | Run lint/tests | 8 lint warnings and ESM reparsing warning | Frontend |

No S0 breach or system-wide outage was found.

### 17.1 Detailed issue records

Unless overridden below: **environment** is production; **browser/device** is Chrome 149 on macOS plus direct authenticated API inspection; **status** is Open; and **frequency** is reproducible in the audited scenario. Evidence is retained in this report as response excerpts, measured timings, database counts, Vercel runtime observations, and the cited document IDs. “Corpus-wide” means the defect is architectural or aggregate rather than limited to a single record.

#### RA-001 — Compliance recommendations accept unrelated evidence

- **Feature / sub-feature / route:** Compliance Copilot / obligation discovery; `/api/product-intelligence/compliance` and `/api/recommendations/problem`. **Severity / priority:** S1 / P0. **Root cause:** RETRIEVAL + RELEVANCE + EVIDENCE_SAFETY; likely insufficient domain/jurisdiction/normative-passage gating.
- **Reproduction / expected / actual:** Ask for EV-battery recycling obligations in Gujarat. Expected authoritative Indian/Gujarat environmental obligations or an explicit insufficiency result. Actual result is marked complete/sufficient using an EU end-of-life-vehicle report, a Gujarat salary record, and a human-sacrifice/black-magic Bill as obligations. **Evidence / affected:** captured response; multiple report/Bill records; search-ready and semantic-ready states; API/desktop.
- **Impact / risk / workaround / fix / regression:** Users can receive materially misleading compliance research; legal/compliance risk High, research-quality impact Critical, data-integrity risk Low. No safe workaround beyond independently verifying every item. Enforce authority, jurisdiction, domain, currentness, and normative-evidence gates before generation. Add negative-domain, misleading-title, empty-evidence, and Gujarat EV fixtures.

#### RA-002 — Current-status answer contradicts catalogue status

- **Feature / sub-feature / route:** Document chat / current-status and temporal reasoning; `/api/document-chat/*`. **Severity / priority:** S1 / P0. **Root cause:** TEMPORAL + METADATA + PROMPT/RETRIEVAL split-brain.
- **Reproduction / expected / actual:** Open document 30 and ask whether it is now an Act/pending. Expected one temporally verified answer or an explicit unverified state. Actual chat says introduction stage/cannot verify later while production metadata says `Passed`; its summary also says “as introduced.” **Evidence / affected:** document 30, Bill, search-ready; API/desktop.
- **Impact / risk / workaround / fix / regression:** Direct contradiction undermines legal-status research; legal risk High, research risk Critical, data-integrity risk High. Workaround: inspect original and latest official source manually. Establish one temporal truth contract and authoritative source precedence; test old Bill + later status, supersession, stale connector, and unknown-current-state cases.

#### RA-003 — Comparison-chat sources disappear at stream completion

- **Feature / sub-feature / route:** Comparison chat / SSE citation metadata; `/api/documents/chat`. **Severity / priority:** S1 / P0. **Root cause:** API + STATE; final SSE metadata omits sources and the client replaces rather than merges the earlier source list.
- **Reproduction / expected / actual:** Chat on comparison of documents 30 and 24066. Expected visible passage citations retained after `done`. Actual 4,452-character verified answer references passages but final source count is zero. **Evidence / affected:** comparison 71; Bills; search-ready/semantic mixed; API/desktop.
- **Impact / risk / workaround / fix / regression:** A grounded answer becomes non-auditable; legal risk Medium, research risk High, data-integrity risk Low. Refresh/history does not restore the missing delivery metadata reliably. Merge final metadata or include sources in the final event; browser-test source visibility before and after `done`, reload, regeneration, and multi-turn chat.

#### RA-004 — Comparison output is slow and analytically weak

- **Feature / sub-feature / route:** Comparison / generation and regeneration; `/api/documents/compare*`. **Severity / priority:** S1 / P1. **Root cause:** AI_GENERATION + RETRIEVAL + PERFORMANCE + OUTPUT_SCHEMA.
- **Reproduction / expected / actual:** Compare documents 30 and 24066, then regenerate. Expected a timely, complete, evidence-led comparison across meaningful dimensions. Actual takes about 17 seconds and is dominated by disclaimers/raw passage dumps with sparse explanation; regeneration changes the version but not the quality pattern. **Evidence / affected:** comparison 71, two Bills, ready states; API/desktop.
- **Impact / risk / workaround / fix / regression:** Core researcher workflow provides low information density; legal risk Medium, research risk High, integrity risk Low. Users can ask follow-ups, but citations then hit RA-003. Add bounded hierarchical retrieval, required analytical sections, task-specific profile, time budgets/streaming, and an expert-reviewed matrix covering related/unrelated, PDF/HTML, semantic/non-semantic, old/new, and bilingual pairs.

#### RA-005 — Processing backlog has no active throughput

- **Feature / sub-feature / route:** Processing V3 / queue operations; operational status/CLI and processing tables. **Severity / priority:** S1 / P0. **Root cause:** PROCESSING + OPERATIONS + SCHEDULING.
- **Reproduction / expected / actual:** Inspect production processing status. Expected monitored workers and a bounded backlog. Actual: 15,505 processable backlog, 4,648 queued, zero running, 719 failed, 109 dead-letter, 62.26% attempt failure rate, about 4.1 documents/hour and >3,700-hour ETA. **Evidence / affected:** corpus-wide, all types/readiness states; operational/API.
- **Impact / risk / workaround / fix / regression:** New material remains unprepared and freshness degrades; legal risk Medium, research risk Critical, integrity risk Medium. Lexical research works for already-ready records only. Restore monitored workers, reconcile stuck state, canary 5/25/100 documents, and assert queue latency, bounded retries, throughput, and post-processing capabilities.

#### RA-006 — Related reading is usually empty

- **Feature / sub-feature / route:** Related research / document recommendations; `/api/documents/:id/recommendations`. **Severity / priority:** S1 / P1. **Root cause:** RETRIEVAL + SEMANTIC_COVERAGE + RANKING.
- **Reproduction / expected / actual:** Sample 20 real documents across types. Expected a small set of defensible related records or an evidence-based no-match explanation. Actual 19 return zero recommendations; one returns one recommendation. **Evidence / affected:** 20-document sample; mixed types and readiness; API/desktop/mobile.
- **Impact / risk / workaround / fix / regression:** Discovery and cross-document research largely fail; legal risk Low, research risk High, integrity risk Low. Manual search is the workaround. Rank with summaries/entities/legal references/topic/authority/time plus lexical fallback; test relevance and intentional zero-result behavior across all major types.

#### RA-007 — Knowledge discovery endpoint returns HTTP 500

- **Feature / sub-feature / route:** Knowledge graph / semantic knowledge search; `/api/graph/knowledge/search?q=taxation&limit=5`. **Severity / priority:** S1 / P0. **Root cause:** API + DATABASE/SCHEMA + EMPTY_DATA handling.
- **Reproduction / expected / actual:** Call the endpoint with an authenticated user. Expected results or a valid empty response. Actual HTTP 500; legacy `/api/graph/search?q=Finance` still returns five rows. **Evidence / affected:** corpus-wide graph feature; all document/readiness types; API.
- **Impact / risk / workaround / fix / regression:** One advertised discovery path is broken; legal risk Low, research risk High, integrity risk Low. Use standard graph search. Repair query/schema assumptions or disable the empty layer; test empty DB, populated DB, malformed query, authorization, and pagination.

#### RA-008 — Active semantic coverage is only 13.39%

- **Feature / sub-feature / route:** Research Engine V3 / semantic retrieval; semantic coverage audit and Pinecone indexes. **Severity / priority:** S1 / P1. **Root cause:** EMBEDDING + VECTOR_NAMESPACE + PROCESSING.
- **Reproduction / expected / actual:** Run production semantic audit. Expected active-vector coverage for search-ready material with consistent references. Actual 454/3,390 ready records covered, 2,936 backlog, 1,457 namespace mismatches, 11,095 stale vector references, and unhealthy Postgres/Pinecone count delta. **Evidence / affected:** corpus-wide, especially Bills/Acts/Policies; search-ready non-semantic; operational.
- **Impact / risk / workaround / fix / regression:** Nuanced retrieval/recommendations underperform; legal risk Medium, research risk High, integrity risk Medium. PostgreSQL lexical fallback remains. Re-embed bounded cohorts into the active Gemini namespace and reconcile references; regression-test namespace, dimensions, deletions, fallback, and simulated provider failure.

#### RA-009 — Authoritative connectors are blocked, degraded, or stale

- **Feature / sub-feature / route:** Ingestion / connector freshness; source-health endpoint and scheduled ingestion. **Severity / priority:** S1 / P0. **Root cause:** CONNECTOR + NETWORK + PARSING + OPERATIONS.
- **Reproduction / expected / actual:** Inspect connector health. Expected cadence-aligned fresh official sources. Actual 9 Blocked, 4 Degraded, eGazette Error, and NDAP/OGD Not Run; blocked sources include Parliament, India Code, state legislatures/gazettes, UIDAI, PFRDA, and NCLT. **Evidence / affected:** corpus-wide, all readiness states; operational.
- **Impact / risk / workaround / fix / regression:** Current-status answers cannot honestly claim broad freshness; legal risk High, research risk High, integrity risk Medium. Explicitly disclose stale coverage and verify official pages manually. Add connector-specific repair, backoff/alerts, freshness SLOs, and fixture/live-probe tests that prevent stale data from being presented as current.

#### RA-010 — Processing state contains contradictory retry/capability flags

- **Feature / sub-feature / route:** Processing V3 / state consistency; processing audit tables/CLI. **Severity / priority:** S2 / P1. **Root cause:** DATABASE + STATE + MIGRATION. **Reproduction:** run consistency audit. Expected one valid state machine; actual 196 state/document flag mismatches, 377 retryable records beyond max attempts, and 344 non-retryable failures marked retryable. **Affected:** corpus-wide, mixed types/states; operational.
- **Impact / risk:** wasted work and incorrect readiness; legal Low, research Medium, integrity High. **Workaround:** none safe at scale. **Fix/tests:** transactional state transitions, repair migration, invariants for terminal/retry/readiness combinations, idempotent retry and crash recovery.

#### RA-011 — Compliance currentness uses superseded legislative material

- **Feature / sub-feature / route:** Compliance / current applicability; `/api/product-intelligence/compliance`. **Severity / priority:** S2 / P0. **Root cause:** TEMPORAL + RETRIEVAL. **Reproduction:** SaaS personal-data compliance scenario. Expected current Act/rules or explicit gap; actual relies on a 2023 Bill and 2022 draft. **Affected:** Bill/policy records, ready states; API.
- **Impact / risk:** stale compliance guidance; legal High, research High, integrity Low. **Workaround:** verify official current law. **Fix/tests:** latest-authoritative-source gating, supersession graph, connector-staleness disclosure, DPDP current/old/unknown fixtures.

#### RA-012 — Cross-state comparison returns no usable evidence

- **Feature / sub-feature / route:** Product intelligence / cross-state comparison; `/api/product-intelligence/cross-state-comparison`. **Severity / priority:** S2 / P1. **Root cause:** RETRIEVAL + COVERAGE. **Reproduction:** Maharashtra versus Gujarat labour registration/reporting. Expected grounded distinctions or a clear coverage diagnosis; actual 200 with zero evidence and no comparison. **Affected:** state Acts/rules, mixed readiness; API.
- **Impact / risk:** feature cannot answer a realistic task, though it safely avoids fabrication; legal Low, research Medium, integrity Low. **Workaround:** separate state searches. **Fix/tests:** jurisdiction/type-aware retrieval, source coverage checks, and known-answer/insufficient-evidence fixtures.

#### RA-013 — Search-ready PDFs include corrupted extraction

- **Feature / sub-feature / route:** PDF processing / extraction quality; artifact and page-quality audits. **Severity / priority:** S2 / P1. **Root cause:** PDF_EXTRACTION + OCR + QUALITY_GATING. **Reproduction:** audit 500 ready PDFs. Expected ready records to meet minimum page/text quality; actual 61 suspicious, 4 likely corrupt, 7 severe, 60 mixed, including IDs 1523, 249, 1509, 1519, 1562, 1568, 1584. **Affected:** mostly Bills/PDF, search-ready; operational.
- **Impact / risk:** incomplete or misleading research evidence; legal Medium, research High, integrity Medium. **Workaround:** inspect original PDF. **Fix/tests:** per-page quality thresholds, OCR recovery, quarantine/manual review, and corrupt/scanned/bilingual regression fixtures.

#### RA-014 — General official HTML links fail extraction

- **Feature / sub-feature / route:** Study sources / URL ingestion; `/api/research-sources/*`. **Severity / priority:** S2 / P1. **Root cause:** HTML_EXTRACTION + SITE_ADAPTER. **Reproduction:** add representative official PIB/RBI pages. Expected readable text or supported PDF fallback; actual 422 low-quality while a PolicyEdge HTML page yields 7,646 normalized characters. **Affected:** external official HTML, user sources; API/desktop.
- **Impact / risk:** researchers cannot reliably study official pages; legal Low, research Medium, integrity Low. **Workaround:** upload an official PDF when available. **Fix/tests:** generic article extraction plus authority-specific adapters/render fallback, content-type/quality checks, SSRF preservation, and official-page fixtures.

#### RA-015 — Source/ministry taxonomy is fragmented

- **Feature / sub-feature / route:** Catalogue / filters and metadata. **Severity / priority:** S2 / P2. **Root cause:** NORMALIZATION + DATA_QUALITY. **Reproduction:** inspect facet/source counts. Expected canonical identities; actual `policyedge` and `policy-edge` plus case/name ministry variants. **Affected:** corpus-wide, all readiness states; API/UI.
- **Impact / risk:** split filters/counts and weaker ranking; legal Low, research Medium, integrity Medium. **Workaround:** search both variants. **Fix/tests:** canonical source/ministry IDs, backfill and alias table; filter/count/dedup regression.

#### RA-016 — Probable duplicate documents remain unresolved

- **Feature / sub-feature / route:** Catalogue / deduplication; corpus statistics/review queue. **Severity / priority:** S2 / P2. **Root cause:** DEDUP + DATA_QUALITY. **Reproduction:** run catalogue stats. Expected duplicates consolidated or reviewed; actual 1,184 probable groups covering 2,586 documents and 50 pending reviews. **Affected:** mixed types/readiness; database/API.
- **Impact / risk:** noisy search/recommendations and repeated processing; legal Low, research Medium, integrity Medium. **Workaround:** manually check title/source. **Fix/tests:** source-aware fingerprints, canonical/version relationships, safe merge review, and false-positive/variant tests.

#### RA-017 — Ordinances appear under the Bill type

- **Feature / sub-feature / route:** Catalogue / document-type classification and filters. **Severity / priority:** S2 / P2. **Root cause:** CLASSIFICATION + INGESTION. **Reproduction:** filter/search Bills and inspect ordinance-titled rows. Expected ordinance type; actual some are classified as Bills. **Affected:** legislative records, mixed readiness; UI/API.
- **Impact / risk:** incorrect legal taxonomy and misleading filters; legal Medium, research Medium, integrity Medium. **Workaround:** inspect title. **Fix/tests:** normalized type classifier/backfill and Bill/Act/ordinance/rule title fixtures.

#### RA-018 — Dashboard freshness lags newer catalogue records

- **Feature / sub-feature / route:** Dashboard / freshness brief. **Severity / priority:** S2 / P1. **Root cause:** AGGREGATION + TEMPORAL + CACHE. **Reproduction:** compare dashboard latest verified event with catalogue dates. Expected current consistent signal; actual latest verified event remains 15 July while newer records exist. **Affected:** dashboard/corpus-wide; desktop/mobile.
- **Impact / risk:** users infer stale coverage; legal Medium, research Medium, integrity Low. **Workaround:** use catalogue sorting/source health. **Fix/tests:** define event-vs-catalogue semantics, refresh contract, freshness timestamp, stale-cache tests.

#### RA-019 — Research benchmark is too small to validate quality

- **Feature / sub-feature / route:** AI QA / research quality benchmark. **Severity / priority:** S2 / P1. **Root cause:** QA_COVERAGE. **Reproduction:** run benchmark. Expected representative expert-reviewed suites; actual five auto-generated cases with temporal/conflict metrics null. **Affected:** all AI features/types; CI.
- **Impact / risk:** green CI can mask major relevance/temporal failures; legal Medium, research High, integrity Low. **Workaround:** manual audit. **Fix/tests:** versioned expert-reviewed fact, conflict, currentness, citation, perspective, and negative-relevance datasets; label as internal QA until expert review.

#### RA-020 — Research workflows exceed acceptable latency

- **Feature / sub-feature / route:** Performance / comparison, comparison chat, chat history. **Severity / priority:** S2 / P1. **Root cause:** PERFORMANCE + AI_GENERATION + DATABASE. **Reproduction:** production timings. Expected prompt feedback and bounded completion; actual comparisons 14–17 seconds, comparison-chat first token 6.5 seconds, history about 8–9 seconds. **Affected:** comparison/chat, ready documents; desktop/mobile/API.
- **Impact / risk:** abandonment and duplicate retries; legal Low, research Medium, integrity Low. **Workaround:** wait/avoid repeated clicks. **Fix/tests:** trace retrieval/generation/persistence, stream earlier, cache immutable evidence, index history queries, and set cold/warm latency budgets.

#### RA-021 — Uploaded research artifacts lack configured object storage

- **Feature / sub-feature / route:** Study sources / durable file storage; upload API and server configuration. **Severity / priority:** S2 / P1. **Root cause:** STORAGE + CONFIGURATION. **Reproduction:** upload a valid PDF. Expected durable object-backed artifact; actual upload works but warns object storage is unconfigured and text remains in PostgreSQL. **Affected:** user PDFs/sources; API.
- **Impact / risk:** database growth and weaker artifact recovery; legal Low, research Medium, integrity Medium. **Workaround:** retain originals externally. **Fix/tests:** configure private object storage, checksum/read-back verification, retention/deletion lifecycle, account-deletion and access-control tests.

#### RA-022 — Corpus totals have no explicit scope contract

- **Feature / sub-feature / route:** Catalogue/readiness / metrics APIs. **Severity / priority:** S2 / P2. **Root cause:** API_CONTRACT + DATA_MODEL. **Reproduction:** compare stats endpoints/tables. Expected named scopes; actual totals 19,980/19,942/19,784/19,677 without user-facing explanation. **Affected:** corpus-wide; API/dashboard.
- **Impact / risk:** operators/users cannot interpret coverage; legal Low, research Medium, integrity Medium. **Workaround:** use this audit’s definitions. **Fix/tests:** expose canonical/public/state/capability scopes explicitly and reconcile count invariants.

#### RA-023 — Knowledge graph is almost empty and unverified

- **Feature / sub-feature / route:** Knowledge graph / relationships. **Severity / priority:** S2 / P2. **Root cause:** GRAPH_INGESTION + DATA_COVERAGE. **Reproduction:** inspect graph tables/metrics. Expected connected, evidence-backed relationships; actual new nodes/edges/evidence tables are zero, legacy relationships 1,174, about 484 documents connected (~2.4%), zero source-verified edges. **Affected:** corpus-wide; API/database.
- **Impact / risk:** relationship claims/discovery lack coverage; legal Medium, research Medium, integrity Medium. **Workaround:** rely on cited document search. **Fix/tests:** either populate verified graph with provenance or remove unsupported surfaces; evidence/temporal/dedup tests.

#### RA-024 — Document timeline is empty despite legal-status metadata

- **Feature / sub-feature / route:** Document detail / timeline; `/api/documents/:id/timeline`. **Severity / priority:** S2 / P1. **Root cause:** TEMPORAL_DATA + SCHEMA/INGESTION. **Reproduction:** inspect document 30 detail/timeline/summary. Expected status events explaining `Passed`; actual timeline empty and summary says “as introduced.” **Affected:** Bill 30 and potentially corpus-wide legislative records; ready state; UI/API.
- **Impact / risk:** status cannot be audited and feeds RA-002; legal High, research High, integrity High. **Workaround:** original/latest official source. **Fix/tests:** ingest provenance-backed lifecycle events and assert agreement among detail, summary, timeline, chat, comparison, and compliance.

#### RA-025 — Frontend retains non-blocking quality warnings

- **Feature / sub-feature / route:** Frontend / lint and module configuration. **Severity / priority:** S3 / P3. **Root cause:** UI_CODE_QUALITY + BUILD_CONFIG. **Reproduction:** run lint/build. Expected clean gate; actual eight lint warnings (navigation, image optimization, hook dependencies) and an ESM reparsing warning. **Affected:** several frontend routes; desktop/mobile.
- **Impact / risk:** maintainability/performance risk; legal None, research Low, integrity None. No user workaround needed. Resolve warnings deliberately and add zero-warning lint/build policy without changing behavior; regression tests are existing frontend suite and production build.

## 18. Prioritized remediation roadmap

### P0 — before any compliance or legal-status pilot

1. Close RA-001 with production fixtures that reproduce the exact unrelated Gujarat/EU matches; enforce domain, authority, jurisdiction, normative-passage, and current-law gates after retrieval and before response assembly.
2. Close RA-002/RA-011/RA-018/RA-024 with one authoritative temporal contract used by metadata, summaries, chat, comparison, and compliance.
3. Close RA-003 so final SSE metadata merges sources instead of replacing them with an empty array; add a browser regression asserting visible citations after `done`.
4. Close RA-005 by restoring monitored workers, reconciling retry state, and proving bounded throughput with 5/25/100-document canaries.
5. Close RA-007 and populate/disable the empty knowledge layer so users never hit a 500 or a misleading empty graph.

### P1 — before broad researcher pilot

1. Close RA-004/RA-020 with task-specific comparison prompts, bounded retrieval, structured section completeness, streaming, time budgets, and quality evaluation over at least 50 expert-reviewed pairs.
2. Close RA-006/RA-012 by rebuilding recommendations from executive summaries, entities, topic overlap, authority, temporal relationships, and semantic evidence; require non-generic explanations.
3. Raise active semantic coverage from 13.39% using priority-weighted Gemini re-embedding; reconcile the 13-record vector delta and explicitly remove/retain legacy namespaces.
4. Repair P0/P1 PDF candidates and prevent zero-usable-page records from being advertised as research ready.
5. Restore or replace essential blocked connectors, prioritizing Parliament, India Code, eGazette, State Legislatures/Gazettes, IRDAI, PFRDA, and CBIC.

### P2 — data/product hardening

1. Canonicalize source/ministry/type identities and resolve the 1,184 probable duplicate groups.
2. Publish one documented corpus-count/readiness contract across APIs and UI.
3. Configure durable object storage for private uploads and execute restore/read-back tests.
4. Expand expert-reviewed evaluation to current-status, contradiction, comparison, compliance, Hindi, OCR, state, and unanswerable cases.
5. Reduce lint warnings and remove ESM reparsing overhead.

## 19. Exit criteria for changing RED to AMBER/GREEN

### AMBER

- RA-001, RA-002, RA-003, RA-005, and RA-007 closed in production.
- At least 50 expert-reviewed compliance/current-status/comparison fixtures pass.
- Comparison citations visible after streaming completion.
- Processing workers show stable throughput and less than 10% retryable failure rate over a 24-hour canary.
- Related reading returns a relevant result or an explicit no-match for at least 80% of an expert-labelled sample.

### GREEN

- All S1 and S2 research-safety issues closed.
- Essential connector freshness meets an agreed SLA and stale/error sources visibly constrain current-status answers.
- Active semantic coverage reaches the documented target with healthy namespace consistency.
- Restores, OAuth, contact delivery, alert delivery, accessibility, load, and multi-region tests pass.
- External expert reviewers approve comparison, compliance, and current-status answer quality.

## 20. Final audit statement

Rashtram AI has a substantial and well-tested technical foundation, but automated unit success currently overstates production research reliability. The most important next step is not another broad feature. It is to close the production gap between retrieval contracts and live evidence selection, then prove those fixes with expert-reviewed, account-isolated, temporal, citation-preserving end-to-end tests.

**Final status: FULL-PLATFORM-AUDIT-PARTIAL · PRODUCTION RED · NO DEPLOYMENT PERFORMED**

## Appendix A — repository hygiene

- Pre-existing worktree state at audit start: modified `docs/DATABASE_AUDIT_REPORT.md` and untracked `.codex/`.
- Neither path is part of this audit deliverable and neither should be staged with this report.
- During audit execution, the database audit command refreshed the already-modified database report before the “do not overwrite” constraint was re-applied. Its exact prior uncommitted contents were not reconstructable; the file remains excluded from this audit change.
- The only intended repository change from this audit is this report.
