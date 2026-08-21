# Rashtram AI Research Engine V3

Status: **Architecture Complete**
Production acceptance: 21 August 2026

This is the canonical high-level reference for Rashtram AI's production
research architecture. Detailed implementation and operating guidance remains
in the linked subsystem documents:

- [Processing architecture](PROCESSING_ARCHITECTURE_REPORT.md)
- [Retrieval Engine V3](RETRIEVAL_ENGINE_V3.md)
- [Evidence Safety V1](EVIDENCE_SAFETY_V1.md)
- [Knowledge Layer V1](KNOWLEDGE_LAYER_V1.md)
- [RAG Eval V1](RAG_EVAL_V1.md)
- [Semantic Coverage V1](SEMANTIC_COVERAGE_V1.md)
- [Production optimization](RESEARCH_ENGINE_V3_PRODUCTION.md)
- [Operations runbook](OPERATIONS_RUNBOOK.md)

## A. Architecture

Rashtram AI stores canonical public-policy records and processing state in
Neon PostgreSQL, preserves large source artifacts in object storage, indexes
lexical evidence in PostgreSQL and current semantic vectors in Pinecone, and
uses Gemini for embeddings and grounded generation. Deterministic planning
chooses the smallest retrieval path suitable for the question. Evidence from
metadata, FTS, vectors, the verified graph, and account-scoped researcher
sources is fused, bounded, checked for sufficiency, and cited before release.

```text
                    GOVERNMENT SOURCES
                           │
                           ▼
                 DISCOVERY / CONNECTORS
                           │
                           ▼
                  NORMALIZATION / DEDUP
                           │
                           ▼
                 CANONICAL POSTGRESQL
                           │
                    PRIORITY PLANNER
                           │
              ┌────────────┼─────────────┐
              │            │             │
             P0           P1          P2/P3
              └────────────┼─────────────┘
                           ▼
                        RESOURCE
                           ↓
                          FETCH
                           ↓
                         HASHING
                           ↓
                        EXTRACTION
                           ↓
                    PAGE-LEVEL OCR
                           ↓
                   STRUCTURAL CHUNKS
                           ↓
                  POSTGRESQL FTS INDEX
                           ↓
                      SEARCH_READY
                           ↓
                       EMBEDDINGS
                           ↓
                       PINECONE
                           ↓
                    RETRIEVAL PROBE
                           ↓
                    SEMANTIC_READY
                           ↓
                   KNOWLEDGE EXTRACTION
                           ↓
                    KNOWLEDGE LAYER
```

```text
                     USER QUESTION
                          │
                          ▼
                    QUERY PLANNER
                          │
            ┌─────────────┼──────────────┐
            ▼             ▼              ▼
       METADATA/FTS    KNOWLEDGE       VECTOR
            └─────────────┼──────────────┘
                          ▼
                   CANDIDATE EVIDENCE
                          ↓
                         RRF
                          ↓
                       RERANKER
                          ↓
                  AUTHORITY SIGNAL
                          ↓
                 EVIDENCE SUFFICIENCY
                          │
                    ┌─────┴─────┐
                    │           │
                INSUFFICIENT  SUFFICIENT
                    │           │
                 ABSTAIN         ▼
                              GEMINI
                                ↓
                         CLAIM EXTRACTION
                                ↓
                       CITATION VERIFICATION
                                │
                         ┌──────┴──────┐
                         │             │
                      UNSAFE          SAFE
                         │             │
                   REPAIR/ABSTAIN   RESPONSE
```

## Architectural invariants

- **Source truth:** official documents are authoritative.
- **Knowledge:** knowledge helps discovery; it does not replace evidence.
- **Semantic readiness:** Pinecone writes alone are insufficient; current
  hashes, namespace, physical vectors, and retrieval verification are required.
- **Search readiness:** lexical research remains valid without semantic
  indexing. `SEARCH_READY` does not require `SEMANTIC_READY`.
- **Evidence safety:** unsupported material claims are repaired or removed.
- **Abstention:** insufficient evidence is a valid, expected outcome.
- **Privacy:** private researcher sources remain account scoped in retrieval,
  vectors, caches, telemetry, and persisted conversations.
- **Memory:** assistant conversation history is not legal evidence.

## B. Processing

Processing is a resumable state machine with priority scheduling, worker
leases, heartbeats, stale-worker recovery, bounded retries and dead-letter
states. Resource, text, chunk and embedding hashes prevent repeated work.
Readable pages use native extraction; OCR is page-scoped and used only when
required. Capability flags are independent so a document can remain
searchable when Gemini or Pinecone is unavailable.

