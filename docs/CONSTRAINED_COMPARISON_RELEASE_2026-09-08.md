# Constrained release continuation — 8 September 2026

## Independent decisions

Comparison V2: candidate acceptance passed; production certification pending below.
Policy Drafting V2: PARTIAL, preserved on codex/comparison-drafting-v2 at 3cdfb0b.
The release restores all policy implementation/test files and policy-related shared
API/provider changes to github/main (6beb62b). It does not ship the failed drafting candidate.

## Source and root cause

Stored document 83, The Digital Personal Data Protection Bill, 2023:
chunk 4850 (index 6) contains section 9 and subsection (4); chunk 4851
(index 7) continues it; chunk 4864 (index 20) independently cross-references
section 9(4). The exception concerns subsection (1)/(3), prescribed classes
of Data Fiduciaries, purposes and conditions. Section 8 does not support
the generated attribution.

Saved draft 23 already contains the wrong section 8 reference: the error entered
the generated draft, not DOCX conversion. No post-generation legal-reference check
rejected it. Historical exact retrieval context was not retained, so passage clipping
cannot be established as the definitive upstream cause.

## Drafting candidate only

A narrow original-evidence guard withholds unsupported explicit legal/numeric
statements before persistence/output; it does not guess replacement references.
Templates and summaries are not original factual authority. Five guard fixtures pass.
The incomplete-stream guard passes; unfinished provider completion is rejected.

Exactly one generation per workflow in this continuation: default draft 24 and
user-template draft 25. Both saved, reopened and exported. All seven default and
five user-template DOCX pages were visually inspected. No raw Markdown/overflow or
incomplete sentence was seen; template marker did not leak and source IDs excluded
the template. However, omissions leave an empty background, duplicated purpose in
the executive summary, repeated drafting notes, and a numbered list starting at 2.
The guard also does not establish all numeric-free legal paraphrases. Therefore
neither draft receives factual/product acceptance. No second generation was attempted.

## Comparison smoke before release

Haryana 133: five supported findings, ADDENDUM_TO.
DPDP 134: twelve primary findings, NO_VERIFIED_RELATIONSHIP, not BILL_TO_ACT.
Unrelated 136: zero findings, NO_VERIFIED_RELATIONSHIP.
All regenerated with identical factual fingerprints and downloaded saved-report PDFs.
The UI/PDF no longer render the additional 132-item appendix. Evidence remains expandable.

## Gates

Full candidate: 807 backend passes, two skips; 61 frontend passes.
Comparison-only release: 793 backend passes, two skips, zero failures;
60 frontend passes; lint zero errors/eight pre-existing warnings;
Next.js webpack production build passed; diff check passed.
An initial sandbox DNS failure and external-symlink Turbopack failure were environmental;
the unchanged suites/build passed with network permission and webpack.
Database verification and process audit were read-only with unchanged fingerprints.
20,224 catalogue records; 17 existing readiness mismatches observed, none modified.
No apply flag, public-source mutation, corpus recovery or semantic backfill.

## Remaining scope

Production deployment IDs, alias smoke and QA cleanup will be appended after release.
RA-T003/006/007 should use their own bounded acceptance evidence; these comparison
checks do not certify them. Release E is not started. Further drafting correction is
a separate bounded task, not another comparison redesign.
