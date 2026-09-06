# Source Acceptance Wave 1B — bounded closure

## 1. Elapsed time

Started approximately 17:48 UTC on 6 September 2026. Final QA and cleanup completed by 18:28 UTC: approximately 40 minutes, followed by report publication. This pass is closed with explicit blockers, not manufactured acceptance.

## 2. Starting SHA

`8aff6d7aced732829841a22c312827cce8c0cd77`, branch `codex/ux-quality-pass`, isolated `ux-quality-worktree-2026`. Unrelated worktrees and pre-existing untracked output/dependency directories were preserved.

## 3. CAG pagination

Checked the first three listing pages, 10 entries each. Page 2 contains an undated entry; page 3 has August 12 entries after August 11 entries. Therefore publisher ordering is NOT strictly newest-to-oldest. The adapter sorts known dates within the checked window and retains undated candidates with UNKNOWN precision; it never substitutes report year. This is a 30-candidate bounded window, not full-archive coverage. Production collection is capped at five detail records and three pages.

## 4. CAG identity

Identity includes publisher, report number, report year, jurisdiction and canonical landing page. Same-number/year Nagaland and Himachal Pradesh reports remain distinct. PDF/chapter URLs do not determine canonical identity. Full-report selection requires the exact report title in the publisher download section; chapters require explicit publisher grouping. Cover/navigation assets are excluded. Report number/year, jurisdiction, sector, landing URL, title and observed tabling date are retained.

## 5. CAG PDF quality

| Publisher ID / production ID | Physical pages | Evidence chunks | Resources | Quality result |
| --- | ---: | ---: | ---: | --- |
| 126325 / 25106, Nagaland | 153 | 132 | 4 | Partial; full report and three explicit chapter associations |
| 126303 / 25107, HP State Finances | 180 | 150 | 1 | Partial; 30 unreliable pages excluded |
| 126301 / 25108, HP Compliance | 128 | 103 | 1 | Smaller third sample; 103 good, 5 suspicious, 20 unrecoverable pages |

Native text, headings, page-local passages and physical/printed page identity were inspected. Nagaland physical page 37 is printed page 17; HP State Finances physical page 35 is printed page 17; HP Compliance physical page 37 is printed page 17. The third sample's rendered prison-funding page was checked against extracted text. OCR was bounded to six pages per preparation; deferred/unreliable pages do not become evidence. No structured table extraction is claimed. Readable flattened text does not establish column/footnote semantics.

PDF SHA-256: Nagaland `903886c0006aaf77878e730a72797c87e137f41d0ce32ddad6b82300d2aec3f4`; HP State Finances `511e440a4035b4d33e36c926287012f0d5023fb6415750c256790bca4964cb5d`; HP Compliance `d7674609e6f320408eca32f0da7fd02b7e31b92a2d4915c97c96c6bcf1ae989e`.

## 6. CAG duplicate canary

PASS. Ingested 126325 twice: first run inserted one; second inserted zero and identified one duplicate. Exactly one canonical document, one source identity, one full-report resource and three explicitly associated chapter resources remained. Evidence: `/tmp/rashtram-wave1b-duplicate.json`.

## 7. CAG catch-up

PASS, deliberately limited to three quality-inspected reports, below the five-report ceiling. Catch-up discovered three, inserted two and recognized the existing report once. Total wave additions: three canonical documents, three source rows, six resources. A final refresh rediscovered the same three, inserted zero, updated zero and recognized three duplicates, with zero errors and no further PDF downloads. No archive history was ingested. Evidence: `/tmp/rashtram-wave1b-catchup.json` and `...-refresh.json`.

## 8. CAG research-readiness

All three have SEARCH_READY, CHAT_READY and COMPARISON_READY capability flags after normal preparation and verified full-text search probes. Semantic readiness is false; embeddings were intentionally deferred. Chunk-reference rows are not semantic embeddings. No semantic backfill was run.

Live authenticated title search and opening passed for all three. Two-report QA exercised actual production chat, persisted answers and page citations. Citation links now include the physical `#page=` fragment. The original publisher links resolve to the correct report landing identities. The Library picker accepts Nagaland plus HP State Finances and enables Comparison; one source correctly leaves it disabled. Comparison generation itself was not claimed as tested.

Grounded-answer acceptance FAILED for Nagaland. On physical page 37, the prose says the ₹5.77 crore released during 2024–25 related to 2021–22 recommendations and was not transferred to implementing departments. The table's ₹0.07 crore is penal interest for past delay. The repeat answer nevertheless described ₹0.07 crore as an actual grant transfer and attached unsupported implications. Its deterministic verifier still reported zero unsupported claims after repair. This is a semantic/footnote verification gap, not a missing-PDF problem. See the [official report landing page](https://cag.gov.in/en/audit-report/details/126325).

