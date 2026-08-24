# Rashtram AI — Production Completion Tracker 2026

**Baseline:** `docs/FULL_PLATFORM_AUDIT_2026.md`  
**Started:** 24 August 2026  
**Rule:** An issue is not closed until the relevant production workflow is verified.

| ID | Severity | Feature | Root cause | Current status | Fix and regression evidence | Production evidence | Remaining limitation |
|---|---:|---|---|---|---|---|---|
| RA-001 | S1 | Compliance safety | Retrieval candidates were allowed to satisfy the workflow without primary-official normative evidence | FIXED_LOCALLY | Compliance output now requires relevant, normative, primary-official passages; descriptive and secondary-only fixtures abstain | Pending Release A deployment | Authority/currentness coverage still depends on connectors |
| RA-002 | S1 | Current-status truth | Catalogue status and temporal evidence reached chat through separate contracts | FIXED_LOCALLY | Canonical temporal resolver prefers dated lifecycle facts and labels undated catalogue status as unverified; current-status retrieval fixture added | Pending Release A deployment | Some records lack source-backed lifecycle dates |
| RA-003 | S1 | Comparison citations | Final SSE metadata replaced earlier sources with an empty array | FIXED_LOCALLY | Stream metadata now merges and preserves non-empty sources; frontend regression added | Pending Release A deployment | Production comparison chat must confirm visible sources |
| RA-004 | S1 | Comparison quality/latency | Retrieval/generation output and latency | OPEN | — | — | — |
| RA-005 | S1 | Processing throughput | Worker/queue operation and contradictory state | OPEN | — | — | — |
| RA-006 | S1 | Related reading | Sparse semantic coverage and strict/no fallback ranking | OPEN | — | — | — |
| RA-007 | S1 | Knowledge discovery | PostgreSQL `UNNEST` token alias was treated as a record in `LENGTH()`/`ILIKE` | FIXED_LOCALLY | SQL now names the scalar column `tokens(token)`; SQL-contract regression added | Pending Release A deployment | Knowledge corpus remains sparse |
| RA-008 | S1 | Semantic coverage | Active namespace coverage/backfill | OPEN | — | — | — |
| RA-009 | S1 | Connector freshness | Multiple upstream/parser/operation failures | OPEN | — | — | — |
| RA-010 | S2 | Processing consistency | Retry/readiness state drift | OPEN | — | — | — |
| RA-011 | S2 | Compliance currentness | Old/draft sources can appear without verified current authority | PARTIALLY_FIXED | Compliance no longer completes without primary-official normative evidence | Pending Release A deployment | Latest-source verification still constrained by connector health |
| RA-012 | S2 | Cross-state coverage | Retrieval coverage | OPEN | — | — | — |
| RA-013 | S2 | PDF quality | OCR/extraction quality gating | OPEN | — | — | — |
| RA-014 | S2 | Official HTML | Generic extraction/site adapters | OPEN | — | — | — |
| RA-015 | S2 | Metadata taxonomy | Source/ministry aliases | OPEN | — | — | — |
| RA-016 | S2 | Duplicates | Probable-duplicate review backlog | OPEN | — | — | — |
| RA-017 | S2 | Type classification | Ingestion classification | OPEN | — | — | — |
| RA-018 | S2 | Dashboard freshness | Temporal aggregation/cache | PARTIALLY_FIXED | Canonical temporal resolver introduced for research path | Pending | Dashboard adoption still required |
| RA-019 | S2 | QA benchmark | Small auto-generated dataset | OPEN | — | — | — |
| RA-020 | S2 | Performance | Comparison/chat/history latency | OPEN | — | — | — |
| RA-021 | S2 | Object storage | Provider not configured | BLOCKED_EXTERNALLY | — | — | Requires an object-storage resource and credentials |
| RA-022 | S2 | Corpus counts | Inconsistent scope contracts | OPEN | — | — | — |
| RA-023 | S2 | Knowledge graph coverage | New graph layer empty | OPEN | Query path fixed locally | Pending | Population remains incomplete |
| RA-024 | S2 | Temporal metadata | Missing lifecycle events | PARTIALLY_FIXED | Undated status is now surfaced with an explicit verification limitation | Pending | Source-backed event ingestion still required |
| RA-025 | S3 | Frontend warnings | Lint/module warnings | OPEN | — | — | — |

## Release A — Safety

- Compliance safety gate implemented.
- Canonical current-status evidence implemented.
- SSE citation preservation implemented.
- Knowledge discovery SQL regression fixed.
- Targeted backend tests: 39 passed, 0 failed.
- Frontend tests: 16 passed, 0 failed.
- Production deployment and smoke test: pending.
