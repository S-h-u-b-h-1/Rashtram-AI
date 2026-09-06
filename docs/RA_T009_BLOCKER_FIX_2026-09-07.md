# RA-T009 blocker fix — candidate verified, production held

Approximately 15 minutes, spanning 6–7 September 2026. Branch:
`codex/ra-t009-certification-blockers`.

## Integration and numeric fix

Started from freshly fetched main 11f34de, then fast-forwarded to
6beb62b2704c65f59446c78e96290a45fa7798a9. The intervening change was documentation
only. Preserved newer CAG/ingestion, source acceptance, UX and lexical readiness
work. Carried over the verified amendment implementation without redesigning it.

Two causes explained the deadline false negative:

1. Shared structural number 2.1 suppressed comparison of factual 30/60 values.
2. Near-duplicate filtering could discard one passage before safety ran.

`numericClaims` separates PROVISION_IDENTIFIER, FACTUAL_VALUE, DATE, YEAR,
MONEY, PERCENTAGE, DURATION, QUANTITY, ORDINAL and UNKNOWN. Legal references
retain nested subdivisions. Structural identifiers cannot create or suppress
numeric disagreement. Comparable values retain dimensions; money, mass and
power units normalize, while calendar duration units are not arbitrarily
converted. Different explicit provisions are not automatically the same claim.
The subject-overlap requirement is retained, with a narrowly defined bare
same-provision age-rule case. Deduplication preserves numerically different
passages. Citation numeric support itself was not weakened.

An authenticated, fixed-input `/api/documents/compare-safety-check` probe runs
context selection and Evidence Safety on synthetic conflicting deadlines. It
performs no database access, model calls, source preparation or writes and accepts
no user evidence. Intended for the requested post-deployment safety test; it has
not been deployed in this pass.

## Six actual-service controls

Actual `createComparison`, with external I/O isolated by fixtures; no production
catalogue fixture rows were created.

| Case | Result |
| --- | --- |
| Unrelated Regulation/Circular | PASS, no invented lineage/change/conflict |
| Similar title, no lineage | PASS |
| Historical reference | PASS |
| Negated amendment | PASS |
| Different sections, different values | PASS |
| Same provision, 30 versus 60 days | PASS, CONFLICTING |

The eight required numeric cases and additional unit/reference/probe tests pass.
General language reasoning is not thereby universally certified: this is a
conservative, lexical numeric classifier, not a complete legal proposition solver.

## CAG diagnosis and reconciliation decision

Read-only inspection included documents, processing state, canonical readiness,
resources, jobs and extracted chunks. Source identity is cag-reports, official
publisher pages, and the existing metadata marks onboarding as pilot and
structured tables as unverified.

| ID | Nonempty/total chunks | Text characters across chunks | Accessible resources | Job | Canonical state |
| --- | --- | --- | --- | --- | --- |
| 25106 | 132/132 | 283778 | 4 PDF resources | completed | search/chat/comparison ready, semantic false |
| 25107 | 150/150 | 338013 | 1 PDF resource | completed | search/chat/comparison ready, semantic false |
| 25108 | 103/103 | 228621 | 1 PDF resource | completed | search/chat/comparison ready, semantic false |

All have valid PDF status, ready extraction/chunking/processing, verified FTS,
deferred embeddings and no recorded processing failure. Existing flags match
the current canonical contract. Root classification: OTHER — stale verifier
predicate excluded valid deferred-embedding/FTS states, corrected on main in
11f34de before this integration. There is no remaining row-level mismatch.

Exact fields to change: **none** for each row. Reconciliation: **0 documents,
0 updates**, no --apply. No readiness promotion based only on extraction.
Source acceptance remains NEEDS_MORE_WORK, not PRODUCTION_ACCEPTED: live CAG
table/footnote answer quality is still an explicitly recorded separate blocker.
Technical lexical readiness is not a source-quality certification. No source
exception was added and none of the six protected incident documents was edited.

## Real integrated comparisons and persistence

Real production evidence and Gemini, executed by integrated service with a
disposable QA account (not a deployed comparison endpoint).

