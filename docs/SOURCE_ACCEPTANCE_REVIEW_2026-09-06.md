# Source acceptance review — 6 September 2026

This is an incomplete source-reconnection pass, not a declaration of full coverage.
The first-pass document is historical context; this report records the stricter completion audit.

## 1. Elapsed time

Started 12:45:54 UTC. Final timing and delivery status are recorded below after verification.

## 2–3. Existing connector census and fixes

The persisted read-only audit covers all 46 registered connectors: 36 existing and 10 new pilots. See `server/config/source-connection-audit.json` for exact observations, URLs, errors and timestamps. One listing page and three requested records were used; existing multi-collection connectors may apply that bound per collection. This is not exhaustive archive or pagination verification. Last successful production ingestion was not queried by the read-only network audit and remains unknown in that artifact; the application reads it from database run history.

Fixes: India Code's observed browse path; exact identity before fuzzy matches; transaction-scoped locking and identity recheck; partial-failure exit status; failure isolation between scheduled sources; no migration on dry run; explicit DAY/MONTH/YEAR/UNKNOWN precision; URL tracking/query normalization; edition collision prevention; secondary/academic publisher authority; safe related-resource handling; separate freshness and onboarding states.

Freshness now requires a known cadence, actual discovered records, a successful collection timestamp and explicit listing-quality/window acceptance. A recent attempt, old stored records or an empty page cannot produce FRESH. Existing publishers without explicit validation may correctly appear Delayed pending acceptance.

## 4–5. Ministry matrix and completed adapters

All 103 IGOD entries have states: 73 DISCOVERED, 22 ADAPTER_NEEDED, 8 BLOCKED_EXTERNAL. There are 57 observed section links. No missing official URL was invented. Departments not visited have no fabricated attempt timestamp. Directory discovery is not collection.

29 section pages were checked across the 12 priority ministries; Information & Broadcasting had no non-PDF section link in the bounded homepage sample. The initial priority matcher also included Agriculture; that substring match was corrected. No new ministry adapter has passed all acceptance gates.

| Ministry | Sections checked | Candidate PDF links, not accepted publications |
|---|---:|---:|
| Civil Aviation | 3 | 2 |
| Coal | 1 | 50 |
| Culture | 3 | 12 |
| Environment | 3 | 149 |
| External Affairs | 3 | 51 |
| Food Processing | 3 | 260 |
| Heavy Industries | 2 | 26 |
| Information & Broadcasting | 0 | 0 |
| Minority Affairs | 3 | 1 |
| Petroleum | 3 | 56 |
| Shipping | 3 | 20 |
| Steel | 2 | 22 |

These counts include potentially unrelated navigation links and overlap between pages. They must not be interpreted as unique documents or evidence readiness. Civil Aviation displayed far-future dates for old documents; Steel included a citizen charter on an orders page. This demonstrates why dedicated adapters and date semantics remain necessary.

## 6. India Code

Live year checks: 2026 explicitly empty; 2025 returned 16 Act rows; 2024 returned two. Known discovery includes handle 22046, The Repealing and Amending Act, 2025. Three tested detail handles (22046, 22478, 22084) each returned HTTP 500. The official homepage announces migration to `https://indiacode.gov.in`; the destination returned HTTP 502 in the direct check. Browse-path restoration and historical discovery work, but document traversal and pagination are not accepted. India Code is not fully repaired.

## 7–16. Pilot decisions

All decisions are enforced by `server/config/source-acceptance.json` and the scheduled runner. An ACCEPTED_FOR_SCHEDULE label alone is insufficient: the guard also requires all named gates, cadence and an evidence report.

| Pilot | Current result | Decision / remaining gate |
|---|---|---|
| Union Budget | PDFs discovered; 23-page 2026–27 highlights rendered. Cover gives February 2026, not a day. | NEEDS_MORE_WORK: edition-safe publisher extraction, date semantics, charts/table evidence |
| CAG | Full Nagaland state-finances report, 153 PDF pages, Report 2 of 2026. Full-report URLs preferred; canonical landing identity retained. | NEEDS_MORE_WORK: complete report metadata, explicit chapter associations, pagination, table evidence |
| MHA circulars | Recent circular dated 27 August 2026 confirmed visually; 3-page scan with noisy OCR text. | NEEDS_MORE_WORK: OCR/table verification and bounded latest-first pagination |
| MHA notifications | First sampled record is a 2015 notification package; all three pages have zero extracted text. | NEEDS_MORE_WORK: recent-window sorting, document-type semantics, OCR |
| Education | Current endpoint returns a client-rendered Next.js shell with no text/anchors in direct HTML. | NEEDS_MORE_WORK: verified public listing/API contract; no speculative browser bypass |
| Takshashila | Stable publication landing identity, authors and exact listing dates; 46-page native-text discussion document inspected. | NEEDS_MORE_WORK: rights/indexing review, publication-type completeness and citation preparation |
| NIPFP | Working-paper IDs, authors and canonical landing links extracted. Hindi June 2026 retained as MONTH; unknown month remains YEAR. | NEEDS_MORE_WORK: pagination, full date coverage, rights and table/citation acceptance |
| CEEW | 28-page report, MONTH precision retained. Only selected resource attached until association is verified. | NEEDS_MORE_WORK: title cleanup, authors, annexure semantics, rights and table evidence |
| IIM Ahmedabad | Series ID, authors, observed landing link and YEAR precision retained; 48-page PDF rendered. A series number is not treated as an exact date. | NEEDS_MORE_WORK: month semantics, missing landing links, rights, tables and citations |
| Azim Premji University | Actual repository latest-additions route identified from public navigation. | BLOCKED: robots.txt disallows `/cgi/latest`; no workaround attempted |

