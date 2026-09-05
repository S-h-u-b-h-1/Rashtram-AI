# Rashtram AI — Research Workspace Redesign V1 Report

Date: 5 September 2026  
Release branch: `codex/research-workspace-redesign-v1`  
Commits: `d2e80b6` (workspace redesign), `728d236` (PDF byte-array compatibility fix)

## Executive result

V1 changes the product model to three task-oriented destinations while retaining the underlying evidence, retrieval, persistence, comparison, drafting, reporting, graph, monitoring and account capabilities.

| Destination | User intent |
| --- | --- |
| New Research | “I have a question.” |
| Library | “I need a document.” |
| My Research | “I want to continue my work.” |

The research workspace remains `Sources | Chat | Studio`, but source scope is explicit before generation, the open document is visible in Sources, provenance is inspectable, and specialist controls are contextual.

## 1. Navigation and journey

### Before

The signed-in sidebar presented Research Desk, Search Documents, Browse Libraries (Bills, Acts, Gazette and Policies), Compare, Suggested Reading and Policy Drafter. Profile mixed settings, analytics, history, collections, notes, recommendations, graph journeys and support. The dashboard hero, global search, library search and specialist tiles overlapped as discovery entry points.

### After

Primary navigation is only New Research (`/app`), Library (`/app/library`) and My Research (`/app/research`). Profile, Settings, Help and Coverage & Sources are utilities. Recent conversations are resumable links. Compare, Policy Drafter, reports, relationships, compliance and specialist libraries remain available through Library, Studio, saved outputs or their existing routes.

The new journey is: `Question → discovery → source preview → explicit selection → Sources | Chat | Studio → saved output → resume`. New Research never generates an answer during discovery. It searches existing document services, shows usable sources and trust metadata, supports existing PDF/URL source adapters, and opens a source-scoped workspace only after selection.

## 2. Routes and components

Added canonical routes: `/app/library`, `/app/research`, `/app/reports/[id]`, `/app/settings`, `/app/help` and `/app/coverage`. `/app` is now question-first. Document, multi-document, compare, policy-drafter, recommend, graph, bill/act/gazette chat and specialist-library routes remain backward compatible.

New or substantially redesigned components include `WorkspaceShell`, `NewResearch`, `RecentResearch`, `MyResearch`, `WorkspaceUtilities`, `CatalogueSourcePicker`, `MobileWorkspaceSheet`, `DocumentExplorer`, `DocumentFilters`, `StudySourcesPanel`, `DocumentChatLayout`, `MultiDocumentChat`, `ChatHeader`, `ChatMessage`, `CitationCard`, `ChatInput`, `StudioPanel`, `PolicyDraftWorkspace`, `DocumentComparison`, `ProfileView` and `ResearchReport`.

The server additions are a composition-only owner-scoped research-history query, a stable source-aware multi-chat selection key, and a narrow PDF parser byte-array boundary fix. Retrieval V3, FTS, Pinecone, Evidence Safety, Adaptive Intelligence, providers, ranking, corpus processing and reconciliation were not redesigned.

## 3. Moved, demoted and preserved

Specialist libraries, Compare, recommendations and compliance are secondary/contextual entry points. Dashboard telemetry/freshness detail and implementation vocabulary are no longer first-run navigation. Studio starts with compact Create and Saved outputs; overview, related sources, notes, timeline, graph and additional workflows remain available on demand.

Preserved: evidence-grounded answers, citations, passage/provenance inspection, original-source links, freshness limitations, PDF/URL sources, private-source ownership, chat persistence, comparisons/versioning/regeneration, policy generation/DOCX export, reports/PDF export, collections, notes, graph, amendment/compliance workflows, monitoring, account settings, authentication and old URLs.

## 4. Reliability fixes

The open catalogue document is rendered as an explicit Library source in Sources. Counts use the same ready-source rule as active chat; unavailable personal sources are excluded. Multi-source history keys include catalogue and personal source IDs, including one-document multi-source conversations.

Welcome and new messages store ISO timestamps. Rendering formats valid ISO values, preserves legacy clock-only text, and safely hides invalid/missing values; server validation remains strict.

