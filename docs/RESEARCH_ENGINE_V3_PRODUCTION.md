# Research Engine V3 production optimization

Phase 6 adds bounded performance controls without weakening evidence correctness. Retrieval, evidence safety, citation verification, and the legacy-compatible path remain independently controllable.

## Cache safety

The server uses bounded in-process caches for catalogue queries, retrieval, and safe repeat comparisons. Summaries remain persisted in PostgreSQL and embedding reuse remains content-hash based.

Retrieval keys include a normalized query fingerprint, document/version identity, resource hash, result limit, query type, account/private-source scope, retrieval version, embedding version, reranker version, and authority configuration version. A missing document version or missing private-account identity bypasses the cache. A changed document/resource/version therefore cannot reuse stale evidence.

Safe repeat comparison keys additionally include account identity, selected document IDs, model, prompt version, and a hash of the exact retrieved evidence. Chat responses are never blindly cached. The same question with different evidence produces a different analysis key.

Catalogue results use a 30-second freshness bucket and explicit catalogue version. This reduces repeated list/filter work while bounding staleness for newly ingested metadata.

## Conversation and evidence boundary

Conversation messages are stored as user workspace history only. Retrieval evidence is assembled independently from canonical chunks, verified graph evidence, and explicitly selected account-owned sources. Assistant messages are not indexed into canonical document chunks, vector namespaces, or knowledge evidence and never become legal proof.

## Privacy-safe telemetry

Migration 031 creates `research_query_telemetry`. It stores query IDs/types, planner and retrieval versions, stage latency, candidate/evidence counts, authority distribution, sufficiency/abstention outcomes, citation-verification counters, approximate token counts, provider models, cache status, and rollout decisions.

It does not contain raw questions, retrieved source text, assistant answers, authentication data, or secrets. Private work is marked only as `account_private`; account IDs and source IDs are not stored. Writes fail soft so telemetry cannot break research. Retention cleanup is bounded to 500 rows and runs after every 100 successful writes, removing rows older than 30 days.

## Operational dashboards

Authenticated internal endpoints:

- `GET /api/dashboard/operations` — capability-level readiness, queue state, stage failure rates, retryable/permanent failures, dead letters, documents/OCR pages/embeddings per hour, database/object/vector size signals, query telemetry, cache counters, and rollout configuration.
- `GET /api/dashboard/research-quality` — the governed synthetic CI benchmark, full grouped evaluation metrics, regression policy, and 24-hour production telemetry. It is explicitly internal and is not a marketing accuracy claim.

The processing view reports `CATALOGUED`, `RESOURCE_READY`, `TEXT_READY`, `SEARCH_READY`, `SEMANTIC_READY`, `CHAT_READY`, and `COMPARISON_READY` independently. It does not collapse corpus health into one generic ready percentage.

## Gradual rollout

`RESEARCH_V3_ROLLOUT_PERCENT` and per-feature flags control query planning, RRF, authority weighting, reranking, evidence sufficiency, citation verification, knowledge-assisted retrieval, and caching. Bucketing is deterministic per account, so a researcher does not switch paths between requests.

Recommended promotion order:

1. local/development tests;
2. RAG CI benchmark;
3. internal accounts;
4. small production percentage;
5. compare telemetry and failure labels;
6. increase percentages deliberately.

Setting a feature percentage to zero restores its legacy-compatible behavior without deleting the V3 implementation. Baselines are never updated by rollout code.

## Migration and rollback

Migration 031 is additive: one narrow telemetry table plus two indexes. It does not rewrite or delete historical document data. Rollback disables telemetry writes or the dashboard endpoints; the table can remain safely unused. Apply with `npm run db:migrate --prefix server` before deploying code that exposes the telemetry dashboard.
