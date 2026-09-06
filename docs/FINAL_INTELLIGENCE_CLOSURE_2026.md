# Final Intelligence Closure — 6 September 2026

Decision: **PARTIAL. Release E must not begin.** This report supersedes older
closure notes only for the acceptance checks explicitly repeated below.

## 1. Elapsed time

Approximately 50 minutes (about 16:00–16:50 IST), within the four-hour limit.
Two comparison implementation rounds and two recommendation rounds; no third
tuning round. Exactly six production comparisons and two regenerations.

## 2. Branch and revision

Started on `codex/final-intelligence-closure`, based on GitHub main `fd0770d`.
Candidate `3d65e20` is preserved on local branch
`codex/final-intelligence-candidate`. Revert `0fa57d7` restores the baseline
application code on main. Unrelated worktrees were not modified.

## 3–4. Comparison traces and root causes

Three read-only traces preceded implementation. They used original production
evidence and Gemini through the application's provider adapter, without saving
comparisons. In-memory instrumentation captured raw responses and parser results.

| Pair | Request characters | Prompt tokens | Thinking / answer tokens | Provider / repair time | Total |
| --- | ---: | ---: | ---: | --- | ---: |
| DPDP 83/998 | 28,771 | 6,734 | 2,234 / 1,350 | ~18.9s / 8s timeout | 38.888s |
| Regulation/Circular 23271/23686 | 29,049 | 7,294 | 3,253 / 333 | ~19.1s / 8s timeout | 39.103s |
| Act/Amendment 973/18 | 20,910 | 5,281 | 1,905 / 1,680 | ~18.1s / 8s timeout | 36.655s |

All three ended `MAX_TOKENS` with a 3,600-token budget, malformed/incomplete JSON,
then a timed-out repair and extractive fallback. Main causes:
`PROMPT_SCHEMA_OVERLOAD`, `STRUCTURED_OUTPUT_PARSE_FAILURE`, and repair
`MODEL_TIMEOUT`. Retrieval was balanced across both sources, but the two selected
Regulation/Circular records concern different subjects. That is a relevance
limitation, not a provider failure. No account-wide Gemini quota exhaustion was
established.

## 5. Candidate architecture

For two-document comparisons only: deterministic six-theme plan → balanced
selection from existing Retrieval V3 evidence → two concurrent three-theme
Gemini requests → per-theme premise/citation checks → canonical section assembly
→ executive digest assembled exclusively from retained findings. Each source
contributes at most two 1,400-character passages per theme. Invalid themes are
excluded without discarding valid themes. The existing final verifier remains.

Profile: Gemini 2.5 Flash, temperature 0.15, top-p 0.8, JSON output, 3,000 output
tokens per batch, explicit zero thinking budget for the supported Flash model,
18-second request deadline, one model/attempt, at most one shared JSON repair.
No chat-provider settings changed. Three-or-more-document comparisons retain the
old path. The digest requires no third model request. Two batches can consume
more aggregate input tokens than one old request; this is a latency/reliability
experiment, not a demonstrated total-token saving.

The candidate is **not retained in production**. Its lexical premise checker
still cannot reliably distinguish an actual legislative change from differences
in the retrieved excerpts. A comparative-word heuristic also rejects some
plausible useful themes. Further tuning was stopped at the requested limit.

## 6–8. Representative results

- DPDP: four retained themes; useful comparison prose, but wording such as
  “introduces additional specific obligations” risks treating excerpt coverage
  as a legislative addition. This fails the strict factual acceptance standard.
- Regulation/Circular: two retained themes, correctly describing different
  purposes (energy connectivity versus a government appointment). It is not
  evidence that the records have a meaningful direct legal relationship.
- Act/Amendment: two retained themes; substantive procedural/track-and-trace
  distinctions, but insufficient theme completeness for a broad closure claim.

## 9–10. Live success and latency

All six returned HTTP 201 with AI text, valid citation identities, both documents
represented, and `PARTIAL_EVIDENCE`, not empty `SUCCESS`. Zero provider fallbacks
or transport failures. This is **6/6 transport/generation success, not 6/6 factual
acceptance**. The five-normal-pair requirement is not certified because a
material inference failure remains. RA-T009 remains PARTIAL.

| Frozen case / IDs | Retained themes | Substantive canonical sections | Retrieval ms | Generation ms | Final verification ms | HTTP total ms |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| DPDP / 83,998 | 4/6 | 9 | 588 | 4,442 | 71 | 8,909 |
| Act/Amendment / 973,18 | 2/6 | 5 | 108 | 4,086 | 63 | 7,489 |
| Act/Rule / 998,44 | 3/6 | 8 | 588 | 4,227 | 61 | 7,119 |
| Regulation/Circular / 23271,23686 | 2/6 | 6 | 596 | 5,560 | 60 | 9,012 |
| Policy/Policy / 20592,20593 | 4/6 | 7 | 155 | 4,267 | 129 | 6,922 |
| Existing weak control / 64,23686 | 4/6 | 9 | 446 | 4,365 | 100 | 6,756 |