Capacity is checked before and between bounded groups. The database pause
threshold remains 82% and the current effective safe group is 25. Semantic
backfill reuses valid chunks and vectors and never repeats download,
extraction, OCR or chunking for valid artifacts. Three consecutive provider or
vector failures stop a batch.

## C. Retrieval

The planner routes `METADATA`, `EXACT_REFERENCE`, `FACTUAL`, `SEMANTIC`,
`RELATIONSHIP`, `TIMELINE`, `COMPARISON`, `COMPLIANCE`, and
`POLICY_ANALYSIS`. Metadata queries avoid embeddings. Exact provision queries
use structural identifiers plus bounded PostgreSQL web-search FTS. Broader
questions may add Gemini/Pinecone semantic candidates. Verified graph and
knowledge nodes can discover candidate documents but final claims must return
to original source passages.

Candidates are combined with reciprocal-rank fusion, bounded reranking and an
authority signal. Authority can distinguish two relevant sources; it cannot
make irrelevant evidence relevant. Comparison keeps per-document identity so
D1/D2 citations cannot be silently merged.

## D. Trust

Evidence sufficiency is evaluated before generation. Insufficient evidence
abstains; conflicting evidence exposes both positions. Generation is grounded
in retrieved passages, followed by material-claim extraction, citation and
numeric verification, and at most one bounded repair attempt. A Gemini failure
returns a safe source-only result rather than an unsupported synthesis.

## E. Knowledge

Evidence-backed nodes cover concepts, definitions, obligations, rights,
prohibitions, exemptions, penalties, procedures, authorities, industries,
jurisdictions, schemes, requirements and entities. Nodes retain source
evidence and verification state. They guide discovery and query expansion but
are never treated as final legal authority.

## F. Evaluation

The unchanged CI fixture reports:

| Metric | Result |
|---|---:|
| Recall@10 | 1.000 |
| MRR | 0.875 |
| nDCG@10 | 0.724085 |
| Citation precision | 1.000 |
| Citation recall | 1.000 |
| Unsupported material claim rate | 0.000 |
| Abstention precision | 1.000 |
| Abstention recall | 1.000 |

Composition is exactly five `AUTO_GENERATED_DRAFT`, zero
`INTERNAL_REVIEWED`, and zero `EXPERT_VERIFIED` cases. These values are a
stable engineering regression baseline, not evidence of legal accuracy.

The next evaluation project should recruit domain reviewers and distribute
cases across Acts, Bills, Rules, Gazette, regulators and state sources; include
exact-reference, semantic, relationship, comparison and compliance questions;
and include answerable, unanswerable and conflicting-evidence cases.

## G. Semantic corpus

| Measure | Before completion | After completion |
|---|---:|---:|
| Active semantic documents | 31 | 192 |
| Effective search-ready coverage | 0.99% | 6.12% |
| Search-ready documents | 3,138 | 3,138 |
| P1 backlog | 145 | 5 oversized |
| P2 backlog | 2,962 | 2,941 (untouched by rollout) |

The architecture run indexed 140 P1 documents after the initial baseline. All
passed physical write and retrieval verification. Five Gazette documents with
105–617 chunks remain search-ready and deferred by the automatic 100-chunk
ceiling. No ceiling or safety threshold was relaxed.

Readiness reconciliation produced 192 flagged and 192 derived active semantic
documents: difference zero. All 2,044 current PostgreSQL vector references are
present in Pinecone. Three vector-only records for non-public document 1734 are
quarantined, not destructively removed. Old/unversioned provenance is retained
as historical/rollback metadata and no longer makes a document ready.

## H. Infrastructure

- **Neon PostgreSQL:** connected and healthy; approximately 486.3 MB used
  against provider-reported capacity of about 16 TiB. The independent 82%
  application pause threshold remains enforced; safe batch 25.
- **Pinecone:** both configured indexes reachable; active Gemini namespace has
  2,047 records, including the three deferred historical records above.
- **Gemini:** generation, embedding and streaming health checks pass with
  `gemini-2.5-flash` and `gemini-embedding-001`.
- **Object storage:** Backblaze B2 read/write, checksum and byte-equality checks
  pass; 25 sampled references verified and no test artifact remained.

No database migration was required for completion.

## I. Performance

A production-safe document probe recorded:

| Route | Retrieval behavior | Total |
|---|---|---:|
| Metadata | metadata only; no vector | 5 ms |
| Exact reference | FTS 9; no vector/local fallback | 919 ms |
| Semantic | FTS 8 + vector 9; RRF/rerank to 6 | 3,916 ms |
| Relationship | metadata 1 + FTS 2 + local 9 | 791 ms |
| Timeline | metadata 1 + FTS 6 | 304 ms |
| Compliance/policy | local 9 + vector 9 | 1,667 ms |

