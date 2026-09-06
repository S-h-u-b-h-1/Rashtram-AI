# Comparison V2 + Policy Drafting V2 — final acceptance checkpoint

**Decision: NOT ACCEPTED. Production unchanged. Release E not started.**

This is a bounded continuation of `dbd6bac`, not a new architecture or a production certification.

## Acceptance report

1. **Elapsed:** approximately 20 minutes for this continuation, including checks; not a precisely instrumented duration.
2. **Latest main:** fetched `github/main`: `6beb62b2704c65f59446c78e96290a45fa7798a9`.
3. **Consolidation:** exact proposition/source-pair deduplication, conservative grouping by explicit provision identifiers, strongest member retained with all other supporting pairs. Broad headings are not treated as section identifiers. Primary view capped at 12; additional findings persist separately. Relationship provenance now participates in the evidence hash so a changed relationship triggers revalidation.
4. **DPDP count:** 144 before; **12 primary + 132 additional** after. **Zero provision groups consolidated in this real case.** This is presentation bounding, not successful conceptual consolidation.
5. **DPDP factual review:** not accepted as a useful Bill-to-Act report. Read-only production inspection found only `REFERS_TO`/`REFERRED_BY`, `metadata_heuristic`, `title_reference`, with no source URL. Bill metadata records parliamentary passage, but the inspected graph does not establish this particular Bill-to-Act edge. The candidate correctly retains `NO_VERIFIED_RELATIONSHIP`. No title-only enactment claim was added. Complete manual review of all findings remains outstanding.
6. **Haryana:** 5 exact-source amendment findings preserved in fixture checks. One bounded explanation call failed with `provider_or_format_failure`; facts retained. Not an authenticated acceptance result.
7. **Industrial Relations:** 1 exact-source finding preserved; bounded explanation accepted. Not an authenticated acceptance result.
8. **Food Safety:** 1 exact-source finding preserved; explanation withheld by the existing verification path. No invented significance substituted.
9. **Related-policy:** not certified. The old 104/83 similar-title candidate is not substituted for the required genuinely related pair.
10. **Unrelated control:** zero findings; no AI call; automated fixture passes.
11. **Explanation:** existing bounded batch path remains; no retry loop or safety relaxation. Per-finding reliability and regenerated summary/takeaway acceptance remain unfinished.
12. **Comparison UI:** primary findings, expandable additional findings, supporting evidence retained inside evidence expansion, relationship displayed, Export PDF label. Final document-strip/header/progress-state acceptance remains incomplete.
13. **Responsive/accessibility:** earlier component-only checks are not a current authenticated result. No fresh responsive matrix or accessibility scan certified in this continuation.
14. **Persistence/reopen:** saved-result serialization tests pass; actual disposable-account V2 flow not run. No QA accounts or private records created.
15. **Regeneration:** automated unchanged-fact fingerprint, overflow retention and relationship-change revalidation tests pass. Authenticated immutable-version and duplicate-record checks remain outstanding.
16. **PDF:** uses saved primary findings and relationship metadata, retaining source references. Explicitly states the additional finding count and that the expanded appendix remains in the app. Does not regenerate analysis. This bounded PDF intentionally omits the expanded appendix; full browser/export acceptance and fresh visual review remain outstanding.
17. **Default drafting:** existing implementation untouched; suite passes. Actual generation/save/reopen acceptance not newly verified.
18. **User-template drafting:** existing implementation untouched; ownership/template tests pass. Actual upload-to-draft acceptance not newly verified.
19. **DOCX visual QA:** outstanding for both actual generated drafts; valid-buffer tests are not visual acceptance.
20. **Backend:** 801 tests, 799 passed, 2 skipped, 0 failed. Added tests for overflow preservation, explicit provision consolidation and relationship-hash invalidation.
21. **Frontend:** 61 passed, 0 failed. Lint: 0 errors, 8 existing warnings. Next.js webpack production build passed. Local Next.js guidance used to preserve the client-component boundary.
22. **Database/audit:** `db:verify` 30/30, read-only; document/processing/metrics fingerprints unchanged. `process:audit` read-only, before/after unchanged; no apply flag. Public catalogue remains 20,210 records; audit records 6,917 processing jobs. No production writes performed.
23. **Commits:** baseline `dbd6bac`; continuation preserved on `codex/comparison-drafting-v2`, not main. See branch log for this report's checkpoint commit.
24. **Deployments:** none. No push, merge, alias promotion or production smoke claimed.
25. **Comparison V2:** PARTIAL.
26. **Policy Drafting V2:** PARTIAL.
27. **Remaining blockers:** meaningful DPDP provision/concept consolidation; trustworthy Bill-to-Act provenance; genuine related-pair factual review; explanation reliability; final UI/progress/export parity; authenticated comparison persistence/version/PDF QA; actual default and uploaded-template drafting workflows; visual DOCX acceptance; fresh responsive/accessibility matrix.

## Evidence locations

Local logs: `/tmp/rashtram-v2-acceptance-{backend,frontend,lint,build,db,audit,cases}.log`.
Local public case reports: `/tmp/rashtram-v2-review/`.

Passing automated gates does not override the failed product gate. Do not promote this checkpoint as accepted or deploy it on the strength of this report.
