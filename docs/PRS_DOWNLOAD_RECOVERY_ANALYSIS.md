# PRS Download Recovery Analysis

Last updated: 2026-07-13

## Scope

This analysis covers the remaining PRS-related download failures after document acquisition hardening commit `b4771a7`.

The recovery phase used source-aware retry controls. It did not retry the full PRS backlog.

## Current PRS failure shape

Read-only production analysis shows the remaining PRS failures are concentrated in direct-PDF bill URLs.

| URL pattern | Type | Year | Failure code | Documents | Retry count range |
| --- | --- | ---: | --- | ---: | --- |
| direct PDF | bill | 2025 | `DOWNLOAD_SERVER_ERROR` | 256 | 3–3 |
| direct PDF | bill | 2026 | `DOWNLOAD_SERVER_ERROR` | 83 | 3–4 |
| direct PDF | bill | 2023 | `DOWNLOAD_SERVER_ERROR` | 25 | 3–3 |
| direct PDF | bill | 2025 | `DOWNLOAD_NOT_FOUND` | 21 | 1–3 |
| direct PDF | bill | 2024 | `DOWNLOAD_SERVER_ERROR` | 5 | 3–3 |
| direct PDF | bill | 2019 | `DOWNLOAD_SERVER_ERROR` | 1 | 6–6 |
| direct PDF | bill | 2011 | `DOWNLOAD_SERVER_ERROR` | 1 | 3–3 |
| direct PDF | bill | 2010 | `DOWNLOAD_SERVER_ERROR` | 1 | 3–3 |

Observed classification:

- Transient upstream failure: likely for the `DOWNLOAD_SERVER_ERROR` group, but not safe to retry indefinitely.
- Permanent not found: `DOWNLOAD_NOT_FOUND`.
- Rate limiting: not directly observed in stored failure codes during this run.
- URL-construction defect: not proven in this sample; all selected PRS Batch A URLs were direct-PDF pattern.
- Source-page parsing defect: not proven in this sample.
- Access restriction: not the dominant PRS failure in this sample.
- Unknown upstream/later-stage failure: observed after Batch A partial recoveries.

## Source-aware PRS retry policy

Conservative PRS defaults used:

| Setting | Value |
| --- | ---: |
| Domain concurrency | 1 |
| Minimum interval | 2500 ms |
| Cooldown | 1800 seconds |
| Window | 60 minutes |
| Max attempts per window | 25 |
| Failure-rate threshold | 0.7 |
| Minimum attempts before circuit | 5 |
| Max attempts per document | 4 |

## Batch A result

Command:

```bash
npm run process:recover-downloads --prefix server -- --batch=A --limit=25 --concurrency=1 --max-attempts=4 --resume-existing
```

Result:

- Documents selected: 25
- Documents actually processed before safety stop: 5
- Circuit-breaker activations: 1
- Circuit state after run: `cooldown`
- Cooldown until: 2026-07-13T06:19:01.697Z
- Downloads recovered far enough to create text artifacts/chunks: 4
- Newly research-ready: 0
- Remaining selected jobs not processed because of cooldown: 20

Stage evidence from inspected attempted documents:

| Document ID | Final state | Text artifact | Chunk rows | Readiness |
| --- | --- | ---: | ---: | --- |
| 390 | `UNKNOWN_PROCESSING_ERROR` | yes | 1 | not ready |
| 492 | `UNKNOWN_PROCESSING_ERROR` | yes | 10 | not ready |
| 576 | `UNKNOWN_PROCESSING_ERROR` | yes | 33 | not ready |
| 647 | `UNKNOWN_PROCESSING_ERROR` | yes | 40 | not ready |
| 668 | `DOWNLOAD_SERVER_ERROR` | no | 0 | not ready |

The four partial recoveries failed because lazy summary generation returned `null` and downstream usage code still read `summary.length`. That bug is now fixed in code, but the PRS cooldown was not bypassed for an immediate retry.

## Batch B/C decision

Batch B and Batch C were not executed.

Reason:

- Batch A hit the circuit breaker after 5 processed attempts.
- Failure rate was 100% at the worker-result level.
- A later-stage code bug was discovered and fixed.
- PRS cooldown was active.

Proceeding to Batch B or C would have violated the source-protection rules.

## Next safe action

After cooldown:

1. Resume only the existing Batch A queued jobs or a smaller reviewed subset.
2. Confirm the null-summary fix allows the four partial-recovery pattern to complete readiness checks.
3. Stop again if the circuit breaker activates.
4. Do not run Batch B until Batch A produces valid ready documents without consistency regressions.