Normal-pair median: **7.489s**, versus prior reported ~23s. All-six median:
7.304s. Theme planning 0–6ms; final assembly below 1ms timer resolution. Provider
generation dominates. End-to-end time includes readiness, storage, recommendation
and transport overhead. Persistence was not independently timed: no invented
stage breakdown is claimed. The retained “weak” control itself has GST-related
overlap; it is not a strong test of completely incompatible sources.

## 11. Regeneration

Two HTTP 200 regenerations, 7.931s and 6.866s. IDs 115 and 116 stayed unchanged;
each advanced from version 1 to version 2. Database verification found exactly
six comparison rows and eight version rows, with distinct saved result hashes.
Original versions remained present. Neither request failed, so failure-preserves-
old-result is covered by regression tests, **not a new live failure injection**.
All disposable comparisons were removed after evidence capture.

## 12–13. Positive precision taxonomy and changes

Two bounded experiments used concept expansion, title/authority matching,
jurisdiction detection and a topical gate. They were reverted before committing
because positive controls regressed. No recommendation change ships in this pass.

| Frozen problem | Evidence / unresolved cause |
| --- | --- |
| NBFC capital/registration | Official 20735/20736 exist; bounded vocabulary recovered them. QUERY_INTERPRETATION / CANDIDATE_RETRIEVAL |
| Digital lending | Wrong state microfinance result became empty. CATALOGUE_GAP is suspected but not fully proven across source text |
| CERT-In | Information-technology university laws still slipped through. ENTITY/REGULATOR_EXTRACTION / ACCEPTANCE_GATE_TOO_LOOSE |
| Direct tax | Income-tax Bills exist, but unrelated agricultural instruments persisted. RANKING / ACCEPTANCE_GATE_TOO_LOOSE |
| Company filing | Companies Act 1253 recovered, but unrelated company/public-service laws remained. RANKING / TOPICAL GATE |
| Battery EPR | Secondary battery/circular-economy report found; exact statutory source not established. Possible CATALOGUE_GAP |
| West Bengal shops | Exact state Act 15860 recovered. JURISDICTION_EXTRACTION / CANDIDATE_RETRIEVAL |
| Odisha GST | Act 11560 exists and surfaced below central instruments. RANKING / JURISDICTION_EXTRACTION |
| MSME procurement | Generic MSME result became empty; exact source absence not exhaustively established. Possible CATALOGUE_GAP |

These failures are not all catalogue gaps. No threshold was blindly lowered and
no empty result is counted as a justified gap without sufficient evidence.

## 14–17. Positive/negative results and RA-T003/006

The second experiment's ten positive controls: NBFC, GST, foreign trade and an
insurance secondary reading were useful at least as discovery leads; digital
lending, food safety and DPDP were empty; direct tax and labour had noisy results;
CERT-In was off-topic. It does not meet 8/10. The final experiment's negative
controls rejected **20/20**. These were read-only application checks against the
production catalogue, not newly persisted live HTTP recommendation sessions.
The failed/weak subset also included P13, P16, P19, P21 and P26.

Since the experiment regressed known controls it was reverted, retaining the
previous production implementation and its previously recorded ~6/10 positive
result. **RA-T003 = PARTIAL. RA-T006 = PARTIAL.**

## 18–19. Public semantic truth — RA-T004

All ten authenticated `/api/documents/:id/readiness` responses matched the
read-only database-derived contract. All ten correctly typed document-chat
lookups also returned HTTP 200. Every row below has search/chat/comparison ready
true in both the contract and relational state.

| ID | Type | Semantic ready | Retrieval mode | Stored vector references | Stored namespace |
| --- | --- | --- | --- | ---: | --- |
| 18 | bill | false | local_text | 6 | legacy/null |
| 32 | bill | false | local_text | 19 | legacy/null |
| 64 | bill | true | hybrid | 2 | gemini-embedding-001-768-v1 |
| 83 | bill | false | local_text | 22 | legacy/null |
| 973 | act | false | local_text | 9 | legacy/null |
| 998 | act | false | local_text | 17 | legacy/null |
| 20592 | policy | false | local_text | 9 | gemini-embedding-001-768-v1 |
| 20773 | consultation_paper | false | local_text | 76 | gemini-embedding-001-768-v1 |
| 23271 | regulation | true | hybrid | 62 | gemini-embedding-001-768-v1 |
| 23686 | circular | false | local_text | 14 | gemini-embedding-001-768-v1 |

Reference counts are not proof of live vectors: the lexical-only examples show
that neither references nor a namespace string resurrect semantic readiness.
This completes the public API gap on top of the earlier exact 67/67 inventory;
it is not a new full Pinecone inventory. No vector writes/deletions occurred.
**RA-T004 = PRODUCTION_VERIFIED.**

