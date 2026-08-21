# Retrieval Performance Optimization V1

This phase optimizes Retrieval V3 without adding a retriever, planner, vector store, or evidence path.

## Safe optimizations

- Query embeddings are cached in a bounded in-memory cache using a hash of the normalized query plus provider, model, namespace/version, and dimension. Raw questions are not cache keys or values. Concurrent identical requests are coalesced, with a maximum of 100 in-flight cache entries.
- Retrieval-result cache keys continue to include document/resource versions, retrieval versions, authority configuration, embedding version, and account/private-source scope. Degraded vector results are not cached.
- PostgreSQL lexical and vector retrieval still start concurrently.
- Candidate limits are selected by the existing query type. Comparison keeps the widest vector pool; factual, relationship, and timeline routes use smaller pools.
- If at least three lexical passages are already available, a slow vector request has a 2.5-second default wait budget. The request returns verified lexical evidence when that budget is exceeded. If lexical evidence is insufficient, retrieval waits for vector evidence rather than sacrificing quality for latency.

## Operational controls

`RETRIEVAL_VECTOR_TIME_BUDGET_MS` may be set between 500 and 10,000 milliseconds. The default is 2,500 milliseconds.

The vector provider request is not duplicated when the wait budget expires. Its settled promise is safely handled, and circuit breakers/provider timeouts remain authoritative. Exact-reference and metadata routes still make no vector call.