## 17–19. Dates, identity and concurrency

Dates preserve explicit precision in canonical metadata and leave SQL `publication_date` null for partial dates. Invalid calendar dates and invalid Date objects remain UNKNOWN. RFC feed dates and existing exact date formats remain compatible. Re-normalization preserves precision and year. Precision-aware catalogue ordering/display across every historical read path is not complete; no partial date has been backfilled to an invented day.

Identity tests cover repeated calls, analytics parameters, reordered semantic queries, publisher scope, different editions, canonical landing-page priority and multiple resource links. Fuzzy deduplication cannot override explicit conflicting publisher IDs/editions. Generic listings now canonicalize known tracking parameters before record/resource identity.

Real PostgreSQL/pgvector fixture: eight concurrent persistence calls produced one canonical document and one source link. A source link was removed only inside the disposable fixture to test legacy recovery; reingestion recovered the original document. Repeated companion-resource retries left two resources owned by the expected document. A separate-edition fixture received a separate document. Processing remained not_started. No concurrency test was skipped. Production duplicate canary was withheld because publisher acceptance gates remain incomplete.

## 20–22. PDF and structured-resource quality

One observed PDF per available pilot was downloaded with normal TLS/robots checks and a 20 MB bound. Eight PDFs were extracted page-by-page and their first two pages rendered. The committed evidence retains page numbers, hashes and character counts, not full publisher text.

| Family | Pages | Visual/text observation | Citation acceptance |
|---|---:|---|---|
| Budget | 23 | Native text plus charts; some blank/cover pages; Hindi logo extraction garbled. PDF page 19 is printed page 17. | Not accepted |
| CAG | 153 | Native report with cover/blank pages and merged-cell tables; PDF page 37 is printed page 17. | Not accepted |
| MHA circular | 3 | Scanned page with existing OCR, handwriting and noisy table text. | Not accepted |
| MHA notification | 3 | Image-only English/Hindi publication package; OCR required. | Not accepted |
| Takshashila | 46 | Native English prose and headings; inspected summary matches page 2. | Preparation not run |
| NIPFP | 27 | Native English working paper; page 2 title/authors/paragraphs visually checked. | Tables/preparation pending |
| CEEW | 28 | Mixed images and native prose; page 2 reading order checked. | Tables/preparation pending |
| IIMA | 48 | Native paper with bilingual institutional cover; title/authors visually checked. | Tables/preparation pending |

CAG Table 1.11 (PDF page 37) and Budget receipts/expenditure charts (PDF page 19) were inspected visually. Flattened text does not establish row/column or chart-series relationships. No structured-table extraction is claimed. PDF page identity must remain distinct from printed page labels.

CSV/XLS/XLSX MIME types are recognized. No spreadsheet/PDF association was invented; no live structured companion was accepted. Scanned and native samples are not interchangeable quality evidence for an entire publisher.

## 23. Coverage UI QA

Publisher search, category filtering, blocked/error messages, pilot labels, counts, missing success dates, ministry search and empty states passed on the clean production-mode build at 430, 390, 360 and 320 pixels. Each viewport had zero horizontal overflow and zero detected accessibility violations. Development repeated navigation exposed a stale layout chunk; that failed development run was replaced by the successful clean production-mode verification, not counted as a pass.

## 24–26. Schedules, catch-up and readiness

New schedule activation list: **none**. Nine pilots NEEDS_MORE_WORK; APU BLOCKED. Existing schedule membership is unchanged. The scheduler rejects unaccepted pilots even when explicitly passed by name.

Production catch-up: **not run**. Discovered/inserted/duplicates/resources/prepared/ready/quality-failure counts for production catch-up are not applicable, not fabricated zeros from a successful run.

Readiness sample: disposable fixtures are CATALOGUED with a resource URL, but the test URL is not a validated RESOURCE_AVAILABLE document; SEARCH_READY, CHAT_READY, COMPARISON_READY and SEMANTIC_READY were not established. No production records or vector readiness flags were changed.

## 27–29. Test and database gates

709 backend tests passed with the two normally optional database tests explicitly enabled; zero skips. The older chat integration fixture needed a fourth cleanup parameter after an earlier maintenance change; that test fixture was corrected, with no change to chat production behavior. Separate source concurrency/legacy/resource retries passed on the disposable database.

58 frontend tests passed. Lint: zero errors, eight existing warnings in unrelated components. Production frontend build passed. Database verification passed all checks on the disposable fixture. `process:audit` found no missing states or flag mismatches and verified identical before/after fingerprints, with zero mutations. No production DB integrity claim is made from a local fixture.

## 30–31. Commits and deployments

Delivery identifiers are appended after final verification. Production ingestion and source activation are not authorized by a passing build alone.

## 32–34. Remaining blocks, gaps and classification

Existing source failures include eGazette/state gazettes/NMC/CBIC certificate validation, IRDAI/PFRDA robots restrictions, NCLT CAPTCHA, parliamentary JavaScript/timeouts and India Code detail/server migration errors. Other nonempty sources still require publication-window and navigation-noise acceptance. No security or access control was bypassed.

The ministry onboarding matrix is present for all 103 entries, but there are **zero newly accepted ministry collection adapters**. The section audit is bounded discovery, not a finished set of adapters.

**Final source classification: PARTIAL — SOURCE_RECONNECTION_PASS_COMPLETE is not satisfied.** Required remaining work includes accepted pilot metadata/pagination, rights review, OCR/layout/citation validation, precision-aware ordering, a bounded production duplicate/catch-up canary and production readiness verification. Do not start bulk historical collection or Release E.
