# Rashtram AI — Final Research Engine V3 Audit

Date: 21 August 2026  
Branch: `main`  
Audit baseline: `0fb1fd9`  
Release head: `2f9c487`

## Executive status

Research Engine V3 remains the single canonical retrieval architecture. The final program added expert-review infrastructure, corpus authority intelligence, hierarchical large-document retrieval, temporal reasoning, bounded performance improvements, five evidence-backed product workflows, a Next.js security upgrade, and privacy-safe pilot telemetry.

The release is **production-capable with known corpus limitations**, not evidence that the system is universally correct. Lexical research remains available when semantic services fail. The most important remaining constraints are the absence of expert-reviewed benchmark cases, low semantic coverage, limited verified graph relationships, and uneven primary-source coverage.

## 1. Exact commits

1. `fd007aa` — expert benchmark review foundation
2. `1101bbe` — primary-source coverage intelligence
3. `089f01f` — hierarchical large-document retrieval
4. `08e6ae1` — effective-date legal reasoning
5. `ae8d5c0` — bounded retrieval performance optimization
6. `84a644e` — evidence-backed Compliance Copilot
7. `419b9b8` — regulatory watchlists
8. `94ddd5c` — amendment tracking
9. `f740122` — cross-state comparison
10. `3c92c84` — verified research report generation
11. `3c3ac68` — Next.js 16 security upgrade
12. `d8a766e` — privacy-safe commercial pilot observability
13. `2f9c487` — canonical research-readiness audit correction

## 2. Deployment status

- Backend deployment `dpl_G9VQFjJFLaqe5dNkYxomHaCCTcga` is `READY` and aliased to `https://rashtram-ai-backend.vercel.app`.
- Backend `/health` returns HTTP 200, database connected, Gemini generation/embedding/streaming available.
- Frontend deployment `dpl_GRgu3gQMavsF8oACBwXguKeDpM4F` built successfully with Next.js 16.3.2 and is `READY` on its team-scoped production deployment.
- `https://rashtram-ai.vercel.app` returns HTTP 200 and contains the simplified “What you get” copy, but its cache age proved that the public alias had not moved to the new deployment during this audit.
- Explicit alias promotion was attempted but could not be authorized after the execution approval quota was reached. Therefore public frontend promotion is **pending**, and is not reported as complete.

## 3. Files changed

The program changed 83 tracked files relative to `0fb1fd9`, covering:

- retrieval planning, caching, telemetry, large-document and temporal services;
- benchmark schemas, review CLI, evaluation reports, and tests;
- product services and routes for compliance, alerts, amendments, state comparison, and reports;
- additive database migrations 033–039;
- frontend API and workflow surfaces;
- Next.js dependencies and ESLint configuration;
- implementation and operations documentation.

No unrelated user-owned `.codex/` content was committed.

## 4. Migrations

- `033_large_document_intelligence`
- `034_temporal_legal_intelligence_v1`
- `035_compliance_copilot_v1`
- `036_regulatory_watchlists_v1`
- `037_cross_state_comparisons_v1`
- `038_research_reports_v1`
- `039_commercial_pilot_observability`

All are additive and were applied to production. Database verification reported zero failed migrations through 039.

## 5. Benchmark changes

The evaluation layer now has explicit maturity states, a versioned schema, reviewer guidance, review-pack export, category/source/jurisdiction segmentation, and separation between automatic engineering fixtures and expert-verified cases. The five-case CI fixture remains a regression guard only.

## 6. Benchmark composition by maturity

- `AUTO_GENERATED_DRAFT`: 5
- human reviewed: 0
- expert verified: 0
- adjudicated: 0

No legal-accuracy claim is made from the automatic fixture. The next required program is 250–500 expert-reviewed questions across document types and query classes.

## 7. Primary-source coverage before/after

Measured production baseline after the authority audit:

- public catalogue documents: 19,911
- resource-backed documents: 18,884
- primary-source documents: 960
- primary-source coverage: 4.82%
- primary-source gaps ranked for review: 2,941

The phase introduced measurement, preference mapping, quality scoring, and deterministic P2 ranking. It intentionally processed zero P2 documents. Coverage therefore did not materially change, by design.

## 8. Semantic coverage before/after

- search-ready: 3,138
- semantic-ready: 192
- semantic coverage of search-ready corpus: 6.12%
- P1 large-document semantic work completed selectively; P2 remained demand-driven.

The final namespace audit found PostgreSQL active vector references and Pinecone active records differed by 19 and marked namespace health false. Lexical fallback remains operational, but semantic corpus reconciliation is still required.

## 9. Large-document results

Gazette document 20582 was indexed hierarchically:

- 105 child chunks grouped into 9 retrieval routes;
- 91.43% reduction in first-stage vector candidates;
- final citations preserve original child/source identity;
- ordinary documents retain the existing 100-chunk ceiling.

This validates selective hierarchical retrieval without globally increasing vector cost.

## 10. Temporal reasoning examples

The planner recognizes questions such as “What applied on 1 January 2025?”, “Which version applied during FY 2024–25?”, and “Was this rule still in force before 2026?”. Publication dates do not establish legal effect. Effective dates, commencement, expiry, supersession, and version relationships remain separate and are used only when explicitly source-backed. Missing evidence returns an unknown/applicability limitation rather than a guessed answer.

## 11. Retrieval performance before/after

For a matching production probe on document 23963:

- before: 5,356 ms
- after: 3,038 ms
- improvement: 43.3%
- lexical evidence retained: 6 passages

The optimization uses query-embedding coalescing/cache, parallel retrieval, dynamic candidate limits, and a 2.5-second bounded vector wait when lexical evidence is sufficient. It does not add a second retrieval architecture.

## 12. Compliance workflow acceptance

