# Legislative Data Catalogue

Last full collection: 27 June 2026

## Stored coverage

The production PostgreSQL catalogue contains:

| Collection | Documents |
| --- | ---: |
| Parliament bills | 959 |
| Parliament acts | 545 |
| State bills | 8,645 |
| State acts | 7,395 |
| **Total** | **17,544** |

Additional coverage:

- 17,228 documents have a resolved PDF URL.
- 18,407 source resources are stored.
- 807 Parliament bills have ministry metadata.
- 939 Parliament bills have a resolved PDF.
- 32 jurisdictions are represented.
- 329 source-page snapshots are stored.
- Initial collection, detail enrichment, and status refresh completed with zero
  errors.

State acts range back to 1837 in the currently exposed source catalogue.
Parliament records extend through 2026.

## Data source and attribution

The collector reads public records exposed by
[PRS Legislative Research](https://prsindia.org/). PRS identifies its site
content as licensed under the
[Creative Commons Attribution 4.0 International License](https://creativecommons.org/licenses/by/4.0/).

Each record retains:

- source name and source-derived stable ID;
- title and document type;
- Parliament/state level and jurisdiction;
- year and current status when exposed;
- ministry and policy category when exposed;
- source, detail, and PDF URLs;
- source-specific metadata;
- first-seen, last-seen, and update timestamps.

Linked resources retain their label, category, type, URL, provenance, and
first/last-seen timestamps.

## Collection commands

From the repository root:

```bash
# Complete catalogue plus Parliament bill detail enrichment
npm run ingest:catalog --prefix server

# Faster list-only refresh
npm run ingest:catalog-only --prefix server

# Restrict to one or more collections
npm run ingest:catalog --prefix server -- \
  --collections=parliament-bills,state-acts

# Review current stored coverage
npm run catalog:stats --prefix server
```

Supported collection names:

- `parliament-bills`
- `parliament-acts`
- `state-bills`
- `state-acts`

Useful controls:

- `--catalog-only`
- `--delay-ms=175`
- `--max-pages=500`
- `--detail-concurrency=4` (maximum 8)

The collector is deliberately throttled, retries transient source failures,
deduplicates by source URL, and updates existing rows instead of creating
duplicates.

## What is not bulk-copied

Full PDF text, embeddings, and Gemini summaries are intentionally generated on
demand when a user opens a document. This avoids:

- consuming large amounts of database storage;
- spending AI quota on documents nobody uses;
- filling Pinecone with unvalidated OCR or parse output;
- creating a long-running, fragile operation inside a serverless request.

The catalogue stores direct PDF links for bulk coverage. The existing processing
pipeline then extracts and indexes the selected document.

## Freshness operations

A refresh is safe to run repeatedly. Each run:

1. creates an `ingestion_runs` row;
2. upserts documents and resources;
3. records source-page hashes;
4. updates `last_seen_at`;
5. stores any collection/detail errors;
6. completes with `completed`, `completed_with_errors`, or `failed`.

The next operational improvement should be a daily scheduled refresh with an
alert when record counts fall sharply or parser errors appear.
