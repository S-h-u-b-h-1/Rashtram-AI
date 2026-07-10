# PDF Catalogue Audit

## 2026-07-10 product-level sprint update

Latest audited state:

- Total documents: 19,237
- Research/comparison-ready: 761
- PDF available but not processed: 16,342
- Extractable source not processed: 1,083
- Permanent PDF/source failures: 66
- Retriable failures: 380
- Unsupported file type: 3
- Invalid/quarantined: 38

Controlled processing verified that PDFs/source records can still become ready through extractive summary and local retrieval fallback when the AI provider is unavailable:

- Acts: `10489`, `961`
- Policies: `20981`, `20983`
- Gazette-family regulations: `20602`, `23271`

Known PDF/resource failure classes:

- Broken PDFs returning `404 status code`.
- Blocked PDFs/source URLs returning `403`.
- Scanned PDFs with insufficient text or too large for inline OCR.
- Duplicate PRS state bill/ordinance variants.
- Generic India Code subordinate `Rules` records that require better title disambiguation.

No document should be marked research-ready unless source accessibility, extracted text, chunks, embeddings/local retrieval, and retrieval verification all pass.

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