Compliance Copilot is account-owned and persists directly to PostgreSQL. It returns cited obligations, authorities, deadlines, evidence gaps, and conditional applicability. It does not infer that a missing penalty passage means no penalty, and it presents research assistance rather than legal advice. Automated acceptance tests passed.

## 13. Watchlist acceptance

Watchlists and alerts are account-owned. Alerts require source name and source URL and use exact regulator/ministry/state/jurisdiction/document matching plus bounded literal topic/industry matching. Vector similarity alone cannot create an alert. Automated acceptance tests passed.

## 14. Amendment tracker results

The tracker uses verified document relationships only and preserves before/after source identity. When historical text is absent it returns: “Historical text unavailable from currently verified sources.” It does not synthesize missing versions. The graph audit found six amendment relationships, but zero source-verified relationships overall; production amendment depth is therefore limited by graph provenance.

## 15. Cross-state comparison results

Each state is retrieved independently with exact jurisdiction isolation. Missing evidence is labelled “not found in current corpus,” never “does not apply.” State, document, passage, and source identity are retained. Automated acceptance tests passed.

## 16. Research report results

Reports preserve exact citation identity in stored output and downloadable PDF. Sections without evidence state “Insufficient verified evidence.” Comparison has a one-click report download. Automated report and citation-retention tests passed.

## 17. Dependency and security status

- Next.js upgraded from 15.5.23 to 16.3.2.
- React and React DOM are pinned to 19.2.8.
- frontend production dependency audit: 0 vulnerabilities.
- the official asynchronous request API codemod dry-run found no required changes across 195 files.
- tracked-secret scan found only examples, provider-error sanitization, and explicit security/database test fixtures; no production credential was found in tracked source.

Credentials previously shared outside the repository should still be rotated because chat or terminal disclosure is separate from Git safety.

## 18. Backend tests

- total: 456
- passed: 455
- failed: 0
- skipped: 1 intentional database-write fixture
- duration: approximately 2.1 seconds

## 19. Frontend tests

- total: 4
- passed: 4
- failed: 0

## 20. Lint

ESLint exits successfully with 0 errors and 9 warnings. The warnings are existing hook-dependency, internal-navigation, and unoptimized-image warnings. They are not release blockers but should be resolved in a focused frontend cleanup.

## 21. Production build

Next.js 16.3.2 production build succeeds. All 22 static/dynamic route entries compile and page generation completes successfully, locally and in Vercel.

## 22. Database integrity

Production audit after correcting the obsolete audit predicate:

- documents: 19,949
- research-ready: 3,138
- low-quality rows: 38
- missing source: 0
- broken resource rows: 0
- orphan sources/resources/messages: 0
- exact duplicate canonical IDs: 0
- invalid research-ready rows: 0
- probable duplicate groups: 1,184 covering 2,586 records
- pending match reviews: 46

The latest retained capacity measurement was approximately 485 MB against a 16 TiB provider ceiling. The final capacity command succeeded, but its concise storage summary was not retained in the final console capture, so no newer exact byte count is claimed.

## 23. Production health

Backend health at audit time:

- HTTP: 200
- database: connected
- AI provider: Gemini
- generation: available
- embedding: available
- streaming: available
- measured provider latency: generation 644 ms, embedding 203 ms, streaming 574 ms

Public frontend health:

- HTTP: 200
- Rashtram AI branding present
- simplified “What you get” copy present
- latest frontend alias promotion pending as described in section 2

## 24. Privacy and security checks

- product data is account-scoped;
- commercial telemetry excludes raw questions and source text;
- session identity is hashed and metadata is allowlisted;
- unauthenticated product and activity routes are rejected;
- database query inputs remain parameterized;
- generation rate limiting keys by authenticated account;
- 5xx responses redact internal errors and return request IDs;
- no private keys or production credentials were added to source.

## 25. Known limitations

1. Zero expert-reviewed benchmark cases; current metrics prove engineering regression safety, not universal legal correctness.
2. Semantic coverage is 6.12% of search-ready documents and vector namespace reconciliation is unhealthy by 19 records.
3. Primary-source coverage is 4.82%; 2,941 ranked gaps remain.
4. Graph coverage is 2.4%, with zero source-verified relationships in the final graph audit.
5. Many temporal fields are absent in the current corpus, so time-aware answers correctly return unknown frequently.
6. New commercial telemetry began at zero and has no fabricated historical backfill.
7. New product tables are initially empty until users run workflows.
8. The requested public frontend alias still needs promotion to the verified new frontend deployment.
9. Nine non-blocking frontend lint warnings remain.

## 26. Rollback instructions

Application rollback is independent from additive data migrations:

1. Identify the last known-good frontend/backend deployments in Vercel.
2. Repoint each production alias with Vercel rollback or promote the known-good deployment.
3. If a source-code rollback is required, create a revert commit for the affected phase commit on `main`; do not reset shared history.
4. Keep migrations 033–039 in place. They are additive and older application code can ignore the new tables/columns.
5. Disable individual product routes in the application before considering schema removal.
6. Do not drop product tables until retention/export requirements are reviewed and a separate destructive migration is approved.
7. After rollback, rerun backend tests, frontend tests, lint, build, database verification, `/health`, and the five-case RAG regression fixture.

## Final classification

- Core Research Engine V3 architecture: **verified and frozen**
- Processing and lexical fallback: **verified**
- Retrieval regression quality: **verified on automatic engineering fixture only**
- Expert legal/policy accuracy: **not yet established**
- Large-document architecture: **verified on canary**
- Temporal reasoning: **implemented; corpus-limited**
- Product workflows: **implemented and test-verified; pilot usage not yet established**
- Backend production deployment: **complete**
- Public frontend deployment: **build complete; requested alias promotion pending**
