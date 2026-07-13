# Rashtram AI — Current Platform Audit

Audit date: 2026-07-13
Evidence standard: repository code, production-linked database commands, bounded live connector checks, and authenticated deployed-browser tests. Historical reports are not current evidence.

## Executive conclusion

Rashtram AI is a working research-grade prototype suitable for a controlled institutional pilot. It is not yet a complete commercial SaaS product, a legal-advice system, or an enterprise compliance platform.

The deployed product supports email authentication, onboarding/profile workflows, a public legislative and policy catalogue, research-ready document workspaces, grounded chat with citations, private notes and history, bookmarks, document recommendations, comparison selection, knowledge-network exploration, and source-health views. The underlying platform includes provenance, readiness controls, retry controls, processing audits, connector infrastructure, and a Gemini-first AI path.

The largest constraints are corpus conversion, processing-attempt failures, unresolved probable duplicates, incomplete file-checksum coverage, incomplete independent/human evaluation, uneven source depth, and enterprise/commercial features that remain roadmap-only.

## Measured database baseline

These figures were measured on 2026-07-13 and will drift as ingestion and processing continue.

| Metric | Measured value |
|---|---:|
| Canonical catalogue records | 19,307 |
| Records with a PDF URL | 17,514 |
| Public jurisdictions represented | 32 |
| Canonical source labels represented | 20 |
| Research-ready | 1,602 |
| Comparison-ready | 1,602 |
| Processable backlog | 16,997 |
| Stored chunks | 12,296 |
| Stored embeddings | 12,120 |
| Queue completed | 1,597 |
| Queue failed | 371 |
| Queue dead-letter | 70 |
| Queue queued | 1,325 |
| Historical processing attempts | 2,928 |
| Historical failed attempts | 1,341 |
| Attempt failure rate | 45.8% |
| Probable duplicate groups | 1,113 |
| Records in probable duplicate groups | 2,442 |
| Pending match reviews | 26 |
| Records with populated PDF hash in the catalogue report | 0 |

The 45.8% figure is the failure rate of recorded processing attempts. It is not the percentage of catalogue documents proven permanently unusable.

Some research-ready records use a verified local-text retrieval fallback and have no vector embedding. The product must not claim that every ready document is vector-indexed.

## Source coverage

The catalogue is highly concentrated in PRS.

| Source | Records | Records with PDF URL |
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

A bounded live health check of PRS, India Code, eGazette, PIB, RBI, and SEBI on 2026-07-13 found five connected sources and one reachable/valid India Code sample with no records in that single-page sample. RBI was reachable and discovered a sample, while its latest stored ingestion run still carried two prior errors. This is evidence of connector operability, not proof of complete source coverage.

## Capability truth table

| Capability | Status | Evidence and limitation |
|---|---|---|
| Email registration/login/logout | Implemented and deployed | Authenticated temporary-account flow passed. |
| Google OAuth | Configurable, not currently enabled | UI now hides Google login unless explicitly enabled and configured. |
| Onboarding and personal profile | Implemented and deployed | Signup, onboarding skip, profile routing, and account deletion exist. |
| Legislative/policy catalogue and filters | Implemented and deployed | Bills, Acts, state records, gazette, policies, universal search, and detail routes passed release checks. |
| Dashboard and source-health views | Implemented | Counts are live; public UI count can differ from raw DB totals because invalid/internal records are excluded. |
| Grounded document chat | Implemented for research-ready documents | Authenticated production question returned the stated 1,600 MW rooftop target with six cited passages. Not every catalogue record is chat-ready. |
| Evidence briefs/summaries | Implemented for processed documents | AI or extractive fallback; outputs remain research assistance requiring source verification. |
| Notes, bookmarks, chat history | Implemented | Temporary-account browser test created a note and a saved chat. |
| Recommendations | Implemented | Uses catalogue, metadata, profile, semantic, and relationship signals. Recommendation confidence is relevance scoring, not legal certainty. |
| Document comparison | Implemented but production latency needed repair | Selection and retrieval worked; deployed request hung in provider generation. The audit adds a bounded AI timeout and grounded extractive fallback. Must be reverified after deployment. |
| Multi-document chat | Implemented route and UI | Route passes release verification; a complete deployed conversational turn was not independently exercised in this audit. |
| Knowledge graph | Partially implemented | Graph storage and UI work, but many edges are inferred signals. They must not be called source-verified. The audit removes misleading labels, excludes inferred legal-effect edges from timelines/comparison prompts, tightens title-reference inference, and adds auditable quarantine migration 020. |
| Legal timeline | Implemented for document dates/events; relationship-derived items restricted | Before this audit, unrelated inferred replacement events appeared. Only source-verified temporal legal relationships are now eligible. |
| Provenance and source authority | Implemented in schema/API | Population is incomplete across connectors; file checksums are notably absent in the catalogue report. |
| Deduplication | Partially implemented | Deterministic/fuzzy infrastructure exists, but 1,113 probable groups remain and hash coverage is incomplete. “Duplicate-safe” was an overstatement and has been corrected. |
| Processing/readiness/retry controls | Implemented | Critical contradictions are zero; 371 legacy retryable records exceed max attempts and require backlog hygiene. |
| Automated ingestion | Implemented on schedules for configured sources | Connector coverage and freshness are uneven; “continuous” is replaced with “scheduled/monitored.” |
| PIB and regulator connectors | Implemented with partial coverage | PIB, RBI, SEBI and other regulator adapters exist; this is not comprehensive regulator intelligence. |
| Research benchmark | Internal regression benchmark only | Fifty catalogue-derived exact-title questions previously reported 1.0 recall. The benchmark was self-seeded and comparison retrieval used expected IDs, so it was not an independent accuracy result. The audit removes expected-ID injection and labels the design honestly. |
| Human/legal evaluation | Not completed | Review export/guide exist; completed formal human reviews: 0. |
| Pricing and billing | Not implemented | Placeholder dollar pricing was removed. The page now states commercial pricing is not launched and describes proposed pilot tiers only. |
| Organization tenancy, shared team workspaces, enterprise RBAC, SSO, audit console, SLAs | Roadmap only | Do not describe as implemented. |
| Compliance applicability engine/copilot | Roadmap only | General impact research is not a deterministic legal-compliance engine. |
| Case-law/judgment integration | Roadmap only | No complete judicial corpus or production case-law workflow. |
| API product with customer keys, quotas, billing and public docs | Roadmap only | Internal application APIs are not a commercial API product. |

