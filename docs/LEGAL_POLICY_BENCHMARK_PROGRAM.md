# Rashtram Legal & Policy Benchmark Program

Status: engineering foundation complete; human review pending.

The benchmark is intended to grow to 250–500 genuinely reviewed cases. AI-
generated drafts remain `AUTO_GENERATED_DRAFT` and must never be presented as
legal accuracy. Review maturity is tracked as `AUTO_GENERATED_DRAFT`,
`INTERNAL_REVIEWED`, `DOMAIN_REVIEWED`, `EXPERT_VERIFIED`, or `REJECTED`.

## Target composition

Use stratified sampling rather than a single random catalogue sample:

| Dimension | Target guidance |
|---|---|
| Instruments | Acts, Bills, Rules, Gazette notifications, committee material |
| Regulators | RBI, SEBI, IRDAI, PFRDA, CCI, TRAI and other verified regulators |
| Government | Ministry documents, central policy, state legislation and notifications |
| Query types | All nine Retrieval V3 query types |
| Safety | At least 15% unanswerable/conflicting/outdated-source controls |
| Versions | Effective-date, multi-version and amendment questions |
| Geography | Central plus a balanced, published state/jurisdiction matrix |
| Difficulty | Easy, medium and hard; avoid title-only dominance |

Each review tranche should be small enough for source verification (for
example, 25 cases) and should publish its maturity composition separately.
Cases must preserve expected documents/resources, source coordinates, bounded
gold passages, acceptable evidence variants, answerability, conflict and date
context, authority expectation, reviewer role, review timestamp, notes and
benchmark version.

## Workflow

1. Draft or sample a case and keep it `AUTO_GENERATED_DRAFT`.
2. Validate the schema and open the original authoritative resource.
3. Run Retrieval V3 and generate a review pack with `eval:review`.
4. Review evidence, answer, citations and abstention; vector scores are hidden.
5. Record the decision and role. Do not invent reviewer identities.
6. Promote maturity only after the required review actually happened.
7. Retain flawed cases as `REJECTED` for audit history.
8. Report automated metrics separately from reviewer decisions.

The machine template is
`server/evaluation/benchmarks/expert-template-v1.json`; the canonical schema is
`server/evaluation/benchmarks/schema-v1.json`.
