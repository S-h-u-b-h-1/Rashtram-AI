# National Policy and Governance Source Expansion Report

Verified: 2 July 2026

## Outcome

Production PostgreSQL contains 17,741 canonical documents across 18 populated
source families; 17,334 have PDF URLs. This sprint added real PIB, NITI Aayog,
state-policy, India.gov discovery, and secondary-research coverage without bulk
downloads, OCR, embeddings, or AI generation.

| Source | Source records | Canonical documents | PDFs |
| --- | ---: | ---: | ---: |
| NITI Aayog | 20 | 20 | 20 |
| PIB | 15 | 15 | 1 release-specific attachment |
| Haryana state policy portal | 15 | 15 | 15 |
| Ministry environment guidelines | 36 | 36 | 36 |
| The Policy Edge | 12 | 12 | 0 |
| MyGov | 2 | 2 | 0 |
| RBI sample | 10 | 10 | source-dependent |

India.gov contributed 10 stable document-category directory entries. No
document rows were fabricated because its current public results are
client-rendered.

## Classification and source policy

Universal metadata classifies official government, official regulator,
Parliamentary, state government, Gazette, ministry, secondary research, and
international organization sources. Language, state, country, attribution,
and source URL are retained.

“Policy Edge” resolves to The Policy Edge, an independent open-access policy
publication. Its robots file allows `/category/` and `/p/` while disallowing
APIs, dashboards, and previews. The connector reads only the allowed public
category listing and classifies records as secondary research.

## Coverage and limitations

- Directory discovery contains 53 ministries, 48 departments, and all 36
  states/Union Territories.
- Existing PRS coverage supplies state Acts/Bills; Haryana adds 15 first-class
  policy PDFs.
- Eight regulator connectors have ten stored samples each.
- NCLT CAPTCHA, robots exclusions, TLS failures, and 403 responses are not
  bypassed.
- India.gov result rows remain client-rendered.
- State gazettes and additional ministry/state policy adapters remain the next
  expansion priority.

## Deduplication verification

File records now use each file URL as canonical identity rather than a shared
listing page. Matching covers source identity, canonical/PDF URLs, hashes,
legal identifiers, normalized title plus authority/ministry and year/date,
then bounded fuzzy review. The expanded sample has zero duplicate
source-identity groups and zero repeated per-source URLs.
