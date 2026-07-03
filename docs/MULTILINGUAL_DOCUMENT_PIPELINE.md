# Multilingual Document Pipeline

Last reviewed: 1 July 2026

## Guarantees

Rashtram AI treats the official document as the source of truth. Hindi text is
never replaced by a translation. PostgreSQL stores original extracted text and
its language metadata separately from the generated English research summary.
Pinecone source chunks also retain the original language so citations remain
verifiable against the PDF.

## Processing flow

1. Load the canonical PDF URL from PostgreSQL; browser-supplied URLs are never
   trusted.
2. Extract embedded PDF text and normalize Unicode, whitespace, page numbers,
   repeated page furniture, Devanagari matras, and punctuation.
3. Detect `language_code`, `script`, `is_bilingual`, and whether OCR was
   required.
4. If embedded text is insufficient, send the PDF to OpenAI with an
   exact-transcription OCR instruction. The OCR result is cleaned but not
   translated.
5. Split text on headings, paragraphs, English sentence boundaries, Hindi
   danda boundaries, and bounded overlap.
6. Create 768-dimension multilingual embeddings with
   `text-embedding-3-large`, then store the original chunks in a dedicated
   Pinecone namespace.
7. Generate and store an English structured summary independently.
8. Retrieve original-language passages for chat and preserve their language in
   citations and source snippets.

## Stored fields

`document_text_artifacts` records:

- complete `original_text`;
- `language_code` and `script`;
- `is_bilingual`;
- `ocr_required` and `ocr_used`;
- `extraction_method`;
- page and character counts;
- `english_summary`;
- processing metadata, including generated suggested questions.

The summary does not overwrite or mutate `original_text`.

## Chat behavior

The UI offers Auto, English, and Hindi. Auto detects Devanagari in the user's
question. The answer follows the selected language while quoted evidence stays
in the source language. Single- and multi-document chat use the same rule.

## Failure behavior

Processing failures are explicit and retryable. If native extraction and OCR
both fail, the system does not manufacture a summary or index empty content.
Large input, download, generation, and vector batches remain bounded.
