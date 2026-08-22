# PDF text quality recovery

Rashtram AI treats readable PDF text as a verified Processing V3 capability. A non-empty extraction is not sufficient. This extension remains inside the existing pipeline: PostgreSQL is canonical, lexical `SEARCH_READY` does not depend on Pinecone, and PolicyEdge HTML uses its unchanged HTML path.

## Decision model

Each native page is evaluated deterministically and classified as `GOOD`, `SUSPICIOUS`, `CORRUPTED`, or `UNRECOVERABLE`. Bounded diagnostics measure character and word counts, word length, printable/letter/number/whitespace/punctuation/symbol ratios, replacement and control characters, private-use glyphs, fragmented single-character tokens, token plausibility, entropy, repeated sequences, extreme runs, and model chatter.

The evaluator is language-aware. Latin and Devanagari are measured independently, valid Hindi combining marks remain intact, and English and Hindi may coexist. It does not depend on an English dictionary. Quality diagnostics contain scores and short reasons, never full source text.

Current versions are persisted with chunk and artifact metadata:

- quality engine: `pdf-text-quality-v1`
- normalization: `pdf-text-normalization-v1`
- OCR prompt: `pdf-ocr-transcription-v2`
- Processing V3: `research-engine-v3-pdf-quality-v1`

## Recovery ladder

1. Validate and parse the original PDF.
2. Evaluate native text per page.
3. Apply safe NFKC normalization, common ligature conversion, soft-hyphen and zero-width removal, conservative lowercase line-hyphen joining, and clearly artificial character-spacing repair.
4. Re-evaluate normalized text.
5. OCR only pages that remain unusable. OCR is sequential and limited to two attempts per page through the existing provider circuit breaker.
6. Evaluate OCR output with the same quality engine. Conversational text, Markdown chatter, repeated hallucinations, empty output, and printable nonsense are rejected.
7. Keep the better usable version. If neither version is usable, record the original page number as failed and exclude its text from chunks.

The OCR instruction requires transcription of visible text only, preservation of original languages, headings, numbering, legal punctuation and table relationships, and forbids summarization, translation, inference, completion, explanation, or Markdown wrappers.

The existing local `pdf-parse` engine remains the deterministic native extractor. Adding another rendering/runtime dependency was deferred because it would materially enlarge the Vercel deployment. Font-map failures are detected through replacement, private-use, symbol, plausibility, and fragmentation signals and routed to page OCR.

## Page identity and partial readiness

Chunks are created independently from usable pages. Every PDF chunk has an exact `pageStart` and `pageEnd`; `pageEstimate` is false. Failed pages and usable coverage are retained as bounded metadata. A mostly readable document can remain lexical-search ready after retrieval verification, while failed pages never enter PostgreSQL FTS, Pinecone, generation context, citations, or extractive fallbacks.

Evidence Safety rejects `CORRUPTED` and `UNRECOVERABLE` evidence even when retrieval scores are high. When only unreliable passages exist, the user receives: “This section could not be reliably extracted from the source document,” with the original source offered when available.

## Hashing and semantic reuse

The original resource checksum and extracted/chunk/embedding hashes remain canonical. Reprocessing uses the same deterministic document and chunk IDs. Unchanged cleaned chunk content in the active embedding namespace reuses its embedding; changed chunks are embedded again; stale vectors beyond the new chunk set are removed best-effort. A forced repair bypasses historical Pinecone/local-text reconstruction even when the PDF checksum is unchanged.

## Audit and repair commands

The corpus audit is read-only and scans public PDF documents that are currently search ready:

```bash
npm run pdf:quality:audit --prefix server
```

It reports totals, source/type/language/year/extractor/OCR breakdowns, mixed-quality documents, bounded page diagnostics, and a P0–P3 repair queue.

Repair is dry-run by default and bounded to five documents (maximum ten):

```bash
npm run pdf:repair --prefix server -- --limit=5 --dry-run
npm run pdf:repair --prefix server -- --limit=5 --apply
npm run pdf:repair --prefix server -- --document-ids=123,456 --limit=2 --apply
```

The command runs the existing capacity guard and worker lease path, forces PDF re-extraction, verifies readiness and retrieval, records page/citation identity, measures database growth and embedding reuse, and stops after three consecutive provider failures. There is deliberately no unbounded bulk mode.

## Operations and rollback

Processing stage metadata records page counts, quality counts, failed pages, average score, selective OCR counts, invalidated chunks, reused/regenerated embeddings, and stale-vector cleanup. It does not store raw text in telemetry. Original PDFs remain authoritative in object storage/source URLs; page images are not persisted.

Rollback the code release to disable new classification. Repaired normalized chunks remain valid source-derived text; if a specific document must be reverted, rerun Processing V3 from its authoritative PDF with the prior processor. Never restore previously detected corrupt text as evidence merely to regain readiness.

Documents are operationally classified as good, repaired, partially recovered, unrecoverable, or needs review. Unrecoverable source text is an acceptable outcome; invented text is not.
