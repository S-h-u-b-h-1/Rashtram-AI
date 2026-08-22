# Research readiness and compliance retrieval audit

Date: 22 August 2026

Mode: read-only production audit, followed by bounded code fixes

Database: production PostgreSQL (Neon)

## Canonical capability contract

Rashtram AI now treats capabilities as separate facts:

1. `catalogued`
2. `resourceReady`
3. `textReady`
4. `searchReady`
5. `semanticReady`
6. `chatReady`
7. `comparisonReady`

Lexical PostgreSQL retrieval is sufficient for `searchReady`, `chatReady`, and (with stable evidence identity) `comparisonReady`. Pinecone/Gemini semantic coverage is an optional additional capability and does not remove otherwise valid lexical research access.

## Production corpus baseline

| Stage | Documents |
| --- | ---: |
| Public catalogue | 19,921 |
| Resource ready | 19,155 |
| Text ready | 3,379 |
| Search ready | 3,379 |
| Chat ready | 3,379 |
| Comparison ready | 3,379 |
| Semantic ready | 443 |
| Not search ready | 16,542 |
| Automatically recoverable | 16,264 |
| Manual/restricted | 278 |

Primary non-ready classes:

| Failure class | Documents |
| --- | ---: |
| No valid chunks | 14,947 |
| Resource fetch failed | 766 |
| PDF download failed | 397 |
| PDF OCR failed | 326 |
| Dead letter | 99 |
| FTS/index verification failed | 6 |
| Processing pending | 1 |

Recovery groups:

| Group | Documents |
| --- | ---: |
| Cheap automatic recovery | 594 |
| Native extraction | 15,198 |
| Selective OCR | 326 |
| HTML preparation | 146 |
| Manual/restricted | 278 |

The audit assigns exactly one primary failure class and one recovery group to each non-ready record. Ready records intentionally have neither.

## Measured preparation timings

These values are calculated from completed production processing jobs, not a hardcoded estimate.

| Recovery group | Completed samples | Average | P50 | P95 |
| --- | ---: | ---: | ---: | ---: |
| Native extraction | 845 | 16.5 s | 17.5 s | 22.9 s |
| Selective OCR | 26 | 28.5 s | 29.4 s | 61.9 s |
| HTML preparation | 247 | 28.0 s | 28.5 s | 31.6 s |
| Large document | 1 | 123.2 s | 123.2 s | 123.2 s |

No whole-corpus ETA is stated because the cheap-recovery group has no reliable group-specific production timing. The audit leaves this value null instead of substituting a guessed global average.

## Preparation decision

No bulk or P0/P1 preparation was started during this release. The database measured 492,847,104 bytes during the audit, above the repository's 82% bulk-processing pause threshold for the configured 512 MiB capacity. This is an intentional safety stop. P2/P3 work was not started, and manual/restricted records were not retried.

## PolicyEdge contract verification

The root cause was a serializer mismatch: the list query exposed legacy readiness values but omitted the accessible-resource/capability state used by the mapper. For HTML records without `pdf_url`, the mapper reconstructed `hasAccessibleResource` as false and disabled Research, while the badge still rendered the stored `comparison_ready` state.

Five real no-PDF PolicyEdge records were verified through the corrected serializer:

| ID | Title | Search/chat/comparison | Semantic |
| --- | --- | --- | --- |
| 24562 | Monsoon Session Passes 12 Bills with Lok Sabha Productivity at 19% | Ready | Ready |
| 24218 | Indian Railways Begins Next-Generation Ticketing Upgrade as Online Bookings Reach 89% | Ready | Ready |
| 24227 | MEA Clarifies Bangladesh's BRICS Role and Positions on Trade, Borders and Water Treaties | Ready | Ready |
| 23900 | Samudra Manthan Uses Public Risk-Sharing to Accelerate Deepwater Exploration | Ready | Ready |
| 23901 | Revamped Khelo India Scheme Creates a Pathway from Schools to Olympic Preparation | Ready | Ready |

All five have no PDF and remain valid first-class HTML research sources.

## Business/compliance relevance safeguards

The recommendation path now separates:

- candidate discovery;
- high/medium relevance recommendations;
- passage-level compliance evidence.

Hard gates cover business activity/sector anchors, jurisdiction, authority, document type, and indexed evidence. Official authority cannot rescue an irrelevant document. Low-confidence results remain in a separately labelled discovery section. Obligations, permissions, deadlines, penalties, prohibitions, and exemptions require a relevant normative passage and retain document/citation identity. Metadata is never converted into a duty. Secondary-only evidence shows a primary-source gap; insufficient evidence produces an explicit abstention.

The fixture suite includes NBFC digital lending, EV battery recycling, food manufacturing, insurance intermediaries, SaaS/data protection, five state jurisdictions, weak input, no-evidence, secondary-only, and irrelevant-official distractors.

## Release gates

- Backend: 498 tests, 497 passed, 1 intentionally skipped, 0 failed.
- Frontend: 7 tests passed.
- ESLint: 0 errors (pre-existing warnings remain).
- Next.js production build: passed.
- Database verification: all checks passed.
- RAG regression: passed; recall@10 1.0, citation precision 1.0, unsupported factual claim rate 0.
- Server production dependency audit: 0 vulnerabilities.

This report does not claim legal accuracy from automated fixtures. Production recommendations and compliance findings remain research assistance and require source verification.
