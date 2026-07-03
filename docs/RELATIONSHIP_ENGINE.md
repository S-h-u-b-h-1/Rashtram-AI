# Relationship Engine

## Supported relationships

The engine supports amendment, repeal, implementation, supersession,
replacement, reference, explanation, notification, policy hierarchy,
jurisdiction equivalence, delegated legislation, compliance, and Bill-to-Act
lineage. Directional relationships store an inverse, including:

- `AMENDS` / `AMENDED_BY`
- `REPEALS` / `REPEALED_BY`
- `IMPLEMENTS` / `IMPLEMENTED_BY`
- `BECAME_ACT` / `ENACTED_FROM`
- `PARENT_POLICY` / `CHILD_POLICY`

## Discovery sequence

1. Candidate selection from identifiers, ministry, category, and title tokens.
2. Exact legal-reference and extracted-text checks.
3. Document-type rules such as Rule-to-Act and Bill-to-Act.
4. Normalized-title similarity and state-equivalence checks.
5. Optional OpenAI verification for plausible non-conclusive candidates.
6. Confidence thresholding and idempotent persistence.

Run a bounded batch:

```bash
npm run graph:discover --prefix server -- --limit=100 --offset=0
```

Use `--verify-ai=false` for deterministic extraction only.

Confidence measures evidence support; strength measures practical closeness.
Similar titles alone can never produce amendment, repeal, or implementation
claims. Unsupported or low-confidence AI results are discarded.

