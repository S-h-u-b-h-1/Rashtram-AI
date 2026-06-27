# Legislative Ingestion Architecture

Last reviewed: 27 June 2026

## Purpose

Rashtram AI's catalogue is a source-agnostic national legislative and policy
data layer. It separates a real-world document from the websites that publish
or describe that document:

- `legislative_documents` holds one canonical document.
- `document_sources` holds every source's version and provenance.
- `legislative_document_resources` holds PDFs and related files.
- `document_relationships` connects bills, acts, rules, notifications, reports,
  and other related documents.
- `source_collection_snapshots` proves what a collector saw and when.
- `ingestion_runs` records scope, counters, errors, and completion state.
- `catalog_match_reviews` holds uncertain duplicate candidates for a person to
  accept or reject.

Existing numeric document IDs remain stable because the frontend and Pinecone
filters use them. The new `canonical_id` is an additional globally stable ID;
it does not replace the compatibility ID.

## Canonical document model

Supported document types include:

- bills, acts, ordinances;
- rules, regulations, notifications, orders, and resolutions;
- gazettes, circulars, office memoranda, and guidelines;
- policies and schemes;
- committee reports, debates, questions, and proceedings;
- reports and other public policy documents.

The canonical row stores:

| Field group | Examples |
| --- | --- |
| Identity | `id`, `canonical_id`, `document_type` |
| Scope | `jurisdiction_level`, `jurisdiction`, `authority` |
| Description | `title`, `normalized_title`, `status`, `category` |
| Legal identity | `legal_identifier`, `bill_number`, `act_number`, `gazette_identifier` |
| Organisations | `ministry`, `department` |
| Dates | introduced, passed, enacted, published, effective |
| Canonical provenance | `canonical_source`, `canonical_url`, `source_priority` |
| Content identity | `content_hash`, `text_fingerprint` |
| Compatibility | original source fields used by current bill/act routes |

Unstructured source-only values remain in JSON metadata. Known universal values
are promoted into typed columns so they can be filtered and audited.

## Acquisition policy

Collectors follow these rules:

1. Prefer a documented API, feed, archive, or stable browse page.
2. Fetch only public pages allowed by `robots.txt`.
3. Identify Rashtram AI through a descriptive user agent.
4. Throttle by host and retry only transient errors.
5. Store a SHA-256 snapshot hash, HTTP status, record count, URL, and timestamp.
6. Keep the raw source identity and URL even when the source is not canonical.
7. Do not bypass CAPTCHAs, authentication, access controls, or disallowed search
   paths.
8. Do not bulk-generate embeddings or AI summaries during catalogue collection.

The eGazette portal uses ASP.NET postbacks for search and downloads. The starter
collector therefore reads the official recent listings and maps the numeric
suffix of each public Gazette ID to the official `WriteReadData` PDF archive.
It intentionally does not automate CAPTCHA or session-bound search forms.

IndiaCode's public WAF rejects conventional bot-style user-agent prefixes even
on allowed browse pages. Its connector uses the site-compatible identifying
header `curl/8.7.1 RashtramAI-Catalog/1.0`; robots enforcement, request
throttling, and stable browse/detail URLs remain unchanged.

## Source connectors

| Connector | Acquisition method | Stable source identity | Freshness strategy | Status |
| --- | --- | --- | --- | --- |
| PRS India | Existing bill/act listings, pagination, bill detail pages | SHA-256 of permanent source URL | Full or collection refresh | Production |
| IndiaCode | Allowed DSpace browse pages, Dublin Core detail metadata, direct bitstream PDFs, RSS-compatible design | DSpace handle ID; legal identifier when exposed | Current-year increment; historical year walk | Production starter |
| eGazette | Recent official homepage listings and official PDF archive | Gazette ID such as `CG-DL-E-...` | Frequent recent-list refresh | Production starter |
| Digital Sansad | Official public directory/PDF discovery | SHA-256 of official file URL | Directory snapshot; targeted adapters can be added | Safe starter |
| Lok Sabha | Official Sansad public directory/PDF discovery | SHA-256 of official file URL | Directory snapshot | Safe starter |
| Rajya Sabha | Official Sansad public directory/PDF discovery | SHA-256 of official file URL | Directory snapshot | Safe starter |
| State legislatures | Configured official state portal, PDF discovery | SHA-256 of official file URL | One state/portal per run | Safe starter |
| State gazettes | Official eGazette state directory discovery | SHA-256 of official file URL | Directory snapshot | Safe starter |
| Ministries/departments | National Portal directory or explicit official URL | SHA-256 of official file URL | One directory/site per run | Safe starter |

Directory connectors are intentionally conservative. A site-specific adapter
should replace them when an official API, feed, or stable structured listing is
confirmed. Passing `--url` allows a known official directory to be sampled
without changing canonical ingestion logic.

## Normalization

Every connector emits the same source-record contract. The normalizer:

- applies Unicode NFKC normalization and whitespace cleanup;
- standardizes document types;
- creates a comparison title without generic legal suffixes and years;
- converts common Indian date formats to ISO `YYYY-MM-DD`;
- derives the year from trusted dates if needed;
- maps source authority into a source-priority number;
- retains source metadata and resources.

A record is rejected before storage unless it has a title, source name, source
record ID, and source URL.

## Deduplication and canonical merge

Matching is layered and stops at the strongest available evidence:

1. Exact `(source_name, source_record_id)`.
2. Exact legal, Gazette, act, or bill identifier.
3. Exact PDF/content SHA-256 hash.
4. Exact normalized text fingerprint.
5. Same-document-type, same-jurisdiction, same-year normalized-title
   similarity.

Title similarity never acts alone across a different document type,
jurisdiction, or year. A bill and the act it later becomes remain distinct
canonical documents and are connected with a `became_act` relationship. Scores
are handled as follows:

| Similarity | Action |
| --- | --- |
| `>= 0.92` | Merge automatically |
| `0.80–0.92` | Keep separate and queue a manual review |
| `< 0.80` | Create a new canonical document |

Canonical source priority is:

1. eGazette;
2. IndiaCode;
3. Parliament or state legislature official sources;
4. ministries and regulators;
5. PRS India;
6. other sources.

A better source may replace canonical descriptive fields and URL. A lower
priority source can fill missing fields but cannot overwrite stronger
provenance. Every version is still retained in `document_sources`.

## Collection flow

```text
official source
    -> polite fetch + robots check
    -> connector parse
    -> source snapshot
    -> universal normalization
    -> layered candidate lookup
       -> confident match: merge canonical + add/update source
       -> uncertain match: create + queue review
       -> no match: create
    -> upsert resources
    -> ingestion run counters/errors
```

PDF extraction, Pinecone embeddings, and Gemini summaries remain downstream,
on-demand operations. Catalogue ingestion records links and content identity;
it does not make an ingestion run depend on expensive AI work.

## Commands

```bash
# Default small official-source refresh: IndiaCode + eGazette
npm run ingest:sources --prefix server

# IndiaCode current-year sample with detail pages
npm run ingest:sources --prefix server -- \
  --source=india-code --years=2026 --limit=10

# IndiaCode historical walk (use conservative limits for each run)
npm run ingest:sources --prefix server -- \
  --source=india-code --years=all --max-pages=10 --limit=100

# eGazette recent official records
npm run ingest:sources --prefix server -- \
  --source=egazette --limit=25

# Existing complete PRS collector through the universal pipeline
npm run ingest:sources --prefix server -- \
  --source=prs-india --collection=parliament-bills --catalog-only

# Operational views
npm run catalog:stats --prefix server
npm run catalog:duplicates --prefix server
npm run catalog:review-matches --prefix server
```

Common controls are `--catalog-only`, `--collection`, `--years`, `--handle`,
`--url`, `--limit`, `--max-pages`, `--delay-ms`, `--timeout-ms`, and
`--retries`.

The deployed backend also exposes `POST /api/catalog-operations/refresh` and
`GET /api/catalog-operations/stats` for bounded operations. They deliberately
return `404` without a server-only operational token. If
`CATALOG_INGESTION_SECRET` is unset, the backend accepts compartmentalized,
domain-separated HMAC tokens derived from its existing server-only JWT or
database secret. The underlying secret is never sent to the endpoint, and an
operational token cannot be used as a JWT or database credential. Only
IndiaCode and eGazette are enabled through this remote surface, and each
request is capped at 25 records per source and five pages.

## Adding a connector

1. Create a connector in `server/lib/ingestion/connectors/`.
2. Export a unique `name`, optional `defaultCollection`, and `collect()`.
3. Return `{ records, snapshots, errors }`.
4. Use `PoliteFetcher`; do not call remote sites directly.
5. Keep parsing pure where possible and add an HTML fixture test.
6. Register it in `connectors/index.js`.
7. Document acquisition, identity, freshness, and limitations in this file.

No connector should write directly to PostgreSQL. The shared runner owns
normalization, deduplication, canonical merge, provenance, and run auditing.

## Operational safeguards

- Run small samples after a parser change.
- Compare discovered/stored counts with the preceding run.
- Treat a sudden record-count collapse as a parser/source alert.
- Inspect pending match reviews before changing fuzzy thresholds.
- Hash PDFs before using content identity as a cross-source merge signal.
- Preserve snapshots even when some records fail.
- Keep secrets in local/Vercel environment variables only.
- Do not log database, OAuth, Gemini, or Pinecone credentials.

## Known next steps

- Add source-specific API adapters for Sansad questions, debates, proceedings,
  and committee reports after confirming stable official endpoints.
- Add official per-state legislature and Gazette manifests.
- Add a scheduled worker with per-source checkpoints and alerting.
- Populate explicit bill-to-act, act-to-rule, amendment, repeal, and
  supersession relationships from authoritative identifiers.
- Add OCR and page/section citations as downstream document-processing jobs.
- Add an authenticated review UI for uncertain matches.
