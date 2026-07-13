# Human Review Guide for Research Benchmark Outputs

The research benchmark can export a human-review pack:

```bash
npm run eval:research --prefix server -- \
  --limit=50 \
  --top-k=10 \
  --output-json \
  --output-markdown \
  --output-review-json \
  --output-review-csv
```

Use `--retrieval-only` when provider quota or credentials prevent model generation. In that case, the review pack validates retrieval and citation readiness only.

## What reviewers should inspect

For each row:

1. Read the question and expected document IDs.
2. Open the top retrieved chunks listed in `topResults`.
3. If `generatedAnswer` is present, verify every substantive claim against the listed chunks.
4. Mark `reviewerDecision` as:
   - `pass`
   - `minor_issue`
   - `fail`
   - `insufficient_evidence_expected`
5. Use `reviewerNotes` for unsupported claims, missing citations, wrong documents, or ambiguous evidence.

## Pass criteria

A row passes when:

- The expected document appears in the top retrieved results.
- Comparison questions retrieve evidence from every compared document.
- Generated answers cite supplied evidence labels.
- Negative-control questions admit insufficient evidence instead of inventing facts.
- Inferences are clearly labelled as implications, not source-stated facts.

## Fail criteria

A row fails when:

- The answer cites a document not present in the retrieved evidence.
- The answer invents a legal obligation, deadline, authority, or relationship.
- A comparison answer relies on only one side of the comparison.
- A negative-control answer fabricates a regulation or compliance date.
- A Hindi or bilingual source is translated in a way that drops material meaning.

## Reporting limitations

The benchmark report deliberately separates:

- retrieval metrics,
- provider-generated answer review,
- deterministic citation proxy checks,
- human reviewer decisions.

Do not merge these into one “accuracy” score without preserving the underlying evidence.
