# Temporal Legal Intelligence V1

Temporal research extends Retrieval V3; it is not a second timeline or RAG system. TIMELINE questions retrieve separate recorded dates, verified legal relationships, and ordinary source passages in parallel.

## Date safety

The system keeps these fields distinct:

- publication;
- introduction and passage;
- assent;
- notification;
- effective-from;
- commencement;
- amendment;
- repeal;
- supersession; and
- effective-to/expiry.

No fallback converts a publication date into an effective or commencement date. If no explicit effective/commencement evidence exists, an “as of” assessment is `unknown` even when publication is known.

## Applicability language

Temporal resolution returns `not_yet_effective`, `potentially_effective`, `no_longer_effective`, or `unknown`. “Potentially effective” is deliberately conditional: it reflects recorded metadata and source-verified relationships, not a legal-opinion guarantee.

FY expressions are represented as a date range. Unknown dates remain null. The service does not infer dates from a title or year.

## Version and relationship safety

The temporal relationship vocabulary reuses the existing evidence-backed graph: AMENDS, REPEALS, SUPERSEDES, COMMENCES, and IMPLEMENTS plus their inverse forms. Only relationships marked by explicit-source evidence can enter the temporal passage set. Similar titles and model-only inferences are excluded.

Before/after research continues to retrieve original passages from both instruments. A temporal metadata passage can guide selection and explain dates, but it cannot replace the text of the previous or current provision. Missing historical text must be reported as unavailable from currently verified sources.
