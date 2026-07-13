# Research Readiness

## Current readiness state

| Metric | Value |
|---|---:|
| Total documents | 19,307 |
| Research-ready | 1,528 |
| Comparison-ready | 1,528 |
| Processable backlog | 17,075 |
| Readiness conversion rate | 7.91% |
| Processing failure rate | 46.8% |

Readiness conversion rate is `1,528 / 19,307`.

## Quality tiers

Recommended interpretation:

- 90–100: verified research-grade
- 75–89: research-ready
- 60–74: searchable with limitations
- 40–59: partially processed
- below 40: failed or unsuitable

## Mandatory research-ready evidence

- Original source preserved.
- Original file or extractable source page preserved.
- File integrity or source extraction validated.
- Metadata is sufficient for citation.
- Text extraction passes threshold.
- Chunks exist.
- Embeddings or verified local retrieval exists.
- Page/section references exist where possible.
- No critical failure remains.

## Citation requirements

Research answers must include:

- document title;
- source authority;
- authority tier;
- publication/effective date where known;
- page, section, clause, or chunk reference;
- original source link;
- relevant excerpt.

Claims should be labelled:

- directly supported;
- inferred;
- requires professional review;
- insufficient evidence.

## Latest readiness audit

Command:

```bash
npm run research:ready-audit --prefix server -- --per-type=3
```

Result, 2026-07-13:

- Sample size: 33
- Document types sampled: 14
- False-ready cases in sample: 0
- OCR-derived examples included
- Native PDF examples included
- Tier A and Tier C examples included

This sample supports the current readiness gate behavior but is not a full corpus-level legal review.

