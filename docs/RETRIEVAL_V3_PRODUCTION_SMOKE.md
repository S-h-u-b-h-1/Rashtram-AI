# Retrieval Engine V3 Production Smoke Verification

Verified on 21 August 2026 against the production PostgreSQL corpus, configured Gemini embedding provider, active Pinecone namespace, and deployed Vercel health endpoint.

## Deployment status

- Retrieval V3 commit `a778a4e` is contained in the current `main` history and in the production backend release.
- The production backend health endpoint returned HTTP 200 with PostgreSQL connected and Gemini generation, embedding, and streaming available.
- The production frontend returned HTTP 200.
- The authenticated research endpoints could not be exercised through the browser because the test browser was signed out. No production user or account selection was created for this verification.
- Retrieval requests were therefore run through the repository's read-only production service path using the same production PostgreSQL, Gemini, Pinecone, planner, fusion, reranker, and authority code as the API.

## Representative retrieval results

| Case | Document | Planner decision | Retrieval | Candidates | Final | Representative latency |
| --- | --- | --- | --- | --- | --- | --- |
| Metadata | Prevention of Corruption (Amendment) Bill, 2013 | `METADATA` | metadata only | metadata 1; vector 0 | 1 | 5 ms |
| Exact reference | same document, clause 1 | `EXACT_REFERENCE` | PostgreSQL FTS + bounded stored-text fallback; vector disabled | lexical 1; local 16; vector 0 | 8 | 474 ms |
| Semantic | Indian Medical Council (Amendment) Bill, 2013 | `SEMANTIC` | hybrid | local 7; vector 7; fused 7 | 7 | 4,038 ms |
| Relationship | Prevention of Corruption (Amendment) Bill, 2013 | `RELATIONSHIP` | metadata + lexical/local + verified-graph request | graph 0; vector 0 | 8 text passages | 738 ms |
| Policy analysis | Indian Medical Council (Amendment) Bill, 2013 | `POLICY_ANALYSIS` | hybrid + verified-graph request | metadata 1; local 7; vector 7; fused 8 | 8 | 1,112 ms |

The exact-reference test exposed and fixed a planner edge case for parenthesized and decimal clause references. `clause (2)`, `clause 2.30`, and nested forms such as `section 14(2)(a)` now route to `EXACT_REFERENCE` and avoid Pinecone.

Citation coordinates retained stored page estimates, section titles/identifiers, clause identifiers, and chunk identifiers. Where structural metadata was absent, the retrieval response left it absent rather than fabricating a value.

## Comparison isolation

Two production documents were retrieved independently under the `COMPARISON` plan. The first document produced `D1-C1` through `D1-C6` tied only to document 555. The second produced `D2-C1` through `D2-C6` tied only to document 552. Equal chunk indexes did not merge across documents.

## Pinecone degradation and coverage

The active namespace is `gemini-embedding-001-768-v1`.

- Public search-ready documents: 3,138
- Documents marked semantic-ready: 1,573
- Documents with chunks recorded in the active namespace: 31
- Chunks recorded in the active namespace: 310 of 23,349

This confirms that Pinecone is operational but active-namespace corpus coverage is limited. One sampled active document returned seven semantic candidates and genuine hybrid retrieval. Other documents returned no semantic candidates and continued through PostgreSQL without endpoint failure.

The automated failure test deliberately throws from the vector adapter and verifies that PostgreSQL lexical evidence, `retrievalVerified`, and search readiness remain intact. Production Pinecone was not intentionally disrupted.

Embedding recovery must continue as a bounded background operation. It is not a prerequisite for `SEARCH_READY` and must remain subject to the existing provider, time, cost, and capacity controls.

## Relationship evidence

Production currently contains 1,172 relationship rows, but none are marked source-verified under the graph verification policy. The relationship smoke query therefore requested graph retrieval but correctly returned no graph evidence. Inferred rows were not presented as verified legal facts, and final evidence came from the underlying document passages.

The automated graph acceptance test confirms that only `isVerified` relationships can enter grounded graph context.

## Diagnostics and privacy

The smoke output included:

- query type and strategy;
- metadata, lexical, local, vector, fused, and final counts;
- metadata, lexical, vector, local, rerank, and total latency where applicable;
- retrieval, fusion, reranker, embedding, namespace, and planner versions;
- authority distribution and bounded top scores; and
- vector degradation state.

Diagnostics did not contain authentication tokens, environment secrets, raw private-source text, user identifiers, or full retrieved documents. Private-source isolation remains enforced by `research_sources.user_id` together with the selected source IDs and is covered by the regression suite.

## Conclusion

Retrieval V3 is safe to close as an architecture and production-routing phase. Metadata and exact-reference paths avoid unnecessary semantic calls, semantic-ready documents can use hybrid retrieval, PostgreSQL remains available when vectors are absent, result sets are bounded, and comparison identities remain document-specific.

The active-namespace coverage figure is an explicit production limitation, not a hidden success claim. It should be improved incrementally through the existing bounded embedding recovery worker and measured during the later rollout/observability phase.