## Critical audit findings and fixes

1. **Unsafe graph claims:** deployed UI displayed unrelated repeal/replacement edges as “verified.” Root cause was dispersed title-token matching combined with document-wide legal verbs. Fixed with contiguous normalized title matching, evidence-status fields, conservative UI labels, source-verified timeline filtering, source-verified-only comparison context, tests, and migrations 020/021 to preserve and quarantine unsafe legacy title-reference rows. The pre-cleanup graph contained 1,418 signals, 1,298 of which were legacy title-reference inferences; zero relationships met the new source-verified standard.
2. **Comparison request could hang:** the AI provider path retried for longer than a serverless request budget. Fixed with a 12-second single-attempt comparison generation ceiling and grounded extractive fallback.
3. **Fake pricing:** `/pricing` contained lorem ipsum, arbitrary dollar prices, and non-functional purchase buttons. Replaced with transparent pilot-stage messaging.
4. **Unavailable Google login advertised:** Google buttons appeared without deployed OAuth credentials. Buttons now require `NEXT_PUBLIC_GOOGLE_AUTH_ENABLED=true`.
5. **Benchmark overstatement:** perfect metrics came from catalogue-derived exact-title questions and expected-ID-assisted comparison retrieval. Expected IDs are no longer retrieval inputs; unsupported claims and factual correctness remain “requires human review,” and unknown provider cost is no longer reported as zero.
6. **Documentation/provider drift:** README described OpenAI as the active primary provider and carried stale readiness figures. Updated to Gemini-first and current measured counts.
7. **Marketing overstatement:** “continuously refreshed” and “duplicate-safe” language was replaced with scheduled refresh and duplicate-aware wording.

## Verification completed in this audit

- Server unit/integration suite (the suite passes when local loopback permissions are available; sandbox-only rerun produced two `listen EPERM` environment failures).
- Client lint and production build: passed; 22 routes generated.
- Database migrations through 021: code-verified; migration 021 is intentionally left for corrected-code deployment so the old production worker cannot recreate quarantined edges afterward.
- Database verification: passed with 1,602 research-ready records and all strict invariants satisfied.
- Processing status and catalogue statistics: measured above.
- Processing consistency: zero critical readiness contradictions after one retry-class repair; 371 legacy retryable/max-attempt hygiene rows remain.
- Research-ready sample audit: 36 records across 14 document types; zero false-ready in the bounded sample.
- Release route verification: passed for dashboard, profile, catalogues, search, detail, graph, timeline, and unified chats.
- Bounded live connector health: PRS, eGazette, PIB, RBI, and SEBI connected; India Code reachable/valid but empty in the one-record sample.
- Authenticated deployed browser: registration, login/session, dashboard/search, document research, cited chat, note, bookmark interaction, recommendation display, comparison selection, and graph display inspected.

## Remaining limitations and next gates

1. Deploy and reverify migrations 020/021 and the relationship/timeline UI against the production deployment that showed the unsafe edges.
2. Reverify comparison completion after the new bounded provider timeout reaches production.
3. Complete actual human review of at least 20 generated answers and build an independent, expert-curated evaluation set.
4. Reduce the 16,997 processable backlog and clean 371 exhausted legacy retry rows.
5. Populate file checksums and review 1,113 probable duplicate groups.
6. Increase depth and freshness for PIB, India Code, eGazette, regulators, ministries, and states without implying comprehensive coverage.
7. Run institutional pilots before setting final pricing or making commercial accuracy claims.

## Accurate external description

> Rashtram AI is a source-grounded Indian legislative and policy research prototype approaching controlled institutional pilot readiness. It combines a public-document catalogue, provenance-aware processing, research-ready document chat, citations, comparison, recommendations, personal research tools, and an experimental knowledge network. Its current strengths are architecture, traceability, and working research workflows; its remaining work is corpus conversion, independent expert evaluation, relationship verification, broader official-source depth, operational cleanup, and commercial/enterprise productization.
