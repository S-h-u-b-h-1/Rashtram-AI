# Corpus Authority Intelligence

Rashtram AI measures corpus coverage without treating catalogue size as research quality. Run:

```bash
npm run corpus:intelligence --prefix server -- --p2-limit=100
```

Add `--summary` to omit the detailed group breakdowns from terminal output.

The command is read-only. It does not download, extract, embed, or otherwise process P2 documents.

## Coverage dimensions

The report groups public documents by source, source-authority tier, document type, jurisdiction, state, regulator, ministry, and year. Each group reports catalogue, resource, text, lexical-search, semantic-search, and primary-source counts.

A document counts as having primary-source provenance only when its canonical source is authority tier A or one of its recorded source paths maps to an authority-tier-A source. A **primary-source gap** is therefore a measurable candidate for review, not proof that an official replacement URL exists. The system must never invent an official source or silently replace recorded provenance.

## Explainable quality signals

Quality is represented as separate, inspectable signals:

- official primary-source provenance;
- an accessible resource attached to a validated document;
- substantial, limited, or missing extracted text;
- page-coordinate provenance;
- section or clause structure;
- effective-status evidence; and
- pending duplicate-review warnings.

These signals describe corpus fitness. They do not claim that a legal interpretation is correct.

## P2 selection policy

The ranked P2 list is advisory and deterministic. It combines observed 30-day demand, primary-source gaps, regulatory importance, recency, authority, comparison demand, knowledge-layer relevance, existing quality, and benchmark-coverage gaps. Every component is returned with the score so an operator can audit why a record was ranked.

P2 processing remains disabled by this report. A separate, explicitly authorized bounded processing run is required before any document is downloaded or embedded.

## Production baseline

The read-only production report on 21 August 2026 returned:

- 19,911 public catalogue records;
- 18,884 resource-ready records;
- 3,138 text-ready and lexical-search-ready records;
- 192 semantic-ready records;
- 960 records with measured primary-source provenance (4.82% of the public catalogue); and
- 2,941 lexical-search-ready, non-semantic records without measured primary-source provenance.

This phase added measurement only, so corpus coverage before and after the change is identical. It processed zero P2 records and wrote no production data.

## Canonical identity

One canonical document may retain multiple source records and resources. The intelligence report measures those paths without creating duplicate canonical documents, discarding secondary-source provenance, or overwriting a source with a different source's metadata.
