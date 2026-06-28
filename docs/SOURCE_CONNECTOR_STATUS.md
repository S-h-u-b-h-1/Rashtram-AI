# Source Connector Status

Status reviewed: 28 June 2026.

This is an operational snapshot, not a projected catalogue size. Runtime
counts shown in the product always come from PostgreSQL.

## Connector matrix

| Connector | Collections and access method | Current limitation |
| --- | --- | --- |
| `prs-india` | Parliament/State Bills and Acts through polite official public HTML discovery | Existing production connector; remains the broadest populated source |
| `digital-sansad` | Parliamentary committee reports from the Parliament Digital Library; current Lok Sabha and Rajya Sabha question listings from Digital Sansad | Private or undocumented application APIs are intentionally not used |
| `lok-sabha` | Questions, debates, Bulletin I, Bulletin II, and business; official Digital Sansad listings plus paginated Parliament Digital Library collections | Business documents behind interactive filters are reported as blocked when no stable links are exposed |
| `rajya-sabha` | Questions and committee meetings from server-rendered Digital Sansad listings; official-debate discovery | Session/date-filtered debate downloads may be blocked when the official page exposes no crawlable links |
| `ministry` | Ministry and department portal links from the current India.gov Web Directory | The old `/my-government/ministries` route returns 404; the replacement directory may load entries interactively |
| `state-legislature` | Initial official portals for Delhi, Karnataka, Kerala, Maharashtra, Rajasthan, and Tamil Nadu; direct public legislative PDFs first | A reachable portal with no landing-page PDF links is blocked for deeper crawling until a state-specific adapter is reviewed |
| `state-gazette` | Official Gazette Directory link/PDF discovery | The supplied `/stateGazette` path is unavailable; the current ASP.NET directory requires interactive controls and is marked blocked if no stable links are exposed |
| `india-code` | Recent Central Acts by default, all-year browsing on request, detail metadata/PDFs, and independently deduplicable rules, regulations, notifications, orders, circulars, ordinances, and statutes linked from Acts | State-wide enumeration needs authoritative collection handles; detail enrichment is deliberately concurrency-bounded |
| `egazette` | Recent weekly and extraordinary Gazette records, typed rules/orders/ordinances/notifications, official archive PDF URLs, and date filtering within the live feed | Historical date-window search uses interactive ASP.NET state; out-of-feed windows are marked blocked |

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

## Real database baseline

Before this connector expansion, PostgreSQL contained 17,554 canonical
documents, including 17,544 source records from the legislative-reference
collector, 10 India Code records, and 7 eGazette records. The six newly
completed source families had no stored records and therefore appeared as
`Planned`.

The code no longer substitutes projected counts. After each successful run,
`document_sources`, `ingestion_runs`, and source snapshots determine the
displayed record count, freshness, last success, error count, and refresh age.

## Verification notes

The local sandbox used for this change blocks DNS for Node and shell processes.
All eight requested dry-run commands were executed and correctly captured
`ENOTFOUND` as source errors without writes. Official source availability and
current records were independently confirmed through the official public pages.
Production or a network-enabled worker should run the same bounded commands
before enabling schedules.
