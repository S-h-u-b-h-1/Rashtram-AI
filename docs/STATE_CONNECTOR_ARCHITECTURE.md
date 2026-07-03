# State Connector Architecture

Last reviewed: 30 June 2026

## Scope

Rashtram AI represents all 28 states and 8 Union Territories through one
jurisdiction directory and reuses the universal ingestion model for state
Bills, Acts, proceedings, questions, committee reports, Gazette notifications,
rules, orders, policies, schemes, guidelines, circulars, and resolutions.

## Jurisdiction discovery

`stateDirectoryConnector` reads the official IGOD state/UT site map and
normalizes each public jurisdiction into `source_directory_entries`:

```text
source_name = state-directory
entry_key = official two-letter IGOD code
entity_type = state_or_union_territory
name / jurisdiction
parent_name = India
directory_url
source metadata
```

The production directory contains exactly 36 current state/UT entries. These
are discovery targets, not fake documents, and therefore do not inflate
catalogue document counts.

## Document connectors

`stateLegislatureConnector` is a registry of reviewed official portals and
uses shared HTML/PDF discovery with jurisdiction-specific authority and
filtering. `stateGazetteConnector` retains public links and explicit blocked
diagnostics for portals that require interactive ASP.NET state or CAPTCHA.
Future state policy adapters use the same public-listing/RSS factories and
canonical runner.

Every state adapter must define:

- official source URL and host allowlist;
- jurisdiction and issuing authority;
- stable record identity;
- supported public collections and pagination;
- document-type rules;
- source-specific health/empty/blocked diagnostics;
- fixture tests based on the public response shape.

## Coverage

Current PostgreSQL coverage has legislative documents in 31 state
jurisdictions from the historical PRS corpus and six configured official state
legislature portals. The directory now represents all 36 states/UTs, but a
directory entry is not equivalent to a connected legislature, Gazette, or
department document feed.

This distinction is deliberate:

- **represented** means the jurisdiction exists in the directory;
- **connected** means a stable official public source passes a live sample;
- **populated** means real source records exist in PostgreSQL;
- **blocked** means the official surface requires access the collector must not
  bypass.

## Data quality and relationships

State records retain jurisdiction level, jurisdiction name, authority,
department, source URL, file metadata, and publication identifiers. Exact
source/legal/hash matching precedes title similarity. The graph may connect
state Bills to Acts, Gazette notifications, rules, policies, and circulars
only when an official identifier or source link provides evidence.

## Expansion workflow

1. Start from the IGOD jurisdiction directory.
2. Identify official legislature, Gazette, and government/department portals.
3. Prefer documented APIs, RSS/XML, sitemaps, or stable server-rendered
   listings.
4. Check robots rules and access behavior.
5. Implement one reusable adapter pattern before one-off scraping.
6. Run a no-write health sample and retain a source snapshot.
7. Perform a bounded metadata-only production run.
8. Confirm provenance, document types, PDF links, and duplicate status.
9. Promote the source status only after real records are stored.

## Limitations and roadmap

- State Gazette platforms vary widely and many require state-specific
  adapters.
- Several assembly sites are JavaScript-only or expose unstable links.
- Historical PRS coverage is broad but is not a substitute for official source
  provenance.
- The next expansion should prioritize the 30 jurisdictions without a
  configured official legislature adapter, then state Gazettes, followed by
  chief-secretary/department policy repositories.
- Scheduled incremental refreshes should use per-source cursors, conservative
  concurrency, and source-specific freshness thresholds.

