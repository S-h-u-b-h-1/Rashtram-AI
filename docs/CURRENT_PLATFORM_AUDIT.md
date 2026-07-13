# Current Platform Audit

Date: 2026-07-13

This audit is based on the repository, migrations, route map, package scripts, and live database-backed CLI outputs. It intentionally separates implemented capability from roadmap.

## Evidence commands used

- `npm run catalog:stats --prefix server`
- `npm run process:status --prefix server`
- `npm run process:audit --prefix server`
- `npm run process:failures --prefix server`
- `npm run process:backlog --prefix server`
- `npm run process:consistency --prefix server`
- `npm run db:migrate --prefix server`
- `npm run db:verify --prefix server`
- repository route, migration, connector, and workflow inspection

## Current counts

| Metric | Current value |
|---|---:|
| Canonical documents | 19,307 |
| Documents with PDF | 17,514 |
| Canonical source groups represented in catalogue | 20 |
| Jurisdictions represented | 32 |
| Research-ready documents | 1,485 |
| Comparison-ready documents | 1,485 |
| Processable backlog | 17,118 |
| Stored chunks | 11,954 |
| Stored embeddings/local retrieval vectors | 11,954 |
| Processing attempts | 2,808 |
| Completed attempts | 1,475 |
| Failed attempts | 1,331 |
| Current processing failure rate | 47.4% |
| Probable duplicate groups | 1,113 |
| Documents in probable duplicate groups | 2,442 |
| Pending match reviews | 26 |

## Processing state distribution

| State | Documents |
|---|---:|
| `pdf_available_not_processed` | 16,311 |
| `comparison_ready` | 1,485 |
| `source_only` | 599 |
| `source_extractable_not_processed` | 407 |
| `processing_failed_retriable` | 398 |
| `processing_failed_permanent` | 66 |
| `invalid_or_quarantined` | 38 |
| `processing_pending` | 2 |
| `unsupported_file_type` | 1 |

## Source distribution

The catalogue is broad but uneven. PRS dominates the current corpus.

| Source | Records | PDFs |
|---|---:|---:|
| PRS India | 17,545 | 17,229 |
| PIB | 134 | 5 |
| India Code | 78 | 16 |
| RBI | 62 | 26 |
| TRAI | 60 | 34 |
| CERC | 58 | 53 |
| eGazette | 54 | 54 |
| MoEFCC | 36 | 36 |
| Policy Edge | 31 | 0 |
| UIDAI | 31 | 31 |
| SEBI | 26 | 0 |
| NITI Aayog | 25 | 25 |
| State Policy | 15 | 15 |
| MyGov | 3 | 0 |

## What is implemented and working

- Next.js frontend with landing pages, auth pages, dashboard, document catalogue, chat routes, comparison, recommendations, onboarding, profile, and contact form.
- Express backend with authenticated APIs for auth, onboarding, dashboard, profile, activity, documents, graph, recommendations, contact, and internal cron ingestion.
- Canonical document tables, source registry, document resources, text artifacts, processing state, processing jobs, processing attempts, processing workers, recommendations, comparisons, knowledge graph relationships, and user research data.
- Gemini-first AI provider abstraction with OpenAI-compatible/fallback paths.
- Pinecone/local retrieval support and fallback-safe readiness logic.
- PDF processing with native extraction, OCR fallback, language detection, Hindi-aware cleanup/chunking, raw/clean/summary artifact separation, and multilingual tests.
- Research/comparison readiness gates that distinguish catalogued, processable, failed, pending, source-only, research-ready, and comparison-ready documents.
- Recommendation service for document recommendations, problem recommendations, comparison recommendations, and profile recommendation history.
- Knowledge graph relationship discovery/verification foundation.
- Scheduled ingestion scripts and GitHub workflows.
- Release verifier covering dashboard, profile, document sections, search, document detail, graph, timeline, and unified chats.
- Account onboarding, profile preferences, user-specific comparison selection, and account deletion.

## Partially implemented

- Source connectors exist for many official and secondary sources, but coverage and reliability are uneven.
- Source registry exists; migration `012_source_authority_and_canonical_provenance.js` adds explicit authority tiers, source ops counters, and operations view.
- Structured processing failures now have migration `013_processing_failure_taxonomy.js`, which adds failure codes, retry eligibility, pipeline stage, checksums, extraction method, extraction quality metadata, worker version, and cost placeholder fields.
- Duplicate analysis now has migration `014_document_content_fingerprint.js`, which adds `content_fingerprint_sha256` for processed-text fingerprinting where available.
- Canonical document model exists; migration `012` fills several missing provenance fields, but not every connector fully populates every new field yet.
- Processing jobs and attempts exist; stage-level timestamps are partly represented through job/attempt timestamps and stage metrics JSON, but not every individual stage has first-class start/finish columns.
- Hybrid retrieval exists through full-text, metadata, vector/local retrieval, recommendations, and graph signals; ranking still needs more explicit authority-tier/date/supersession weighting throughout all query paths.
- Knowledge graph distinguishes several relationship types, but validation workflows for AI-inferred relationships remain immature.
- Operations visibility exists through CLI scripts and DB views; no polished internal admin UI yet.
- Evaluation is test-heavy but not benchmark-dataset-driven yet.

## Broken or unreliable

- `npm run ingest:health --prefix server` did not finish within the manual 90-second observation window in this audit session.
- A large processable backlog remains: 17,118 documents.
- Current processing failure rate is high: 47.4%.
- Many source records have no PDF hashes yet; checksum coverage is incomplete.
- Duplicate review is incomplete: 1,113 probable duplicate groups remain.
- Some official-source connectors are represented but have very low stored records, indicating partial discovery or parser limits.

## Documented but not implemented as product features

- Enterprise multi-tenant organization accounts.
- Team workspaces and shared notes/collections.
- SSO.
- Billing/subscriptions.
- Role-based access control beyond basic user/admin-style metadata.
- Legal case-law/judgment ingestion.
- Production-grade cost accounting dashboard.
- Formal research-quality benchmark runner before this sprint.

## Missing provenance and control gaps

Migration `012` adds explicit fields for:

- source-specific ID
- alternate title
- authority tier
- original source page
- original file URL
- object storage path
- file checksum
- retrieval date
- last source update
- expiry date
- regulator
- sector
- topic
- legislative status
- notification/gazette numbers
- session/version
- parent document
- validation status
- extraction version

The remaining work is connector population, not only schema creation.

## Technical debt

- PRS dominates the corpus; official-source parity is not yet achieved.
- Processing queue completion estimate is long at current throughput.
- Retry/failure controls exist but the failure rate requires root-cause reduction.
- Failure diagnostics now exist through `process:failures`, `process:backlog`, `process:retryable`, `process:consistency`, and `document:readiness`; these reduce ambiguity but do not by themselves lower the backlog.
- Connector health should have bounded timeouts and consistently machine-readable output.
- Source authority tiers need to be enforced in retrieval ranking and answer citations everywhere.
- Page/section citations exist in chunks but need stronger end-to-end citation validation.
- Existing docs include older OpenAI-oriented language; actual provider path is Gemini-first.
