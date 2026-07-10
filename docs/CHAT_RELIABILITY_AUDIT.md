# Chat Reliability Audit

Date: 2026-07-10

## Findings

- Single-document chat retrieved grounded passages, then depended on live AI
  generation for the final answer.
- Multi-document chat had the same failure mode.
- If generation failed after retrieval, the user could receive an interrupted
  stream even though grounded source passages existed.

## Fixes

- Single-document chat now streams an extractive fallback answer when provider
  generation fails after context retrieval.
- Multi-document chat now streams and persists an extractive fallback answer.
- Fallback answers clearly state that AI generation is unavailable and that the
  response is based only on retrieved passages.
- Fallback metadata includes `generationMode: "extractive_fallback"` and the
  provider error internally.

## Expected behavior

- Ready document with provider available: normal streamed grounded answer.
- Ready document with provider unavailable: streamed extractive answer from
  retrieved snippets.
- No retrieved context: response refuses to answer rather than hallucinating.

## Verification

- Server test suite passes.
- Processing fallback batches produced ready documents despite provider errors.
- Further browser smoke testing should verify the deployed SSE stream after
  backend deployment.
