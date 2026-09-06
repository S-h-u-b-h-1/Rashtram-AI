# Rashtram AI — Comparison and Suggested Research Quality Fix

Status: completion audit in progress on 6 September 2026. Earlier local-completion
and deployment assertions are superseded by the measured audit in
RESEARCH_DISCOVERY_AND_WORKSPACE_QUALITY.md. Network access works when approved;
it is not an inherent environment blocker. Production acceptance remains pending.

The new export retains all persisted findings and legacy section aliases,
preserves citation identifiers, avoids raw object serialization, and bundles
open-license English/Hindi fonts. Saved comparisons 30, 31 and 86 were selected
from the authenticated account's My Research page for read-only export checks.
The first two are historical extractive fallbacks; export compatibility is not
proof of new substantive AI generation. Visual checks exposed malformed source
text and line overflow, which are being addressed without silently regenerating
or replacing the stored comparison. No fresh comparison generation was run yet.

Scope is intentionally limited to the Comparison workflow and Suggested Documents / Recommended Reading. No corpus, connector, search architecture, release, or broad UI redesign changes are included in this pass.

## 1. Comparison: root cause

The previous comparison path treated retrieved passages as a repair source. When the model returned a thin or empty result, `comparisonSectionBackfill` copied passage fragments and metadata into comparison cards. That produced plausible-looking boxes without an analytical relationship between the selected documents. Validation mainly checked whether any field had text and whether one citation existed, so a successful response could still be empty, one-sided, uncited, repetitive, or extractive.

The UI then hid empty sections. A user saw a short “successful” result without knowing which dimensions were actually supported by evidence and which were missing.

## 2. Comparison: new evidence-grounded flow

1. Validate the request (two to five unique documents, supported mode/language, and research-ready source state).
2. Retrieve passages per document and label every passage as `D#-C#`; page/section location is included when available.
3. Send the model a document brief for orientation only plus the labelled passages as the only evidence. The prompt requires cross-document synthesis, exact citation labels for every substantive claim, document-type-aware interpretation, and explicit abstention when evidence is insufficient.
4. Normalize scalar/object/array fields without inventing text. Missing dimensions receive a visible status rather than passage promotion: `available`, `insufficient_evidence`, or `not_applicable`.
5. Validate the generated result. A normal AI result must have a substantive cited summary, cited material analysis, evidence from both documents, at least one comparative cross-document item, comparative language, and no extractive-only or duplicate output.
6. If validation fails, replace the weak analysis with a safe evidence-abstention response. The response lists limitations and suggested next questions; it does not silently manufacture comparison prose.
7. Persist `comparisonSchemaVersion: comparison-quality-v2`, evidence sufficiency, claim verification, citations, and per-section status. The UI renders supported sections and clearly labels unsupported ones.

### Comparison response shape

The analytical response supports these dimensions (legacy names remain readable for compatibility):

`executiveSummary`, `purpose`, `scope`, `applicability`, `keyProvisions`, `similarities`, `differences`, `obligations`, `rights`, `definitions`, `legalEffect`, `timeline`, `stakeholderImpact`, `whatChanged`, `practicalImplications`, `keyTakeaways`, `limitations`, `suggestedQuestions`, and `sectionStatus`.

Each analytical item can carry a topic/dimension, document A and B statements, significance/implication, and a `citations` array containing only valid `D#-C#` labels. `sectionStatus` makes the evidence boundary explicit instead of leaving a blank card.

### Why this is safer

- Retrieved text is never presented as if it were synthesis.
- Metadata is explicitly marked as orientation and cannot satisfy an evidence claim.
- A one-document answer cannot pass as a comparison.
- Every material UI statement has a visible citation path to a source passage.
- “Insufficient evidence” and “not materially applicable” are user-facing outcomes, not hidden failures.

## 3. Comparison QA

Automated coverage now includes:

- analytically empty success is rejected;
- two-document cited synthesis succeeds;
- one-sided document summaries fail cross-document validation;
- citation-free material analysis is rejected;
- extractive-only output is rejected;
- raw passage backfill is never promoted into analysis;
- missing dimensions are marked `insufficient_evidence`;
- metadata from one document is not attributed to the other document;
- request count, duplicate, mode, language, and readiness validation remains covered.

The focused server suite passed 46/46 tests across comparison, recommendation, and evidence-safety coverage. Frontend tests passed 41/41, the production webpack build completed, and ESLint reported 0 errors (8 existing warnings outside this change). The complete backend suite ran 626 tests: 619 passed, 5 failed, and 2 were skipped. The five failures were environment-bound (`listen EPERM` in two rate-limit tests, `listen EPERM` in two downloader tests, and DNS resolution for `example.com`); an escalated rerun was rejected by the host usage gate, so these are reported rather than relabelled as product passes.

Performance: comparison retrieval limits, passage character caps, context token budgets, cache keys, and the 22-second interactive generation budget are unchanged. The quality work adds normalization/validation in-process and includes page/section labels in the existing context. Suggested Documents adds no new retrieval round trip; problem understanding, plan construction, grouping, and explanations are deterministic in-process transforms over the existing candidate query. No migration or broad re-index was introduced.

