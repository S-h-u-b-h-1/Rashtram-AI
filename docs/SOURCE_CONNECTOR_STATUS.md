# Source Connector Status

Status reviewed: 29 June 2026.

This is an operational snapshot, not a projected catalogue size. Runtime
counts shown in the product always come from PostgreSQL.

## Connector matrix

| Connector | Collections and access method | Live status and sample | Limitation / next expansion |
| --- | --- | --- | --- |
| `prs-india` | Parliament/State Bills and Acts through polite official public HTML discovery | Existing populated source | Continue incremental refreshes and review the historical duplicate queue |
| `digital-sansad` | Parliamentary committee reports from Parliament Digital Library; Lok Sabha and Rajya Sabha question listings | **Blocked**; 0 records in the one-page sample; listing timed out | Retry from a scheduled worker and add an adapter only if a stable documented feed becomes available |
| `lok-sabha` | Questions, debates, Bulletin I, Bulletin II, and business through official Digital Sansad and Parliament Library pages | **Blocked**; 0 records; questions page snapshot captured but its listing is JS-rendered | Keep the existing paginated Library adapters; add stable question/business feeds if Parliament publishes them |
| `rajya-sabha` | Questions, committee meetings, and official debates | **Blocked**; 0 records; malformed response headers on the question listing | Recheck headers from the production worker and expand stable server-rendered collections independently |
| `ministry` | Ministry/department portal discovery from the current India.gov Web Directory | **Blocked**; 0 records; current directory returned HTTP 403 | Do not bypass the restriction; use an official sitemap/feed if India.gov publishes one |
| `state-legislature` | Delhi, Karnataka, Kerala, Maharashtra, Rajasthan, and Tamil Nadu official portals; direct legislative PDF discovery | **Fresh**; 5 records discovered and stored in the bounded run; 6 source records currently in PostgreSQL; PDF discovery working | Add reviewed state-specific listing/pagination adapters; generic landing-page PDFs are filtered by legislative terms |
| `state-gazette` | Official Gazette Directory link/PDF discovery | **Blocked**; 0 records; page reachable but ASP.NET controls expose no stable listing | Add state-specific Gazette adapters or a documented official feed; do not automate hidden form state |
| `india-code` | Recent Central Acts, optional all-year browsing, detail metadata/PDFs, and independently deduplicable subordinate legislation | Existing populated source | Add authoritative state collection handles; keep detail enrichment concurrency-bounded |
| `egazette` | Recent weekly and extraordinary Gazette records, official PDFs, and evidence-based document typing | Existing populated source | Historical date-window search remains behind interactive ASP.NET state |

## Source inspection findings

- The current Parliament pages expose real, server-rendered question,
  committee, business, and debate information. The connector uses those pages
  and stable Parliament Digital Library collections, not guessed private APIs.
- Parliament Digital Library collection pages support offset pagination and
  item detail pages expose Dublin Core metadata and official bitstream PDFs.
- India Code is DSpace-based. Its published `robots.txt` disallows discovery
  search paths but permits the browse and handle paths used by this connector.
- eGazette publishes recent official Gazette identifiers and deterministic
  `WriteReadData/<year>/<archive-id>.pdf` links on its homepage.
- The ministry and state directory URLs supplied in the brief have moved or
  are interactive. Current official replacement pages are used where
  available, with `Blocked` diagnostics instead of fabricated records.
- Every runtime request still passes through `PoliteFetcher`, which checks
  `robots.txt`, throttles per host, retries transient failures, and records
  errors.

## Commands

```bash
# Read-only health and parser samples
npm run ingest:health --prefix server

# No-write connector samples
npm run ingest:sources --prefix server -- \
  --sources=digital-sansad,lok-sabha,rajya-sabha \
  --max-pages=1 --limit=10 --catalog-only --dry-run

npm run ingest:sources --prefix server -- \
  --sources=ministries,state-legislatures,state-gazettes \
  --max-pages=1 --limit=10 --catalog-only --dry-run

# Bounded live run; blocked reasons are persisted to ingestion_runs
npm run ingest:sources --prefix server -- \
  --sources=digital-sansad,lok-sabha,rajya-sabha,ministries,state-legislatures,state-gazettes \
  --max-pages=1 --limit=5 --detail-concurrency=1 \
  --download-pdfs=false

# Recent Acts plus linked subordinate legislation
npm run ingest:sources --prefix server -- \
  --sources=indiacode --max-pages=6 --limit=100 \
  --detail-concurrency=2 --download-pdfs=false

# Explicit all-year India Code walk; operate in bounded batches
npm run ingest:sources --prefix server -- \
  --sources=indiacode --years=all --max-pages=10 --limit=100 \
  --detail-concurrency=2 --download-pdfs=false

# Current eGazette feed; date filters never invent archive results
npm run ingest:sources --prefix server -- \
  --sources=egazette --from=2026-06-01 --to=2026-06-30 \
  --limit=100 --download-pdfs=false
```

## Live verification result

The bounded live run created ingestion runs 20–25. Five source families
completed with explicit blocked-access errors and no fabricated records.
`state-legislature` discovered and stored five Delhi records: four canonical
documents were created and one matched an existing document. No PDFs were
downloaded; five official PDF URLs and their provenance were stored.

After the run, PostgreSQL contained 17,560 canonical documents and 17,244
documents with PDF URLs. Source counts were: PRS 17,544, India Code 10,
eGazette 7, and State Legislatures 6. The health sample reported five
`Blocked` sources and one connected source whose display status was `Fresh`.

The code does not substitute projected counts. After each run,
`document_sources`, `ingestion_runs`, and source snapshots determine the
displayed record count, freshness, last success, error count, and refresh age.

## Verification notes

The six-source dry run and bounded live run were both executed against the
official public pages on 29 June 2026. The health check exposed parser and PDF
status, latest successful ingestion, latest error, database count, and a
dashboard-compatible display status for every source.

`catalog:duplicates` still reports historical PRS candidate groups. The new
State Legislature run created no new reported duplicate group; one record was
merged by the existing layered dedupe. Server tests, client lint, and client
production build are the required release gates before scheduling these
connectors.
