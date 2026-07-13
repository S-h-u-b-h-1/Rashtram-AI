# Ingestion Architecture

## Existing architecture

Source ingestion is built around reusable connector modules under:

`server/lib/ingestion/connectors`

Core utilities live under:

`server/lib/ingestion/core`

Important pieces:

- `connectorLifecycle.js`: default lifecycle wrapper for collect/discover/fetchDetails/normalize/run/healthCheck.
- `normalizer.js`: canonical record shaping.
- `dedupe.js`: duplicate candidate evaluation.
- `catalogRepository.js`: catalog persistence and ingestion runs.
- `fetcher.js`: source fetching utilities.
- `pdfDiscovery.js` and `pdfDownload.js`: PDF discovery/download logic.
- `healthCheck.js`: connector health probing.
- `sourceSnapshots.js`: source snapshot persistence.

## Scheduled ingestion

CLI:

- `npm run ingest:sources --prefix server`
- `npm run ingest:scheduled --prefix server`
- `npm run ingest:daily --prefix server`
- `npm run ingest:weekly --prefix server`

Scheduled workflows:

- `.github/workflows/scheduled-ingestion.yml`
- `.github/workflows/corpus-processing.yml`

Vercel cron:

- `server/vercel.json`
- route: `/api/internal/cron/ingest`

## Contract for reliable connectors

Every connector should:

- expose a stable `name`;
- discover records without storing duplicates;
- preserve source URL and original file URL;
- provide stable source-specific IDs;
- classify source authority;
- map document types consistently;
- record parser version;
- support bounded retries;
- record structured failures;
- avoid downloading unchanged files where checksum/hash evidence exists;
- include fixture tests using saved representative responses.

## Current reliability status

The architecture exists, but operational reliability is incomplete. During this audit, the source-health CLI did not complete within a manual 90-second observation window. This should be treated as an operations bug: health checks must be bounded and return partial results rather than hang.

