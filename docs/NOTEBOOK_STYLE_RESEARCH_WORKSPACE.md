# Notebook-style research workspace

Rashtram AI now uses a three-column research workspace for document chats:

- **Sources** (left): the current catalogue record plus user-added websites and PDFs. Select one or more sources to include them in the next answer. A source link can be opened in a new tab for reading.
- **Chat** (centre): the existing evidence-grounded conversation. The selected source IDs are sent with each question, so source context is private to the signed-in user and does not leak into another account's chat.
- **Studio** (right): the existing brief, risk, stakeholder, policy-draft, summary, related-document, timeline, graph, and notes tools remain available beside the conversation.

## Adding study material

The left shelf accepts:

1. Public `http` or `https` pages. The server fetches the page, removes navigation and presentation-only HTML, keeps the readable article text, and stores searchable chunks.
2. Public PDF links or a local PDF upload. Native text is extracted first. Scanned PDFs automatically use the configured Gemini OCR path when native text is insufficient. Hindi/Devanagari text is retained in its original form and language metadata is stored.

Sources are scoped to the authenticated account. The server rejects localhost, private-network addresses, credentials embedded in URLs, and unsupported protocols. The current source limit is 20 MB per file/response and extracted text is capped at 500,000 characters. Originals are written to configured object storage; the extracted text and searchable chunks are stored in Postgres so answers remain fast and reproducible.

## API surface

- `GET /api/research-sources` — list the signed-in user's sources.
- `POST /api/research-sources/url` with `{ "url": "https://..." }` — fetch, extract, chunk, and store a public URL.
- `POST /api/research-sources/upload` with `{ "fileName": "report.pdf", "mimeType": "application/pdf", "contentBase64": "..." }` — validate and store a PDF upload.
- `DELETE /api/research-sources/:sourceId` — delete the source, its chunks, and its object-storage original when available.

Document and multi-document chat requests can include `sourceIds`. Retrieval only uses ready sources owned by the current user. Source passages are returned with the normal citations and are persisted with the assistant response metadata.

## Operational notes

Migration `027_research_sources.js` creates the source and chunk tables. Deploying the backend runs the normal migration bootstrap. If object storage is unavailable, the user receives a warning and the extracted text remains usable; configure the existing S3-compatible storage variables before production use so uploaded originals are retained.

