# Research Workspace Redesign V1 — UX audit and migration plan

Audit date: 5 September 2026. This document precedes implementation. Scope: information architecture, navigation, interaction, source scope, presentation, and the timestamp regression. Existing uncommitted corpus recovery / Release B changes are excluded.

## Product contract

One question → discover and preview sources → explicit source confirmation → Sources / Chat / Studio → durable conversation and outputs → resume. Discovery must never generate an answer before scope is confirmed. Preserve burgundy `#8f1d2c`, warm cream/ivory, charcoal, beige accents, authentication and evidence safety.

## Current information architecture

Primary sidebar (`WorkspaceShell.jsx`): Research Desk; Search Documents; expanded Browse Libraries (Bills, Acts, Gazette, Policies); Compare; Suggested Reading; Policy Drafter. Profile and sign-out at the bottom. Header command palette is presented as another “Search everything” action.

| Surface | Current route / components | Audit observations |
| --- | --- | --- |
| Research Desk | `/app`; `IntelligenceDashboard`, `DashboardHero` | Large burgundy hero, search, freshness narrative, instructions, three action cards, seven library tiles, ContinueResearch, recommended and recently catalogued records. Advanced platform metrics are already collapsed, but operational freshness remains prominent. |
| Library | `/app?view=documents`; `DocumentExplorer`, `DocumentFilters` | Default `cataloguedAt desc`; production first page dominated by press releases with source-only actions. Repeated headings, instructions, record-count card, separate sort direction, many readiness labels. Advanced filters already collapse. |
| Specialist libraries | `?view=bills`, `?view=acts`, `?view=policies`, `/app/egazette`, `/app/state-bills`, `/app/state-acts` | Much shared DocumentExplorer implementation; deep links remain useful, equal navigation prominence does not. |
| Document workspace | `/app/document/[id]`; `UniversalDocumentRoute`, `DocumentChatLayout` | Good three-part structure, persistent chat, citations, retries, upload support. Sources excludes the open catalogue document. Production displayed “0 selected” alongside “1 sources in context”. Huge summary auto-expands in Studio. Chat answers are heavily boxed; icon-heavy header. |
| Legacy chats | `/app/bill-chat`, `/app/act-chat`, `/app/egazette-chat/[id]` | Preserve routes and canonical document identity. |
| Multi-source chat | `/app/multi-document-chat?ids=…`; `MultiDocumentChat` | Up to five catalogue records plus personal sources; selection-bound persisted history. Main app sidebar plus inner panels can crowd desktop. Personal sources are not restored from last conversation on refresh. |
| Compare | `/app/compare`; `DocumentComparison`, `ComparisonTray`, `ComparisonContext` | Already supports selection, readiness checks, history/versioning/regeneration. Empty production page sends user back to Bills, rather than the unified Library. Contextual tray is useful. |
| Drafting | `/app/policy-drafter`; `PolicyDraftWorkspace` | Own three-column interface inside navigation shell; source selection not transferred from research. Existing generation and authenticated DOCX export; saved draft listing API exists but no clear resume destination. |
| Recommendations / Compliance | `/app/recommend`; `RecommendationSection`, `BusinessProblemRecommender` | Specialist problem form, compliance result and private watchlist creation. Keep engine, move entry under Library/secondary tools and contextual workspace action. Do not change ranking or infer automatic compliance routing in this phase. |
| Reports | Product-intelligence report API; document answer/report exports | Report generation/get/PDF exist; no dedicated frontend report route or list endpoint. Introduce access/composition only, preserve report service and evidence rules. |
| Relationships | `/app/graph/[id]`; `GraphExplorer`, `KnowledgeGraph`, `RelatedDocuments` | Contextual graph links already exist. Graph traversal and saved journeys remain. |
| Account / research history | `/app/profile`; `ProfileView`, `AccountSettings`, `ContinueResearch`, `ComparisonHistory` | Profile mixes personal settings, analytics, chats, comparison history, collections, bookmarks, notes, recommendations, graph journeys and support forms. Existing account data can feed My Research. |
| Mobile | `WorkspaceShell`, `MobileWorkspaceSheet`, chat/draft layouts | Navigation becomes drawer below lg; inner panels use modal sheets. Retain stateful chat when opening panels; provide explicit Sources / Chat / Studio controls. Verify 320–768px after implementation. |

## Overlap, density and reliability findings

1. Sidebar Search Documents, Browse Libraries, header global search, hero search and “Search all documents” overlap. New Research must mean a question; Library must mean document lookup.
2. Bills/Acts/state libraries and library-category tiles duplicate shared discovery routes.
3. Large platform hero and source-health text precede the returning user's recent work.
4. Compare, drafter and suggestions compete with starting research despite depending on source/task context.
5. Source/readiness labels expose processing implementation; label from actual chat capability rather than assuming searchable means answerable.
6. Sources/Chat counts represent different sets. The open document must be visibly included and unavailable sources excluded from active counts.
7. `ContinueResearch` uses `buildResearchHref`, which requires readiness metadata absent from some recent-chat payloads. It falls back to `/app`; resume should use the durable document identity.
8. `DocumentChatLayout.timeLabel()` returns a clock-only string. Welcome message POST passes it to `DocumentChat.validateChatMessageData`, which rejects non-dates. This reproduces the live “Chat message timestamp must be a valid date” banner. Store ISO timestamps, format at rendering; handle legacy/null/invalid display values safely without weakening server validation.
9. Drafting and cross-document chat add inner multi-panel layouts to the app sidebar; reduce shell width/allow collapse and use full research layouts where appropriate.
10. Report/multi-document history have no list UI. Use owner-scoped read composition; no destructive schema migration.

