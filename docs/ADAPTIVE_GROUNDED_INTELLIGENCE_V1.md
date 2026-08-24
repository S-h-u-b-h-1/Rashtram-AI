# Adaptive Grounded Intelligence V1

Rashtram AI uses Retrieval Engine V3 as its canonical evidence path. Adaptive
Grounded Intelligence changes generation policy, not retrieval ownership.

## Answer hierarchy

1. Current verified authoritative evidence
2. Original evidence from the selected document
3. Verified related sources
4. Stable general knowledge
5. Clearly labelled analysis, perspective, or hypothetical reasoning

The selected source remains authoritative for what that source says. General
model knowledge cannot add or override a provision, date, institution, duty,
penalty, legal effect, or document relationship.

## Shared decision layer

Every generated answer receives:

- an answer intent such as source fact, explanation, analysis, implication,
  critique, perspective, hypothetical, current status, comparison, compliance,
  timeline, drafting, or general context;
- a freshness class: static, document-bound, time-sensitive, or current status;
- a requested answer style derived from the latest user instruction;
- a task-specific Gemini generation profile;
- the selected evidence and, when required, current-status verification state.

The same prompt policy is used by document chat, multi-document and comparison
chat, comparison generation, and policy drafting. Compliance remains stricter:
licences, registrations, deadlines, penalties, obligations, and statutory
applicability always require evidence.

## Facts versus reasoning

Evidence Safety classifies material generated claims as source facts, external
facts, inferences, perspectives, or hypotheticals. Source facts and changing
external facts require a cited evidence passage. Analytical statements do not
need to appear verbatim in a source, but their supporting factual premises are
verified and retained as an internal citation trace.

Stable general concepts can be explained without a document citation. This
exception never applies to current laws, regulators, office-holders, document
status, market figures, or amendment status.

## Freshness and contradictions

Questions such as “Is this Bill still pending?” route through temporal
retrieval. Verified amendment, repeal, replacement, and supersession
relationships are loaded alongside the selected document. Evidence includes
publication, effective, commencement, indexed, and authority metadata where it
is known.

Current verification also checks the relevant connector health and the most
recent successful refresh. A connector that is stale, degraded, blocked, or in
error cannot support an unqualified current-status answer. If no later
authoritative evidence is available, Rashtram states what the selected document
says and explicitly says that the current position could not be verified. The
absence of a later indexed instrument is never treated as proof that none
exists.

When older and newer verified evidence conflicts, both positions must remain
visible with their dates and sources. Newer official evidence takes precedence
for the current position; it does not rewrite what the older document said.

## Conversation behavior

Recent conversation turns may resolve pronouns, preferred depth, tone, and
perspective. They are never factual evidence. The newest user direction wins,
so a researcher can move from defence to critique, business to government, or
fact to hypothetical without being anchored to the prior framing.

## Model profiles

- Evidence extraction: low temperature and narrow sampling.
- Grounded analysis: moderate, bounded flexibility.
- Comparison: moderate synthesis with structured JSON and verified premises.
- Policy drafting: bounded creative recommendations, clearly separated from
  existing evidence or law.

All profiles use configured environment overrides when present. Relevant
settings include `CHAT_AI_TEMPERATURE`, `CHAT_AI_TOP_P`,
`CHAT_AI_MAX_OUTPUT_TOKENS`, `COMPARISON_AI_TEMPERATURE`,
`COMPARISON_AI_TOP_P`, `COMPARISON_AI_MAX_OUTPUT_TOKENS`,
`POLICY_DRAFT_AI_TEMPERATURE`, `POLICY_DRAFT_AI_TOP_P`, and
`POLICY_DRAFT_AI_MAX_OUTPUT_TOKENS`.

## Verification fixtures

The automated suite covers intent and freshness decisions, source-versus-model
precedence, stable general knowledge, current-status abstention, connector
failure, older and superseding instruments, perspective and hypothetical claim
classification, analytical citation traces, unsupported legal facts,
comparison analysis, Evidence Safety, drafting, compliance, temporal reasoning,
and Retrieval V3 regression.

