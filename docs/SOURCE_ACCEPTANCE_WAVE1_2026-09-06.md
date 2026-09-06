# Source Acceptance Wave 1 — 6 September 2026

This report supersedes the five relevant pilot decisions in the previous acceptance review. **PARTIAL, not production accepted.** No additional publishers, historical bulk ingestion, vector cleanup or Wave 2 work was performed.

## 1. Elapsed time

Started approximately 13:45 UTC on 6 September 2026. Release timing is recorded below after deployment.

## 2. Starting revision and production baseline

Main: `c5465072665b744589862736a3f5fd5aab07cec5`.
Frontend: `dpl_EC6AL1boFYyMwKxgUqQZksCo7WyQ`.
Backend: `dpl_PpBzsF2XeuBhDQpoqhEB6fxHS6mB`.
All five publishers started NEEDS_MORE_WORK, unscheduled, with zero source-linked documents and no source-health/ingestion-run rows.

The database baseline uses the existing Rashtram workspace connection. The Vercel environment export returned empty values, so independent comparison of that connection with the deployed runtime connection was unavailable. Do not interpret this as verified production connection parity.

## 3. MHA Circulars — MANUAL_ONLY / METADATA_ONLY

The repaired connector follows observed same-origin pagination, bounded to at most three pages. Live two-window check: page 0 has 20 records, page 1 has nine, no listing errors. Newest observed circular: 27 August 2026; older window extends to March 2026. Invalid mailto/javascript navigation no longer aborts collection. Circular classification, publisher identity and PDF URL remain separate from evidence readiness.

The first US-format listing date is retained; an end-of-display date is not used as publication date. Full archive ordering is not certified. The prior three-page scanned sample has noisy OCR; no new OCR provider upload or preparation was performed after the permission gate was identified. Citation acceptance remains outstanding.

## 4. Union Budget — MANUAL_ONLY / METADATA_ONLY

Live heading identifies edition 2026–2027. Identity includes the observed edition plus the individual resource URL, preventing reused root PDF paths from silently identifying different editions as one publication. Existing deduplication rejects explicit conflicting editions. Speech, highlights, receipts, expenditure, Finance Bill and other files remain separate candidate records; the landing page is retained in detail/publisher metadata. The landing page exposed 336 matching resource candidates, not 336 accepted publications.

Publication day/month is UNKNOWN where absent from the listing. The previously inspected highlights cover gives February 2026 (MONTH); it must not become an invented day or be applied to every Budget file. No structured chart/table acceptance is claimed. Independent subtype/association checks across all 336 candidates remain outstanding.

## 5. CAG — NEEDS_MORE_WORK

Dedicated adapter preserves canonical report landing identity, report number/year, tabling-date semantics, state/jurisdiction and observed sector/department metadata. Full PDF selection requires an exact publisher report-title label inside the report download section. Only explicitly labelled chapters in that section attach as resources; covers/navigation links do not become canonical reports.

Two observed listing pages expose ten records each. Known dates run from 3 September into August 2026. One entry has no published tabling date, including on its detail page; `orderChecked` therefore remains false rather than certifying complete newest-first coverage. Report year is not substituted for publication date.

Reports 126325 (Nagaland, report 2 of 2026) and 126303 (Himachal Pradesh, report 2 of 2026) have usable partial page evidence after a PDF pipeline repair. These are local quality canaries, not prepared production records. CAG is not scheduled or PRODUCTION_ACCEPTED.

## 6. NIPFP — MANUAL_ONLY / METADATA_ONLY

Observed two-window pagination works: 28 papers in the 2025–26 window and 57 in the 2022–24 window, no listing errors. Working-paper number, title, authors, canonical landing and PDF identity are retained. Paper 449 preserves June 2026 as MONTH. Unrecognized abbreviated Hindi months conservatively retain YEAR; this avoids invented precision but remains a parser coverage gap. Public access alone does not establish full-text storage/indexing permission.

## 7. Takshashila — BLOCKED