## 20–21. Authority matrix — RA-T007

| Case | Live result |
| --- | --- |
| Controlled HTML host A declares example.org canonical B | HTTP 201; B rejected; fetched gist.githubusercontent.com identity retained |
| Generic website, ordinary research | HTTP 200 SSE, GENERIC_WEB detail, LIMITED evidence |
| Same website, compliance | HTTP 422; read-only context confirms NOT_USABLE and zero evidence |
| Same website, current status | HTTP 422; read-only context confirms NOT_USABLE and zero evidence |
| Official low-quality candidate (RBI robots URL) | HTTP 422 UPSTREAM_UNAVAILABLE / NOT_USABLE; fetch failed before extraction, so this does not certify the specific low-quality-extraction case |
| Uploaded PDF | HTTP 201, retained original, one readable page; live chat HTTP 200 with USER_SOURCE identity |
| Loopback and private network | Both HTTP 422 URL_UNSUPPORTED / NOT_USABLE |

The upload response itself still has null authority fields and the fallback
“External web source” label, although live evidence correctly uses USER_SOURCE.
No authority redesign was attempted. The cross-host gap is closed, but the exact
official-low-quality extraction scenario remains unverified live.
**RA-T007 = PARTIAL.**

## 22–23. Test gates

- Candidate backend: 694 discovered, 692 passed, 2 intentional skips, zero failures.
- Restored final backend: 691 discovered, 689 passed, 2 intentional skips, zero failures.
- Full suite includes Release A safety, retrieval, semantic/vector safety,
  authority/SSRF, temporal, comparison/regeneration, persistence/completeness.
- Frontend: 54/54. Lint: zero errors, eight existing warnings.
- Next.js Webpack production build passed, 27 routes. Default Turbopack failed
  on the local external node_modules symlink; that environment limitation was
  not disguised as a default-build pass.
- Dependency audit: client zero; server one pre-existing moderate transitive
  `qs` finding, no high/critical. No unrelated dependency update was made.

## 24. Database, audit and cleanup

20,203 public documents; 3,670 ready. Read-only process audits have identical
before/after and cross-run hashes, zero mutations, zero missing states. Existing
eight legacy flag mismatches and six eligible dead letters remain unchanged.
Read-only integrity checks: zero orphan processing states, document chunks and
private source chunks.

| Surface | Rows | Unchanged fingerprint |
| --- | ---: | --- |
| Processing state | 20,203 | 20ddd58eca39457eaa0a9e5bad7d189a |
| Canonical documents | 20,203 | 74578dce7e60159e0c4808dcc4347968 |
| Legacy documents | 20,203 | d7f7f89067f9680efa0d402cee80936d |
| Processing jobs | 6,914 | 5c892ccbd94b3ed7d0e2295092044acf |

Disposable account 78 (`intelligence-closure-1788692280849@example.com`) was
deleted through the normal API. Deleted owned inventory: six comparisons/eight
versions, two multi-document chats, two sources/seven chunks, ten query telemetry
rows, one each profile/preferences/research-preferences/session. User absent;
zero remaining rows across user_id-owned tables. Both exact private storage keys
have empty version/delete-marker inventories. The synthetic gist and temporary
credential file were deleted. Public/canonical data fingerprints did not change.

## 25–26. Commits and deployments

- `3d65e20`: comparison candidate, pushed to main after automated gates.
- `0fa57d7`: candidate reverted on main after failed factual acceptance; candidate
  retained on its review branch.
- A manual production deploy was rejected by the safety review before acceptance.
  The already-approved earlier push had independently triggered Git deployment
  `dpl_FH6T3YH81Ej44ssxYPDkFDssNDwH`; the eight-request matrix tested that build.
- Restored backend alias: `dpl_3mkM7SSkRvFBjJzoi5eknC2B3wCt`, Ready.
- Frontend code unchanged; Git-triggered baseline rebuild observed at
  `dpl_GcRAUp1LnY7d8SBqHxdoAqEHCWfP`, Ready.
- Frontend root and backend `/health` both returned HTTP 200 after rollback.
  Documentation commits can trigger identical-code rebuilds; deployment IDs above
  describe the observed verification point, not a claim that aliases never move.

## 27–31. Final disposition

Remaining: positive relevance defects, incomplete/unsafe comparison inference,
unverified live official-low-quality extraction and upload display metadata.
Comparison candidate performance is promising but not a correctness certificate.
No further tuning, corpus processing, embedding, vector deletion or UX work ran.

- **Release B: PARTIAL** — RA-T004 closed; RA-T003 remains.
- **Release C: PARTIAL** — RA-T005 preserved; RA-T007 remains as detailed above.
- **Release D: PARTIAL** — RA-T010 preserved; RA-T006/009 remain.
- **Release E: NO-GO. Not started.**

Next approval should be a separate bounded fix for comparison entailment and
positive relevance, not another open-ended rerun of this pass.
