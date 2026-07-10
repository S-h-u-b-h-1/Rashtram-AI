# PDF Catalogue Audit

Date: 2026-07-10

## Findings

- PRS PDF discovery is working: focused live refresh found 12 PDFs across 10
  refreshed records.
- Daily dry-run found PDFs across PRS, India Code, eGazette, PIB, RBI, TRAI,
  and other sources.
- Some document failures are genuine permanent PDF/source failures, including
  404 responses.

## Sample permanent PDF failures

- Document 2230: permanent 404.
- Document 2235: permanent 404.
- Document 20597 (`regulation`, "Directions U/S 108 of Electricity Act 2003"):
  PDF URL returns 404 and was correctly marked permanent-failed.

## Fixes in this sprint

- Processing now distinguishes real PDF failures from AI-provider failures.
- Gazette-family batch processing now includes `gazette`, `notification`,
  `rule`, `regulation`, `order`, `circular`, and `ordinance`.
- Typed batches no longer accidentally process unrelated queued documents.

## Remaining work

- Repair or replace known 404 source URLs where official alternate URLs exist.
- Run resource validation reports after larger processing batches.
- Keep permanent failures blocked until resource status is corrected.
