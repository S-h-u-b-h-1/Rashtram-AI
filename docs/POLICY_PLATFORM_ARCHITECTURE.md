# Policy Platform Architecture

Last reviewed: 30 June 2026

## Objective

The Policies module is a typed view over Rashtram AI's universal document
platform, not a separate database or chat implementation. It covers policies,
schemes, guidelines, consultations, strategy papers, white papers, discussion
papers, recommendations, reports, government resolutions, and Cabinet
decisions.

## Source inventory

| Source family | Official acquisition surface | Current operational state |
| --- | --- | --- |
| NITI Aayog | Public reports/publications listing | Implemented; current server probe receives HTTP 403 |
| Press Information Bureau | Official RSS feed | Implemented; current server probe receives HTTP 403 |
| MyGov | Public discussions and consultation pages | Connected; two real consultation records stored |
| NDAP | Public landing/catalogue discovery | Connected, but dataset links are absent from server-rendered HTML |
| OGD India | Public catalogue listing | Implemented; current server probe receives HTTP 403 |
| Ministries/departments | IGOD official directory | Connected; 53 ministries and 48 departments stored as directory entities |
| Regulators | Stable public listings and public files | Mixed; see `SOURCE_CONNECTOR_STATUS.md` |

Only official public URLs are collected. CAPTCHA, authentication, robots
restrictions, HTTP refusal, and certificate failures are recorded as source
health; the collector does not work around them.

## Connector design

`publicListingConnector` provides bounded, source-configured parsing for stable
HTML listings. It discovers HTML, PDF, DOC, and DOCX records, dates, MIME type,
and visible file size. `rssConnector` handles RSS/Atom GUIDs, publication
dates, categories, and descriptions. Source-specific configuration supplies
authority, jurisdiction, selectors, allowlisted hosts, and evidence-based type
classification.

All connectors return:

```text
records
directoryEntries (optional)
snapshots
errors
diagnostics
```

The shared runner owns normalization, deduplication, canonical merges,
resources, relationships, source snapshots, and run auditing.

## Normalization and provenance

Every policy record retains source identity, source/detail/PDF URL,
publication date, authority, ministry/department when known, jurisdiction,
document type, source metadata, MIME type, file size, file/content hashes when
available, and first/last-seen timestamps.

Canonical selection prioritizes eGazette and India Code, official legislatures,
ministries/regulators, PRS, then other trusted public sources. A lower-priority
record may fill missing fields but cannot overwrite stronger provenance.

## Deduplication

The merge order is exact source identity, legal/publication identifier,
PDF/content hash, normalized text hash, then bounded fuzzy title matching
within the same type, jurisdiction, and year. Ambiguous matches remain
separate and enter manual review. Bills and enacted Acts are connected rather
than merged.

## Search and research experience

Policies use `DocumentExplorer`, `/api/documents`, the universal document
workspace, global command search, bookmarks, collections, recommendations,
timeline, graph, export, and chat. Policy chat uses the same authenticated,
on-demand RAG boundary as other legal instruments. Files are indexed only when
a user opens a supported official document for research.

## Verified coverage

The 30 June 2026 bounded production run stored:

- 16 consultation papers;
- 2 guidelines;
- 82 new public-policy/regulatory source records across nine connected source
  families;
- 17 new PDF URLs, without retaining PDF bytes.

The Policies catalogue returns real records and passed production-backed API
verification.

## Operational limitations and roadmap

- NITI, PIB, OGD, CBDT, and Election Commission currently return HTTP 403.
- IRDAI and PFRDA disallow the sampled paths through robots policy.
- UIDAI timed out; CCI, NMC, and CBIC failed certificate verification.
- NDAP needs a documented public data endpoint or server-rendered catalogue;
  client hydration is not scraped as a private API.
- Ministry document collection remains a second stage after directory
  discovery; each official portal requires a stable, reviewed public listing,
  feed, sitemap, or API.
- Automated relationship inference should remain evidence-based: explicit
  identifiers, official cross-links, and cited source metadata before fuzzy
  suggestions.