### Before / after example

Before: a model response with an empty summary could be “repaired” by placing a paragraph from Document 1 into a Differences card and still return success.

After: the same response fails `ANALYTICALLY_EMPTY` or `NON_COMPARATIVE_ANALYSIS`; the user sees an evidence-abstention summary, per-section “Insufficient evidence…” messages, source limitations, and a question asking for a narrower provision/date or another official source.

The requested eight-case live comparison matrix is recorded as pending (not falsely marked pass): Act vs Bill; Act vs amendment; Regulation vs Circular; Policy vs Policy; long document vs long document; related documents with different scope; unrelated documents; and insufficient/one-sided evidence. The first six are the representative relationship/scale cases, while the last two verify honest abstention and non-comparative rejection. The live browser/API run was blocked by the host approval gate.

## 4. Suggested Documents: root cause

The previous recommender had useful deterministic retrieval and authority signals, but the product surface started at a flat list of documents. It did not tell the user how the problem had been interpreted, what research areas should be checked, why a source mattered for this activity/location, or when the catalogue lacked a ready primary official source. Generic reasons made secondary material look interchangeable with governing sources.

## 5. Suggested Documents: new problem-aware flow

1. Parse the user’s problem, industry/topic, location, timeframe, and requested state/jurisdiction.
2. Infer a plain-language intent (for example, starting a business, checking compliance, understanding a law/change, or researching policy), activity, likely regulator, stakeholders, and desired outcome. This is an orientation layer, not legal advice.
3. Build an ordered research plan from the inferred domain and themes: essential governing instrument, customer/worker/environment or data duties as applicable, jurisdiction/currentness, and implementation/reporting areas.
4. Retrieve candidates through the existing catalogue/retrieval path. Existing research-ready, visibility, quality, freshness, semantic, relationship, legal-identifier, jurisdiction, and authority checks remain the ranking inputs.
5. Enrich each candidate with a friendly authority label, priority (`essential`, `important`, or `background`), focus areas, and a specific “why this matters” explanation tied to the activity and jurisdiction. No internal enum is shown as the explanation.
6. Return grouped recommendations plus the problem understanding and research plan. Strong recommendations are capped at eight; the compliance copilot presents its top five while preserving the same grouping metadata.
7. If no ready primary source is available, say so explicitly. Related sources remain available as context, with actions to search the library, add an official URL, or adjust the problem description.

### Suggested Documents response shape

The endpoint now returns `problemUnderstanding`, `researchPlan`, and `recommendationGroups` (`essential`, `important`, `background`) alongside the existing recommendations, inferred signals, coverage class, abstention, and preparation candidates. Each recommendation may include `authorityLabel`, `priority`, `focusAreas`, `whyThisMatters`, and `relevanceExplanation`.

## 6. Suggested Documents QA

Automated coverage confirms that plain-language intent and research-plan helpers are deterministic, authority labels are friendly, weak metadata-only matches remain rejected, grounded catalogue signals still improve ranking, and existing eligibility/comparison-request validation is preserved.

The UI QA checklist covers ten cases: broad problem, specific business activity, state-specific request, regulator named, time-sensitive request, primary official source available, official source gap, background-only results, no results, and adjust-query/search-library/add-source recovery. Local component tests/build pass; live browser/API proof is pending the same environment usage gate.

For repeatable acceptance, those ten cases should record: interpreted problem, research areas, grouped output, authority label, relevance explanation, and whether a primary-source gap is disclosed. The first six are expected to return a grounded reading path; the gap/background/no-result cases must remain explicit and offer recovery actions. None is claimed as a live production pass in this environment.

### Before / after example

Before: “Documents relevant to this problem” showed a flat list with a generic “matches your query” explanation.

After: the user first sees “You are checking compliance requirements for a digital lending platform in India,” the research areas to investigate, then Essential / Important / Background readings. Each card explains why it matters and whether it is a primary official source or supporting context. If the primary source is missing, that gap is explicit.

## 7. Production status and limitations

The implementation is ready for deployment from branch `codex/comparison-suggested-quality-v1`. The frontend was deployed and aliased to `https://rashtram-ai.vercel.app` as `dpl_6GVt5rFff76bGhGfysHZawdkQaQD`; a public `HEAD /` returned HTTP 200. The existing backend alias returned HTTP 200 from `/health`, but a new backend deployment could not be safely selected because the linked Vercel scope did not expose a project named `rashtram-ai-backend`. Authenticated browser/API quality cases were not run because the host rejected the browser/network approval request. No claim of live comparison or recommendation success is made here.

Remaining product work is deliberately outside scope: expanding corpus coverage, changing connectors/search architecture, or starting a broader V2 redesign. The next safe step is to deploy this branch once the environment permits the bounded live QA matrix (up to eight comparison cases and ten recommendation cases) and record the real response payloads.
# Current completion status

See [the 6 September completion audit](COMPLETION_AUDIT_2026_09_06.md). Live comparison 95 failed acceptance; its latest fix is committed locally but deployment is blocked by destination approval. Older statements below must not be treated as a completed live-verification record.
