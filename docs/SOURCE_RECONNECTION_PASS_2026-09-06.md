# Source reconnection and expansion — first pass

Status: IN PROGRESS. Local changes only; no production import, deployment or new schedule activation.

## Implemented

- India Code browse URLs now use the publisher's observed `/indiacode/handle/` route. The current-year bounded probe returns an explicit empty index instead of 404. This is not proof that upstream publication coverage is current.
- Canonical source identity is checked before fuzzy deduplication, including legacy documents without `document_sources` rows. Persistence serializes repeated source identifiers and checks identity inside the transaction. Production duplicate-key recovery still needs a bounded integration canary.
- Scheduled ingestion continues through individual exceptions and reports an unsuccessful exit for partial failures. Dry-run workflow no longer applies migrations. Verification runs even after an ingestion failure.
- Added read-only connection audit and ministry homepage discovery tools; neither imports documents or invokes preparation.
- Added ten unscheduled pilot connectors: Union Budget, CAG, Home Affairs circulars, Home Affairs notifications, Education notices, Takshashila Institution, NIPFP, CEEW, IIM Ahmedabad and Azim Premji University.
- Added publisher search and category filters to Coverage & Sources, with separate last attempt, last success, newest catalogued publication, inserted, updated and error fields. Pilot sources are labelled not scheduled.
- CSV/XLS/XLSX MIME recognition and DNS-label-boundary host restrictions in the shared listing parser.
- Research publishers have secondary/academic authority classifications, not official-policy classifications.

## Live checks

All then-registered collectors were probed with bounded discovery (one listing page, small requested sample; some existing collectors apply the limit per collection).

The ministry directory returned 103 ministry/department entries. The audit attempted the ministry homepages with usable official government-domain URLs; missing URLs were recorded rather than guessed. Listing candidates were found for Civil Aviation, Coal, Culture, Environment, External Affairs, Food Processing, Heavy Industries, Information & Broadcasting, Minority Affairs, Petroleum, Shipping and Steel. Homepage discovery is not an operational ministry document collector.

Confirmed failures include India Code's old path, eGazette certificate-chain failure, parliamentary interactive/timeout failures, IRDAI/PFRDA robots restrictions, NCLT CAPTCHA, and NMC/CBIC certificate failures. Ministry failures included MCA 403, Women & Child Development robots restrictions, certificate errors and timeouts. No access restrictions or TLS verification were bypassed.

### New publisher sample results

| Pilot | Observed result | Remaining check |
| --- | --- | --- |
| Union Budget | Three document PDF links | Edition-safe identity, dates, table/layout review |
| CAG | Report PDFs; navigation files excluded and chapter files attached | Publication date, jurisdiction, full-report selection, PDF quality |
| Home Affairs circulars | Correct titles and dates including 27 August 2026 | PDF OCR/layout quality, pagination and recent-window coverage |
| Home Affairs notifications | PDF discovery, some old records | Latest-first pagination and date semantics |
| Education | No matching PDF records | Updated listing/parser |
| Takshashila | Three correctly titled PDFs dated 3–5 September 2026 | Rights/access review, layout and citation preparation |
| NIPFP | Three correctly titled working-paper PDFs | Month/year precision, authors, quality |
| CEEW | Report and annexure PDF links | Title cleanup, month-only date precision, rights and quality |
| IIM Ahmedabad | Three correctly titled working-paper PDFs | Year/month precision, authors, rights and quality |
| Azim Premji University | No matches on homepage | Repository listing adapter |

In-memory PDF samples: Union Budget highlights (23 pages, 21,735 extracted characters), Takshashila China economic warfare paper (46 pages, 103,867 characters), MHA tyre-life circular (3 pages, 5,093 characters). These checks confirm text presence only. OCR noise and layout issues are visible in extracted text; none was labelled research-ready. No full visual/table validation performed.

## Required before completion

1. Persist and expose ministry-by-ministry onboarding coverage, and build/test dedicated listing adapters for every discovered ministry section and departments where ministries lack a portal.
2. Correct remaining existing collectors and test date-window/pagination behaviour. An empty or blocked collector must not be called fresh.
3. Validate stable document identity, explicit publication-date precision and publisher permissions for every pilot.
4. Add bounded PDF quality canaries covering text, mixed/scanned documents, reading order and tables; preserve structured companions without guessing their relationship to a PDF.
5. Database integration tests for exact-identity recovery and concurrent ingestion; bounded production catch-up only after those pass.
6. Browser verification of category filters, missing-data states, mobile layout and backend freshness fields.
7. Activate only accepted sources in schedules; deploy and verify actual catalogue visibility and freshness. No blanket claim that all sources are connected or all catalogue documents are ready.

## Verification so far

Backend suite before final parser edits: 697 tests, 695 passed, two skipped. A later full suite with local-server/DNS access also passed. Targeted source expansion and ingestion checks: 58 passed. Frontend production build succeeded; changed-component lint passed. Full publication and production verification remain outstanding.

## Publisher references

- https://igod.gov.in/ug/E002/organizations
- https://www.indiacode.nic.in/indiacode/home.jsp
- https://www.indiabudget.gov.in/
- https://cag.gov.in/en/audit-report
- https://www.mha.gov.in/en/notifications/circular?page=0
- https://takshashila.org.in/pages/publications/
- https://www.nipfp.org.in/publication-index-page/working-paper-index-page/
- https://www.ceew.in/publications/page
- https://iima.ac.in/faculty-research/research-publications/publication/search
- https://publications.azimpremjiuniversity.edu.in/
