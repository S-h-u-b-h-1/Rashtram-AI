# Scheduled Ingestion

Last verified: 2 July 2026

## Scheduling architecture

Long-running public-source collection runs in GitHub Actions rather than a user
request or frontend process. This avoids serverless duration limits and gives
each run durable logs, retries at the connector layer, concurrency protection,
and a clear failure signal.

The backend also exposes a bounded Vercel Cron endpoint for recent PIB,
eGazette, or NITI refreshes:

```text
GET|POST /api/internal/cron/ingest
Authorization: Bearer <CRON_SECRET>
```

It returns 404 when the secret is absent or invalid, permits at most three
allowlisted sources, limits pages and records, never downloads PDFs, and never
calls AI. `server/vercel.json` schedules a bounded PIB refresh at 14:30 UTC
(20:00 IST).

## GitHub Actions schedules

`.github/workflows/scheduled-ingestion.yml` provides:

- daily metadata refresh at 20:00 IST;
- weekly deep refresh on Sunday;
- manual daily/weekly dispatch with an optional dry-run;
- one active ingestion workflow at a time;
- additive migration before collection;
- normalized database verification after writes;
- weekly duplicate audit.

The repository must configure `DATABASE_URL` as a GitHub Actions secret.
Vercel must configure `CRON_SECRET` for the backend production environment.
GitHub scheduled events run from the repository default branch, so the
workflow becomes schedule-active after this feature branch is merged to
`main`. Manual dispatch can target the feature branch before merge.

## Profiles

Daily covers PRS, India Code, eGazette, PIB, MoEFCC, NITI Aayog, MyGov, a state
policy portal, and representative regulators. Weekly covers directories,
state sources, the permitted research source, and every configured regulator.
Individual connector errors do not prevent later sources from running.

## Commands

```bash
npm run ingest:scheduled --prefix server -- --profile=daily
npm run ingest:daily --prefix server
npm run ingest:weekly --prefix server
npm run ingest:daily --prefix server -- --dry-run --max-pages=1 --limit=2
npm run ingest:health --prefix server
```

Every real run writes `ingestion_runs`, per-record `ingestion_run_items`,
`source_health`, source-registry timestamps, snapshots, counters, and bounded
error diagnostics. Deduplication remains active for every scheduled record.

## Operational policy

- Respect robots.txt, access controls, rate limits, and source terms.
- Do not bypass CAPTCHA, WAF, authentication, or paywalls.
- Collect metadata and links only; PDF processing and embeddings remain
  on-demand.
- Treat `completed_with_errors` as degraded, not as a silent success.
- Alert from GitHub workflow failures and inspect `source_health` for
  consecutive failures.
# 2026-07-10 Recovery Update

Focused PRS health passed: the connector is reachable, parser shape is valid,
and the latest successful ingestion was fresh at audit time. A focused live PRS
refresh updated 10 records and found 12 PDF URLs with zero errors. Daily dry-run
completed across 11 sources with no failed or partial-failed sources.

The all-source health command can run for several minutes because it checks
every connector with retries and delay. For production triage, prefer focused
checks such as:

```bash
npm run ingest:health --prefix server -- --sources=prs-india --timeout-ms=8000 --retries=0 --limit=2 --max-pages=1 --delay-ms=0
```