## Production evidence and coverage of audit

Browser inspection in the signed-in production session: `/app`, `/app?view=documents`, `/app/document/1710`, `/app/compare`, `/app/policy-drafter`. Screenshots and accessibility trees are recorded in the Codex task. Document 1710 demonstrates both timestamp and source-count defects. Desktop capture was 1512×855. Recommendation/compliance, graph, profile and mobile structures were traced in the components listed above; additional live captures and width checks are recorded in the final verification report, not assumed passed here. No production generations or data deletion were performed during the initial audit.

## Proposed navigation and routes

Primary: New Research, Library, My Research. Secondary: Profile, Settings, Help, Coverage & Sources. Recent conversations directly resumable. All existing specialist routes remain functional.

| Existing route | V1 destination / compatibility |
| --- | --- |
| `/app` | Quiet New Research with question-first source selection and optional PDF/URL addition |
| `/app?view=documents&q=…` | Retained; unified Library |
| `/app/library` | New canonical Library; accepts query/type filters |
| `/app?view=bills`, `acts`, `policies` | Retained specialist filtered libraries; Library nav active |
| `/app/egazette`, `/app/state-bills`, `/app/state-acts` | Retained specialist entry points from Library |
| `/app/research` | New My Research composition view; conversations, uploads, saved items, comparisons, drafts, reports, monitoring |
| `/app/document/[id]` and legacy chat routes | Retained; consistent source scope, compact Studio, ISO timestamp fix |
| `/app/multi-document-chat` | Retained; question and selected-source handoff, restored scope |
| `/app/compare` | Retained; contextual selection and versioning unchanged |
| `/app/policy-drafter` | Retained; contextual source handoff and saved-output deep links |
| `/app/recommend` | Retained; related-source/compliance entry under secondary tools |
| `/app/graph/[id]` | Retained; Explore relationships in Studio |
| `/app/reports/[id]` | New authenticated view over existing report GET/PDF |
| `/app/profile` | Retained; identity and existing settings remain accessible |
| `/app/settings`, `/app/help`, `/app/coverage` | Focused utilities using existing account/support/coverage capabilities |

## Component plan

| Component | Change |
| --- | --- |
| WorkspaceShell | Three main links; collapsible neutral sidebar; recent links; accessible drawer; quiet command shortcut |
| NewResearch (new) | Single question input, examples/recent work, explicit source preview and confirmation, existing upload/URL adapter |
| DocumentExplorer / DocumentFilters | Ready-to-research default, clear reset to full collection, relevance sort for search, compact trust metadata |
| MyResearch (new) | Compose existing owner-scoped APIs; separate tab/section errors; no invented persistence |
| StudySourcesPanel | Catalogue + personal sources, common active count, previews, source-add controls, plain language, accessible removal |
| DocumentChatLayout / MultiDocumentChat | Preserve generation/persistence flows, scope restoration, query handoff without automatic generation |
| StudioPanel | Compact Create + Saved outputs; summary/timeline/graph/notes available on demand; preserve all workflow prompts |
| ChatMessage / CitationCard / ChatInput / ChatHeader | Readable unboxed assistant text, visible citation controls and provenance, ISO-to-display timestamp adapter, fewer surrounding actions |
| PolicyDraftWorkspace | Use existing generation and exports; initialise selected sources from context and open saved draft by ID |

## Migration and verification sequence

0. Complete this audit before major implementation. Record baseline tests and unrelated dirty files.
1. Navigation, New Research shell, unified Library, My Research composition and recent links. No backend intelligence changes.
2. Sources/Chat/Studio consistency, contextual actions, timestamp regression, responsive controls.
3. Visual polish, accessible names/focus/touch targets, honest loading/empty/error states.
4. Wire question → discovery → preview → explicit confirmation → chat using existing search and generation APIs. Do not present search as a generated answer. Support only real source capabilities. If source-only chat requires compatibility plumbing, reuse existing retrieval/evidence/persistence services and document it; do not introduce a new engine.
5. Frontend tests/lint/build; backend complete test suite and targeted persistence/upload/citation/account-isolation regressions. Browser checks at requested widths and task-based evidence.
6. Commit only redesign-owned files. Deploy from a clean staging checkout/export of that commit so unrelated Release B files cannot ship. Verify aliases and real workflows, then write `RESEARCH_WORKSPACE_REDESIGN_V1_REPORT.md` with measured results and explicit gaps.

## Safety and rollback

No changes to Retrieval V3, PostgreSQL FTS, Pinecone, Evidence Safety, Adaptive Grounded Intelligence, Gemini provider, corpus processing, ranking or vector reconciliation. No new destructive schema. Any metadata/history compatibility additions require owner-scoped queries and regression tests. Preserve old URLs and restore prior deployment if production verification fails. Do not claim the 5–10 second usability target is measured without representative-user observation.
