# Rashtram AI — final B + C + D closure pass

Date: 6 September 2026. Engineering window: approximately 70 minutes. Final
decision: **PARTIAL**. Release E was not started.

## 1–3. Scope, branch and fixes

The pass ran on `codex/bcd-final-closure` from the latest intended integration
state. Product commits are `ac4dba7` and `092e7b8`. The changes are limited to
problem interpretation/ranking, canonical readiness truth, vector-deletion
safety, implicit temporal claims, comparison conflict/output validation, and
chat completeness. No corpus bulk processing, broad embedding, vector deletion,
UX redesign, TLS bypass or Release E work occurred.

## 4–8. RA-T003

The root cause was literal problem-query construction plus ranking that allowed
readiness to outrank legal relevance. The new interpreter derives bounded legal
concepts, titles, authorities, jurisdictions, document types and synonyms, then
runs at most five catalogue-wide subqueries. Discovery no longer requires
readiness. Before: 0/30 natural-language cases returned direct matches. After:
28/30 returned at least one candidate, but manual review did not establish the
required 24 clearly relevant results: NBFC, CERT-In, company filing, battery
waste, West Bengal shops, Odisha GST and procurement cases still expose gaps.
`canPrepare` now requires an accessible supported resource or extractable
PolicyEdge HTML; the SEBI page-only case is covered. Recoverable lexical sources
remain usable without embeddings; unsupported sources cannot advertise false
preparation. **RA-T003 = PARTIAL.**

## 9–13. RA-T004

The public serializer could revive stale semantic truth from capability JSON.
The readiness contract now requires exact relational semantic state, complete
embedding/vector counts, verified semantic retrieval and a hybrid/vector mode.
Ordinary vector upserts never delete stale IDs. Explicit deletion requires a
per-ID namespace/document/chunk/content ledger and all three no-reference proofs
with `SAFE_TO_DELETE`. Exact inventory remains 67 flagged / 67 exact-active
semantic documents. Four correctly typed public probes matched DB truth; six
wrong-type probes correctly returned 404 but therefore did not certify the full
ten-document API matrix. No backfill or deletion ran in this pass. **RA-T004 =
PARTIAL.**

## 14–17. RA-T005

The old route made freshness decisions before generation, so a model-introduced
present-tense claim could escape verification. Both document and multi-document
chat now inspect material output for enactment, force, repeal, pending/latest and
applicability claims, perform bounded temporal retrieval, and qualify claims when
current truth cannot be established. Historical dated statements remain a
control and do not trigger current verification. The H07/H11 live cases were
qualified and made no absolute unverified enactment claim. **RA-T005 =
PRODUCTION_VERIFIED.**

## 18–19. RA-T007

Existing tests verify generic web as `LIMITED` for ordinary research and
`NOT_USABLE` for legal/compliance/current-status work, reject low-quality
official extraction, preserve user-upload identity, and reject cross-host
canonical promotion. The prior live matrix covered all practical public cases,
but a controlled public cross-host canonical fixture is still not provisioned.
**RA-T007 = PARTIAL.**

## 20–23. RA-T006

Recommendation acceptance now uses explicit premise classes and hard negative
topic/authority/jurisdiction checks rather than a blind threshold increase. The
final live result is 20/20 correct no-match for the frozen negative set, with the
future 2200 law rejected as unsupported. The first ten positive controls did not
reach eight clearly useful results: NBFC was empty; digital lending and CERT-In
were materially off-target; direct tax was weak. **RA-T006 = PARTIAL.**

## 24–30. RA-T009

The confirmed conflict bug compared numbers without first establishing the same
subject, obligation/theme or structural provision. Proposition fingerprints now
preserve true same-obligation conflicts while allowing cited cross-document
differences. A second confirmed mismatch counted canonical and legacy output
aliases as separate requirements; validation now uses the canonical 15-section
contract and promotes old aliases once. Analytical comparison summaries can be
verified by valid citations from both documents without requiring their
interpretation to appear verbatim.

Final live matrix: eight fixed cases yielded 0 satisfactory AI comparisons, 3
extractive fallbacks, 4 evidence abstentions and 1 transport failure. Two
regenerations returned one fallback and one abstention; the prior saved result
remained addressable under the same comparison ID. Two PDFs were valid and
readable, but one was a long raw extractive report and one accurately displayed
insufficient evidence; they are not accepted as analytical comparisons. Total
latency p50 was 22.994 seconds, maximum 50.031 seconds (excluding the transport
failure). Required phase timings were not exposed by the client evidence.
**RA-T009 = PARTIAL.** The two-iteration cap is exhausted.

## 31–35. RA-T010

The direct extractive path and a final Markdown heading such as `Evidence Gaps:`
could be persisted without content. All response paths now pass through the same
completion guard; excerpt fallback uses full sentence/paragraph/Unicode
boundaries. Final production result: 15/15 SSE requests completed, 15/15 answers
were complete, all 15 were persisted exactly, two repeated history reads were
identical, no `[object Object]` appeared, and zero incomplete assistant messages
were stored. Eleven were AI-verified, two were safe extractive fallbacks and two
were verification abstentions. p50 total response time was 550 ms; maximum was
1.039 seconds. **RA-T010 = PRODUCTION_VERIFIED.**

## 36–41. Gates, database, cleanup and deployment

- Backend: 686 discovered; 684 passed; 2 intentional environment-gated skips;
  0 failed.
- Frontend: 42/42 passed. Lint: 0 errors and 8 pre-existing warnings.
- Next.js Webpack production build: passed, 27 routes.
- Dependency audit: client 0 vulnerabilities; server retains one pre-existing
  moderate transitive `qs` advisory. No high/critical result.
- Production `process:audit`: 20,203 rows, zero mutations, identical before/after
  fingerprints on processing state, canonical and legacy documents, and 6,914
  jobs. It reports 3,670 SEARCH/CHAT/COMPARISON-ready documents, 8 legacy flag
  mismatches and 6 eligible dead letters; no reconcile was run.
- Disposable accounts 75, 76 and 77 were deleted through the normal account
  path. Their owned chats/comparisons/sessions were removed transactionally; no
  uploads were created and no public catalogue row was touched. No credentials
  were persisted.
- Backend deployment `dpl_7r9RG1GDTopDwsskBgf5tD4tttN9` is Ready and attached
  to `rashtram-ai-backend.vercel.app`. Backend and unchanged frontend aliases
  both returned HTTP 200. Live health reported PostgreSQL connected and Gemini
  generation, embeddings and streaming available.

## 42–46. Final disposition

Remaining product blockers are natural-language positive precision, completion
of the ten-record public semantic API proof, the controlled cross-host authority
fixture, and—most importantly—Gemini comparison generation/latency. Release B is
**PARTIAL** (RA-T003/004 partial). Release C is **PARTIAL** (RA-T005 verified,
RA-T007 partial). Release D is **PARTIAL** (RA-T010 verified, RA-T006/009
partial). **Release E may not begin under this closure rule because unresolved
B/D correctness defects remain.**
