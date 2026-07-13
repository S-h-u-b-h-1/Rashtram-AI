# Research Evaluation Status

Last updated: 2026-07-13

## What the current benchmark is

`npm run eval:research --prefix server` builds a synthetic regression set from current research-ready catalogue records. Questions quote exact stored titles and check whether the catalogue resolver returns the seeded records. It also includes synthetic negative controls.

This is useful for detecting retrieval regressions. It is not an independent legal-research accuracy benchmark because:

- the questions and expected IDs are generated from the same catalogue;
- exact quoted titles are substantially easier than open-ended research questions;
- there have been zero completed formal human/legal reviews;
- required-fact and unsupported-claim adjudication is not automated reliably;
- provider usage wrappers do not currently expose a trustworthy monetary cost.

## Historical result and correction

Commit `b18c916` reported a 50-question run with Recall@10, comparison Recall@10, citation proxy, and negative-control accuracy all equal to 1.0, with average retrieval latency of 1,054.5 ms. Five bounded questions used Gemini generation.

Those figures must be described as a **synthetic catalogue resolver regression result**, not product-wide research accuracy. The comparison evaluator passed expected document IDs directly into per-document retrieval, making perfect comparison recall tautological. This audit removes that expected-ID injection.

The prior “unsupported-claim rate: 0” was also not a valid generated-answer metric: generated positive answers were assigned `unsupportedClaim: false` without claim-level review. The evaluator now reports `requires_human_review`; the aggregate rate stays unmeasured until decisions exist. Unknown generation cost is now `null`, not `$0`.

## Current evaluation behavior

- Expected document IDs are used only for scoring, never as retrieval inputs.
- Quoted-title retrieval balances result allocation without inspecting expected IDs.
- Generated citations are validated against available evidence labels.
- Citation completeness checks whether expected retrieved documents were actually cited.
- Factual correctness, inference quality, and unsupported claims require human review.
- The JSON/CSV review export remains the path for faculty, policy, or legal adjudication.

## Claims that are permitted

- “The platform has a 50-question catalogue-derived retrieval regression framework.”
- “A historical self-seeded run resolved all expected exact-title records within top 10.”
- “Generated-answer review exports and reviewer guidance exist.”

## Claims that are not permitted

- “Rashtram AI is 100% accurate.”
- “Citation correctness is independently proven at 100%.”
- “Unsupported claims are zero.”
- “The benchmark proves production-grade legal accuracy.”
- “The benchmark is human reviewed.”

## Required next evaluation

Build an independent set of at least 100 questions authored and reviewed by faculty, policy researchers, law students, or legal professionals. It should include open-ended retrieval, clauses, amendments, supersession, source conflicts, state comparisons, realistic insufficient-evidence cases, and claim-to-citation adjudication.

