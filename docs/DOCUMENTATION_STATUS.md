# Documentation status

The canonical current-status document is `CURRENT_PLATFORM_AUDIT.md`. Numeric metrics must be regenerated before external reuse.

Documents whose titles include `REPORT`, `AUDIT`, `MIGRATION`, `RECOVERY`, `IMPROVEMENTS`, or `V1` often describe a dated implementation phase. They are retained as engineering history, not as proof of the current deployment. Where they conflict with current code, database evidence, or `CURRENT_PLATFORM_AUDIT.md`, the current evidence prevails.

Current operational references:

- `CURRENT_PLATFORM_AUDIT.md`
- `DEPLOYMENT_GUIDE.md`
- `OPERATIONS_RUNBOOK.md`
- `DATA_SOURCE_LIMITATIONS.md`
- `RESEARCH_READINESS.md`
- `RESEARCH_BENCHMARK_RESULTS.md`
- `EMBEDDING_PROVIDER_STRATEGY.md`
- `HUMAN_REVIEW_GUIDE.md`

Known superseded references:

- `OPENAI_MIGRATION.md` records an earlier OpenAI phase; production is Gemini-first.
- Historical processing reports carrying 1,485 or 1,528 ready records are snapshots, not current counts.
- The 30-question 0.94/0.70 benchmark is an earlier regression run.
- The reported 50-question 1.0 result is a self-seeded catalogue resolver regression, not independent legal accuracy.

No historical report should be sent externally without checking it against the current audit.

