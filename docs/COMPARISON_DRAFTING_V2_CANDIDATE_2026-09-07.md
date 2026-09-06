# Comparison Engine V2 / Policy Template V2 — candidate checkpoint

Status: **PARTIAL — NOT RELEASED**. This is not a production certification.

## Scope and provenance

- Approximately 30 minutes of implementation/validation in this pass (candidate baseline preserved at 00:25 IST; final gates approximately 00:50 IST).
- Starting main: `6beb62b2704c65f59446c78e96290a45fa7798a9`.
- Dedicated branch: `codex/comparison-drafting-v2` in `product-v2-worktree-2026`.
- Preserved prior candidate safety work as `fde5ffa`, `da8760e`, `643c5e1`: numeric safety, read-only verification, amendment evidence matching.
- No production mutations, bulk preparation, new QA users, pushes, deployments or alias changes in this pass.

## Implementation

1. New comparison contract: `comparison-findings-v2`. Browser requests explicitly opt into V2; old API clients and historical reports retain their original contract. Regeneration can upgrade an old report without replacing its prior version.
2. Facts are constructed deterministically before optional explanation. Amendment facts use the existing exact-provision verifier. Non-amendment matches require identical textual propositions (allowing only dimensioned numeric values to differ), not title/topic similarity.
3. Each finding stores ID, subject/title, relationship context, two original excerpts with document-scoped citation IDs, type, factual comparison, separate significance, confidence state and limitations.
4. Excerpt/citation identity is checked before admission. Unsupported, conflicting and unrelated candidates are omitted. Zero findings produces the explicit no-supported-comparison message and document/library links.
5. Factual fingerprint and evidence hash are saved. Default regeneration reuses facts if evidence is unchanged and every original excerpt still validates. Existing transactional persistence/versioning is reused, not replaced.
6. Gemini receives only frozen findings, with bounded explanation input. Up to 12 findings receive an explanation attempt. Unsupported absence/removal implications are rejected; unavailable explanations are omitted rather than replaced with filler.
7. New cards have stacked mobile source text, relationship-aware labels, collapsed exact evidence, optional significance and compact limitations. Old generic cards are bypassed for V2, but retained for historical report rendering.
8. PDF V2 consumes saved findings, without retrieval/generation. It emits bounded excerpts, factual comparisons, available significance and sources. Full relationship-label/metadata parity still needs finishing.
9. Policy drafting resolves an explicit template independently of evidence. Default has 15 body headings plus title (annexures optional); private reference reads require ownership; public references require public/readiness state.
10. User templates extract numbered/Markdown headings and hierarchy; raw template body is excluded from the prompt. Heading order/hierarchy survive canonical storage and DOCX generation. This is bounded heading extraction, **not complete style/format analysis**.
11. The drafting UI names the template. Choosing it removes its implicit evidence selection; users can separately select it as evidence. Final saved Markdown replaces provisional streaming text. Unaligned generated content is retained as review notes rather than silently discarded.
12. Confirmed lineage bug fixed: a Bill's self-title or mention of an Act inside an amendment to a different Act no longer establishes `AMENDS`.

## Factual review

| Case | Observed candidate result | Acceptance |
| --- | --- | --- |
| Haryana 20592 / 20598 | Five original-source findings: 1.7(b), 2.1, 2.7, 4.3, 2.2; one omitted provision | Exact excerpts/operations checked. Gemini explanation call unavailable. Not full product acceptance. |
| Industrial Relations 1074 / 960 | One finding, 104(1), with amendment relationship | Original wording and interpretation reviewed locally. No production persistence test in this pass. |
| Food Safety 1420 / 1361 | One 7(1) proviso finding; two unsupported instructions omitted | Exact wording checked. Live interpretation included a removal inference; subsequent filter now withholds that inference pending stronger scoped explanation. |
| DPDP Bill 83 / Act 998 | 144 literal provision matches using all stored chunks; no verified lineage asserted after bug fix | **Fails useful-report acceptance:** repetitive matches need provision-level consolidation and manual review. This all-chunk harness is not the production top-k path. |
| Related drafts 104 / 83 | Two exact textual matches, no legal lineage asserted | Discovery demonstrated; not a substitute for the required broader related-policy acceptance review. |
| Unrelated control | Zero findings, no AI call | Fixture passes. |

Source content was read from existing public fixtures and read-only production chunks. Public review outputs are under `/tmp/rashtram-v2-review/`. Existing amendment fixtures lack source URLs, so their exported source links are not a production-link acceptance result.

## QA and gates

- Backend: **798 total; 796 passed; 2 skipped; 0 failed** after final fixes.
- Frontend: **61 passed; 0 failed**.
- Lint: **0 errors; 8 pre-existing warnings**.
- Production build: **passed**, webpack mode to accommodate the shared dependency symlink; temporary QA route removed before final build.
- `git diff --check`: passed.
- `db:verify`: **30/30**, read-only, before/after fingerprints identical for documents (20,210), processing state (20,210), metrics (7).
- `process:audit`: read-only, zero mutation counts, identical before/after fingerprints.
- New tests: finding admission, exact three-source fixtures, zero-findings, numeric matched proposition conflicts, two false-lineage controls, unchanged-fact regeneration, PDF content, default/user templates, ownership, heading order, optional omission, DOCX buffers, frontend contract checks.
- Browser: local rendered comparison and mocked-source drafting checked at **1440, 1024, 768, 430, 390, 360, 320**. No horizontal document overflow; evidence expands; template selection works. This is component QA, not authenticated production E2E.
- PDF: Haryana four-page compact revision and Industrial/Food two-page outputs visually reviewed. Layout readable; fixture source URLs absent. DPDP export is excessive and **not approved**.
- DOCX: both template modes generate valid DOCX buffers and preserve canonical section order. Visual Word/LibreOffice review and live persisted-draft download remain unverified. Draft PDF is not currently a supported route.

## Remaining release blockers

1. Consolidate literal non-amendment matches into useful provision-level findings; manually review the DPDP and genuine related-policy cases. Do not ship 144 repetitive cards as an intelligent comparison.
2. Verify authoritative Bill-to-Act/parent relationships against source provenance, not titles. Existing verified graph types can be used but this pass did not certify those cases.
3. Complete full structured discovery beyond retrieved passages; current structure metadata is retained but does not implement comprehensive hierarchy parsing for every selected document.
4. Improve explanatory reliability without weakening evidence gates. Haryana's single bounded explanation attempt was unavailable; no endless retry loop was run. The final absence guard needs a new bounded AI check.
5. Finish relationship/document-strip/export parity, exact progress stages, and richer template style detection. Current non-English significance filtering is English-oriented and is not certified.
6. Run complete authenticated create/save/reopen/regenerate/version/export flows on the candidate and production only after factual acceptance. Existing unit/in-memory regeneration checks do not certify live V2 persistence.
7. Complete visual DOCX review, actual user-template upload-to-draft generation and persistent reopen/download QA.

## Release decision

**Comparison V2: PARTIAL. Policy Drafting V2: PARTIAL. Production release: NO-GO.**

Do not merge, push main, deploy or promote aliases based on these passing suites alone. The factual/product acceptance gate remains open. Existing production is unchanged. Continue from this dedicated candidate; do not restart or redo the completed safety/database work.
