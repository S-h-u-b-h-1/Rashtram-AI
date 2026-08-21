# Semantic Coverage & Corpus Quality V1

Verified against the production-linked PostgreSQL database and Pinecone on
21 August 2026. This report distinguishes capability flags from vectors that
are actually recorded in the active Gemini namespace.

## Production baseline

| Measure | Verified value |
|---|---:|
| Public catalogue | 19,911 |
| Resource ready | 18,884 |
| Text ready | 3,138 |
| Search ready | 3,138 |
| Previously marked semantic ready | 1,573 |
| Active, version-consistent and retrieval-verified semantic documents | 31 |
| PostgreSQL active-namespace references on those documents | 310 |
| Pinecone active-namespace vectors | 302 |
| Effective semantic coverage of search-ready documents | 0.99% |
| Search-ready documents without verified active semantic coverage | 3,107 |

The active embedding configuration is Gemini `gemini-embedding-001`, 768
dimensions, namespace `gemini-embedding-001-768-v1`.

The old capability count was not a reliable active-vector count. It included
1,542 documents whose vector references predated namespace/version metadata.
Another 1,565 documents use the lexical/local fallback and have not had an
active Gemini embedding attempt. PostgreSQL records eight more active
references than Pinecone reports, so the namespace is also not fully
consistent.

### Backlog diagnosis

| Reason | Documents |
|---|---:|
| No active embedding attempt / lexical fallback | 1,565 |
| Old unversioned embedding namespace | 1,542 |

The deterministic static priority audit classifies 145 documents as P1 and
2,962 as P2. No P0 documents are currently measurable because there were zero
document-linked activity events in the allowed 30-day aggregate window.
Demand-weighted semantic coverage is therefore unavailable, not zero and not
estimated.

Primary-source gaps are material. All five search-ready India Code documents,
all four eGazette documents, all 15 UIDAI documents, and all 14 Ministry of
Environment documents currently lack verified active semantic coverage. Only
31 documents across the entire search-ready corpus meet the active namespace
and retrieval-verification contract.

## Priority formula

Semantic backfill reuses the existing queue priority model and assigns a
deterministic tier and score. It does not use an LLM.

- P0: an explicitly requested document or aggregate demand in the last seven
  days.
- P1: primary/high-authority and strategically important records, or score at
  least 390.
- P2: score at least 220, or aggregate 30-day access/comparison demand.
- P3: remaining long-tail material.

Score inputs are authority tier, primary-official source identity, document
type, recency, configured source priority, quality score, aggregate access and
comparison counts, and bounded knowledge-evidence relevance. No raw query or
private user identifier is read or persisted by the prioritiser.

## Reusable backfill path

`semantic:backfill` targets public `SEARCH_READY` documents whose active
semantic state is missing or inconsistent. It loads existing chunks only:

```text
stored chunks
→ verify embedding-input hash and namespace
→ reuse compatible vectors or embed only changed chunks
→ index in active namespace
→ query the document through semantic retrieval
→ mark semantic ready only after a relevant chunk is recovered
```

It never downloads a source, repeats extraction, or invokes OCR. A successful
Pinecone write alone does not set semantic readiness. A failed semantic probe
keeps PostgreSQL lexical search available and leaves `semantic_ready=false`.

The command is capacity bounded, rechecks capacity between groups, stops after
three consecutive provider/vector failures, excludes private/account-owned
sources from the public namespace, and defaults to documents with at most 100
chunks. Large documents require an explicit `--max-chunks` override.

```bash
npm run semantic:audit --prefix server
npm run semantic:backfill --prefix server -- --limit=5 --priority=P1 --dry-run
npm run semantic:backfill --prefix server -- --limit=5 --priority=P1
```

The legacy `embeddings:recover` entrypoint delegates to this path. Provider and
model overrides are refused because equal-dimensional embeddings from
different models are not reusable.

## Capacity gate and rollout status

The required P1 dry run selected five documents containing 23 chunks and an
estimated 24,767 embedding-input tokens. It performed zero downloads and zero
OCR pages.

No production embeddings were generated. The database capacity guard reports:

| Measure | Value |
|---|---:|
| Database bytes before additive indexes | 484,941,824 |
| Database bytes after additive indexes | 485,359,616 |
| Configured maximum | 536,870,912 |
| Usage | 90.41% |
| Required pause threshold | 82% |
| Safe batch size | 0 |

Running a canary while the safe batch is zero would violate Processing V3's
non-negotiable guard. The production rollout is intentionally paused until
database headroom is restored or the configured database capacity is safely
increased. No capability flags were bulk-rewritten because that would add
avoidable database churn at critical capacity; internal semantic coverage
instead derives active truth from namespace metadata and verification state.

## Evaluation baseline

The reviewed CI fixture baseline remains unchanged:

| Metric | Before | After |
|---|---:|---:|
| Recall@10 | 1.000 | Not measured—no backfill allowed |
| MRR | 0.875 | Not measured—no backfill allowed |
| nDCG@10 | 0.724085 | Not measured—no backfill allowed |
| Citation precision | 1.000 | Not measured—no backfill allowed |
| Citation recall | 1.000 | Not measured—no backfill allowed |
| Unsupported factual claim rate | 0.000 | Not measured—no backfill allowed |
| Abstention precision | 1.000 | Not measured—no backfill allowed |
| Abstention recall | 1.000 | Not measured—no backfill allowed |

These are five stable synthetic CI cases, not a legal-accuracy claim. Benchmark
baselines were not modified.

Production research telemetry contains no query records in the current 24-hour
window, so representative METADATA, EXACT_REFERENCE, FACTUAL, SEMANTIC,
COMPLIANCE, POLICY_ANALYSIS, and COMPARISON latency/cost changes cannot be
measured honestly. The dry run supplies only the embedding-token estimate
above. Query Planner behavior remains unchanged and continues to avoid vector
calls for metadata and exact-reference questions.

## Internal observability

The existing authenticated operations response now includes:

- effective search/semantic coverage and capability-flag discrepancy;
- backlog reasons and P0–P3 distribution;
- source, authority, type, year, and jurisdiction breakdowns;
- privacy-safe demand-weighted coverage or an explicit unavailable state;
- semantic backfill attempts, success/failure rates, reuse/generation counts,
  24-hour throughput, and average duration.

No raw question, source passage, assistant answer, account identifier, token,
or credential is added to semantic telemetry.

## Release continuation gate

After capacity becomes healthy:

1. rerun `semantic:audit` and save the new before snapshot;
2. run a maximum five-document P0/P1 canary;
3. confirm database, Gemini and Pinecone health;
4. confirm every successful document passes its retrieval probe;
5. rerun the unchanged RAG benchmark and compare honestly;
6. inspect semantic telemetry before increasing to the next bounded group.

Knowledge extraction is not triggered by this workflow.

## Verification completed

- Backend: 396 passed, one intentional database-write fixture skipped.
- Frontend: 4 passed.
- Frontend lint: passed.
- Frontend production build: passed.
- RAG CI regression gate: passed without baseline modification.
- Backend production dependency audit: zero known vulnerabilities.
- Capacity-guard execution: requested five, effective zero, zero document writes.
- Operations-service smoke: passed against the production-linked database.

The frontend dependency audit separately reports four pre-existing high-severity
advisories in the pinned Next.js dependency chain. This sprint does not force a
framework upgrade because that would be an unrelated release change; it must be
handled as a dedicated, tested dependency-upgrade task.
