# Source Registry

## Purpose

The source registry is the operational source of truth for where documents come from, how authoritative each source is, which connector owns it, and whether the source is healthy.

## Table and view

- Table: `source_registry`
- Operations view: `source_registry_operations`

Migration `012_source_authority_and_canonical_provenance.js` adds:

- `source_domain`
- `authority_tier`
- `supported_document_types`
- `refresh_schedule`
- `last_attempted_refresh_at`
- `documents_discovered`
- `documents_added`
- `documents_updated`
- `failure_count`
- `health_status`
- `parser_version`
- `source_terms_or_usage_notes`

## Authority tiers

| Tier | Meaning | Use in answers |
|---|---|---|
| A | Authoritative legal/regulatory record or official record | Can support direct legal/policy claims if citation is exact |
| B | Official government communication or advisory publication | Can support government-position and policy-context claims |
| C | Recognised institutional/academic research | Can support background or analytical context |
| D | Secondary commentary | Must not be used as primary legal basis |

## Current connector groups

Implemented or represented:

- PRS Legislative Research
- India Code
- eGazette
- Digital Sansad
- Lok Sabha
- Rajya Sabha
- PIB
- NITI Aayog
- MyGov
- India.gov / public listing style sources
- Ministry directory and MoEFCC
- State legislature/directory/gazette/policy frameworks
- Regulators including RBI, SEBI, TRAI, CERC, UIDAI, GST Council, UGC, AICTE, NCLAT and others in registry/connectors
- Policy Edge as secondary research

## Current limitation

Registry presence is not equal to complete coverage. A source should be marked fully reliable only after:

- fixture tests pass;
- discovery is idempotent;
- update detection works;
- parser version is recorded;
- source-health output is bounded and machine-readable;
- stored documents preserve provenance and checksums;
- controlled sample processing succeeds.

## Download failure evidence, 2026-07-13

The source registry should reflect that the largest current acquisition problem is not a generic parser failure. It is concentrated in source download responses:

| Source/domain | Failed downloads | Dominant code |
| --- | ---: | --- |
| `prsindia.org` | 397 | `DOWNLOAD_SERVER_ERROR` |
| `www.policyedge.in` | 29 | malformed/missing direct file URL in stored record |
| `cercind.gov.in` | 13 | mixed download errors |
| `indiacode.nic.in` | 10 | `DOWNLOAD_NOT_FOUND`/access-style permanent failures |
| `nclat.nic.in` | 2 | retriable download errors |
| `cdnbbsr.s3waas.gov.in` | 1 | permanent source failure |

Operational action:

- Keep source records visible but non-ready when download evidence is missing.
- Mark 403/404-style acquisition failures as permanent until source repair.
- Retry 5xx-style failures only in bounded queue batches.
- Do not fabricate direct PDF URLs from listing pages unless the connector can verify the final PDF bytes.
