# Evidence Safety V1

Evidence Safety V1 adds a bounded safety layer around Retrieval Engine V3. Its objective is not to promise zero hallucination. It prevents unsupported factual claims from being presented as established source facts.

## Request path

1. Retrieval V3 supplies ranked, deduplicated passages and verified graph evidence.
2. The safety service assesses whether the available evidence is sufficient before generation.
3. Gemini receives only the bounded context and explicit grounding constraints.
4. The completed answer is parsed into claims.
5. Factual claims are checked against their cited passage, an immediately neighboring passage from the same document, and preserved source metadata.
6. Unsupported factual lines are removed in one bounded repair pass. If unsafe claims remain, the response abstains.
7. Only the verified or repaired response is delivered and persisted.

The same path protects single-document chat, multi-document chat, and structured comparisons.

## Sufficiency algorithm

The assessment combines:

- retrieval relevance;
- question-to-evidence lexical alignment;
- source authority;
- number of usable passages;
- independent source count;
- document/retrieval readiness;
- exact section or clause matches; and
- conflicting evidence.

No single vector or lexical score is treated as truth. A detected material conflict returns `CONFLICTING` rather than silently selecting one source. Possible levels are `HIGH`, `MEDIUM`, `LOW`, `INSUFFICIENT`, and `CONFLICTING`.

Every assessment also returns an explicit decision (`SUFFICIENT`, `LIMITED`, `ABSTAIN`, or `CONFLICT`) and named signals instead of requiring consumers to interpret an opaque number. Signals describe retrieval strength, query/evidence alignment, exact-reference matching, source authority, source diversity, evidence coverage, source consistency, and verified document capabilities. The numeric score remains available for diagnostics, but the decision and signals are the public reasoning contract.

The thresholds are configurable:

```text
EVIDENCE_HIGH_THRESHOLD=0.72
EVIDENCE_MEDIUM_THRESHOLD=0.50
EVIDENCE_LOW_THRESHOLD=0.30
EVIDENCE_SUPPORT_OVERLAP=0.12
EVIDENCE_PARTIAL_OVERLAP=0.06
EVIDENCE_MAX_REPAIR_ATTEMPTS=1
```

The maximum repair count is clamped to one even if a larger environment value is supplied.

## Abstention and source-only fallback

`INSUFFICIENT` evidence returns a transparent response explaining that the available sources cannot answer reliably and, where available, identifies the searched documents and missing evidence. `CONFLICTING` evidence shows both retrieved positions and asks the researcher to check effective dates and original official records.

If Gemini is unavailable but passages exist, the existing source-only behavior remains: the API returns short retrieved excerpts with their actual citation labels and explicitly says that no additional interpretation was generated. Missing page, section, clause, or URL metadata is never invented.

## Generation constraints

Grounded prompts require Gemini to:

- use retrieved passages for factual claims;
- attach the exact existing citation label to factual statements;
- distinguish analytical implications from source facts;
- state uncertainty and abstain when evidence is absent;
- never invent dates, sections, amendments, institutions, legal effects, pages, clauses, or relationships;
- treat verified graph relationships as navigation/context rather than primary legal evidence;
- never treat document summaries, earlier assistant messages, or model knowledge as proof; and
- use researcher-added material only when the authenticated researcher selected it.

## Claim types and validation

Claims are classified as:

- `SOURCE_FACT` — material factual and legal claims are strictly citation-checked;
- `ANALYTICAL_INFERENCE` — must be visibly framed as inference;
- `RECOMMENDATION` — advice rather than a claimed source fact; or
- `UNCERTAINTY` — an explicit evidence limitation.

Factual claim states are `SUPPORTED`, `PARTIALLY_SUPPORTED`, `UNSUPPORTED`, or `CONFLICTING`. Validation checks the cited evidence only. It does not search the internet or use unrelated documents. Numeric claims must preserve a number found in the supporting evidence.

Strict verification is scoped to material factual/legal assertions: numbers, legal instruments or provisions, named public bodies, jurisdictions, duties, powers, deadlines, penalties, amendments, exemptions, and similar claims that could affect a research conclusion. Non-material connective or stylistic prose is marked `non_material` and does not fail merely because it has no citation. Manually supplied verifier claims remain strict by default unless they explicitly set `material: false`.

Structured comparisons validate every detailed item and repair an unsupported executive summary with a neutral description of the remaining verified findings.

## Repair and conflict policy

The repair loop is deliberately bounded:

1. remove an unsupported factual line when safe;
2. re-check the repaired response once;
3. abstain when the repaired result is empty or remains unsupported.

Provider, verifier, and repair failures all fail safely. The deterministic verifier remains available if an optional verifier fails. Conflicting close-match sources with materially different rates, amounts, deadlines, dates, limits, or penalties are surfaced rather than resolved by the model.

## Privacy

Researcher-added sources remain selected and queried with `user_id` ownership constraints. Verification receives only the authenticated account's selected chunks. It does not widen source access or persist private material as shared authority.

## Observability

SSE and persisted multi-document messages include:

- evidence sufficiency level, decision, explainable signals, score, reasons, and version;
- generation mode;
- verifier version;
- unsupported claims before and after repair;
- repair count;
- abstention status; and
- provider fallback status.

Raw internal claim objects are not sent to the browser or persisted.

## Tests

`server/test/evidenceSafetyV1.test.js` covers exact-section evidence, low evidence, unsupported claims, inference classification, positive and negative citation support, conflicting sources, missing metadata, provider failure, verifier failure, failed bounded repair, final abstention, private-source isolation, neighboring evidence, and structured comparison repair.

The full backend and frontend regression suites, frontend lint, and production build are required before release.

## Latency and limitations

Safety verification is deterministic and local, so its computation is small compared with retrieval and generation. To ensure unsafe generated text never reaches the browser, generated output is held until the bounded verification pass finishes and is then emitted in small SSE chunks. This can delay the first answer token by approximately the provider's generation duration, while avoiding a second AI call in the normal path.

Lexical claim support is deliberately conservative. Complex paraphrases may be removed even when a human would consider them supported. Conflict detection focuses on closely aligned numeric/legal facts and cannot replace version-aware legal review. Researchers should continue verifying important conclusions against the linked original records.
