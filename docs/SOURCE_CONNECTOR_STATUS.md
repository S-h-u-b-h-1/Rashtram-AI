# Source Connector Status

Status reviewed: 15 July 2026 after a complete read-only health sweep and
bounded production runs 258–263.

This is an operational snapshot. `Connected` means a live, read-only sample
returned valid normalized records or directory entities. `Populated` means
real source records exist in PostgreSQL. `Blocked` and `Degraded` are retained
instead of bypassing source controls or inventing coverage.

## Core legislative sources

| Connector | Operational state | Stored/verified scope | Current limitation |
| --- | --- | --- | --- |
| `prs-india` | Populated | 17,544 source records across Parliament and state Bills/Acts | Historical fuzzy-title groups still require human review |
| `india-code` | Populated | Central Acts and subordinate-resource framework | Expand authoritative state handles incrementally |
| `egazette` | Populated | Recent Gazette/notification records and official PDF archive links | Historical search remains interactive |
| `state-legislature` | Populated / fresh | Ten stored official records after the bounded Delhi refresh, plus PRS state coverage | Most jurisdictions still need official portal adapters |
| `digital-sansad` | Blocked | Connector and parser implemented | Current official listings time out or hydrate client-side |
| `lok-sabha` | Blocked | Questions, debates, bulletins, business adapters | Some official listings are client-rendered |
| `rajya-sabha` | Blocked | Questions, meetings, debates adapters | Malformed headers/client rendering in current sample |
| `state-gazette` | Blocked | Official directory discovery | Interactive ASP.NET state exposes no stable public listing |

## National directories and policy sources

| Connector | Live probe | Production result |
| --- | --- | --- |
| `ministry` | Connected | 53 ministries and 48 departments stored as directory entities |
| `state-directory` | Connected | All 28 states and 8 Union Territories stored as directory entities |
| `mygov` | Connected | 2 public consultation records stored |
| `ndap` | Reachable / no server-rendered records | 0 records; no private hydration endpoint used |
| `niti-aayog` | Populated | 20 current official reports/PDFs stored |
| `pib` | Populated | 15 current releases stored; release-specific PDF discovery enabled |
| `india-gov` | Connected directory | 10 stable document categories stored; result rows are client-rendered |
| `state-policy` | Populated | 15 official Haryana policy/regulatory PDFs stored |
| `ministry-environment` | Populated | 36 official ministry PDF records stored |
| `policy-edge` | Populated secondary source | 12 attributed open-access articles stored from robots-allowed paths |
| `ogd-india` | Blocked by HTTP 403 | 0 records |

## Regulators and tribunals

| Connector | Live probe | Production result / reason |
| --- | --- | --- |
| `regulator-rbi` | Connected | 10 records stored |
| `regulator-sebi` | Connected | 10 records stored |
| `regulator-trai` | Connected | 10 consultation records stored |
| `regulator-cerc` | Connected | 10 records stored |
| `regulator-aicte` | Connected / fresh | 10 records stored; bounded refresh completed without errors |
| `regulator-ugc` | Connected | 10 records stored |
| `regulator-nclat` | Connected | 10 public order/listing records stored |
| `regulator-gst-council` | Connected | 10 records stored |
| `regulator-nclt` | Blocked | Order search requires CAPTCHA; automated collection disabled |
| `regulator-irdai` | Blocked | `robots.txt` disallows the sampled regulation path |
| `regulator-pfrda` | Blocked | `robots.txt` disallows the sampled circular path |
| `regulator-ec` | Blocked by HTTP 403 | No records stored |
| `regulator-cbdt` | Blocked by HTTP 403 | No records stored |
| `regulator-uidai` | Connected | 31 records stored |
| `regulator-cci` | Populated / fresh | 10 regulations stored from the current official DataTables JSON endpoint, with 10 official PDFs |
| `regulator-nmc` | Populated / fresh | 10 rules/regulation records stored, with 10 official PDFs |
| `regulator-cbic` | Reachable / no data | Angular shell is reachable; its public same-origin notifications API returned HTTP 500 during the audit |

Four official sites omitted public intermediate certificates required by the
Node runtime. Connectivity was restored with host-scoped, fingerprinted public
intermediates while retaining `rejectUnauthorized: true`; TLS validation was
not disabled. Robots, CAPTCHA, and access-control responses are not worked
around.

## 15 July 2026 complete health sweep

The bounded read-only sweep covered every configured connector:

- 23 connected;
- 5 reachable with no records in the bounded sample;
- 8 blocked by robots rules, CAPTCHA, timeouts, malformed upstream headers, or
  client-only/interactive catalogues;
- 0 unavailable because of a connector TLS failure.

The five pre-fix TLS failures were `ministry`, `state-directory`,
`regulator-cci`, `regulator-nmc`, and `regulator-cbic`. After the repair, all
five official sites were reachable. CCI and NMC produced catalog records;
ministry/state-directory produced their intended directory entities; CBIC
remained a reachable client application with no usable server-rendered listing.

## Verified production coverage

The figures below are the 2 July baseline. Later bounded runs added 10 CCI,
10 NMC, and 4 state-legislature canonical records; use `catalog:stats` for the
current live total.

- 17,741 canonical documents;
- 17,334 canonical documents with PDF URLs;
- 18 populated canonical source families;
- 53 ministries, 48 departments, and 36 state/UT directory entries;
- 20 NITI records, 15 PIB releases, 15 Haryana policy PDFs, 36 ministry
  documents, and 12 secondary research records;
- 10 India.gov document-category directory entries;
- zero exact content-hash duplicate groups;
- zero duplicate source identities or repeated URLs in the expanded sample;
- zero bulk PDF downloads, OCR jobs, vector writes, or AI calls during
  collection.

## Health and ingestion commands

```bash
# Read-only connector health
npm run ingest:health --prefix server

# Read-only policy and directory samples
npm run ingest:sources --prefix server -- \
  --sources=directories,policies --catalog-only --dry-run \
  --limit=10 --max-pages=1

# Bounded metadata-only connected-source refresh
npm run ingest:sources --prefix server -- \
  --sources=mygov,regulator-rbi,regulator-sebi,regulator-trai,regulator-cerc \
  --catalog-only --limit=10 --max-pages=1 --download-pdfs=false

# Catalogue and duplicate audit
npm run catalog:stats --prefix server
npm run catalog:duplicates --prefix server
npm run release:verify --prefix server
```

## Promotion rule

A source is promoted to populated only after:

1. official ownership and public accessibility are verified;
2. robots/access behavior is respected;
3. a read-only health sample returns the universal shape;
4. a bounded production run stores real provenance-aware records;
5. document types, URLs, file metadata, and duplicate behavior are reviewed.

Directory representation alone does not imply a connected document feed.
