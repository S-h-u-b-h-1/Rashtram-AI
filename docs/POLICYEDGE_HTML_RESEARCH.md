# PolicyEdge HTML Research and Comparison

## Outcome

PolicyEdge catalogue records with readable public HTML are first-class inputs to Research Engine V3. They use the same normalized document identity, processing stages, PostgreSQL full-text retrieval, optional semantic retrieval, evidence safety, chat, comparison, Knowledge Layer, and telemetry paths as PDF-backed records. No second RAG system or HTML-only answer path exists.

PolicyEdge remains a `RESEARCH` authority source. Successful parsing does not promote it to an official primary source.

## Source path and identities

- Active catalogue source: `policy-edge`, registered by the universal ingestion registry.
- Dedicated catalogue-only connector: `server/lib/ingestion/connectors/policyedgeConnector.js`.
- Retired records named `PolicyEdge` or `policyedge` are recognized without destructive source-name rewrites.
- Canonical public article URLs use `https://www.policyedge.in/p/<slug>`.
- The retired `ingestPolicyEdge --embed` switch fails explicitly. All chunking, FTS, embedding reuse, readiness, and verification run through Processing V3.

## Safe acquisition

The connector permits only HTTPS requests to `www.policyedge.in` and `api.policyedge.in`. It rejects credentials in URLs and redirects outside those hosts. Requests have a 30-second timeout, a 10 MiB response cap, bounded retries/backoff, a maximum of three redirects, and content-type validation. Authentication headers are sent only to the fixed Strapi API host. Raw tokens, page bodies, and user research text are not written to telemetry.

## Deterministic extraction

`server/document/htmlResourceService.js` is shared by public PolicyEdge processing and researcher-added web sources. It:

- removes navigation, headers, footers, forms, sidebars, cookie prompts, newsletters, sharing controls, scripts, and styles;
- prefers article/main content and can read JSON-LD or Next.js structured article text;
- preserves headings and section hierarchy, paragraphs, lists, definitions, quotes, and preformatted content;
- normalizes table rows with captions, headers, cells, and row identity;
- retains only real source anchors and never invents page numbers or section anchors;
- rejects access/login pages, empty pages, link-heavy shells, and dynamic loading shells;
- produces separate SHA-256 hashes for raw HTML and cleaned research content.

Chunks follow natural section boundaries. Table rows are never split. Every chunk carries `resourceType=html`, `mimeType=text/html`, heading, section path, real anchor when present, canonical source URL, null page coordinates, structural type, table context, and both hashes.

## Change detection and provenance

Raw HTML and cleaned-content hashes are intentionally separate:

- a cookie banner or navigation change changes the raw hash but leaves the clean hash stable;
- a meaningful article change changes the clean hash;
- unchanged clean chunks reuse embeddings only when their content hash and active embedding namespace both match;
- PostgreSQL chunks are always written first, so embedding or Pinecone failure leaves lexical retrieval and `search_ready` intact;
- summaries are reused when the clean content hash is unchanged.

When S3-compatible object storage is configured, the raw HTML is uploaded content-addressably as a `source-html` artifact, read back, checksum- and byte-verified, and only then registered in `document_artifact_objects`. If object storage is unavailable, processing continues with hashes, stage provenance, and the canonical public source URL; no raw HTML is stored inline in PostgreSQL.

No schema migration was required. Existing JSON provenance fields, Processing V3 stage metadata, content hashes, normalized chunks, and artifact-object tables already represent the required state without duplicate columns.

## Readiness contract

HTML resources do not require a PDF and record PDF status as `not_required`.

- `catalogued`: public record exists.
- `resource_ready`: an extractable PolicyEdge source or accessible HTML resource exists.
- `text_ready`: deterministic extraction and normalized chunks succeeded.
- `search_ready`: PostgreSQL lexical retrieval is available.
- `semantic_ready`: vectors exist in the active namespace and retrieval verification succeeds.
- `chat_ready`: verified retrieval is available, including lexical fallback.
- `comparison_ready`: the document is genuinely research ready.

HTML-specific failures are structured as fetch, access, redirect, content-type, empty-content, dynamic-content, low-quality, and unsupported-structure failures. Permanent failures do not loop; transient fetch and dynamic-content failures remain retryable.

## Citations, chat, comparison, and Knowledge Layer

Chat and comparison citations display PolicyEdge as a webpage, link to the canonical URL or a real anchor, show headings/section paths when present, and omit page labels when no page exists. Mixed PDF/HTML comparisons preserve separate document/chunk identities and use the same sufficiency and claim-verification rules. Knowledge extraction consumes retrieved evidence with its document, chunk, source URL, and authority identity; HTML evidence is not treated as a legal fact merely because it parsed successfully.

Telemetry stores only bounded operational metadata: resource types, HTML evidence count, latencies, candidate counts, readiness, retrieval mode, fallback use, and token estimates. It does not store raw queries, raw HTML, or evidence passages.

## Operations

Read-only production audit:

```sh
npm run policyedge:html:audit --prefix server
npm run policyedge:html:audit --prefix server -- --probe=5
```

The optional probe is read-only and capped at ten public records.

Bounded canary selection (default, no writes):

```sh
npm run policyedge:html:canary --prefix server -- --limit=5
```

Apply only after reviewing the selection:

```sh
npm run policyedge:html:canary --prefix server -- --limit=5 --apply
```

The apply path is capped at ten documents, disables graph discovery, reports per-document latency/readiness/retrieval evidence, measures database growth, and stops after the selected batch. It does not start a bulk backfill.

## Acceptance coverage

Automated tests cover structural extraction, boilerplate removal, tables, section paths, real anchors, null page coordinates, dynamic/access rejection, current and legacy source identities, clean-hash stability, meaningful change detection, embedding reuse, authority separation, relevance-gated ranking, HTML citation safety, lexical fallback after vector failure, and cross-document chunk identity. The standard server test suite, frontend tests, lint, production build, secret scan, release verification, read-only production audit, and bounded canary are required before rollout.

## Rollback

The implementation is additive. Rollback is code-only: redeploy the prior application commit. Existing HTML chunks and content-addressed source artifacts remain valid provenance and can be retained. No destructive database rollback or source-name rewrite is required.