The semantic route was dominated by the 3,913 ms vector/provider stage.
Comparison, evidence safety, conflicts, fallback and account isolation are
covered by acceptance tests; no invented production latency is reported for a
flow without a comparable read-only timing sample.

## J. Resource economics

Across 140 rollout documents: 1,598 vectors, 1,762,658 recorded embedding-input
tokens, about 549 KiB observed database allocation and 1,256.9 seconds of
processing. Empirical means are 11.41 vectors, 12,590 tokens, approximately
3.9 KiB observed database allocation, and 8.98 seconds per document. Database
allocation is noisy because PostgreSQL allocates pages and catalogue ingestion
was concurrent.

Projections use those means and are planning estimates, not recommendations or
provider-price estimates:

| Coverage target | More docs | Vectors | Tokens | DB allocation | Sequential time |
|---:|---:|---:|---:|---:|---:|
| 10% | 122 | ~1,393 | ~1.54m | ~0.48 MB | ~18 min |
| 25% | 593 | ~6,768 | ~7.47m | ~2.32 MB | ~1.48 h |
| 50% | 1,377 | ~15,715 | ~17.34m | ~5.40 MB | ~3.43 h |
| 75% | 2,162 | ~24,677 | ~27.22m | ~8.48 MB | ~5.39 h |
| 100% | 2,946 | ~33,624 | ~37.09m | ~11.55 MB | ~7.35 h |

P2 must not be processed automatically. Future selection should prioritize
observed demand, authority, primary-source gaps, regulatory recency, comparison
demand, knowledge relevance, document quality, and expert-benchmark coverage.

## K. Legacy review and remaining risks

| Path | Classification | Decision |
|---|---|---|
| Legacy candidate merge behind feature flags | `ACTIVE_COMPATIBILITY` | Keep for rollback |
| Exported legacy `retrievePassages` wrapper | `ACTIVE_COMPATIBILITY` | Keep while callers/tests exist |
| Legacy processing tables/triggers | `ACTIVE_COMPATIBILITY` | Current callers prohibit removal |
| `embeddings:recover` entrypoint | `SAFE_TO_DEPRECATE` | Delegates to V3; retain alias now |

Nothing is `SAFE_TO_REMOVE` with sufficient production proof in this release.

Remaining risks are corpus and governance work rather than a reason to add a
fourth architecture: semantic coverage is still 6.12%; P2 contains 2,941
records; five oversized P1 documents need an explicit large-document policy;
state and primary-source coverage remains uneven; temporal/version legal
reasoning needs deeper expert evaluation; the benchmark has no expert-verified
cases; three quarantined historical vectors need a retention decision; and
compatibility paths still require caller retirement evidence.

The frontend production audit also reports four high-severity transitive
advisories in the Next.js 15 dependency chain after upgrading to the latest
compatible 15.5 patch. The automatic fix requires the explicitly out-of-scope
Next.js 16 migration. Backend production dependencies report zero known
vulnerabilities. This dependency work must be handled in a separate tested
framework-upgrade release.

## L. Production acceptance

- Backend: 402 tests, 401 passed, one intentional skipped write fixture.
- Frontend: 4 tests passed; lint and production build passed.
- Database integrity: 23/23 checks passed; latest migration 032.
- Processing V3, Retrieval V3, Evidence Safety, Knowledge Layer, semantic
  coverage, degradation fallback, comparison isolation, private-source
  isolation and cache safety acceptance tests passed.
- RAG CI passed without modifying its baseline.
- Gemini generation, embeddings and streaming passed health checks.
- PostgreSQL, Pinecone and B2 checks passed as described above.
- Secret scan found no committed live credential; tracked environment files are
  examples only.
- Concurrency, retry, network-loop and telemetry boundaries remain bounded.

Operational telemetry exposes corpus capabilities, semantic coverage and
backlogs, processing stages and failures, research strategies and latency,
evidence sufficiency and citation outcomes, cache status, and evaluation
metrics. Raw questions, source passages, assistant answers and account secrets
are not added to aggregate semantic telemetry.

Rollback is code-first: revert the release commit and redeploy. The data changes
are additive embeddings plus truth-correct capability flags; canonical text and
historical provenance were not deleted. Semantic failure preserves PostgreSQL
lexical `SEARCH_READY` retrieval.

## Architecture freeze

**Research Engine V3 — Architecture Complete**

Do not add another retrieval architecture, vector database, knowledge
representation, or query planner without measured evaluation evidence of a
specific deficiency. The next work should focus on corpus quality, expert
evaluation, primary sources, temporal legal intelligence, product workflows,
and commercial pilots.
