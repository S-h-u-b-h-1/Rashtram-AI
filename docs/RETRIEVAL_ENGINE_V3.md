# Rashtram Retrieval Engine V3

## Purpose

Retrieval Engine V3 keeps Rashtram AI's existing hybrid retrieval and makes it selective, explainable, and resilient. It does not replace PostgreSQL full-text search, Pinecone semantic search, the verified relationship graph, or private researcher sources. It routes each question to the smallest set of systems that can answer it reliably.

## Query planning

Every request is deterministically classified as one of:

- `METADATA`
- `EXACT_REFERENCE`
- `FACTUAL`
- `SEMANTIC`
- `RELATIONSHIP`
- `TIMELINE`
- `COMPARISON`
- `COMPLIANCE`
- `POLICY_ANALYSIS`

Metadata questions use canonical catalogue fields. Exact section, article, clause, and rule questions use PostgreSQL lexical and structural evidence without requiring a vector call. Factual questions begin with PostgreSQL and add semantic search only when evidence is insufficient. Semantic, policy, compliance, and comparison questions use bounded hybrid retrieval. Relationship and timeline questions also request verified graph evidence.

## Ranking stages

1. Each enabled retriever returns a bounded candidate list.
2. Reciprocal rank fusion merges candidates using `documentId:chunkIndex` identity.
3. Duplicate chunks are removed while the richest citation coordinates and strongest scores are preserved.
4. A deterministic reranker combines semantic similarity, lexical overlap, full-text rank, exact legal identifiers, RRF rank, and a small relevance-gated authority signal.
5. The final set is limited to 5–10 passages and near-duplicate passages are removed from the prompt context.

Authority classes are `PRIMARY_OFFICIAL`, `OFFICIAL_SECONDARY`, `INSTITUTIONAL`, `RESEARCH`, `USER_SOURCE`, and `UNKNOWN`. Authority can break close relevance ties; it cannot promote an irrelevant passage above clearly relevant evidence.

## Failure behaviour

Pinecone and embedding failures are isolated. When semantic retrieval is unavailable, PostgreSQL full-text and stored document chunks remain available, and `search_ready` is not altered. Exact-reference and metadata queries do not depend on Pinecone.

Private uploaded PDFs and links remain restricted by `research_sources.user_id` plus the selected source IDs. They are labelled `USER_SOURCE` and are never searched across accounts.

## Observability and privacy

Each retrieval emits structured diagnostics containing:

- query type and selected strategy;
- per-stage latency;
- candidate and final counts;
- bounded top-ranking scores;
- source-authority distribution;
- retrieval, fusion, embedding, vector-namespace, reranker, and planner versions;
- semantic degradation status.

Diagnostics do not log raw questions, source text, account IDs, tokens, or credentials. The requesting user receives the same bounded diagnostics in chat metadata. Comparison diagnostics are saved with that user's comparison record.

## Configuration

All candidate limits, context budget, RRF constant, and authority weights are bounded and configurable through the variables documented in `server/.env.example`. Defaults are safe for production and deliberately keep reranking to a small candidate pool.

## Compatibility

Existing document-chat, multi-document chat, comparison, and legacy `retrievePassages` contracts remain available. The V3 diagnostics are additive.

## Acceptance coverage

`server/test/retrievalEngineV3.test.js` verifies deterministic planning, exact-reference vector avoidance, structured metadata retrieval, hybrid semantic retrieval, graph routing, RRF deduplication, authority behaviour, bounded reranking, comparison identity, semantic outage fallback, dynamic context deduplication, account isolation, and legacy API compatibility.

The concurrency acceptance test confirms that lexical and vector retrieval start together for hybrid queries. A production latency benchmark needs representative authenticated traffic and is intentionally not inferred from unit-test timings.

## Current limitations

- V3 uses a deterministic bounded reranker rather than a separate neural reranking provider.
- Source authority is inferred from explicit source metadata and recognised domains; unknown sources remain eligible based on relevance.
- The full claim-verification layer is deliberately outside this phase.
