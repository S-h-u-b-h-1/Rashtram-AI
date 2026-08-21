# Rashtram Knowledge Layer V1

Knowledge Layer V1 extends Rashtram's existing document relationship graph with evidence-backed concepts. It is a discovery and interoperability layer, not a substitute for legislation, Gazette text, policy records, or researcher-selected sources.

## Safety contract

Original document evidence remains authoritative. A knowledge object can help identify concepts and candidate documents, but an answer must still retrieve and cite the underlying document passage.

- `SOURCE_VERIFIED` and `HUMAN_VERIFIED` objects may be presented as verified structured knowledge.
- `MODEL_CHECKED` and `MODEL_EXTRACTED` objects may support discovery only.
- `DISPUTED` and `QUARANTINED` objects are excluded from discovery and traversal.
- Verified and AI-generated nodes or edges require an evidence span tied to an original public document or an account-owned private source.
- Similar names never establish an amendment, repeal, or other legal relationship.

## Data model

Migration `030_knowledge_layer_v1.js` adds:

- `knowledge_nodes` for concepts, definitions, obligations, rights, prohibitions, exemptions, penalties, procedures, authorities, industries, jurisdictions, schemes, requirements, and entities;
- `knowledge_edges` for typed relationships between nodes; and
- `knowledge_evidence` for the original document, chunk, resource, page, section, clause, evidence span, checksum, and source URL.

Public and private concept identities have separate uniqueness constraints. Private nodes and evidence carry `owner_user_id`, and every discovery/export query enforces that ownership.

## Extraction rollout

Extraction is deliberately bounded. `eligibleForKnowledgeExtraction` admits only search-ready P0/P1 records, high-authority records, or frequently accessed records. `extractKnowledgeCandidates` emits only explicit, supported sentences and does not force every document to create every node type. `prepareKnowledgeForDocument` is the controlled persistence entry point.

The first extractor is deterministic and recognizes explicit definitions, duties, prohibitions, exemptions, penalties, rights, and procedures. It stores the complete supporting sentence and source coordinates. Bulk corpus extraction is not enabled by this phase.

## Retrieval flow

Knowledge-assisted catalogue retrieval runs concurrently with vector retrieval:

```text
question
→ evidence-backed concept discovery
→ candidate document IDs
→ original PostgreSQL/vector evidence retrieval
→ reranking
→ grounded generation with original citations
```

If embeddings or Pinecone are unavailable, evidence-backed knowledge candidates can still narrow the public catalogue. Knowledge descriptions are flagged `knowledgeDiscoveryOnly` and are not inserted into the answer context as legal evidence.

## APIs and portability

- `GET /api/graph/knowledge/search?q=...` returns account-scoped concepts, candidate document IDs, and original evidence coordinates.
- `GET /api/graph/knowledge/:id/export` exports a verified object as portable Markdown/YAML front matter. Model-only, disputed, quarantined, inaccessible, or evidence-free objects cannot be exported.

The database remains the internal source of truth; Markdown is export-only.

## Existing graph compatibility

The existing document graph remains intact and continues to provide verified amendment/repeal lineage, bounded traversal, comparison overlap, timelines, saved paths, UI graph views, and verified-only chat context. Knowledge routes live beside the existing graph routes and reuse its authentication and conservative verification philosophy.

## Tests

`knowledgeLayerV1.test.js` covers evidence requirements, model-fact exclusion, edge evidence, quarantine, retrieval narrowing, original citations, normalization, jurisdiction isolation, conflicts, private-source isolation, traversal bounds, extraction priority, safe persistence ordering, and existing graph reuse. The existing `knowledgeGraph.test.js` remains part of the release gate.

## Current limitations

V1 does not attempt full legal ontology extraction, bulk backfill, automatic conflict adjudication, or Compliance Copilot behavior. `MODEL_CHECKED` means evidence was attached and passed bounded structural checks; it does not mean a human verified the legal interpretation. Those limits are intentional.