| Pair | Comparison | Supported | Final factual status |
| --- | --- | --- | --- |
| Haryana 20592 → 20598 | 128 | 1.7(b), 2.1, 2.7, 4.3, 2.2; withhold 4.11 | PARTIAL_EVIDENCE |
| Industrial 1074 → 960 | 129 | 104(1) substitution | SUCCESS |
| Food 1420 → 1361 | 130 | 7(1) proviso; other unparsed instructions withheld | PARTIAL_EVIDENCE |

All three saved and reopened with source-correct citations and canonical
validation. Initial Gemini explanations: 5/1/1. Haryana and Industrial
regenerated under their same IDs without duplicate comparisons; version 1 was
preserved and substantive facts were unchanged. Industrial retained its
explanation. Haryana version 2 retained all five facts but no explanatory
analysis. One bounded retry created version 3: facts again stable, explanation
still absent. No further retries or Gemini tuning were attempted.

## PDF acceptance: incomplete

Rendered and inspected all nine pages of the post-regeneration exports
(Haryana 5, Industrial 2, Food 2). Before/after, operation, section, citations,
limitations and status labels were present without a raw retrieval dump or
clipping. Industrial and Food include significance. Haryana explicitly says
“No separately-verified explanatory analysis is available.” It is honest but
does not satisfy the full requested significance acceptance criterion.

The bounded retry retained the same missing-analysis state. The current
amendment helper catches provider errors and filters explanations without
persisting a diagnostic reason, so this pass does not assert whether provider
output, an exception or verification caused the absence. This pre-existing
explanation behavior was not redesigned under the two-blocker scope.

## Automated / database gates

- Backend: 783 tests; 781 passed, 2 existing skips, 0 failed.
- Frontend: 58 passed, 0 failed.
- Lint: 0 errors, 8 existing warnings.
- Production build: webpack passed, with network access for existing fonts.
- `git diff --check`: passed.
- `db:verify`: 30/30 before and after, REPEATABLE READ / READ ONLY, single SELECT
  checks, rollback, fingerprint.unchanged=true. Fingerprints also match across
  both runs: documents 20210/329168ec61dbde4872b5a948924c4e1a, processing state
  20210/21b2094694e904aa8c78f70dddf90175, metrics 7/5ed59b920960660f2693a0ec7673f0e7.
- `process:audit`: readOnly=true, fingerprint.unchanged=true, no reconciliation.
- Full suite includes semantic truth, temporal/current claims, chat completeness,
  ingestion/CAG/source acceptance, Evidence Safety, citations and SSRF regressions.

## Release decision

The two requested certification blockers and automated commit conditions pass.
Preserve tested logic as local candidate commits; do not push/update main or
deploy because full PDF/explanation acceptance remains incomplete. Commit IDs
are recorded in the handoff. No force push; no Release E work.

Baseline backend inspection was Ready: dpl_J2rnciQsEHDoSYxd78cjhywVF4tu.
No new backend/frontend deployment, alias change, production comparison test,
production fixture probe or production PDF download is claimed. Main remains
unchanged by this pass (last integrated main 6beb62b).

AMENDMENT_COMPARISON_PATH = INTEGRATED_FACTUAL_SERVICE_VERIFIED, not
PRODUCTION_VERIFIED. RA-T009 = PARTIAL. Numeric conflict handling is corrected;
the regeneration explanation loss and unrestricted general comparison quality
are not certified. Existing RA-T003/RA-T006 precision and CAG answer-quality
limitations remain separate B/C/D blockers. Release E: **NO-GO**.

Local evidence: `/tmp/ra009-blocker-{cag,persistence}.json`,
`/tmp/ra009-blocker-{acceptance,retry,backend-final,frontend,lint,build,db-before,db-after,audit}.log`,
and `/tmp/ra009-blocker-pdfs/`. Cleanup evidence is recorded separately below.

## QA cleanup

Normal account deletion removed disposable user 83: three comparisons, six
versions, six query telemetry rows and one each of profile/preferences/research
preferences/session. Post-delete owned-row and comparison-version checks were
empty; no chats or private source/storage objects existed. Temporary credentials
were deleted. No public catalogue records were targeted. Evidence:
`/tmp/ra009-blocker-cleanup.json`.
