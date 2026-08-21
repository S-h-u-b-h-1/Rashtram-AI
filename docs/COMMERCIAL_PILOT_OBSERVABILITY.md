# Commercial Pilot Observability

The 30-day usefulness report covers research sessions, questions per session,
evidence-backed answers, abstention rate, citation and source opens, comparison
usage, compliance workflows, watchlists, reports, cross-state comparison,
time-to-first-evidence, time-to-final-answer, active/repeat users, and repeat
workflows.

Query latency is derived from the existing stage timings. First evidence is the
metadata time plus the slowest parallel retrieval branch, fusion, and reranking;
final answer adds generation and verification. This is an operational measure,
not a browser-paint measurement.

Privacy controls:

- product telemetry never stores questions or source text;
- browser session identifiers are stored only as SHA-256 fingerprints;
- metadata keys are allowlisted and bounded;
- account metrics are authenticated and scoped to the current user;
- records are deleted with the account;
- the aggregate operations report contains counts and timings only.

Run `npm run metrics:commercial-pilot --prefix server` for the aggregate report.
