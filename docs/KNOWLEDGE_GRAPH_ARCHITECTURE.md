# Government Knowledge Graph Architecture

Rashtram AI models the Indian public-policy catalogue as an explainable,
directed property graph backed by PostgreSQL. Document nodes remain canonical
records in `documents` and `legislative_documents`; verified edges live in
`document_relationships`. Ministries, authorities, and jurisdictions are
projected as virtual graph nodes from canonical metadata.

## Data flow

1. Official-source ingestion normalizes document metadata and source evidence.
2. Deterministic heuristics evaluate legal identifiers, titles, types, dates,
   jurisdictions, metadata, and extracted PDF text.
3. Ambiguous candidates may be verified by OpenAI only after deterministic
   candidate discovery.
4. Supported edges and inverse edges are stored with strength, confidence,
   explanation, provenance, and structured evidence.
5. Bounded APIs expose expansion, search, shortest paths, metrics, and saved
   paths.
6. Chat, comparison, recommendations, dashboard, timeline, and profile use the
   same graph.

## Schema

`document_relationships` retains compatible `from_document_id` and
`to_document_id` columns and exposes generated `source_document_id` and
`target_document_id` aliases. It also stores relationship type, strength,
source, confidence, explanation, evidence, provenance, and timestamps.

`saved_graph_paths` stores user-owned, reproducible research paths.

## Performance and safety

- Source/type/strength, target/type/strength, confidence, and evidence indexes
  support bounded graph reads.
- Expansion is limited to depth three and 200 edges.
- Shortest-path traversal is cycle-safe and limited to eight steps.
- Only public-valid document nodes are returned.
- No LLM relationship is stored without prior catalogue evidence.

## Limitation

Missing relationships mean “not yet supported by stored evidence,” not that no
real-world legal relationship exists.

