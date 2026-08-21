# Large Document Intelligence V1

Rashtram AI keeps the ordinary semantic backfill ceiling at 100 chunks. A public, search-ready document above that limit uses a separate hierarchical route:

```text
document → bounded structural routing groups → original child chunks
```

Routing groups are deterministic representations made from existing structural labels and bounded excerpts. They help select a small part of a large document, but they are never legal evidence. Every released passage and citation is loaded from the original `document_text_chunks` row with its original page, section, clause, language, and source metadata.

## Safety properties

- The normal 100-chunk ceiling is unchanged.
- The path performs no new download, extraction, or OCR.
- Routing vectors are stored separately and cannot delete ordinary child vectors.
- `semantic_ready` continues to mean complete, current child-vector coverage.
- `hierarchical_semantic_ready` is a separate capability and cannot masquerade as full child coverage.
- PostgreSQL full-text search remains available across every child chunk.
- Indexing requires an explicit document ID and rejects private, unready, and ordinary-sized documents.

## Operation

Preview one oversized document without writes or provider calls:

```bash
npm run large-document:index --prefix server -- --document-id=20582 --dry-run
```

After migration and capacity verification, explicitly index one controlled canary:

```bash
npm run large-document:index --prefix server -- --document-id=20582
```

The result reports child chunks, routing vectors, reduction percentage, estimated embedding tokens, embedding latency, and Pinecone latency. Exact-reference requests still use PostgreSQL and do not require a vector call.

## Controlled production canary

Gazette `20582` was indexed on 21 August 2026 after a dry run:

| Measurement | Result |
|---|---:|
| Original child chunks | 105 |
| Routing vectors | 9 |
| Vector reduction | 91.43% |
| Estimated embedding input | 11,148 tokens |
| Embedding time | 1,580 ms |
| Pinecone upsert time | 3,792 ms |
| Downloads / OCR pages | 0 / 0 |

The semantic compliance probe returned five original child passages through the hierarchical route, all with page provenance, while PostgreSQL returned lexical candidates concurrently. The measured end-to-end retrieval time was 15,361 ms; most of it was production PostgreSQL/Pinecone network latency and is retained as an honest Phase 5 optimization baseline.

An exact-reference probe for section `2.1.4` used PostgreSQL only, made no vector request, and returned original chunk 33 with section `2.1.4)` and page 61 as the highest-ranked passage. It exposed and then verified a fix for dotted legal identifiers. The measured exact-reference time was 12,709 ms, also retained for Phase 5.

No other oversized P1 document was indexed in this phase. The remaining four keep lexical search readiness and the ordinary safety ceiling remains unchanged.
