# Research-Ready Corpus Report

Report date: 3 July 2026

## Starting point

- Audited documents: 17,744
- Research-ready: 16
- Comparison-ready: 16
- Stored chunks/embeddings: 137 / 137

## Infrastructure validation milestone

After the six-document concurrent profiling batch:

- Research-ready: 22
- Comparison-ready: 22
- Stored chunks/embeddings: 472 / 472
- Six new documents passed extraction, chunk storage, embeddings, retrieval
  verification, and graph post-processing.

The first 100-document milestone is processed through the durable worker queue.
Use `npm run process:status --prefix server` for the live authoritative count.

## Readiness guarantees

A record is promoted only after all of the following succeed:

- accessible official source;
- PDF validation and extraction/OCR;
- original-language text preservation;
- structural chunk persistence;
- embedding and Pinecone upsert;
- live retrieval probe; and
- no active processing error.

Graph discovery and recommendation expansion run after readiness. Their
failure is recorded/logged but does not invalidate a document whose grounded
retrieval path works.