Previously observed publication identity, authors, exact dates and PDF associations remain historical discovery evidence. Published terms restrict automated navigation/search as well as copyrighted reproduction. Automated collection now fails before any network request; preparation is also blocked. No further automated fetches were made after identifying that restriction. Publisher clarification or permission is required. Authority remains INSTITUTIONAL_SECONDARY, never official government policy.

## 8. Rights review

| Publisher | Enforced preparation/access state | Public policy |
|---|---|---|
| MHA | Metadata only; reproduction permission outstanding | [Website policy](https://www.mha.gov.in/en/page/website-policy) |
| Budget | Metadata only; reproduction permission outstanding | [Website policies](https://www.indiabudget.gov.in/website-policies.php) |
| NIPFP | Metadata only; no affirmative storage/indexing licence established in bounded review | [Publisher website](https://www.nipfp.org.in/homepage/) |
| Takshashila | Automated collection blocked; metadata-only preparation restriction | [Terms](https://takshashila.org.in/pages/terms.html) |
| CAG | Accurate reproduction with attribution; third-party exclusions still require review | [Copyright policy](https://cag.gov.in/en/page-copyright) |

Restrictions are enforced at collection/download and normal preparation entry points, not only displayed in the UI. Snapshot storage contains hashes and metadata, not copied listing HTML. This is a conservative implementation gate, not a legal opinion or a claim to publisher permission.

## 9. PDF quality matrix

| Publisher/sample | Quality | Page/readability evidence | Remaining limitation |
|---|---|---|---|
| MHA, three-page scan (prior inspection) | LOW_QUALITY | Noisy existing OCR/handwriting | Selective OCR and citation acceptance withheld under rights gate; native companion sample not established |
| Budget highlights, 23 pages (prior inspection) | PARTIAL, visual only | Native text, headings and physical/printed page distinction | Charts and merged table relationships unverified; no difficult second sample accepted |
| CAG 126325, 153 pages | PARTIAL | 124 GOOD, 16 SUSPICIOUS, 13 UNRECOVERABLE; usable pages retained, others excluded | 29 pages excluded; table structure not verified |
| CAG 126303, 180 pages | PARTIAL | 150 GOOD, 18 SUSPICIOUS, 12 UNRECOVERABLE | 30 pages excluded; table structure not verified |
| NIPFP 449, 27 pages (prior inspection) | PARTIAL, visual only | Native English title/authors/prose | Difficult sample and production citation checks not completed |
| Takshashila, 46-page discussion document (prior inspection) | PARTIAL, visual only | Native English prose/headings | Further automated inspection/preparation blocked by terms |

The matrix is not a completed two-sample acceptance matrix for every publisher. Missing samples are explicitly outstanding, not presumed GOOD.

CAG PDF hashes: 126325 `903886c0006aaf77878e730a72797c87e137f41d0ce32ddad6b82300d2aec3f4`; 126303 `511e440a4035b4d33e36c926287012f0d5023fb6415750c256790bca4964cb5d`.

Visual review compared Nagaland physical PDF page 37 / printed page 17 and Himachal Pradesh physical page 35 / printed page 17 with extraction. Prose order/headings are usable; flattened table text is not structured data. HP physical page 37 contains a chart/table and stays excluded by quality. The local OCR budget was at most six attempted pages per sample, not every rejected page; budget-deferred pages do not become evidence.

Fixed a genuine pipeline failure: a whole-document repetition check rejected long reports despite individually verified pages. The processor now retains the representation actually quality-checked and relies on page-level quality when physical boundaries exist. Without those boundaries, the existing whole-text check remains. Corrupt pages are still excluded. No production SEARCH_READY flag was set from this repair.

## 10. Production duplicate canaries

Not run: no publisher passed every pre-production gate. Do not substitute local database concurrency evidence for a production duplicate canary.

## 11. Production catch-up

Not run. Zero intended production document/source/resource mutations. The user’s maximum of five publications per publisher / 25 total was not used to justify ingestion of unaccepted publishers.

## 12. Research-readiness checks

No new production IDs, chunks, FTS results, grounded chats, source/page citations, comparison eligibility or semantic readiness were established. Two CAG PDF quality samples are not a substitute for these seven end-to-end checks. No semantic backfill was run.

## 13. Schedule activation

None. All five remain unscheduled. MHA, Budget and NIPFP are MANUAL_ONLY; CAG NEEDS_MORE_WORK; Takshashila BLOCKED. No cadence is advertised as active. Existing unrelated schedule membership was not changed. Pilot activation additionally requires explicit production duplicate, catch-up, readiness, source-health and coverage-UI gates; offline checks alone cannot enable a pilot.

## 14. Source health and freshness

All five still have no persisted attempt/success/run rows or source-linked documents in the checked database. Local listing success is not written as production collection success or FRESH. Coverage displays missing values truthfully, independently of onboarding/rights state.

## 15. UI verification

Coverage now displays rights restrictions/policy links, authority, cadence and actual scheduled/not-scheduled state. Production authenticated desktop/mobile publisher filters and readiness checks are NOT VERIFIED: the Mac browser was locked and no authenticated session was available. No impersonation token or lock bypass was used. Previous-pass responsive/accessibility checks are historical, not proof for this release.

## 16. Backend tests

725 full-suite tests passed, zero skips, including the database-backed activity and chat tests against a disposable local PostgreSQL database. A parallel run hit the existing sub-45ms timing assertion during simultaneous frontend compilation; the full serialized rerun passed. No assertion was loosened. Source/identity/date/authority/SSRF/TLS/readiness/PDF/schedule regressions are included.

Separate real-database regression passed: eight concurrent inserts, one canonical document/source identity, legacy-source-link recovery, idempotent companion resources, correct resource ownership and separate editions. This ran only against the explicitly guarded disposable database.

## 17. Frontend tests

58 tests passed; lint has zero errors and eight pre-existing unrelated warnings. Production webpack build passed. Local Turbopack build failed on a restricted subprocess socket even after retry; the supported webpack build is the successful alternative, not a claimed Turbopack success. Fresh browser accessibility/responsive verification remains blocked as above.

## 18. Database verification and audit

`db:verify` was found to refresh quality state and initialize through the ordinary query path. It now uses a database-enforced REPEATABLE READ READ ONLY transaction, without migrations or quality refresh. All 26 checks pass. `process:audit` remains read-only with zero mutations.

Before/after counts: 20,203 documents; 20,290 source rows; 20,777 resources. All compared fingerprints unchanged:

- Documents: `0c16540b4ee12321fc4c15188ac91b40`
- Sources: `d80235071cd04310cf98c07bb245061c`
- Resources: `768c846b7966746ada3315d2bbd41a73`
- Processing state: `20ddd58eca39457eaa0a9e5bad7d189a`
- Legacy documents: `d7f7f89067f9680efa0d402cee80936d`
- Processing jobs: `5c892ccbd94b3ed7d0e2295092044acf`

Fourteen pre-existing document/readiness flag mismatches and six eligible dead letters remain unchanged. There are zero missing states and zero unsafe failure rows. No unrelated reconciliation, vector cleanup or data deletion was performed.

## 19. Commits

Release identifiers are recorded after commit and push. Local untracked output and dependency symlinks are excluded.

## 20. Deployments

Deployment result is recorded after release. A healthy deployment does not imply source acceptance.

## 21. Accepted publishers

**Zero PRODUCTION_ACCEPTED.** No accepted status is manufactured to meet a target count.

## 22. Manual/rejected publishers

MHA, Budget, NIPFP: MANUAL_ONLY / METADATA_ONLY. Takshashila: BLOCKED. CAG: NEEDS_MORE_WORK, with the strongest partial technical evidence.

## 23. Remaining source gaps

Publisher permission/clarification; representative difficult/native sample pairs; NIPFP abbreviated month coverage; Budget independent subtype/resource verification; CAG undated-window handling; verified runtime database identity; production duplicate/catch-up/readiness canaries; authenticated desktop/mobile coverage and accessibility checks. The Mac must be unlocked with Rashtram signed in to resume the blocked browser checks.

## 24. Final classification

**SOURCE_ACCEPTANCE_WAVE1 = PARTIAL. SOURCE_RECONNECTION_PASS remains PARTIAL.** Repairs and guardrails are implemented, but production acceptance is not complete. Stop here; do not begin Wave 2 or activate pilots automatically.