The existing PDF parser receives a plain `Uint8Array` at the Node `Buffer` boundary. Extraction quality, OCR, citations and storage behavior are unchanged. A two-page regression test verifies page identity and non-mutation of upload bytes.

## 5. Visual and accessibility verification

The deterministic local fixture suite covered New Research, Library, My Research, document workspace, source selector, Studio, Compare, Policy output and report views at 1440, 768 and 390 pixels, plus overflow checks at 320, 360, 375, 412 and 430 pixels.

- 57 layout checks: 0 horizontal overflow findings
- 27 accessibility audits: 0 violations
- 27 screenshots generated and inspected
- Production captures: `redesign-v1-qa/production-home-1440.png` and `redesign-v1-qa/production-chat-1440.png`
- Fixture screenshots are labelled as fixture-only, not legal-accuracy evidence

## 6. Usability task evidence

These are engineering task checks, not a representative-user study; no 5–10 second target is claimed without user observation.

| Task | Result |
| --- | --- |
| DPDP Act → cited question | Passed in live UI; explicit source selection, saved `ai_verified` answer and one citation |
| RBI digital-lending research | Partial: full phrase returned no ready source; shorter phrase returned a secondary article; official RBI URL import succeeded and was not presented as an official requirement by inference |
| PDF upload → question | Initial real upload exposed “bad XRef entry”; local fix passes and is deployed. Post-fix browser/API retry was blocked by the environment usage-limit approval gate and is not claimed |
| External government source | Passed; official RBI notification URL imported with HTTP 201 and appeared in Sources |
| Compare two documents | Passed; live POST 201, reopen GET 200, comparison `84`, second QA account 404 |
| Policy Draft | Form route and source handoff loaded; generation not repeated after the gate |
| Return to saved research | Passed at persistence boundary; live document-chat history restored 3 messages, one cited answer and valid timestamp; owner isolation passed |
| Find an Act without chat | Passed; Library is a separate source-lookup destination |
| Inspect citation | Passed; disclosure expanded to passage metadata and original-source link |
| Mobile workspace | Passed in responsive fixture QA; production mobile generation was not repeated after the gate |

## 7. Automated regression

- Frontend tests: 41 passed, 0 failed.
- Backend release checkout: 609 tests, 607 passed, 0 failed, 2 skipped (no disposable PostgreSQL integration database supplied).
- Lint: 0 errors, 8 pre-existing warnings in unrelated components.
- Vercel production frontend build: passed; 27 routes generated.
- Local webpack production build: passed. Local Turbopack was restricted by sandbox process binding; Vercel’s production build passed.
- Read-only production database check: 31 passed, 0 failed; no corpus/schema mutation.
- Release diff check: passed.

## 8. Production deployments and verification

- Frontend: [https://rashtram-ai.vercel.app](https://rashtram-ai.vercel.app), deployment `dpl_2ahFXBJrZBqcTs33eyNWnj537vXR`, ready and promoted.
- Backend: [https://rashtram-ai-backend.vercel.app](https://rashtram-ai-backend.vercel.app), redesign deployment `dpl_HHG8udbsukFLTzZwsFSoiBjbk4ve`, then parser-fix deployment `dpl_A4aiTGnLWQEA3Lr7RA3WRnZ8QWvZ`, ready and promoted.

Deployments came from the isolated release checkout; ongoing Release B/C working-tree files were not staged or deployed. Dedicated QA accounts were used, with credentials kept only in a mode-600 temporary state file. Live comparison `84`, report `9`, official RBI URL source and synthetic PDF attempt were owner-scoped. Cross-account private-chat, comparison, report and history checks returned empty/404 responses.

## 9. Remaining UX and release debt

1. Re-run post-fix production PDF upload and source-only chat when the environment usage-limit approval gate is available; the fix is locally tested and deployed, but post-fix end-to-end proof is intentionally not claimed.
2. Add a first-party RBI Digital Lending Directions 2025 catalogue record or improve authority/synonym search coverage.
3. Run a representative-user study for clicks, hesitation and time-to-first-use.
4. Re-run production mobile generation and policy-draft generation after the gate clears.
5. Consider replacing the remaining manual collection popup with the new focus primitive.
6. The eight lint warnings are pre-existing and outside V1 scope.

Per the brief’s stop condition, no new feature-development cycle was started after V1.
