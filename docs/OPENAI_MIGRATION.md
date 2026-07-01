# OpenAI Migration

Last reviewed: 1 July 2026

## Scope

The active AI path uses the official OpenAI Node SDK and Responses API for
summaries, suggested questions, grounded chat, dashboard overviews, and PDF OCR.
Embeddings use `text-embedding-3-large` at 768 dimensions to remain compatible
with the provisioned Pinecone indexes.

The browser never receives the OpenAI key. All requests originate from the
Express backend, and streamed chat is forwarded to the frontend through the
existing Server-Sent Events contract.

## Configuration

Required backend variables:

```text
OPENAI_API_KEY
OPENAI_MODEL=gpt-5.4-mini
OPENAI_FALLBACK_MODEL=gpt-4.1-mini
OPENAI_OCR_MODEL=gpt-5.4-mini
OPENAI_EMBEDDING_MODEL=text-embedding-3-large
EMBEDDING_PROVIDER=openai
PINECONE_NAMESPACE=openai-text-embedding-3-large-768-v1
```

The namespace must not reuse vectors produced by another embedding model.
Existing documents are re-indexed on demand into the OpenAI namespace.

## Runtime behavior

- Generation retries transient failures with bounded backoff.
- The configured fallback model is attempted if the primary model fails.
- Chat consumes `response.output_text.delta` events and preserves the existing
  SSE payload format.
- OCR sends a Base64 PDF file input with an exact-transcription instruction.
- Summaries use a stable evidence-only Markdown schema.
- Retrieval remains constrained to canonical document IDs and verified
  PostgreSQL metadata.

## Deployment checklist

1. Store all variables as encrypted backend environment variables.
2. Deploy the backend and verify `/health` reports `aiProvider: openai`.
3. Deploy the frontend after the backend URL and CORS origin are verified.
4. Process one English and one Hindi document.
5. Confirm original-language snippets, English summaries, and all three chat
   response-language modes.
6. Inspect runtime logs for provider, database, vector, and timeout errors.
7. Rotate any key that was pasted into chat, logs, tickets, or source code.