Two narrower defects found by live QA were fixed and retested: unsupported compliance assertions can no longer hide under an analysis heading, and asking for PDF page citations no longer triggers PDF export. These repairs do NOT close the remaining financial-footnote quality gate.

## 9. CAG final status

**NEEDS_MORE_WORK; not scheduled.** Catalogue and preparation success do not equal publisher acceptance. Required next gate: table/footnote-aware factual verification followed by two clean live grounded-research checks. The three bounded canary reports remain in the catalogue; this pass did not relabel the entire publisher as accepted.

## 10. MHA rights result

The [published website policy](https://www.mha.gov.in/en/page/website-policy) requires permission for reproduction and for incoming hyperlinks. It does not expressly establish permission for automated metadata collection, extracted-text storage, OCR or cited excerpts. No legal permission was inferred. No new MHA PDFs were downloaded or processed in Wave 1B.

## 11. MHA final status

**MANUAL_ONLY / METADATA_ONLY**, with source-link permission explicitly restricted. Rights clarification precedes further automated samples or citation preparation.

## 12. Budget rights and taxonomy

The [Budget website policies](https://www.indiabudget.gov.in/website-policies.php) require reproduction permission and contain inconsistent hyperlink clauses. These were not resolved through legal inference. Identity now distinguishes financial-year edition and independent document subtype: Speech, Highlights, Finance Bill, Receipts, Expenditure and other independently named publications. Unknown dates stay unknown; no cover-date propagation or edition mega-document. No new Budget PDF processing occurred.

## 13. Budget final status

**MANUAL_ONLY / METADATA_ONLY**, pending clear processing/indexing rights.

## 14. NIPFP rights and metadata

No affirmative full-text indexing permission was established from the [publisher site](https://www.nipfp.org.in/homepage/). Metadata discovery and canonical links remain allowed by the requested workflow; automated extracted-text storage/preparation remains blocked. Existing paper-number, author, canonical landing/PDF identity and two-window pagination evidence was retained. Hindi abbreviations for all twelve months now have regression coverage; unknown tokens do not guess a month. The ambiguous `मा` was verified as March against the official [paper 446 landing page](https://www.nipfp.org.in/publication-index-page/working-paper-index-page/do-fiscal-transfers-stick-under-fiscal-stress-evidence-of-the-flypaper-effect-from-manipur-north-eastern-region-of-india/), which explicitly gives March 2026. No new NIPFP PDF processing occurred.

## 15. NIPFP final status

**MANUAL_ONLY / METADATA_ONLY**; authority remains INSTITUTIONAL_SECONDARY. Citation preparation is intentionally uncompleted because indexing rights are unresolved.

## 16. Takshashila

**BLOCKED. Zero additional automated publisher requests in this pass.** The previously recorded restriction remains authoritative until permission or materially changed published terms is supplied. No workaround or terms re-fetch was attempted.

## 17. Independent rights-state matrix

| Publisher | Authority | Rights states | Automated full-text preparation |
| --- | --- | --- | --- |
| CAG | OFFICIAL_GOVERNMENT | METADATA_ALLOWED; FULL_TEXT_PROCESSING_ALLOWED, attribution required | Only bounded reviewed canary used; not schedule-accepted |
| MHA Circulars | OFFICIAL_GOVERNMENT | MANUAL_REVIEW_REQUIRED | No |
| Union Budget | OFFICIAL_GOVERNMENT | MANUAL_REVIEW_REQUIRED | No |
| NIPFP | INSTITUTIONAL_SECONDARY | METADATA_ALLOWED; MANUAL_REVIEW_REQUIRED | No |
| Takshashila | INSTITUTIONAL_SECONDARY | AUTOMATION_BLOCKED; MANUAL_REVIEW_REQUIRED | No |

CAG's [copyright policy](https://cag.gov.in/en/page-copyright) permits accurate attributed reproduction subject to third-party exclusions. Rights status never substitutes for readiness, authority or acceptance.

## 18. Authenticated Coverage UI

A new disposable account was created through the normal production signup flow; database identity was confirmed by a read-only lookup. No personal browser session or forged token was used. All five publishers were checked at 1440, 768, 390 and 360 pixels: 20 passing cases, zero detected accessibility violations, zero horizontal overflow. Checks cover authority, rights, acceptance/scheduling and attempt/success/publication/error fields. Small-screen rendering was visually reviewed. The final production rerun also passed all 20 cases and displayed the final CAG blocker. Evidence: `client/output/wave1b/coverage-results.json` and screenshots; `/tmp/rashtram-wave1b-ui-final.log`. Automated a11y results are not a claim of universal accessibility. The disposable account (ID 80) was deleted with its test research through the normal authenticated account-deletion API (HTTP 200), and the isolated browser was closed. Shared CAG documents were retained. QA transcripts were preserved locally as audit evidence before account deletion.

## 19. Schedule activations / freshness

**Zero activations.** Pilot scheduling now requires PRODUCTION_ACCEPTED, every required gate, an evidence report and a supported cadence. No other source's existing schedule was changed.

CAG's actual production refresh completed 18:22:41 UTC: three discovered, zero inserted, zero updated, three duplicates, zero errors; latest catalogued publication 3 September 2026. FRESH describes that bounded successful production collection, not acceptance or full archive freshness. Other four publishers have no production run/health rows from this wave; local policy/discovery checks did not manufacture last-success dates.

## 20. Database safety

Before baseline: 20,207 documents / 20,295 source rows / 20,778 resources. After: 20,210 / 20,298 / 20,784. Canonical uniqueness, source/resource orphan checks and normalized/legacy parity pass. Both verification and process audit are database-enforced read-only with zero audit mutations.

The first after-verification exposed an obsolete audit predicate that rejected deferred semantic embeddings despite verified FTS. The predicate was aligned with the existing readiness service's fallback/deferred + local_text/fts/hybrid contract; no readiness flags were mass-edited. Final database verification passes every check. Process audit retains the same 14 pre-existing flag mismatches and six eligible dead letters; zero missing states and zero unsafe failure rows. These unrelated findings were not repaired implicitly.

An explicit post-preparation fingerprint audit excluding only IDs 25106–25108 matched every baseline document, legacy document, processing-state/job, source and resource fingerprint. No unrelated flag changes or vector deletion operations were performed. Intentional mutations were the three canary records/resources; four bounded ingestion runs with eight snapshot hashes each; three preparation jobs and page/chunk/lexical-reference artifacts; and disposable-account signup/session/activity/chat data. Normal document opening also generated summaries for two new reports, separately from preparation's skip-summary option. No existing user's research was changed.

## 21. Backend tests

**731 passed, zero failed/skipped**, including adapters, rights, Hindi dates, identity/dedupe, readiness, PDF quality/OCR bounds, scheduler guards, SSRF/TLS and chat-safety/export regressions. Full suite used a disposable local database, not production. Separate eight-writer concurrency canary passed with one canonical identity and idempotent resource association. Live PDF and production research checks are reported separately; unit-test success does not override the Nagaland quality failure.

## 22. Frontend tests

**58 passed.** Lint: zero errors, eight pre-existing warnings (existing hook/navigation warnings, not suppressed). Production build passed. Authenticated live 20-case Coverage QA passed. The PDF and database skills materially influenced physical-page verification and transaction-enforced read-only auditing.

## 23. Commits

- `d02594b`: discovery, rights-state, bounded OCR/canary and Coverage changes.
- `ab90559`: compliance-claim verifier and physical-page citation fixes.
- `a800bf7`: distinguish PDF citation questions from export requests.
- `11f34de`: final CAG quality blocker, lexical audit correction and bounded health refresh.

All pushed to the existing GitHub `main` and `codex/ux-quality-pass` branches. This report is published in a subsequent documentation-only commit.

## 24. Deployments

Implementation commit `11f34de` verified READY on both existing production projects:

- Backend `dpl_FD7wgHcNz4ShEbheJKogZ4FC7E5P`: `rashtram-ai-backend-lffp1ehdw-shubh1s-projects.vercel.app`.
- Frontend `dpl_GvJNCzyAG8QdSf7Aez7z66AThb7v`: `rashtram-j7y7e7z2w-shubh1s-projects.vercel.app`.

Production aliases remain [Rashtram AI](https://rashtram-ai.vercel.app/) and its existing backend. The final backend's error-log query returned no entries in the checked 15-minute window; that is not a claim of perpetual error-free operation. No new Vercel project or production database was created. Subsequent documentation-only deployment, if generated by the existing integration, contains identical application code.

## 25. Production-accepted publishers

**Zero.** In particular, CAG was not promoted merely because extraction, title search or comparison eligibility passed.

## 26. Remaining blockers

- CAG: grounded numeric/footnote interpretation and verification; reproduce using Nagaland physical page 37. No need to ingest more reports to investigate it.
- MHA: explicit access/reproduction/linking permission; scanned-document evidence gate remains untested in this pass.
- Budget: processing rights and contradictory link policy; no full-text production acceptance.
- NIPFP: full-text storage/indexing permission, then citation preparation.
- Takshashila: explicit publisher permission or supplied materially changed terms.

## 27. Final Wave 1 status

**Wave 1B bounded audit closed under the truthful-blocker success path. Overall Wave 1 production acceptance remains PARTIAL.** Infrastructure and targeted fixes are deployed, but no publisher passed all gates. Stop here: no Wave 2, new publishers, archive backfill or automatic pilot activation.
